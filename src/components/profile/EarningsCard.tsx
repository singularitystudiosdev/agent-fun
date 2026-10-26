import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatBountyAmount } from '../../lib/bounty';
import { earningsSeries, type EarningsRange, type EarningsSeries, type PastResult } from '../../lib/profile';
import { FOCUS_RING, HEADING_3XL, Meta, TriangleUpGlyph } from './glyphs';

/**
 * The right card of the two-card top: polymarket's Profit/Loss card as cumulative bounty payouts. A step line (a
 * payout lands all at once) over a flat accent wash, no axes. Scrubbing the chart (pointer, touch drag or the arrow
 * keys) reads the amount at that date: a hairline, a dot on the line and a tooltip pill, while the big number and its
 * label switch to that reading, as polymarket's P/L chart does. The scrub lives in this card's state only.
 */

const RANGES: readonly EarningsRange[] = ['1M', '3M', 'ALL'];
/** The SVG's own coordinate box; the element stretches it to the card width. */
const VB_W = 360;
const VB_H = 120;
/** Keeps the 2px stroke inside the box at the top and bottom. */
const PAD = 4;
/** A pointer this close (px) to a payout step snaps to it, so the exact payout date can be hit. */
const SNAP_PX = 8;
/** Space (px) between the hairline and the tooltip pill. */
const TIP_GAP = 8;
const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

/** The series' scales: x as a 0..1 fraction of the range, y in viewBox units (the floor when nothing was gained). */
function scales(series: EarningsSeries) {
  const pts = series.points;
  const floor = VB_H - PAD;
  const span = Math.max(1, series.end - series.start);
  const base = pts[0]?.cum ?? 0;
  const top = pts.length ? Math.max(...pts.map((p) => p.cum)) - base : 0;
  return {
    span,
    base,
    fx: (t: number) => Math.min(1, Math.max(0, (t - series.start) / span)),
    y: (cum: number) => (top > 0 ? floor - ((cum - base) / top) * (VB_H - PAD * 2) : floor),
  };
}

/** Step-line and area paths for a cumulative series in the 360x120 box. A series with no gain is a flat line on the floor. */
export function chartPaths(series: EarningsSeries): { line: string; area: string } {
  const pts = series.points;
  const floor = VB_H - PAD;
  if (pts.length === 0) return { line: `M0 ${floor}H${VB_W}`, area: `M0 ${floor}H${VB_W}V${VB_H}H0Z` };
  const { fx, y } = scales(series);
  const r = (n: number) => Math.round(n * 100) / 100;
  let line = `M0 ${r(y(pts[0].cum))}`;
  for (const p of pts.slice(1)) line += `H${r(fx(p.t) * VB_W)}V${r(y(p.cum))}`;
  line += `H${VB_W}`;
  return { line, area: `${line}V${VB_H}H0Z` };
}

/** How many payouts the series shows: each step up is one. */
export const payoutCount = (series: EarningsSeries): number => series.points.reduce((n, p, i) => (i > 0 && p.cum > series.points[i - 1].cum ? n + 1 : n), 0);

/** The line's value at t: the cum of the last point at or before t, because the line is step-after. */
export function cumAt(series: EarningsSeries, t: number): number {
  let v = series.points[0]?.cum ?? 0;
  for (const p of series.points) {
    if (p.t > t) break;
    v = p.cum;
  }
  return v;
}

/** Where the keyboard stops and the pointer snaps: each payout's date (one stop per date), or the range's two ends when it has none. */
export function payoutStops(series: EarningsSeries): number[] {
  const pts = series.points;
  const ts = [...new Set(pts.slice(1).filter((p, i) => p.cum > pts[i].cum).map((p) => p.t))];
  return ts.length ? ts : [series.start, series.end];
}

type Scrub = { t: number; by: 'pointer' | 'key' };

export function EarningsCard({ past, now, joinedAt }: { past: PastResult[]; now: number; joinedAt: string }) {
  const [range, setRange] = useState<EarningsRange>('ALL');
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const [announce, setAnnounce] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const series = useMemo(() => earningsSeries(past, range, now, joinedAt), [past, range, now, joinedAt]);
  const { line, area } = useMemo(() => chartPaths(series), [series]);
  const scale = useMemo(() => scales(series), [series]);
  const stops = useMemo(() => payoutStops(series), [series]);
  const count = payoutCount(series);
  const total = formatBountyAmount(series.total);
  const summary = `${series.label}: ${total} from ${count} ${count === 1 ? 'payout' : 'payouts'}`;

  /** The amount earned inside the range by t: the right edge reads the range total. */
  const amountAt = (t: number) => formatBountyAmount(cumAt(series, t) - scale.base);
  const hover = scrub && {
    amount: amountAt(scrub.t),
    date: DATE.format(scrub.t),
    left: scale.fx(scrub.t) * 100,
    top: (scale.y(cumAt(series, scrub.t)) / VB_H) * 100,
  };

  const show = (next: Scrub | null) => setScrub((prev) => (prev && next && prev.t === next.t && prev.by === next.by ? prev : next));

  const scrubAt = (clientX: number) => {
    const box = chartRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const px = Math.min(box.width, Math.max(0, clientX - box.left));
    let t = series.start + (px / box.width) * scale.span;
    let nearest = SNAP_PX;
    for (const s of stops) {
      const d = Math.abs(scale.fx(s) * box.width - px);
      if (d <= nearest) {
        nearest = d;
        t = s;
      }
    }
    show({ t: Math.min(series.end, Math.max(series.start, t)), by: 'pointer' });
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => scrubAt(e.clientX);
  const endPointer = () => setScrub((prev) => (prev?.by === 'pointer' ? null : prev));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = scrub?.t;
    const first = stops[0];
    const last = stops[stops.length - 1];
    let next: number;
    if (e.key === 'ArrowRight') next = cur === undefined ? first : (stops.find((s) => s > cur) ?? last);
    else if (e.key === 'ArrowLeft') next = cur === undefined ? last : ([...stops].reverse().find((s) => s < cur) ?? first);
    else if (e.key === 'Home') next = first;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape' && scrub) {
      e.preventDefault();
      setScrub(null);
      setAnnounce('');
      return;
    } else return;
    e.preventDefault();
    show({ t: next, by: 'key' });
    setAnnounce(`${amountAt(next)} on ${DATE.format(next)}`);
  };

  /* Sides the pill before paint: right of the hairline, flipped left when it would cross the chart's right edge,
     clamped inside the chart so the card never clips it. Written to the node, so placing it costs no second render. */
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const box = chartRef.current;
    if (!tip || !box || !hover) return;
    const width = box.clientWidth;
    const w = tip.offsetWidth;
    const x = (hover.left / 100) * width;
    const flip = x + TIP_GAP + w > width;
    const left = Math.min(Math.max(0, width - w), Math.max(0, flip ? x - TIP_GAP - w : x + TIP_GAP));
    tip.style.transform = `translateX(${left}px)`;
    tip.dataset.side = flip ? 'left' : 'right';
  });

  return (
    <section aria-labelledby="profile-earnings-h" data-testid="profile-earnings" data-range={range} className="flex min-w-0 flex-col rounded-xl border border-pk-border bg-pk-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="profile-earnings-h" className="flex items-center gap-1.5 text-body-sm text-pk-content-secondary">
          <TriangleUpGlyph className={`size-2.5 ${series.total > 0 ? 'text-pk-green-500' : 'text-pk-gray-400'}`} />
          Earnings
        </h2>
        <div role="group" aria-label="Earnings range" className="flex items-center gap-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => {
                setRange(r);
                setScrub(null);
                setAnnounce('');
              }}
              data-testid={`profile-earnings-range-${r}`}
              className={`inline-flex h-7 min-w-8 cursor-pointer items-center justify-center rounded-md px-2 text-body-xs font-semibold transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                r === range ? 'bg-pk-blue-100 text-pk-brand-500' : 'text-pk-content-secondary hover:bg-pk-hover-overlay-darker hover:text-pk-content-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p data-testid="profile-earnings-total" data-scrubbing={hover ? 'true' : undefined} className={`${HEADING_3XL} text-pk-content-primary tabular-nums`}>
            {hover ? hover.amount : total}
          </p>
          <p className="text-body-xs text-pk-content-secondary tabular-nums" data-testid="profile-earnings-label">
            {hover ? hover.date : series.label}
          </p>
          {series.total === 0 && <p className="text-body-xs text-pk-content-secondary">No payouts in this range</p>}
        </div>
        <span aria-hidden="true" className="pt-2 text-body-sm text-pk-content-secondary">
          agent.fun
        </span>
      </div>

      <div className="mt-auto pt-4">
        <div
          ref={chartRef}
          role="group"
          tabIndex={0}
          aria-label="Earnings chart, use arrow keys to read each payout"
          aria-describedby="profile-earnings-summary"
          data-testid="profile-earnings-chart"
          data-start={series.start}
          data-end={series.end}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={endPointer}
          onPointerCancel={endPointer}
          onKeyDown={onKeyDown}
          onBlur={() => setScrub((prev) => (prev?.by === 'key' ? null : prev))}
          className={`relative block h-24 w-full touch-pan-y rounded-md select-none md:h-[120px] ${FOCUS_RING}`}
        >
          <svg aria-hidden="true" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="block size-full">
            <path d={area} className="fill-pk-blue-100" />
            <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="stroke-pk-brand-500" />
          </svg>

          {/* HTML over the stretched SVG, placed in percentages, so the dot stays round and the hairline 1px. */}
          {hover && (
            <div aria-hidden="true" data-testid="profile-earnings-hover" className="pointer-events-none absolute inset-0">
              <span className="absolute inset-y-0 w-px bg-pk-gray-300" style={{ left: `calc(${hover.left}% - 0.5px)` }} />
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pk-brand-500 ring-2 ring-pk-surface"
                style={{ left: `${hover.left}%`, top: `${hover.top}%` }}
              />
              <div
                ref={tipRef}
                data-testid="profile-earnings-tooltip"
                className="absolute top-0 left-0 rounded-md bg-pk-surface px-2 py-1 text-body-sm whitespace-nowrap text-pk-content-secondary shadow-pk-middle tabular-nums"
              >
                <Meta nowrap parts={[<span className="font-semibold text-pk-content-primary">{hover.amount}</span>, hover.date]} />
              </div>
            </div>
          )}
        </div>
        <p id="profile-earnings-summary" className="sr-only">
          {summary}
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="profile-earnings-live">
          {announce}
        </p>
      </div>
    </section>
  );
}

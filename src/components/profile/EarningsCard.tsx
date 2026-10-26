import { useMemo, useState } from 'react';
import { formatBountyAmount } from '../../lib/bounty';
import { earningsSeries, type EarningsRange, type EarningsSeries, type PastResult } from '../../lib/profile';
import { FOCUS_RING, HEADING_3XL, TriangleUpGlyph } from './glyphs';

/**
 * The right card of the two-card top: polymarket's Profit/Loss card as cumulative bounty payouts. A step line (a
 * payout lands all at once), a flat accent wash under it, no axes and no hover: the number above is the reading.
 */

const RANGES: readonly EarningsRange[] = ['1M', '3M', 'ALL'];
/** The SVG's own coordinate box; the element stretches it to the card width. */
const VB_W = 360;
const VB_H = 120;
/** Keeps the 2px stroke inside the box at the top and bottom. */
const PAD = 4;

/** Step-line and area paths for a cumulative series in the 360x120 box. A series with no gain is a flat line on the floor. */
export function chartPaths(series: EarningsSeries): { line: string; area: string } {
  const pts = series.points;
  const floor = VB_H - PAD;
  if (pts.length === 0) return { line: `M0 ${floor}H${VB_W}`, area: `M0 ${floor}H${VB_W}V${VB_H}H0Z` };
  const span = Math.max(1, series.end - series.start);
  const base = pts[0].cum;
  const top = Math.max(...pts.map((p) => p.cum)) - base;
  const x = (t: number) => Math.min(VB_W, Math.max(0, ((t - series.start) / span) * VB_W));
  const y = (cum: number) => (top > 0 ? floor - ((cum - base) / top) * (VB_H - PAD * 2) : floor);
  const r = (n: number) => Math.round(n * 100) / 100;
  let line = `M0 ${r(y(pts[0].cum))}`;
  for (const p of pts.slice(1)) line += `H${r(x(p.t))}V${r(y(p.cum))}`;
  line += `H${VB_W}`;
  return { line, area: `${line}V${VB_H}H0Z` };
}

/** How many payouts the series shows: each step up is one. */
export const payoutCount = (series: EarningsSeries): number => series.points.reduce((n, p, i) => (i > 0 && p.cum > series.points[i - 1].cum ? n + 1 : n), 0);

export function EarningsCard({ past, now, joinedAt }: { past: PastResult[]; now: number; joinedAt: string }) {
  const [range, setRange] = useState<EarningsRange>('ALL');
  const series = useMemo(() => earningsSeries(past, range, now, joinedAt), [past, range, now, joinedAt]);
  const { line, area } = useMemo(() => chartPaths(series), [series]);
  const count = payoutCount(series);
  const total = formatBountyAmount(series.total);
  const chartLabel = `Earnings, ${series.label.toLowerCase()}: ${total} from ${count} ${count === 1 ? 'payout' : 'payouts'}`;

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
              onClick={() => setRange(r)}
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
          <p data-testid="profile-earnings-total" className={`${HEADING_3XL} text-pk-content-primary tabular-nums`}>
            {total}
          </p>
          <p className="text-body-xs text-pk-content-secondary" data-testid="profile-earnings-label">
            {series.label}
          </p>
          {series.total === 0 && <p className="text-body-xs text-pk-content-secondary">No payouts in this range</p>}
        </div>
        <span aria-hidden="true" className="pt-2 text-body-sm text-pk-content-secondary">
          agent.fun
        </span>
      </div>

      <div className="mt-auto pt-4">
        <svg role="img" aria-label={chartLabel} data-testid="profile-earnings-chart" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="block h-24 w-full md:h-[120px]">
          <path d={area} className="fill-pk-blue-100" />
          <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="stroke-pk-brand-500" />
        </svg>
      </div>
    </section>
  );
}

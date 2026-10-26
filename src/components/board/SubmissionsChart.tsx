import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Submission } from '../../lib/bounty';

/** Series classes in legend order (pk-chart-1..5). Literal strings so Tailwind generates every one. */
export const SERIES_STROKE = ['stroke-pk-chart-1', 'stroke-pk-chart-2', 'stroke-pk-chart-3', 'stroke-pk-chart-4', 'stroke-pk-chart-5'] as const;
export const SERIES_FILL = ['fill-pk-chart-1', 'fill-pk-chart-2', 'fill-pk-chart-3', 'fill-pk-chart-4', 'fill-pk-chart-5'] as const;
export const SERIES_BG = ['bg-pk-chart-1', 'bg-pk-chart-2', 'bg-pk-chart-3', 'bg-pk-chart-4', 'bg-pk-chart-5'] as const;

export interface HunterSeries {
  hunter: string;
  /** Submission instants (ms), ascending. */
  times: number[];
}

/** Hunters by submission count, descending (ties: the earlier first submission, then handle). */
export function groupByHunter(submissions: Submission[]): HunterSeries[] {
  const map = new Map<string, number[]>();
  for (const s of submissions) {
    const t = Date.parse(s.createdAt);
    if (Number.isNaN(t)) continue;
    const list = map.get(s.hunter);
    if (list) list.push(t);
    else map.set(s.hunter, [t]);
  }
  return [...map.entries()]
    .map(([hunter, times]) => ({ hunter, times: times.sort((a, b) => a - b) }))
    .sort((a, b) => b.times.length - a.times.length || a.times[0] - b.times[0] || a.hunter.localeCompare(b.hunter));
}

/** Integer ticks from 0: about four steps, each a whole number, the top tick at or above `max`. */
function integerTicks(max: number): number[] {
  const top = Math.max(1, max);
  const raw = top / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? Math.ceil(raw));
  const ticks: number[] = [];
  for (let v = 0; v < top + step; v += step) {
    ticks.push(v);
    if (v >= top) break;
  }
  return ticks;
}

const DAY_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const HOUR_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric' });

const PAD_R = 40; // room for the right-hand count axis
const PAD_T = 10;
const PAD_B = 22;
const X_LABELS = 4;

/**
 * Cumulative submissions per hunter over time as step-after lines (port of polymarket-clone HeroChart): dashed
 * gridlines, an integer axis on the right, a time axis along the bottom, an end dot with a halo on each line.
 * Drawn in real pixels (the box is measured), so the dots stay round at any size.
 */
export function SubmissionsChart({ series, from, to, label }: { series: HunterSeries[]; from: number; to: number; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 520, h: 280 });
  const [drawn, setDrawn] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the lines in once, on the frame after mount (the stroke transition is off under reduced motion).
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { w, h } = size;
  const innerW = Math.max(1, w - PAD_R);
  const innerH = Math.max(1, h - PAD_T - PAD_B);
  const start = Math.min(from, ...series.map((s) => s.times[0] ?? from));
  const end = Math.max(to, ...series.map((s) => s.times[s.times.length - 1] ?? to), start + 1);
  const max = Math.max(1, ...series.map((s) => s.times.length));
  const ticks = integerTicks(max);
  const yTop = ticks[ticks.length - 1];

  const x = (t: number) => ((t - start) / (end - start)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / yTop) * innerH;
  const fmt = end - start > 2 * 86_400_000 ? DAY_FMT : HOUR_FMT;
  const xLabels = Array.from({ length: X_LABELS }, (_, i) => start + ((end - start) * i) / (X_LABELS - 1));

  return (
    <div ref={boxRef} className="relative size-full min-h-0">
      <svg role="img" aria-label={label} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 size-full overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="stroke-pk-gray-200" strokeWidth={1} strokeDasharray="2 4" />
            <text x={innerW + 8} y={y(t) + 4} className="fill-pk-content-tertiary text-xs tabular-nums">
              {t}
            </text>
          </g>
        ))}

        {/* Painted last-first so the top hunter's line sits on top where steps overlap. */}
        {series.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => {
          // Step-after: flat until each submission, then up by one.
          let d = `M 0 ${y(0).toFixed(2)}`;
          s.times.forEach((t, k) => {
            d += ` H ${x(t).toFixed(2)} V ${y(k + 1).toFixed(2)}`;
          });
          d += ` H ${innerW.toFixed(2)}`;
          const cy = y(s.times.length);
          return (
            <g key={s.hunter}>
              <path
                d={d}
                pathLength={1}
                fill="none"
                className={`${SERIES_STROKE[i]} transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none`}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={1}
                strokeDashoffset={drawn ? 0 : 1}
              />
              <circle cx={innerW} cy={cy} r={7} className={SERIES_FILL[i]} opacity={0.18} />
              <circle cx={innerW} cy={cy} r={3.2} className={SERIES_FILL[i]} />
            </g>
          );
        })}

        {xLabels.map((t, i) => (
          <text
            key={i}
            x={(i / (X_LABELS - 1)) * innerW}
            y={h - 6}
            textAnchor={i === 0 ? 'start' : i === X_LABELS - 1 ? 'end' : 'middle'}
            className="fill-pk-content-tertiary text-xs"
          >
            {i === X_LABELS - 1 ? 'Now' : fmt.format(t)}
          </text>
        ))}
      </svg>
    </div>
  );
}

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { BoardBounty, Submission } from '../../lib/bounty';
import { formatScore, scoreDecimals } from '../../lib/profile';

/**
 * How the winning entry compares with every other scored submission: one clean line through every verified score,
 * ranked best to worst, so the winner sits top left and the field trails away beneath it. The vertical axis runs best
 * to worst whichever way the metric wins (labels carry the real values). A dashed rule marks the median; hovering
 * shows a crosshair and that entry's handle, score and rank. A table carries the same data for assistive tech.
 */

interface Point {
  hunter: string;
  score: number;
  /** 0 (worst) to 1 (best). */
  p: number;
}

/** Plot coordinates in percent: x across the ranks, y from the top (best) with a little headroom at both ends. */
const xOf = (i: number, n: number) => (n === 1 ? 0 : (i / (n - 1)) * 100);
const yOf = (p: number) => 6 + (1 - p) * 88;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function PerformanceChart({ bounty, extra, handle }: { bounty: BoardBounty; extra: Submission[]; handle: string }) {
  const metric = bounty.resolution?.metric;
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (!metric) return null;
    const higher = metric.better === 'higher';
    const scored = [...bounty.submissions, ...extra].filter((s): s is Submission & { score: number } => s.status === 'passed' && typeof s.score === 'number');
    if (scored.length < 2) return null;
    scored.sort((a, b) => (higher ? b.score - a.score : a.score - b.score) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const best = scored[0].score;
    const worst = scored[scored.length - 1].score;
    const span = Math.abs(best - worst) || 1;
    const points: Point[] = scored.map((s) => ({ hunter: s.hunter, score: s.score, p: Math.abs(s.score - worst) / span }));
    const mid = median(scored.map((s) => s.score));
    // The line in a 1000 x 100 box; the SVG stretches to the plot and the stroke stays 2px (non-scaling).
    const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${(xOf(i, points.length) * 10).toFixed(1)},${yOf(pt.p).toFixed(2)}`).join(' ');
    return { points, best, worst, mid, midP: Math.abs(mid - worst) / span, path };
  }, [bounty, extra, metric]);

  if (!metric || !data) return null;
  const dp = scoreDecimals(bounty);
  const fmt = (v: number) => formatScore(v, metric, dp);
  const who = (h: string) => `@${h}${h === handle ? ' (you)' : ''}`;
  const n = data.points.length;
  const winner = data.points[0];
  const shown = hover === null ? null : data.points[hover];

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const rel = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    setHover(Math.round(rel * (n - 1)));
  };

  return (
    <figure data-testid="won-bounty-chart" className="flex flex-col gap-3 rounded-xl border border-pk-border bg-pk-elevated p-4">
      <figcaption className="text-body-base font-semibold text-pk-content-primary">
        Every scored submission, best to worst
        <span className="ml-2 text-body-sm font-normal text-pk-content-secondary">
          {n} submissions, {metric.name} ({metric.better} wins)
        </span>
      </figcaption>

      <div className="flex gap-3">
        {/* The value scale: best at the top, worst at the bottom, in the metric's own unit. */}
        <div className="relative h-44 w-16 shrink-0 text-right text-body-xs text-pk-content-secondary tabular-nums" aria-hidden="true">
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${yOf(1)}%` }}>
            {fmt(data.best)}
          </span>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${yOf(0)}%` }}>
            {fmt(data.worst)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            ref={plotRef}
            className="relative h-44 min-w-0 cursor-crosshair touch-pan-y"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`${who(winner.hunter)} placed first with ${fmt(winner.score)}. ${n} scored submissions run from ${fmt(data.best)} down to ${fmt(data.worst)}; the median is ${fmt(data.mid)}.`}
          >
            {/* Recessive frame: the best and worst gridlines, and the median as a dashed rule. */}
            <div className="pointer-events-none absolute inset-x-0 border-t border-pk-border" style={{ top: `${yOf(1)}%` }} />
            <div className="pointer-events-none absolute inset-x-0 border-t border-pk-border" style={{ top: `${yOf(0)}%` }} />
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-pk-content-tertiary" style={{ top: `${yOf(data.midP)}%` }}>
              <span className="absolute right-0 -translate-y-full pb-0.5 text-body-xs text-pk-content-secondary">Median {fmt(data.mid)}</span>
            </div>

            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={data.path} fill="none" stroke="var(--color-pk-brand-500, #2e5cff)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>

            {/* The winner: a ringed point and a direct label, drawn in HTML so the dot stays round. */}
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pk-brand-500 ring-2 ring-pk-elevated"
              style={{ left: `${xOf(0, n)}%`, top: `${yOf(winner.p)}%` }}
              data-testid="won-bounty-chart-winner"
            />
            <span className="pointer-events-none absolute ml-3 -translate-y-1/2 text-body-sm whitespace-nowrap" style={{ left: `${xOf(0, n)}%`, top: `${yOf(winner.p) + 9}%` }}>
              <span className="font-semibold text-pk-content-primary">{who(winner.hunter)}</span>
              <span className="ml-1.5 text-pk-content-secondary tabular-nums">{fmt(winner.score)}</span>
            </span>

            {shown && hover !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 border-l border-pk-gray-300" style={{ left: `${xOf(hover, n)}%` }} />
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pk-brand-500 ring-2 ring-pk-elevated"
                  style={{ left: `${xOf(hover, n)}%`, top: `${yOf(shown.p)}%` }}
                />
                <div
                  className="pointer-events-none absolute top-0 z-10 rounded-md bg-pk-surface px-2.5 py-1.5 text-body-sm whitespace-nowrap shadow-pk-middle"
                  style={hover / (n - 1) > 0.6 ? { right: `calc(${100 - xOf(hover, n)}% + 8px)` } : { left: `calc(${xOf(hover, n)}% + 8px)` }}
                  data-testid="won-bounty-chart-tooltip"
                >
                  <span className="font-semibold text-pk-content-primary">{who(shown.hunter)}</span>
                  <span className="ml-2 text-pk-content-secondary tabular-nums">{fmt(shown.score)}</span>
                  <span className="ml-2 text-pk-content-secondary">#{hover + 1}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between text-body-xs text-pk-content-secondary" aria-hidden="true">
            <span>#1</span>
            <span>#{n}</span>
          </div>
        </div>
      </div>

      {/* The same data as a table, for assistive tech. */}
      <table className="sr-only">
        <caption>Every scored submission, best to worst</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Hunter</th>
            <th scope="col">{metric.name}</th>
          </tr>
        </thead>
        <tbody>
          {data.points.map((pt, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{who(pt.hunter)}</td>
              <td>{fmt(pt.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

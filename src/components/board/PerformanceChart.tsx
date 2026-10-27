import { useMemo, useState } from 'react';
import type { BoardBounty, Submission } from '../../lib/bounty';
import { formatScore, leaderboard, scoreDecimals } from '../../lib/profile';

/**
 * How the winning entry compares with every other scored submission: one column per submission, best to worst, height
 * = performance (taller is better whichever way the metric wins), so the winner always stands at the left. The winner
 * is brand blue, the 2nd and 3rd place entries dark neutral, the rest light neutral (contrast relief: the legend, the
 * hover tooltip and a table for assistive tech). A dashed line marks the median.
 */

interface Bar {
  hunter: string;
  score: number;
  place: 1 | 2 | 3 | null;
  /** 0 (worst) to 1 (best). */
  p: number;
}

const BAR_FILL: Record<'1' | 'podium' | 'rest', string> = { '1': 'bg-pk-brand-500', podium: 'bg-pk-content-secondary', rest: 'bg-pk-gray-500' };
/** The shortest column, so the worst submission still reads as a bar. */
const MIN_HEIGHT = 0.04;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function PerformanceChart({ bounty, extra, handle }: { bounty: BoardBounty; extra: Submission[]; handle: string }) {
  const metric = bounty.resolution?.metric;
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    if (!metric) return null;
    const higher = metric.better === 'higher';
    const scored = [...bounty.submissions, ...extra].filter((s): s is Submission & { score: number } => s.status === 'passed' && typeof s.score === 'number');
    if (scored.length < 2) return null;
    scored.sort((a, b) => (higher ? b.score - a.score : a.score - b.score) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const best = scored[0].score;
    const worst = scored[scored.length - 1].score;
    const span = Math.abs(best - worst) || 1;
    // Podium places come from the leaderboard (each hunter's best); mark the bar of each placed hunter's best entry.
    const podium = leaderboard(bounty, extra).slice(0, 3);
    const marked = new Set<number>();
    const placeOf = (s: { hunter: string; score: number }): Bar['place'] => {
      const k = podium.findIndex((r) => r.hunter === s.hunter && r.score === s.score);
      if (k < 0 || marked.has(k)) return null;
      marked.add(k);
      return (k + 1) as 1 | 2 | 3;
    };
    const bars: Bar[] = scored.map((s) => ({ hunter: s.hunter, score: s.score, place: placeOf(s), p: Math.abs(s.score - worst) / span }));
    const mid = median(scored.map((s) => s.score));
    return { bars, best, worst, mid, midP: Math.abs(mid - worst) / span };
  }, [bounty, extra, metric]);

  if (!metric || !data) return null;
  const dp = scoreDecimals(bounty);
  const fmt = (v: number) => formatScore(v, metric, dp);
  const who = (h: string) => `@${h}${h === handle ? ' (you)' : ''}`;
  const winner = data.bars[0];
  const shown = hover === null ? null : data.bars[hover];
  const height = (p: number) => `${(MIN_HEIGHT + (1 - MIN_HEIGHT) * p) * 100}%`;

  return (
    <figure data-testid="won-bounty-chart" className="flex flex-col gap-3 rounded-xl border border-pk-border bg-pk-elevated p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="text-body-base font-semibold text-pk-content-primary">
          Every scored submission, best to worst
          <span className="ml-2 text-body-sm font-normal text-pk-content-secondary">
            {data.bars.length} submissions, {metric.name} ({metric.better} wins)
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-pk-content-secondary" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-xs ${BAR_FILL['1']}`} />
            Winner {who(winner.hunter)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-xs ${BAR_FILL.podium}`} />
            2nd and 3rd
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-xs ${BAR_FILL.rest}`} />
            Everyone else
          </span>
        </span>
      </figcaption>

      <div className="flex gap-3">
        {/* The value scale: best at the top, worst at the bottom, in the metric's own unit (aligned to the plot, not its caption). */}
        <div className="flex h-40 shrink-0 flex-col justify-between self-start text-right text-body-xs text-pk-content-secondary tabular-nums" aria-hidden="true">
          <span>{fmt(data.best)}</span>
          <span>{fmt(data.worst)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="relative h-40 min-w-0" role="img" aria-label={`${who(winner.hunter)} placed first with ${fmt(winner.score)}. ${data.bars.length} scored submissions range from ${fmt(data.best)} to ${fmt(data.worst)}; the median is ${fmt(data.mid)}.`}>
          {/* The surface gap between columns thins out as the field grows, so 196 entries still fit a phone. */}
          <div
            className={`absolute inset-0 flex items-end border-b border-pk-border ${data.bars.length <= 40 ? 'gap-0.5' : data.bars.length <= 100 ? 'gap-0 md:gap-px' : 'gap-0 xl:gap-px'}`}
            onPointerLeave={() => setHover(null)}
          >
            {data.bars.map((b, i) => (
              // The whole column is the hover target, not just the bar.
              <div key={i} className="flex h-full min-w-0 flex-1 items-end" onPointerEnter={() => setHover(i)} data-place={b.place ?? undefined}>
                <div
                  className={`w-full rounded-t-xs ${b.place === 1 ? BAR_FILL['1'] : b.place ? BAR_FILL.podium : BAR_FILL.rest} ${hover !== null && hover !== i ? 'opacity-60' : ''}`}
                  style={{ height: height(b.p) }}
                />
              </div>
            ))}
          </div>
          {/* The median: a recessive dashed rule with its value. */}
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-pk-content-tertiary" style={{ bottom: height(data.midP) }}>
            <span className="absolute right-0 -translate-y-full pb-0.5 text-body-xs text-pk-content-secondary">Median {fmt(data.mid)}</span>
          </div>
          {shown && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md bg-pk-surface px-2.5 py-1.5 text-body-sm shadow-pk-middle whitespace-nowrap"
              style={hover / data.bars.length > 0.6 ? { right: `${(1 - (hover + 1) / data.bars.length) * 100}%` } : { left: `${(hover / data.bars.length) * 100}%` }}
              data-testid="won-bounty-chart-tooltip"
            >
              <span className="font-semibold text-pk-content-primary">{who(shown.hunter)}</span>
              <span className="ml-2 text-pk-content-secondary tabular-nums">{fmt(shown.score)}</span>
              <span className="ml-2 text-pk-content-secondary">#{hover + 1}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between text-body-xs text-pk-content-secondary" aria-hidden="true">
          <span>Best</span>
          <span>Worst</span>
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
          {data.bars.map((b, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{who(b.hunter)}</td>
              <td>{fmt(b.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

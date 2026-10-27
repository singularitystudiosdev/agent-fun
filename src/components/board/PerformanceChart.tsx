import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { BoardBounty, Submission } from '../../lib/bounty';
import { formatScore, scoreDecimals } from '../../lib/profile';

/**
 * The race, competitor by competitor: one line per hunter tracing their best verified score from their first entry to
 * the deadline (stepping up when a later attempt beat it). The winner, 2nd and 3rd are coloured and named in the legend;
 * the rest of the field is thin neutral lines. The vertical axis runs best (top) to worst whichever way the metric
 * wins. Hovering shows a crosshair with that moment's leader and the podium's standing. A table carries the final
 * standings for assistive tech. Colours: brand blue, pk-chart-4, pk-chart-5 (validated: CVD and contrast pass).
 */

interface Series {
  hunter: string;
  /** Best-so-far steps, oldest first: the score holds from `at` until the next step. */
  steps: { at: number; score: number }[];
  final: number;
  firstAt: number;
}

const PODIUM = [
  { stroke: 'var(--color-pk-brand-500, #2e5cff)', swatch: 'bg-pk-brand-500' },
  { stroke: 'var(--color-pk-chart-4, #e0632a)', swatch: 'bg-pk-chart-4' },
  { stroke: 'var(--color-pk-chart-5, #8f3dd7)', swatch: 'bg-pk-chart-5' },
] as const;

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
/** Plot y in percent from the top: best near the top, worst near the bottom. */
const yOf = (p: number) => 6 + (1 - p) * 88;

export function PerformanceChart({ bounty, extra, handle }: { bounty: BoardBounty; extra: Submission[]; handle: string }) {
  const metric = bounty.resolution?.metric;
  const [hoverX, setHoverX] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (!metric) return null;
    const higher = metric.better === 'higher';
    const better = (a: number, b: number) => (higher ? a > b : a < b);
    const scored = [...bounty.submissions, ...extra]
      .filter((s): s is Submission & { score: number } => s.status === 'passed' && typeof s.score === 'number')
      .map((s) => ({ hunter: s.hunter, score: s.score, at: Date.parse(s.createdAt) }))
      .sort((a, b) => a.at - b.at);
    if (scored.length < 2) return null;

    const byHunter = new Map<string, Series>();
    for (const s of scored) {
      const cur = byHunter.get(s.hunter);
      if (!cur) byHunter.set(s.hunter, { hunter: s.hunter, steps: [{ at: s.at, score: s.score }], final: s.score, firstAt: s.at });
      else if (better(s.score, cur.final)) {
        cur.steps.push({ at: s.at, score: s.score });
        cur.final = s.score;
      }
    }
    const ranked = [...byHunter.values()].sort((a, b) => (higher ? b.final - a.final : a.final - b.final) || a.firstAt - b.firstAt);
    const all = scored.map((s) => s.score);
    const best = higher ? Math.max(...all) : Math.min(...all);
    const worst = higher ? Math.min(...all) : Math.max(...all);
    const span = Math.abs(best - worst) || 1;
    const start = Date.parse(bounty.publishedAt);
    const end = Date.parse(bounty.deadline);
    const len = Math.max(1, end - start);
    const x = (t: number) => Math.min(1000, Math.max(0, ((t - start) / len) * 1000));
    const y = (score: number) => yOf(Math.abs(score - worst) / span);
    // Step-after paths in a 1000 x 100 box: hold each best until the next improvement, then to the deadline.
    const pathOf = (s: Series) => s.steps.map((st, i) => (i === 0 ? `M${x(st.at).toFixed(1)},${y(st.score).toFixed(2)}` : `H${x(st.at).toFixed(1)} V${y(st.score).toFixed(2)}`)).join(' ') + ' H1000';
    return { ranked, best, worst, start, end, len, y, pathOf, better };
  }, [bounty, extra, metric]);

  if (!metric || !data) return null;
  const dp = scoreDecimals(bounty);
  const fmt = (v: number) => formatScore(v, metric, dp);
  const who = (h: string) => `@${h}${h === handle ? ' (you)' : ''}`;
  const podium = data.ranked.slice(0, 3);
  const rest = data.ranked.slice(3);

  /** A hunter's best score at time t, or undefined before their first entry. */
  const valueAt = (s: Series, t: number) => {
    let v: number | undefined;
    for (const st of s.steps) {
      if (st.at > t) break;
      v = st.score;
    }
    return v;
  };
  const hoverT = hoverX === null ? null : data.start + hoverX * data.len;
  const leaderAt = (t: number) => {
    let lead: { hunter: string; score: number } | undefined;
    for (const s of data.ranked) {
      const v = valueAt(s, t);
      if (v !== undefined && (!lead || data.better(v, lead.score))) lead = { hunter: s.hunter, score: v };
    }
    return lead;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setHoverX(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)));
  };

  const lead = hoverT === null ? undefined : leaderAt(hoverT);

  return (
    <figure data-testid="won-bounty-chart" className="flex flex-col gap-3 rounded-xl border border-pk-border bg-pk-elevated p-4">
      <div className="flex gap-3">
        {/* The value scale: best at the top, worst at the bottom, in the metric's own unit. */}
        <div className="relative h-56 w-16 shrink-0 text-right text-body-xs text-pk-content-secondary tabular-nums" aria-hidden="true">
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
            className="relative h-56 min-w-0 cursor-crosshair touch-pan-y"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHoverX(null)}
            role="img"
            aria-label={`${data.ranked.length} competitors' best scores over the bounty. ${who(podium[0].hunter)} won with ${fmt(podium[0].final)}${podium[1] ? `, ahead of ${who(podium[1].hunter)} (${fmt(podium[1].final)})` : ''}${podium[2] ? ` and ${who(podium[2].hunter)} (${fmt(podium[2].final)})` : ''}.`}
          >
            <div className="pointer-events-none absolute inset-x-0 border-t border-pk-border" style={{ top: `${yOf(1)}%` }} />
            <div className="pointer-events-none absolute inset-x-0 border-t border-pk-border" style={{ top: `${yOf(0)}%` }} />

            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
              {rest.map((s) => (
                <path key={s.hunter} d={data.pathOf(s)} fill="none" stroke="var(--color-pk-gray-300, #d4d7dc)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {/* The podium last, the winner on top. */}
              {[...podium].reverse().map((s) => {
                const k = podium.indexOf(s);
                return <path key={s.hunter} d={data.pathOf(s)} fill="none" stroke={PODIUM[k].stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
              })}
            </svg>

            {/* End points of the podium lines, in HTML so they stay round. */}
            {podium.map((s, k) => (
              <span
                key={s.hunter}
                className={`pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-pk-elevated ${PODIUM[k].swatch}`}
                style={{ left: '100%', top: `${data.y(s.final)}%` }}
                data-testid={k === 0 ? 'won-bounty-chart-winner' : undefined}
              />
            ))}

            {hoverT !== null && hoverX !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 border-l border-pk-gray-300" style={{ left: `${hoverX * 100}%` }} />
                {podium.map((s, k) => {
                  const v = valueAt(s, hoverT);
                  return v === undefined ? null : (
                    <span
                      key={s.hunter}
                      className={`pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-pk-elevated ${PODIUM[k].swatch}`}
                      style={{ left: `${hoverX * 100}%`, top: `${data.y(v)}%` }}
                    />
                  );
                })}
                <div
                  className="pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-md bg-pk-surface px-2.5 py-1.5 text-body-sm whitespace-nowrap shadow-pk-middle"
                  style={hoverX > 0.6 ? { right: `calc(${(1 - hoverX) * 100}% + 8px)` } : { left: `calc(${hoverX * 100}% + 8px)` }}
                  data-testid="won-bounty-chart-tooltip"
                >
                  <span className="text-body-xs text-pk-content-secondary">{DAY.format(new Date(hoverT))}</span>
                  {lead && (
                    <span>
                      <span className="text-pk-content-secondary">Leading </span>
                      <span className="font-semibold text-pk-content-primary">{who(lead.hunter)}</span>
                      <span className="ml-1.5 text-pk-content-secondary tabular-nums">{fmt(lead.score)}</span>
                    </span>
                  )}
                  {podium.map((s, k) => {
                    const v = valueAt(s, hoverT);
                    return (
                      <span key={s.hunter} className="inline-flex items-center gap-1.5">
                        <span className={`h-0.5 w-3 rounded-full ${PODIUM[k].swatch}`} />
                        <span className="text-pk-content-primary">{who(s.hunter)}</span>
                        <span className="text-pk-content-secondary tabular-nums">{v === undefined ? 'not entered yet' : fmt(v)}</span>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between text-body-xs text-pk-content-secondary" aria-hidden="true">
            <span>Opened {DAY.format(new Date(data.start))}</span>
            <span>Ended {DAY.format(new Date(data.end))}</span>
          </div>
        </div>
      </div>

      {/* Legend: the podium by name and final score, then the rest of the field. */}
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pl-[76px] text-body-sm" aria-hidden="true">
        {podium.map((s, k) => (
          <li key={s.hunter} className="inline-flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${PODIUM[k].swatch}`} />
            <span className="font-semibold text-pk-content-primary">{who(s.hunter)}</span>
            <span className="text-pk-content-secondary tabular-nums">{fmt(s.final)}</span>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="inline-flex items-center gap-1.5 text-pk-content-secondary">
            <span className="h-px w-4 bg-pk-gray-300" />
            {rest.length} other {rest.length === 1 ? 'competitor' : 'competitors'}
          </li>
        )}
      </ul>

      {/* Final standings as a table, for assistive tech. */}
      <table className="sr-only">
        <caption>Final standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Hunter</th>
            <th scope="col">{metric.name}</th>
          </tr>
        </thead>
        <tbody>
          {data.ranked.map((s, i) => (
            <tr key={s.hunter}>
              <td>{i + 1}</td>
              <td>{who(s.hunter)}</td>
              <td>{fmt(s.final)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

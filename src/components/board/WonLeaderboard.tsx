import { useMemo, useState } from 'react';
import { formatBountyAmount, type BoardBounty, type Submission } from '../../lib/bounty';
import { formatScore, leaderboard, scoreDecimals } from '../../lib/profile';

/**
 * The final leaderboard of a won bounty: rank, competitor, verified score on the task and money won, #1 on top and
 * set apart. Each competitor's best entry counts once. The top 10 show first; the rest are one click away.
 */

const TOP = 10;
const GRID = 'grid grid-cols-[3.5rem_minmax(0,1fr)_auto_6rem] items-center gap-x-4';

export function WonLeaderboard({ bounty, extra, handle }: { bounty: BoardBounty; extra: Submission[]; handle: string }) {
  const [all, setAll] = useState(false);
  const rows = useMemo(() => leaderboard(bounty, extra), [bounty, extra]);
  const metric = bounty.resolution?.metric;
  if (!metric || rows.length === 0) return null;

  const dp = scoreDecimals(bounty);
  const shown = all ? rows : rows.slice(0, TOP);

  return (
    <section aria-labelledby="won-leaderboard" data-testid="won-leaderboard" className="flex flex-col rounded-xl border border-pk-border bg-pk-elevated">
      <h2 id="won-leaderboard" className="px-4 pt-4 pb-2 text-body-base font-semibold text-pk-content-primary">
        Leaderboard
      </h2>
      <div className={`${GRID} border-b border-pk-border px-4 pb-2 text-body-sm text-pk-content-secondary`} aria-hidden="true">
        <span>Rank</span>
        <span>Competitor</span>
        <span className="text-right">{metric.name}</span>
        <span className="text-right">Won</span>
      </div>
      <ol className="flex flex-col">
        {shown.map((r) => {
          const payout = bounty.rewards?.[String(r.rank)] ?? 0;
          const first = r.rank === 1;
          return (
            <li
              key={r.hunter}
              data-testid="won-leaderboard-row"
              data-rank={r.rank}
              className={`${GRID} border-b border-pk-border px-4 last:border-b-0 ${first ? 'bg-pk-gray-100 py-4' : 'py-3'}`}
            >
              <span className={`font-semibold tabular-nums text-pk-content-primary ${first ? 'text-heading-xl' : 'text-body-base'}`}>#{r.rank}</span>
              <span className={`min-w-0 truncate font-semibold text-pk-content-primary ${first ? 'text-heading-xl' : 'text-body-base'}`}>
                @{r.hunter}
                {r.hunter === handle && <span className="font-normal text-pk-content-secondary"> (you)</span>}
              </span>
              <span className={`text-right tabular-nums text-pk-content-primary ${first ? 'text-heading-xl font-semibold' : 'text-body-base'}`}>{formatScore(r.score, metric, dp)}</span>
              <span className={`text-right font-semibold tabular-nums ${payout > 0 ? 'text-pk-green-600' : 'text-pk-content-secondary'} ${first ? 'text-heading-xl' : 'text-body-base'}`}>
                {formatBountyAmount(payout)}
              </span>
            </li>
          );
        })}
      </ol>
      {rows.length > TOP && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="h-11 cursor-pointer border-t border-pk-border text-body-sm font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pk-content-secondary"
        >
          {all ? 'Show top 10' : `Show all ${rows.length} competitors`}
        </button>
      )}
    </section>
  );
}

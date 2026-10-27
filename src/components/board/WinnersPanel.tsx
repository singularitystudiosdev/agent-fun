import { useId, useMemo } from 'react';
import { formatBountyAmount, formatEndedOn, type BoardBounty } from '../../lib/bounty';
import { formatScore, leaderboard, ordinal, rankOf, scoreDecimals, useMyEntries, useProfile, useWinners, type Winner } from '../../lib/profile';
import { MedalGlyph, Meta } from '../profile/glyphs';

/**
 * WINNERS: the top of an ended bounty's right column. Who won, by how much and what each paid place was paid, in place
 * order. First place is the hero row (larger medal, the payout at heading size, its winning margin over 2nd); 2nd and 3rd are
 * compact rows. Above the list: when it ended and how many scored entrants it had. When you entered and finished
 * outside the paid places, one line says where you finished. Nothing here invites a new entry.
 */

const MEDAL = ['text-pk-chart-3', 'text-pk-gray-400', 'text-pk-chart-4'] as const;

export function WinnersPanel({ bounty }: { bounty: BoardBounty }) {
  const titleId = useId();
  const winners = useWinners(bounty);
  const { handle } = useProfile();
  const mine = useMyEntries(bounty.slug);
  const metric = bounty.resolution.metric;
  const dp = scoreDecimals(bounty);
  const fmt = (x: number) => formatScore(x, metric ?? { unit: '' }, dp);

  // The field is the scored hunters (yours included): the same count your rank is out of.
  const field = useMemo(() => leaderboard(bounty, mine).length, [bounty, mine]);
  const standing = useMemo(() => rankOf(bounty, handle, mine), [bounty, handle, mine]);
  const placed = winners.some((w) => w.you);

  let yours: string | null = null;
  if (!placed && standing.kind === 'ranked') yours = `You finished #${standing.rank} of ${Math.min(standing.of, field).toLocaleString('en-US')}`;
  else if (!placed && standing.kind !== 'none') yours = 'Your entry was not scored by the deadline';

  const margin = winners.length > 1 ? Math.abs(winners[0].score - winners[1].score) : null;

  return (
    <section id="winners" data-testid="winners-panel" aria-labelledby={titleId} className="flex min-w-0 shrink-0 scroll-mt-40 flex-col rounded-xl border border-pk-border bg-pk-elevated">
      <header className="flex flex-col gap-0.5 px-4 pt-3 pb-2">
        <h2 id={titleId} className="text-body-base font-semibold text-pk-content-primary">
          Winners
        </h2>
        <p className="text-body-sm text-pk-content-secondary" data-testid="winners-meta">
          <Meta
            parts={[
              <time dateTime={bounty.deadline}>Ended {formatEndedOn(bounty.deadline)}</time>,
              `${field.toLocaleString('en-US')} ${field === 1 ? 'entrant' : 'entrants'}`,
            ]}
          />
        </p>
      </header>

      {winners.length === 0 ? (
        <p className="px-4 pb-4 text-body-base text-pk-content-secondary">No entry was scored, so no prize was paid.</p>
      ) : (
        <ol className="flex flex-col gap-1 px-2 pb-2" aria-label="Paid places, in order">
          {winners.map((w) => (
            <WinnerRow key={w.place} winner={w} handle={handle} score={fmt(w.score)} margin={w.place === 1 && margin !== null ? fmt(margin) : null} />
          ))}
        </ol>
      )}

      {yours && (
        <p className="border-t border-pk-border px-4 py-3 text-body-sm font-semibold text-pk-content-primary" data-testid="winners-you">
          {yours}
        </p>
      )}
    </section>
  );
}

function WinnerRow({ winner: w, handle, score, margin }: { winner: Winner; handle: string; score: string; margin: string | null }) {
  const hero = w.place === 1;
  const medal = MEDAL[w.place - 1] ?? 'text-pk-gray-400';
  // Your row follows your current handle, so a rename relabels it.
  const name = w.you ? handle : w.hunter;
  return (
    <li
      data-testid="winner-row"
      data-place={w.place}
      data-you={w.you ? 'true' : undefined}
      className={`flex min-w-0 items-center gap-3 rounded-md px-2 ${hero ? 'bg-pk-gray-100 py-3' : 'py-2'}`}
    >
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-md ${hero ? 'size-12 bg-pk-elevated' : 'size-10 bg-pk-gray-100'}`}>
        <MedalGlyph className={`${hero ? 'size-8' : 'size-6'} ${medal}`} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="min-w-0 truncate text-body-base font-semibold text-pk-content-primary" data-testid="winner-handle">
            @{name}
          </span>
          {w.you && (
            <span className="shrink-0 text-body-sm text-pk-content-tertiary" data-testid="winner-you">
              (you)
            </span>
          )}
        </span>
        <span className="text-body-sm text-pk-content-secondary tabular-nums">
          <Meta parts={[<span className="font-semibold text-pk-content-primary">{ordinal(w.place)}</span>, <span data-testid="winner-score">{score}</span>]} />
        </span>
        {margin && (
          <span className="text-body-sm text-pk-content-secondary tabular-nums" data-testid="winner-margin">
            Won by {margin}
          </span>
        )}
      </span>
      <span className={`shrink-0 font-semibold text-pk-green-600 tabular-nums ${hero ? 'text-heading-xl' : 'text-body-base'}`} data-testid="winner-payout">
        <span className="sr-only">Paid </span>
        {formatBountyAmount(w.payout)}
      </span>
    </li>
  );
}

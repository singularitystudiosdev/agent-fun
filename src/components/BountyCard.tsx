import { useId } from 'react';
import { formatBountyAmount, formatEndedOn, type BoardBounty, type Bounty } from '../lib/bounty';
import { formatCountdown, isExpired, isUrgent, useCountdown } from '../lib/countdown';
import { useWinners } from '../lib/profile';
import { BountyIcon } from './BountyIcon';
import { BookmarkButton, CARD_SHELL } from './MarketCard';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * One rolling digit. Ten stacked glyphs share one cell that is one line high; each glyph sits at a line offset that
 * depends only on the digit shown. Counting down moves every glyph up one line, so the next (lower) digit rises in
 * from below and the old one leaves through the top, the same direction as the hero timer's 9..0 strip. The glyph
 * that wraps from the top of the ring to the bottom is invisible (opacity 0) at both ends.
 * The cell clips to the digits' own ink band (Inter digits span 0.21em..0.24em inside the 1.2em line), not the line
 * box: clipping at the line box let a half-rolled digit show below the baseline with the old one's tail above it.
 */
function RollDigit({ digit }: { digit: number }) {
  return (
    <span className="relative block shrink-0 [clip-path:inset(0.19em_0)]">
      {/* In-flow zero: gives the cell the exact advance width and line height of a tabular digit. */}
      <span className="invisible">0</span>
      {DIGITS.map((glyph) => {
        const line = ((digit - glyph + 14) % 10) - 4; // -4..5, 0 = the glyph on show
        return (
          <span
            key={glyph}
            className="absolute inset-0 text-center pk-roll motion-reduce:transition-none"
            style={{ transform: `translateY(${line * 100}%)`, opacity: line >= -1 && line <= 1 ? 1 : 0 }}
          >
            {glyph}
          </span>
        );
      })}
    </span>
  );
}

/** The real text node stays in flow (transparent while the overlay is active, like .pk-animated-label__text); the overlay is aria-hidden. */
export function RollingTime({ text, deadline, labelId, urgent }: { text: string; deadline: string; labelId: string; urgent: boolean }) {
  return (
    <time
      dateTime={deadline}
      role="timer"
      aria-labelledby={labelId}
      className={`relative inline-block whitespace-pre text-heading-xl tabular-nums ${urgent ? 'text-countdown-urgent' : 'text-pk-content-secondary'}`}
    >
      <span className="text-transparent motion-reduce:text-inherit forced-colors:text-inherit">{text}</span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex select-none motion-reduce:hidden forced-colors:hidden">
        {Array.from(text, (ch, i) => {
          const key = `r${text.length - i}`; // keyed from the right so seconds/minutes keep their cell when a leading field appears or vanishes
          return /\d/.test(ch) ? <RollDigit key={key} digit={Number(ch)} /> : <span key={key} className="whitespace-pre">{ch}</span>;
        })}
      </span>
    </time>
  );
}

const LABEL = 'text-body-xs font-semibold! text-pk-content-secondary whitespace-nowrap';

const ENDED_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const ENDED_DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
/** The footer's end date: "Oct 7", with the year only when it is not this year's. */
const formatEndedDay = (iso: string): string => {
  const d = new Date(iso);
  return (d.getFullYear() === new Date().getFullYear() ? ENDED_DAY : ENDED_DAY_YEAR).format(d);
};

/** A board listing (it has a slug and a leaderboard), as opposed to the replica's bare sample card. */
const isBoardBounty = (b: Bounty): b is BoardBounty => 'slug' in b && 'submissions' in b;

/** The countdown row of an ended board bounty: who took first place, "(you)" when it was you. Falls back to the end date. */
function WinnerRow({ bounty, labelId }: { bounty: BoardBounty; labelId: string }) {
  const winner = useWinners(bounty)[0];
  if (!winner) return <EndedRow deadline={bounty.deadline} labelId={labelId} />;
  return (
    <>
      <span id={labelId} className={`${LABEL} min-w-0`}>
        Won by
      </span>
      <p data-testid="bounty-winner" aria-labelledby={labelId} className="min-w-0 truncate text-heading-xl text-pk-content-primary">
        @{winner.hunter}
        {winner.you && <span className="text-pk-content-secondary"> (you)</span>}
      </p>
    </>
  );
}

function EndedRow({ deadline, labelId }: { deadline: string; labelId: string }) {
  return (
    <>
      <span id={labelId} className={`${LABEL} min-w-0`}>
        Ended
      </span>
      <time dateTime={deadline} className="text-heading-xl tabular-nums text-pk-content-secondary whitespace-pre">
        {formatEndedOn(deadline)}
      </time>
    </>
  );
}

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const labelId = useId();
  const remaining = useCountdown(bounty.deadline);
  const expired = isExpired(remaining);
  const count = bounty.submissionCount;
  /** An ended board listing is a won bounty: the winner replaces the countdown and the footer says when it ended. */
  const won = expired && isBoardBounty(bounty);
  const submissions = count === undefined ? null : `${count} ${count === 1 ? 'submission' : 'submissions'}`;
  return (
    <div className={CARD_SHELL} data-testid="bounty-card">
      <div className="flex w-full items-start gap-2 px-3 h-[42px] static">
        <div className="overflow-hidden rounded-sm relative w-[38px] min-w-[38px] h-[38px]" data-testid="bounty-icon">
          <BountyIcon bounty={bounty} />
        </div>
        <div className="flex flex-1 min-w-0 gap-4 justify-between cursor-default">
          <div className="flex-1 min-w-0 w-full">
            <a
              className="group !static flex h-fit w-full cursor-pointer touch-manipulation outline-none [-webkit-tap-highlight-color:transparent] after:absolute after:inset-0 after:z-20 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pk-gray-400"
              href={bounty.url}
            >
              <div className="flex flex-col justify-center min-h-[36px]">
                {/* Greedy wrap, not the market card's text-pretty: WebKit's `pretty` balances this title to two half-empty lines. */}
                <h3 className="text-body-base text-pk-content-primary font-[590] w-fit line-clamp-2 min-w-0">
                  {bounty.title}
                </h3>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-end gap-1.5 px-3 pb-2">
        <div className="relative h-20 w-full lg:mt-0.5">
          <div className="flex justify-between items-center gap-4 w-full shrink-0 min-h-10">
            {expired ? (
              won ? (
                <WinnerRow bounty={bounty} labelId={labelId} />
              ) : (
                <EndedRow deadline={bounty.deadline} labelId={labelId} />
              )
            ) : (
              <>
                <span id={labelId} className={`${LABEL} min-w-0`}>
                  Ends in
                </span>
                <RollingTime text={formatCountdown(remaining)} deadline={bounty.deadline} labelId={labelId} urgent={isUrgent(remaining)} />
              </>
            )}
          </div>
          <div className="flex justify-between items-center gap-4 w-full shrink-0 min-h-10">
            <span className={LABEL}>Bounty</span>
            <p className={`text-heading-2xl ${expired ? 'text-pk-content-secondary' : 'text-pk-content-primary'}`}>{formatBountyAmount(bounty.rewardAmount)}</p>
          </div>
        </div>
        <div className="flex w-full text-body-sm text-pk-content-secondary relative items-center">
          <div className="flex gap-2 justify-between items-center w-full overflow-x-auto whitespace-nowrap overflow-visible no-scrollbar">
            <div className="flex flex-row gap-1 items-center min-w-0">
              {won ? (
                <>
                  {submissions && <p className="shrink-0">{submissions}</p>}
                  {/* The rail's own divider between the two facts (a middle dot is a named meta-string tell). */}
                  {submissions && <span aria-hidden="true" className="mx-1 h-3.5 w-px shrink-0 bg-pk-gray-300" />}
                  <p className="truncate">
                    Ended <time dateTime={bounty.deadline}>{formatEndedDay(bounty.deadline)}</time>
                  </p>
                </>
              ) : (
                submissions && <p className="truncate">{submissions}</p>
              )}
            </div>
            <div className="flex justify-center items-center">
              <div className="flex">
                <BookmarkButton eventId={`bounty:${bounty.id}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

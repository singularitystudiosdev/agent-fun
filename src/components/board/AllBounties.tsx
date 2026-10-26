import type { BoardBounty } from '../../lib/bounty';
import { BountyCard } from '../BountyCard';

/**
 * The home page's bounty grid, directly under the sticky header. polymarket.com's "All markets" grid geometry:
 * `gap-3`, 1/2/3/4 columns at base/md/lg/xl, which gives 4 x 316.5px at the 1302px content width.
 * App filters and sorts `bounties` for the active header tab; this renders them in the given order.
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-1 focus-visible:ring-offset-pk-surface';
const ICON_BUTTON = `size-10 shrink-0 rounded-md inline-flex items-center justify-center cursor-pointer text-pk-content-primary hover:bg-pk-hover-overlay-darker transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING}`;

function MagnifierIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.75 15.75L11.6386 11.6386" />
      <path d="M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="13.25" y1="5.25" x2="16.25" y2="5.25" />
      <line x1="1.75" y1="5.25" x2="8.75" y2="5.25" />
      <line x1="4.75" y1="12.75" x2="1.75" y2="12.75" />
      <line x1="16.25" y1="12.75" x2="9.25" y2="12.75" />
      <circle cx="11" cy="5.25" r="2.25" />
      <circle cx="7" cy="12.75" r="2.25" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.75 2.75h8.5c.69 0 1.25.56 1.25 1.25v11.25l-5.5-3.65-5.5 3.65V4c0-.69.56-1.25 1.25-1.25Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AllBounties({ bounties, onShowAll }: { bounties: BoardBounty[]; onShowAll: () => void }) {
  return (
    <section
      id="all-bounties"
      data-testid="all-bounties"
      aria-label="Bounties"
      className="flex flex-col gap-1 w-full lg:max-w-[1350px] lg:mx-auto px-4 lg:px-6 pt-4 pb-10 scroll-mt-32"
    >
      <div className="flex items-center justify-end gap-0.5 -mr-2 lg:-mr-2.5">
        <button type="button" aria-label="Search bounties" className={ICON_BUTTON}>
          <MagnifierIcon />
        </button>
        <button type="button" aria-label="Filter bounties" className={ICON_BUTTON}>
          <SlidersIcon />
        </button>
        <button type="button" aria-label="Saved bounties" className={ICON_BUTTON}>
          <BookmarkIcon />
        </button>
      </div>

      {bounties.length > 0 ? (
        <ul role="list" aria-label="Bounties" className="grid h-auto gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bounties.map((b) => (
            <li key={b.id} className="relative h-[180px]" data-reward={b.rewardAmount} data-category={b.category}>
              <BountyCard bounty={b} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-pk-border py-12 px-4 text-center">
          <p className="text-body-base text-pk-content-secondary">No open bounties here right now.</p>
          <button
            type="button"
            onClick={onShowAll}
            className={`inline-flex items-center h-10 px-4 rounded-md border border-pk-border text-body-base font-semibold text-pk-content-primary cursor-pointer hover:bg-pk-hover-overlay-darker transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING}`}
          >
            Show all bounties
          </button>
        </div>
      )}
    </section>
  );
}

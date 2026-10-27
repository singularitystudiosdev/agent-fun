import { memo, useRef, useState, type ReactNode } from 'react';
import {
  activeFilterCount,
  DEFAULT_PANEL_FILTERS,
  ENDS_WITHIN_OPTIONS,
  LOW_COMPETITION_BELOW,
  MIN_REWARD_OPTIONS,
  minRewardLabel,
  parseRewardInput,
  queryTerms,
  sortOptionsFor,
  type BoardSort,
  type MinReward,
  type PanelFilters,
} from '../../lib/boardFilters';
import type { BoardStatus } from '../../lib/boardTabs';
import type { BoardBounty } from '../../lib/bounty';
import { isEnded } from '../../lib/wonBounties';
import { BountyCard } from '../BountyCard';
import { SelectMenu, type SelectMenuCustom } from './SelectMenu';

/**
 * The home page's bounty grid, directly under the sticky header. polymarket.com's "All markets" grid geometry:
 * `gap-3`, 1/2/3/4 columns at base/md/lg/xl, which gives 4 x 316.5px at the 1302px content width.
 * App picks and sorts `bounties` for the active header tab, then applies the toolbar's search, filters and Saved toggle;
 * this renders them in the given order. The toolbar's state lives in App (the header search shares `query`).
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-1 focus-visible:ring-offset-pk-surface';
const ICON_BUTTON = `relative size-10 shrink-0 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING}`;
const ICON_IDLE = `${ICON_BUTTON} text-pk-content-primary hover:bg-pk-hover-overlay-darker`;
const ICON_OPEN = `${ICON_BUTTON} text-pk-content-primary bg-pk-gray-100 hover:bg-pk-gray-200`;
const ICON_ON = `${ICON_BUTTON} text-pk-brand-500 bg-pk-blue-100 hover:bg-pk-blue-200`;
const TEXT_BUTTON = `inline-flex items-center h-8 px-2 -mx-2 rounded-md text-body-sm font-semibold text-pk-brand-500 cursor-pointer hover:bg-pk-blue-100 disabled:cursor-default disabled:text-pk-content-tertiary disabled:hover:bg-transparent transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING}`;
const OUTLINE_BUTTON = `inline-flex items-center h-10 px-4 rounded-md border border-pk-border text-body-base font-semibold text-pk-content-primary cursor-pointer hover:bg-pk-hover-overlay-darker transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING}`;

const SEARCH_ID = 'all-bounties-search';
const FILTER_BAR_ID = 'all-bounties-filters';

/** Cards re-render only when their bounty does: opening the filter bar, a menu or the search leaves them alone. */
const Card = memo(BountyCard);

/**
 * The card grid, memoised on `bounties` (App's memoised list), so toolbar state never re-renders 30 cards.
 * Each cell keeps polymarket's fixed 180px height.
 */
const BountyGrid = memo(function BountyGrid({ bounties }: { bounties: BoardBounty[] }) {
  return (
    <ul role="list" aria-label="Bounties" className="grid h-auto gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {bounties.map((b) => (
        <li key={b.id} className="relative h-[180px]" data-reward={b.rewardAmount} data-category={b.category} data-status={isEnded(b) ? 'won' : 'live'}>
          <Card bounty={b} />
        </li>
      ))}
    </ul>
  );
});

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

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.75 2.75h8.5c.69 0 1.25.56 1.25 1.25v11.25l-5.5-3.65-5.5 3.65V4c0-.69.56-1.25 1.25-1.25Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/*
 * Sort icons: polymarket.com's own 18px outline glyphs from its home sort menu (chunk 3dokwi3h578v0.js; the
 * 24hr Volume one also sits in the live trigger markup). Each maps to the polymarket sort it stands in for.
 */
const ICON_18 = { xmlns: 'http://www.w3.org/2000/svg', width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': true } as const;
const STROKE_18 = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** IconArrowTrendUpOutline18 (polymarket "24hr Volume"). */
function TrendUpIcon() {
  return (
    <svg {...ICON_18}>
      <path {...STROKE_18} d="M1.75,12.25l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l6.146-6.146" />
      <polyline {...STROKE_18} points="11.25 5.75 16.25 5.75 16.25 10.75" />
    </svg>
  );
}

/** IconFireFlameOutline18 (polymarket "Total Volume"). */
function FlameIcon() {
  return (
    <svg {...ICON_18}>
      <path {...STROKE_18} d="M6.962,16.25c-.28-2.75,1.803-2.097,1.875-4.501,1.581,.851,2.239,2.987,2.2,4.465" />
      <path {...STROKE_18} d="M11.037,16.214c3.901-1.516,4.725-5.833,1.964-9.85" />
      <path {...STROKE_18} d="M10.533,7.37s.696-3.766-2.044-5.62c-.364,4.375-5.109,4.531-5.109,9.237,0,2.117,1.096,4.402,3.582,5.263" />
    </svg>
  );
}

/** IconPopOutline18 (polymarket "Newest"): triangle, circle, sparkle. */
function ShapesIcon() {
  return (
    <svg {...ICON_18}>
      <path {...STROKE_18} d="m3.5417,3.6104l-1.7538,4.5807c-.1547.4042.1872.8238.6143.7539l4.8771-.7986c.4271-.0699.6173-.5768.3418-.9105l-3.1233-3.7821c-.2735-.3312-.8025-.2446-.9561.1566Z" />
      <circle {...STROKE_18} cx="13.5" cy="4.5" r="2.75" />
      <path
        {...STROKE_18}
        d="m14.25,12.5167h0c-1.274.9216-2.2147,2.2316-2.681,3.7333h0s0,0,0,0c-.9216-1.274-2.2316-2.2147-3.7333-2.681h0,0c1.274-.9216,2.2147-2.2316,2.681-3.7333h0s0,0,0,0c.9216,1.274,2.2316,2.2147,3.7333,2.681h0Z"
      />
    </svg>
  );
}

/** IconCircleHalfDottedClockOutline18 (polymarket "Ending Soon"). */
function DottedClockIcon() {
  return (
    <svg {...ICON_18}>
      <polyline {...STROKE_18} points="9 4.75 9 9 12.25 11.25" />
      <path {...STROKE_18} d="M9,1.75c4.004,0,7.25,3.246,7.25,7.25s-3.246,7.25-7.25,7.25" />
      {[
        [3.873, 14.127],
        [1.75, 9],
        [3.873, 3.873],
        [6.226, 15.698],
        [2.302, 11.774],
        [2.302, 6.226],
        [6.226, 2.302],
      ].map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="0.75" fill="currentColor" />
      ))}
    </svg>
  );
}

/** IconBoxingGloveOutline18 (polymarket "Competitive"): the least-contested bounties first. */
function BoxingGloveIcon() {
  return (
    <svg {...ICON_18}>
      <path {...STROKE_18} d="M13.25 13.25V15.25C13.25 15.802 12.802 16.25 12.25 16.25H6.75C6.198 16.25 5.75 15.802 5.75 15.25V13.25" />
      <path {...STROKE_18} d="M12.25 5.75C12.25 6.855 11.355 7.75 10.25 7.75H7.58002" />
      <path
        {...STROKE_18}
        d="M4.018 6.751C3.848 6.457 3.75 6.115 3.75 5.75V5.25C3.75 3.593 5.093 2.25 6.75 2.25H12.25C13.907 2.25 15.25 3.593 15.25 5.25V10.25C15.25 11.907 13.907 13.25 12.25 13.25H5.25C3.593 13.25 2.25 11.907 2.25 10.25V8.75C2.25 7.645 3.145 6.75 4.25 6.75H6C6.966 6.75 7.75 7.534 7.75 8.5C7.75 9.467 6.966 10.25 6 10.25H5.25"
      />
    </svg>
  );
}

/** TrendUpIcon mirrored top to bottom: the same arrow heading down. */
function TrendDownIcon() {
  return (
    <svg {...ICON_18}>
      <g transform="matrix(1 0 0 -1 0 18)">
        <path {...STROKE_18} d="M1.75,12.25l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l6.146-6.146" />
        <polyline {...STROKE_18} points="11.25 5.75 16.25 5.75 16.25 10.75" />
      </g>
    </svg>
  );
}

/** IconTrophyOutline18 (polymarket's Leaderboard nav icon). */
function TrophyIcon() {
  return (
    <svg {...ICON_18}>
      <path {...STROKE_18} d="M9.5 11.75C9.5 11.75 9.5 14.688 13.25 15.75H4.75C8.5 14.688 8.5 11.75 8.5 11.75" />
      <path {...STROKE_18} d="M5.286 9C1.469 9 1.74999 3.75 1.74999 3.75H4.42949" />
      <path {...STROKE_18} d="M12.714 9C16.532 9 16.25 3.75 16.25 3.75H13.5705" />
      <path {...STROKE_18} d="M13.75 2.25C13.1562 8.159 11.583 11.4958 9.23749 11.75H8.76251C6.41701 11.4958 4.8438 8.159 4.25 2.25H13.75Z" />
    </svg>
  );
}

/** IconChartActivityOutline18 (polymarket's Activity nav icon). */
function ActivityIcon() {
  return (
    <svg {...ICON_18}>
      <polyline {...STROKE_18} points="2 14 5 10.75 6 13.25 10 6.75 12 12.25 16 4" />
    </svg>
  );
}

/** lucide rotate-ccw-clock ("history"); polymarket has no oldest-first icon. Its 2px stroke on a 24 grid matches 1.5 on 18. */
function HistoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path {...STROKE_18} strokeWidth={2} d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path {...STROKE_18} strokeWidth={2} d="M3 3v5h5m4-1v5l4 2" />
    </svg>
  );
}

/** IconClockOutline18: the whole dial, against Ending soon's half-dotted one. */
function ClockIcon() {
  return (
    <svg {...ICON_18}>
      <circle {...STROKE_18} cx="9" cy="9" r="7.25" />
      <polyline {...STROKE_18} points="9 4.75 9 9 12.25 11.25" />
    </svg>
  );
}

const SORT_ICONS: Record<BoardSort, ReactNode> = {
  reward: <TrendUpIcon />,
  lowest: <TrendDownIcon />,
  prize: <TrophyIcon />,
  submissions: <FlameIcon />,
  fewest: <BoxingGloveIcon />,
  active: <ActivityIcon />,
  newest: <ShapesIcon />,
  oldest: <HistoryIcon />,
  ending: <DottedClockIcon />,
  'time-left': <ClockIcon />,
};
/** Each mode's sort menu (Won drops the live-only orders and renames the deadline ones), with polymarket's icons. */
const SORT_MENU_OPTIONS: Record<BoardStatus, { value: BoardSort; label: string; icon: ReactNode }[]> = {
  live: sortOptionsFor('live').map((o) => ({ ...o, icon: SORT_ICONS[o.value] })),
  won: sortOptionsFor('won').map((o) => ({ ...o, icon: SORT_ICONS[o.value] })),
};

/** The reward dropdown's typed minimum: "7500", "7,500", "7.5k" all read as $7,500+. */
const REWARD_CUSTOM: SelectMenuCustom<MinReward> = {
  label: 'Custom minimum reward',
  placeholder: 'Custom amount',
  prefix: '$',
  parse: parseRewardInput,
  format: minRewardLabel,
  toText: (n) => n.toLocaleString('en-US'),
};

/**
 * polymarket's "Hide sports" checkbox: a 16px box, gap-2, a 12px medium label. A native input, restyled; checked
 * fills the brand blue with polymarket's checkbox tick (CheckboxIcon20's path, chunk 27qu7qjdnlmmn.js) in white.
 */
function FilterCheckbox({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (next: boolean) => void; testId: string }) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-body-xs text-pk-content-primary">
      <span className="relative flex size-4 shrink-0">
        <input
          type="checkbox"
          data-testid={testId}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={`peer size-4 shrink-0 cursor-pointer appearance-none rounded-xs border border-pk-gray-300 bg-pk-surface transition-colors duration-150 motion-reduce:transition-none hover:border-pk-gray-500 checked:border-pk-brand-500 checked:bg-pk-brand-500 ${FOCUS_RING}`}
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-4 text-pk-surface opacity-0 peer-checked:opacity-100"
        >
          <path d="M0.75 3.75003L3 6.25003L7.25 0.750034" transform="translate(6 6.5)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </label>
  );
}

export function AllBounties({
  status = 'live',
  bounties,
  total,
  onShowAll,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  savedOnly,
  onSavedOnlyChange,
  sort,
  onSortChange,
  featured,
}: {
  /** The board's mode. Won hides the deadline menu (nothing is ending) and offers Won's sorts. */
  status?: BoardStatus;
  /** The trending carousel: rendered under the toolbar (and its filter row), above the grid. */
  featured?: ReactNode;
  /** The tab's bounties after the toolbar's refinements, in display order. */
  bounties: BoardBounty[];
  /** How many the tab shows before the toolbar's refinements. */
  total: number;
  onShowAll: () => void;
  query: string;
  onQueryChange: (next: string) => void;
  filters: PanelFilters;
  onFiltersChange: (next: PanelFilters) => void;
  savedOnly: boolean;
  onSavedOnlyChange: (next: boolean) => void;
  sort: BoardSort;
  onSortChange: (next: BoardSort) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filterCount = activeFilterCount(filters);
  const refined = queryTerms(query).length > 0 || filterCount > 0 || savedOnly;

  const toggleFilters = () => setFiltersOpen((open) => !open);

  const closeSearch = () => {
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  };

  const clearAll = () => {
    onQueryChange('');
    onFiltersChange(DEFAULT_PANEL_FILTERS);
    onSavedOnlyChange(false);
    setSearchOpen(false);
    // The Clear control unmounts with the summary; park focus on the toolbar instead of the document body.
    searchButtonRef.current?.focus();
  };

  const n = bounties.length;

  return (
    <section
      id="all-bounties"
      data-testid="all-bounties"
      aria-label="Bounties"
      className="flex flex-col gap-1 w-full lg:max-w-[1350px] lg:mx-auto px-4 lg:px-6 pt-4 pb-10 scroll-mt-32"
    >
      <div className="flex items-center justify-end gap-0.5 -mr-2 lg:-mr-2.5">
        {searchOpen && (
          <div id={SEARCH_ID} className="mr-1.5 min-w-0 flex-1 md:max-w-[360px]">
            <label className="flex h-10 w-full cursor-text items-center gap-1 rounded-md border border-transparent bg-pk-gray-100 px-2.5 transition-colors duration-150 motion-reduce:transition-none focus-within:border-pk-gray-300 focus-within:bg-pk-surface focus-within:ring-2 focus-within:ring-pk-content-secondary/40">
              <span className="shrink-0 text-pk-content-secondary">
                <MagnifierIcon />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                autoFocus
                autoComplete="off"
                aria-label="Search bounties"
                placeholder="Title, skill, sponsor..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeSearch();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent px-1 text-body-base font-medium text-pk-content-primary outline-none focus-visible:outline-none placeholder:text-pk-content-tertiary max-md:text-[16px] [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    onQueryChange('');
                    searchInputRef.current?.focus();
                  }}
                  className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pk-content-secondary outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-pk-hover-overlay-darker hover:text-pk-content-primary focus-visible:ring-2 focus-visible:ring-pk-content-secondary"
                >
                  <ClearIcon />
                </button>
              )}
            </label>
          </div>
        )}

        <button
          ref={searchButtonRef}
          type="button"
          aria-label="Search bounties"
          aria-expanded={searchOpen}
          aria-controls={searchOpen ? SEARCH_ID : undefined}
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          className={searchOpen ? ICON_OPEN : ICON_IDLE}
        >
          <MagnifierIcon />
        </button>

        <button
          type="button"
          aria-label={filterCount > 0 ? `Filter bounties, ${filterCount} active` : 'Filter bounties'}
          aria-expanded={filtersOpen}
          aria-controls={FILTER_BAR_ID}
          onClick={toggleFilters}
          className={filtersOpen ? ICON_OPEN : filterCount > 0 ? ICON_ON : ICON_IDLE}
        >
          <SlidersIcon />
          {!filtersOpen && filterCount > 0 && (
            <span
              aria-hidden="true"
              data-testid="filter-count"
              className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pk-brand-500 px-1 text-body-xs text-pk-surface tabular-nums ring-2 ring-pk-surface"
            >
              {filterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          aria-label="Saved bounties"
          aria-pressed={savedOnly}
          onClick={() => onSavedOnlyChange(!savedOnly)}
          className={savedOnly ? ICON_ON : ICON_IDLE}
        >
          <BookmarkIcon filled={savedOnly} />
        </button>
      </div>

      {/*
        polymarket's filter row under the icon row, left-aligned. It does not animate its height: that re-lays out and
        repaints the whole card grid every frame. The grid moves once, and the row itself fades and drops in on
        opacity and translate only (compositor work). Closed, it is hidden and inert. z-30 lifts its menus over the cards' z-20 link overlays.
      */}
      <div
        id={FILTER_BAR_ID}
        data-testid="filter-bar"
        data-state={filtersOpen ? 'open' : 'closed'}
        inert={!filtersOpen}
        hidden={!filtersOpen}
        className="relative z-30 -mt-1"
      >
        <div>
          <div
            role="group"
            aria-label="Sort and filter bounties"
            className="flex flex-wrap items-center gap-2 pt-2.5 pb-2 lg:pt-2 transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
          >
            <SelectMenu label="Sort by" value={sort} options={SORT_MENU_OPTIONS[status]} onChange={onSortChange} testId="filter-sort" />
            {status === 'live' && (
              <SelectMenu
                label="Ends within"
                value={filters.endsWithin}
                options={ENDS_WITHIN_OPTIONS}
                onChange={(endsWithin) => onFiltersChange({ ...filters, endsWithin })}
                testId="filter-ends"
              />
            )}
            <SelectMenu
              label="Minimum reward"
              value={filters.minReward}
              options={MIN_REWARD_OPTIONS}
              onChange={(minReward) => onFiltersChange({ ...filters, minReward })}
              testId="filter-reward"
              custom={REWARD_CUSTOM}
            />
            <FilterCheckbox
              label={`Under ${LOW_COMPETITION_BELOW} submissions`}
              checked={filters.competition === 'low'}
              onChange={(low) => onFiltersChange({ ...filters, competition: low ? 'low' : 'any' })}
              testId="filter-low-competition"
            />
          </div>
        </div>
      </div>

      {featured && <div className="pt-2 pb-4">{featured}</div>}

      <div role="status" className={refined && total > 0 ? 'flex items-center gap-3 pb-2' : 'sr-only'}>
        {refined && total > 0 && (
          <>
            <p className="text-body-sm text-pk-content-secondary tabular-nums">
              {n} {n === 1 ? 'bounty matches' : 'bounties match'}
            </p>
            <button type="button" onClick={clearAll} className={TEXT_BUTTON}>
              Clear
            </button>
          </>
        )}
      </div>

      {n > 0 ? (
        <BountyGrid bounties={bounties} />
      ) : total > 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-pk-border py-12 px-4 text-center">
          <p className="text-body-base text-pk-content-secondary">No bounties match these filters.</p>
          <button type="button" onClick={clearAll} className={OUTLINE_BUTTON}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-pk-border py-12 px-4 text-center">
          <p className="text-body-base text-pk-content-secondary">{status === 'won' ? 'No won bounties here yet.' : 'No open bounties here right now.'}</p>
          <button type="button" onClick={onShowAll} className={OUTLINE_BUTTON}>
            Show all bounties
          </button>
        </div>
      )}
    </section>
  );
}

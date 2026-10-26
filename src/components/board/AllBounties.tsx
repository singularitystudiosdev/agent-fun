import { useEffect, useRef, useState } from 'react';
import {
  activeFilterCount,
  COMPETITION_OPTIONS,
  DEFAULT_PANEL_FILTERS,
  ENDS_WITHIN_OPTIONS,
  MIN_REWARD_OPTIONS,
  queryTerms,
  type PanelFilters,
} from '../../lib/boardFilters';
import type { BoardBounty } from '../../lib/bounty';
import { BountyCard } from '../BountyCard';

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
const FILTER_PANEL_ID = 'all-bounties-filters';

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

/** One row of the filter popover: a labelled set of pressable segments, exactly one pressed. */
function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-body-xs text-pk-content-secondary">{legend}</legend>
      <div className="flex gap-0.5 rounded-md bg-pk-gray-100 p-0.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              data-value={o.value}
              onClick={() => onChange(o.value)}
              className={`h-8 flex-1 cursor-pointer rounded-md px-2 text-body-sm whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary ${
                on ? 'bg-pk-surface font-semibold text-pk-content-primary shadow-pk-minimal-soft' : 'text-pk-content-secondary hover:text-pk-content-primary'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FilterPanel({ filters, onChange, panelRef }: { filters: PanelFilters; onChange: (next: PanelFilters) => void; panelRef: React.RefObject<HTMLDivElement | null> }) {
  const count = activeFilterCount(filters);
  return (
    <div
      ref={panelRef}
      id={FILTER_PANEL_ID}
      role="dialog"
      aria-label="Filter bounties"
      className="absolute top-full right-0 z-20 mt-2 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-4 rounded-xl bg-pk-surface p-4 shadow-pk-middle animate-in fade-in motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between">
        <p className="text-body-base font-semibold text-pk-content-primary">Filters</p>
        <button type="button" className={TEXT_BUTTON} disabled={count === 0} onClick={() => onChange(DEFAULT_PANEL_FILTERS)}>
          Reset
        </button>
      </div>
      <Segmented legend="Minimum reward" options={MIN_REWARD_OPTIONS} value={filters.minReward} onChange={(minReward) => onChange({ ...filters, minReward })} />
      <Segmented legend="Ends within" options={ENDS_WITHIN_OPTIONS} value={filters.endsWithin} onChange={(endsWithin) => onChange({ ...filters, endsWithin })} />
      <Segmented legend="Competition" options={COMPETITION_OPTIONS} value={filters.competition} onChange={(competition) => onChange({ ...filters, competition })} />
    </div>
  );
}

export function AllBounties({
  bounties,
  total,
  onShowAll,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  savedOnly,
  onSavedOnlyChange,
}: {
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
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filterCount = activeFilterCount(filters);
  const refined = queryTerms(query).length > 0 || filterCount > 0 || savedOnly;

  // The filter popover closes on Escape (focus back to its button) or a press anywhere outside it.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setFiltersOpen(false);
      filterButtonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || filterButtonRef.current?.contains(target)) return;
      const focusInside = panelRef.current?.contains(document.activeElement) ?? false;
      setFiltersOpen(false);
      if (focusInside) filterButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    // Keyboard users land on the current choice of the first group.
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [filtersOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  };

  const clearAll = () => {
    onQueryChange('');
    onFiltersChange(DEFAULT_PANEL_FILTERS);
    onSavedOnlyChange(false);
    setFiltersOpen(false);
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

        <div className="relative">
          <button
            ref={filterButtonRef}
            type="button"
            aria-label={filterCount > 0 ? `Filter bounties, ${filterCount} active` : 'Filter bounties'}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-controls={filtersOpen ? FILTER_PANEL_ID : undefined}
            onClick={() => setFiltersOpen((open) => !open)}
            className={filtersOpen ? ICON_OPEN : filterCount > 0 ? ICON_ON : ICON_IDLE}
          >
            <SlidersIcon />
            {filterCount > 0 && (
              <span
                aria-hidden="true"
                data-testid="filter-count"
                className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pk-brand-500 px-1 text-body-xs text-pk-surface tabular-nums ring-2 ring-pk-surface"
              >
                {filterCount}
              </span>
            )}
          </button>
          {filtersOpen && <FilterPanel filters={filters} onChange={onFiltersChange} panelRef={panelRef} />}
        </div>

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
        <ul role="list" aria-label="Bounties" className="grid h-auto gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bounties.map((b) => (
            <li key={b.id} className="relative h-[180px]" data-reward={b.rewardAmount} data-category={b.category}>
              <BountyCard bounty={b} />
            </li>
          ))}
        </ul>
      ) : total > 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-pk-border py-12 px-4 text-center">
          <p className="text-body-base text-pk-content-secondary">No bounties match these filters.</p>
          <button type="button" onClick={clearAll} className={OUTLINE_BUTTON}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-pk-border py-12 px-4 text-center">
          <p className="text-body-base text-pk-content-secondary">No open bounties here right now.</p>
          <button type="button" onClick={onShowAll} className={OUTLINE_BUTTON}>
            Show all bounties
          </button>
        </div>
      )}
    </section>
  );
}

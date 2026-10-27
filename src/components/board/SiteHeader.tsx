import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { BoardBounty } from '../../lib/bounty';
import { BOUNTY_CATEGORIES } from '../../lib/bounty';
import { boardPath, DEFAULT_TAB, statusCounts, tabCounts, tabsFor } from '../../lib/boardTabs';
import type { BoardStatus, BoardTab } from '../../lib/boardTabs';
import { appHref } from '../../lib/paths';
import { useProfile } from '../../lib/profile';
import { Avatar } from '../profile/Avatar';

/*
 * polymarket.com's desktop nav (polymarket-clone/src/components/Header.tsx), rebranded for bounties.
 * Row 1: agent.fun wordmark, 600px search, help + your avatar (min-h 68px, pt-3 pb-2). Row 2: the h-12 tab rail.
 * The clone styled through polymarket's compiled CSS; every class here is a Tailwind utility or one of our tokens.
 */

/** The brand GIF (a square crop of the marching humanoid army), with a still first frame for reduced motion. */
const BRAND_GIF = new URL('../../assets/brand/agent-army.webp', import.meta.url).href;
const BRAND_STILL = new URL('../../assets/brand/agent-army-still.png', import.meta.url).href;

/** Where a tab lives in a mode: Live Trending is the bare board, the rest add `?status=won` and/or `?tab=<id>` (so middle-click opens it). */
const tabHref = (status: BoardStatus, id: BoardTab) => appHref(boardPath(status, id));

/** Shared control chrome (clone BUTTON_BASE, minus polymarket-only mix utilities). */
const CONTROL =
  'items-center justify-center shrink-0 cursor-pointer select-none outline-none font-semibold transition-[color,background-color,scale] duration-[120ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-pk-surface [&_svg]:pointer-events-none [&_svg]:shrink-0';
const ICON_BUTTON = `${CONTROL} inline-flex size-8 rounded-md text-pk-content-primary hover:bg-pk-hover-overlay-darker`;

/** Clone TAB_BASE: 48px-tall hit area, 10px side padding, 14px semibold label. The ring is inset so the rail's overflow cannot clip it. */
const TAB =
  'relative inline-flex h-full shrink-0 snap-start items-center gap-1.5 px-2.5 text-body-base font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none rounded-md focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pk-content-secondary';
const TAB_ACTIVE = `${TAB} text-pk-content-primary after:pointer-events-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-pk-content-primary`;
const TAB_INACTIVE = `${TAB} text-pk-content-secondary hover:text-pk-content-primary`;

/**
 * The Live bounties / Won bounties switch above the rail: the header's loudest type (heading-xl, 20px) and a 3px full-width
 * underline (the rail's is 2px, inset). No side padding, so the underline spans exactly the label and its count.
 */
const STATUS =
  'relative inline-flex h-full shrink-0 items-center gap-2 text-heading-xl font-semibold whitespace-nowrap outline-none rounded-md transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-pk-surface';
const STATUS_ACTIVE = `${STATUS} text-pk-content-primary after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:rounded-full after:bg-pk-content-primary`;
const STATUS_INACTIVE = `${STATUS} text-pk-content-secondary hover:text-pk-content-primary`;

const STATUS_LABELS: Record<BoardStatus, string> = { live: 'Live bounties', won: 'Won bounties' };

/** Plain left clicks switch in place; modified clicks (new tab, new window) keep the browser's default. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/* ---- Icons: polymarket's 20px glyph set as ported in the clone, plus a plain stroke mark for the wordmark. ---- */

const SearchIcon = ({ className = 'size-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M8.75 2.875a5.875 5.875 0 0 1 4.727 9.363l3.392 3.394a.875.875 0 0 1-1.237 1.237l-3.394-3.392A5.875 5.875 0 1 1 8.75 2.875m0 1.75a4.125 4.125 0 1 0 0 8.25 4.125 4.125 0 0 0 0-8.25" />
  </svg>
);

const ChevronIcon = ({ flip = false }: { flip?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={flip ? 'size-5 rotate-180' : 'size-5'}>
    <path fill="currentColor" d="M7.714 5.214a.877.877 0 0 1 1.238 0l4.166 4.167a.875.875 0 0 1 0 1.237l-4.166 4.167a.876.876 0 0 1-1.238-1.237l3.548-3.55-3.548-3.546a.877.877 0 0 1 0-1.238" />
  </svg>
);

/** The Trending tab's mark: a fire emoji in the 20px box the old trend-up arrow used, decorative (the tab's text names it). */
const TrendingIcon = () => (
  <span aria-hidden="true" data-testid="trending-fire" className="inline-flex size-5 items-center justify-center text-[16px] leading-none select-none">
    🔥
  </span>
);

/** The brand mark: the agent.fun GIF, frozen on its first frame when the user prefers reduced motion. */
const BrandMark = () => (
  <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-pk-gray-100">
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={BRAND_STILL} />
      <img src={BRAND_GIF} alt="" width={32} height={32} decoding="async" className="size-full object-cover" />
    </picture>
  </span>
);

/* ---- Pieces ---- */

/**
 * Your avatar, top right at every width: a plain link to /profile (App's router keeps it in place, a modified click opens
 * a new tab). Polymarket shows the avatar alone, so no name; the ring marks it as the current page on /profile.
 */
function ProfileLink({ active }: { active: boolean }) {
  const profile = useProfile();
  return (
    <a
      href={appHref('/profile')}
      aria-label="Your profile"
      data-testid="header-avatar"
      aria-current={active ? 'page' : undefined}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-[box-shadow,opacity] duration-[120ms] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface aria-[current=page]:ring-2 aria-[current=page]:ring-pk-content-primary aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-pk-surface motion-reduce:transition-none"
    >
      <Avatar profile={profile} size={32} />
    </a>
  );
}

const ClearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Clone SEARCH_LABEL: 40px, gray-100 fill, magnifier, "/" key chip that hides while focused.
 * Controlled by the board's search (App's `query`): typing filters the grid live; a clear button replaces the chip once there is text.
 */
function SearchField({ inputRef, id, value, onChange }: { inputRef: React.RefObject<HTMLInputElement | null>; id: string; value: string; onChange: (next: string) => void }) {
  return (
    <form role="search" className="w-full" onSubmit={(event) => event.preventDefault()}>
      <label
        htmlFor={id}
        className="group/search relative flex h-10 w-full cursor-text items-center gap-0.5 rounded-md border border-transparent bg-pk-gray-100 px-2.5 transition-colors duration-150 motion-reduce:transition-none hover:bg-pk-gray-200/70 focus-within:border-pk-gray-300 focus-within:bg-pk-surface focus-within:ring-2 focus-within:ring-pk-content-secondary/40 [&_input]:max-lg:text-[16px]!"
      >
        <span className="shrink-0 text-pk-content-primary">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          id={id}
          type="search"
          autoComplete="off"
          aria-label="Search bounties"
          aria-keyshortcuts="/"
          placeholder="Search bounties..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          // The focus indicator is the label's focus-within ring-2 (the whole field), so the input's own outline is dropped.
          className="min-w-0 flex-1 bg-transparent px-1 text-body-base font-medium text-pk-content-primary outline-none focus-visible:outline-none placeholder:text-pk-content-primary/40 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pk-content-secondary outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-pk-hover-overlay-darker hover:text-pk-content-primary focus-visible:ring-2 focus-visible:ring-pk-content-secondary"
          >
            <ClearIcon />
          </button>
        ) : (
          <span aria-hidden="true" className="flex shrink-0 items-center rounded-md bg-pk-content-primary/5 px-1.5 py-0.5 group-focus-within/search:hidden">
            <span className="font-mono text-[13px] leading-4 font-semibold tracking-[-0.09px] text-pk-gray-500">/</span>
          </span>
        )}
      </label>
    </form>
  );
}

function StatusLink({ status, href, active, count, onSelect }: { status: BoardStatus; href: string; active: boolean; count: number; onSelect: (s: BoardStatus) => void }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSelect(status);
  };
  return (
    <a href={href} onClick={onClick} data-testid={`status-${status}`} aria-current={active ? 'page' : undefined} className={active ? STATUS_ACTIVE : STATUS_INACTIVE}>
      <span>{STATUS_LABELS[status]}</span>
      <span data-testid={`status-${status}-count`} className="text-body-base font-medium text-pk-content-secondary tabular-nums">
        {count}
      </span>
    </a>
  );
}

function Tab({ id, href, won, active, icon, label, count, onSelect }: { id: BoardTab; href: string; won: boolean; active: boolean; icon?: ReactNode; label: string; count: number; onSelect: (t: BoardTab) => void }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSelect(id);
  };
  return (
    <a href={href} onClick={onClick} data-tab={id} aria-current={active ? 'page' : undefined} className={active ? TAB_ACTIVE : TAB_INACTIVE}>
      {icon}
      <span>{label}</span>
      <span className="text-body-xs font-medium text-pk-content-secondary tabular-nums" aria-label={`${count} ${won ? 'won' : 'open'}`}>
        {count}
      </span>
    </a>
  );
}

/* ---- Header ---- */

export function SiteHeader({
  bounties,
  status,
  onStatusChange,
  tab,
  onTabChange,
  query,
  onQueryChange,
  profileActive = false,
}: {
  /** Every bounty, open and won: each mode counts its own. */
  bounties: BoardBounty[];
  /** The board's mode: the rail shows its tabs and counts. */
  status: BoardStatus;
  onStatusChange: (s: BoardStatus) => void;
  /** The current tab on the board; null on /profile and /bounty/*, where no tab and neither switch side is current. */
  tab: BoardTab | null;
  onTabChange: (t: BoardTab) => void;
  /** The board search, owned by App; typing here filters the grid live. */
  query: string;
  onQueryChange: (next: string) => void;
  /** On /profile: the avatar link carries aria-current="page". */
  profileActive?: boolean;
}) {
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [now] = useState(() => Date.now());

  /** Listings per tab in the current mode (open or ended as of page load), and per mode for the switch. */
  const counts = useMemo(() => tabCounts(bounties, now, status), [bounties, now, status]);
  const modeCounts = useMemo(() => statusCounts(bounties, now), [bounties, now]);
  const onBoard = tab !== null;

  // "/" focuses search (desktop field, or opens the compact one below lg); Escape blurs it. Ignored while typing elsewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (event.key === 'Escape' && (target === desktopInputRef.current || target === mobileInputRef.current)) {
        (target as HTMLInputElement).blur();
        return;
      }
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || typing) return;
      event.preventDefault();
      if (window.matchMedia('(min-width: 1024px)').matches) desktopInputRef.current?.focus();
      else setMobileSearchOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) mobileInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      observer.disconnect();
    };
  }, [updateArrows]);

  const scrollRail = (direction: -1 | 1) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    railRef.current?.scrollBy({ left: direction * 300, behavior: reduce ? 'auto' : 'smooth' });
  };

  // Fade the rail's clipped edge(s), as polymarket's pk-scroll-fade-x-stateful does with a 40px mask.
  const railMask =
    canScrollLeft && canScrollRight
      ? '[mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%-48px),transparent)]'
      : canScrollRight
        ? '[mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]'
        : canScrollLeft
          ? '[mask-image:linear-gradient(to_right,transparent,black_48px)]'
          : '';

  return (
    <header data-testid="site-header" className="sticky top-0 z-30 w-full border-b border-pk-border bg-pk-surface">
      {/* Row 1 */}
      <div className="mx-auto flex w-full max-w-[1350px] items-center justify-between gap-4 px-4 pt-3 pb-3 lg:min-h-[68px] lg:px-6 lg:pb-2">
        <a href={appHref('/')} aria-label="agent.fun home" className="flex h-10 shrink-0 items-center gap-2 rounded-md px-1 text-pk-content-primary outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface">
          <BrandMark />
          <span className="text-heading-2xl font-semibold tracking-[-0.03em]">agent.fun</span>
        </a>

        <div className="hidden w-full min-w-0 lg:flex">
          <div className="w-full max-w-[600px]">
            <SearchField inputRef={desktopInputRef} id="board-search" value={query} onChange={onQueryChange} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-1 md:gap-x-2">
          <button
            type="button"
            aria-label="Search bounties"
            aria-expanded={mobileSearchOpen}
            aria-controls="board-search-mobile-row"
            onClick={() => setMobileSearchOpen((open) => !open)}
            className={`${ICON_BUTTON} lg:hidden`}
          >
            <SearchIcon />
          </button>
          <ProfileLink active={profileActive} />
        </div>
      </div>

      {mobileSearchOpen && (
        <div id="board-search-mobile-row" className="px-4 pb-3 lg:hidden">
          <SearchField inputRef={mobileInputRef} id="board-search-mobile" value={query} onChange={onQueryChange} />
        </div>
      )}

      {/*
        Row 2: the Live / Won switch, at every width. Aligned to the rail: the same container, and from lg the labels start where
        the rail's tab labels do (the rail tabs' 10px side padding). Off the board neither side is current and each opens that mode.
      */}
      <div role="navigation" aria-label="Bounty status" data-testid="status-switch" className="mx-auto w-full max-w-[1350px] px-4 lg:px-6">
        <div className="flex h-12 items-stretch gap-6 lg:px-2.5">
          {(['live', 'won'] as const).map((s) => (
            <StatusLink
              key={s}
              status={s}
              href={tabHref(s, onBoard && tabsFor(s).some((t) => t.id === tab) ? tab : DEFAULT_TAB)}
              active={onBoard && status === s}
              count={modeCounts[s]}
              onSelect={onStatusChange}
            />
          ))}
        </div>
      </div>

      {/* Row 3: the category rail (lg and up). */}
      <nav aria-label="Bounty tabs" className="mx-auto hidden w-full max-w-[1350px] px-6 lg:flex">
        <div className="relative w-full min-w-0">
          <div ref={railRef} className={`no-scrollbar flex h-12 w-full min-w-0 snap-x snap-mandatory items-center overflow-x-auto scroll-px-3 ${railMask}`}>
            <div className="flex h-full w-max min-w-full items-center pr-10">
              {tabsFor(status).map(({ id, label }) => (
                <Fragment key={id}>
                  {id === BOUNTY_CATEGORIES[0] && <span aria-hidden="true" className="mx-2 h-3.5 w-px shrink-0 bg-pk-gray-300" />}
                  <Tab id={id} href={tabHref(status, id)} won={status === 'won'} label={label} count={counts[id] ?? 0} active={tab === id} icon={id === 'trending' ? <TrendingIcon /> : undefined} onSelect={onTabChange} />
                </Fragment>
              ))}
            </div>
          </div>

          {canScrollLeft && (
            <button type="button" aria-label="Scroll categories left" onClick={() => scrollRail(-1)} className={`${ICON_BUTTON} absolute top-1/2 left-0 z-[3] -translate-y-1/2 bg-pk-surface text-pk-gray-500 hover:bg-pk-gray-100 hover:text-pk-content-primary`}>
              <ChevronIcon flip />
            </button>
          )}
          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollRail(1)}
            disabled={!canScrollRight}
            className={`${ICON_BUTTON} absolute top-1/2 right-0 z-[3] -translate-y-1/2 bg-pk-surface text-pk-gray-500 hover:bg-pk-gray-100 hover:text-pk-content-primary disabled:cursor-default disabled:text-pk-gray-300 disabled:hover:bg-pk-surface`}
          >
            <ChevronIcon />
          </button>
        </div>
      </nav>
    </header>
  );
}

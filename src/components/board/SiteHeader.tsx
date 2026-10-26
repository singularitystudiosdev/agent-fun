import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { BoardBounty } from '../../lib/bounty';
import { BOARD_TABS, DEFAULT_TAB, tabCounts } from '../../lib/boardTabs';
import type { BoardTab } from '../../lib/boardTabs';
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

/** Where a tab lives: the default tab is the bare board, every other one is `/?tab=<id>` (so middle-click opens it). */
const tabHref = (id: BoardTab) => appHref(id === DEFAULT_TAB ? '/' : `/?tab=${encodeURIComponent(id)}`);

/** Shared control chrome (clone BUTTON_BASE, minus polymarket-only mix utilities). */
const CONTROL =
  'items-center justify-center shrink-0 cursor-pointer select-none outline-none font-semibold transition-[color,background-color,scale] duration-[120ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-pk-surface [&_svg]:pointer-events-none [&_svg]:shrink-0';
const ICON_BUTTON = `${CONTROL} inline-flex size-8 rounded-md text-pk-content-primary hover:bg-pk-hover-overlay-darker`;

/** Clone TAB_BASE: 48px-tall hit area, 10px side padding, 14px semibold label. The ring is inset so the rail's overflow cannot clip it. */
const TAB =
  'relative inline-flex h-full shrink-0 snap-start items-center gap-1.5 px-2.5 text-body-base font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none rounded-md focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pk-content-secondary';
const TAB_ACTIVE = `${TAB} text-pk-content-primary after:pointer-events-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-pk-content-primary`;
const TAB_INACTIVE = `${TAB} text-pk-content-secondary hover:text-pk-content-primary`;

/* ---- Icons: polymarket's 20px glyph set as ported in the clone, plus a plain stroke mark for the wordmark. ---- */

const SearchIcon = ({ className = 'size-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M8.75 2.875a5.875 5.875 0 0 1 4.727 9.363l3.392 3.394a.875.875 0 0 1-1.237 1.237l-3.394-3.392A5.875 5.875 0 1 1 8.75 2.875m0 1.75a4.125 4.125 0 1 0 0 8.25 4.125 4.125 0 0 0 0-8.25" />
  </svg>
);

const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5">
    <path fill="currentColor" d="M9.791 12.567a1.001 1.001 0 0 1 0 2 1.001 1.001 0 0 1 0-2m.314-7.29c1.27 0 2.667.93 2.668 2.658 0 .605-.16 1.096-.445 1.499-.267.376-.612.626-.86.8-.535.376-.733.511-.804.912a.85.85 0 0 1-1.675-.293c.21-1.195 1.06-1.7 1.502-2.011.242-.17.368-.276.45-.392.064-.09.132-.23.132-.515 0-.612-.45-.958-.969-.958-.602 0-1.14.277-1.381.935a.85.85 0 0 1-1.596-.586c.534-1.455 1.809-2.048 2.978-2.049" />
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M10 1.9a8.1 8.1 0 0 1 8.1 8.1 8.1 8.1 0 0 1-8.1 8.1A8.1 8.1 0 0 1 1.9 10 8.1 8.1 0 0 1 10 1.9m0 1.7a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8" />
  </svg>
);

const ChevronIcon = ({ flip = false }: { flip?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={flip ? 'size-5 rotate-180' : 'size-5'}>
    <path fill="currentColor" d="M7.714 5.214a.877.877 0 0 1 1.238 0l4.166 4.167a.875.875 0 0 1 0 1.237l-4.166 4.167a.876.876 0 0 1-1.238-1.237l3.548-3.55-3.548-3.546a.877.877 0 0 1 0-1.238" />
  </svg>
);

const TrendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-5">
    <path d="M1.75,12.25l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l6.146-6.146" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <polyline points="11.25 5.75 16.25 5.75 16.25 10.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
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

function Tab({ id, active, icon, label, count, onSelect }: { id: BoardTab; active: boolean; icon?: ReactNode; label: string; count: number; onSelect: (t: BoardTab) => void }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Plain left clicks switch in place; modified clicks (new tab, new window) keep the browser's default.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(id);
  };
  return (
    <a href={tabHref(id)} onClick={onClick} data-tab={id} aria-current={active ? 'page' : undefined} className={active ? TAB_ACTIVE : TAB_INACTIVE}>
      {icon}
      <span>{label}</span>
      <span className="text-body-xs font-medium text-pk-content-secondary tabular-nums" aria-label={`${count} open`}>
        {count}
      </span>
    </a>
  );
}

/* ---- Header ---- */

export function SiteHeader({
  bounties,
  tab,
  onTabChange,
  query,
  onQueryChange,
  profileActive = false,
}: {
  bounties: BoardBounty[];
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

  /** Open listings per tab (deadline still ahead at page load). */
  const counts = useMemo(() => tabCounts(bounties, now), [bounties, now]);

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
          <button type="button" aria-label="Help" className={`${ICON_BUTTON} hidden! lg:inline-flex!`}>
            <HelpIcon />
          </button>
          <ProfileLink active={profileActive} />
        </div>
      </div>

      {mobileSearchOpen && (
        <div id="board-search-mobile-row" className="px-4 pb-3 lg:hidden">
          <SearchField inputRef={mobileInputRef} id="board-search-mobile" value={query} onChange={onQueryChange} />
        </div>
      )}

      {/* Row 2: the category rail (lg and up). */}
      <nav aria-label="Bounty tabs" className="mx-auto hidden w-full max-w-[1350px] px-6 lg:flex">
        <div className="relative w-full min-w-0">
          <div ref={railRef} className={`no-scrollbar flex h-12 w-full min-w-0 snap-x snap-mandatory items-center overflow-x-auto scroll-px-3 ${railMask}`}>
            <div className="flex h-full w-max min-w-full items-center pr-10">
              {BOARD_TABS.map(({ id, label }) => (
                <Fragment key={id}>
                  <Tab id={id} label={label} count={counts[id]} active={tab === id} icon={id === 'trending' ? <TrendingIcon /> : undefined} onSelect={onTabChange} />
                  {id === 'ending' && <span aria-hidden="true" className="mx-2 h-3.5 w-px shrink-0 bg-pk-gray-300" />}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AllBounties } from './components/board/AllBounties';
import { BountyPage } from './components/board/BountyPage';
import { WonBountyPage } from './components/board/WonBountyPage';
import { SiteHeader } from './components/board/SiteHeader';
import { TrendingCarousel } from './components/board/TrendingCarousel';
import { ProfilePage } from './components/profile/ProfilePage';
import { applyBoardFilters, DEFAULT_PANEL_FILTERS, isSortFor, sortBounties, tabDefaultSort, type BoardSort, type PanelFilters } from './lib/boardFilters';
import { boardPath, DEFAULT_STATUS, DEFAULT_TAB, hasTab, isBoardStatus, isBoardTab, selectBounties, type BoardStatus, type BoardTab } from './lib/boardTabs';
import type { BoardBounty } from './lib/bounty';
import { BOARD_BOUNTIES } from './lib/bountyData';
import { appHref, appPath } from './lib/paths';
import { useProfile } from './lib/profile';
import { useSavedIds } from './lib/saved';
import { findBounty, isEnded, WON_BOUNTIES } from './lib/wonBounties';
import { ReplicaView } from './ReplicaView';

const view = new URLSearchParams(window.location.search).get('view');
const BOUNTY_PREFIX = '/bounty/';
const PROFILE_PATH = '/profile';
const isProfilePath = (p: string) => p === PROFILE_PATH || p === `${PROFILE_PATH}/`;
/** The current app path (the Pages base stripped): "/", "/bounty/<slug>" or "/profile". */
const currentPath = () => appPath(window.location.pathname);

/** Every bounty the board knows: the open listings and every previously won one. Each mode picks its own from this. */
const ALL_BOUNTIES: BoardBounty[] = [...BOARD_BOUNTIES, ...WON_BOUNTIES];

/** How many of the Trending tab's top bounties the featured carousel cycles through. */
const FEATURED_COUNT = 5;

/** `?status=won` is the Won bounties board; no param (or anything else) is Live. */
const readStatus = (): BoardStatus => {
  const s = new URLSearchParams(window.location.search).get('status');
  return isBoardStatus(s) ? s : DEFAULT_STATUS;
};

/** The URL's tab, when the URL's mode has it (Won has no "Ending soon"); else Trending. */
const readTab = (): BoardTab => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return isBoardTab(t) && hasTab(readStatus(), t) ? t : DEFAULT_TAB;
};

/** The board search lives in `?q=` so a filtered board can be shared and survives a reload. */
const readQuery = (): string => new URLSearchParams(window.location.search).get('q') ?? '';

/** A sort the user picked over the tab's default lives in `?sort=`; absent or unknown means the tab's own order. */
const readSort = (): BoardSort | null => {
  const s = new URLSearchParams(window.location.search).get('sort');
  return isSortFor(readStatus(), s) ? s : null;
};

/** agent.fun: the bounty grid (header tabs filter and sort it), one page per bounty at /bounty/<slug>, and your profile at /profile. */
export default function App() {
  if (view === 'replica') return <ReplicaView />;
  return <Board />;
}

function Board() {
  const [path, setPath] = useState(currentPath);
  const [status, setStatus] = useState<BoardStatus>(readStatus);
  const [tab, setTab] = useState<BoardTab>(readTab);
  const [query, setQuery] = useState(readQuery);
  const [filters, setFilters] = useState<PanelFilters>(DEFAULT_PANEL_FILTERS);
  const [savedOnly, setSavedOnly] = useState(false);
  /** The filter bar's sort when the user picked one; null follows the tab (`tabDefaultSort`). */
  const [sortOverride, setSortOverride] = useState<BoardSort | null>(readSort);
  const savedIds = useSavedIds();
  const profile = useProfile();
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  /** `to` is a full in-app href (base included, as `appHref` and every rendered link produce). */
  const navigate = useCallback((to: string) => {
    // The search follows the user around the board (tabs, the logo), so board URLs carry it.
    const url = new URL(to, window.location.href);
    if (appPath(url.pathname) === '/' && queryRef.current && !url.searchParams.has('q')) url.searchParams.set('q', queryRef.current);
    window.history.pushState(null, '', url.pathname + url.search + url.hash);
    setPath(currentPath());
    setStatus(readStatus());
    setTab(readTab());
    // A tab click or the logo starts that tab in its own order (the sort, unlike the search, does not follow).
    setSortOverride(readSort());
    window.scrollTo({ top: 0 });
  }, []);

  // A tiny history router: same-origin links to "/", "/bounty/..." or "/profile" navigate in place; Back/Forward re-read the URL.
  useEffect(() => {
    const onPop = () => {
      setPath(currentPath());
      setStatus(readStatus());
      setTab(readTab());
      // Back/Forward onto the board restores that entry's search and sort (none in the URL: the tab's own order);
      // a bounty page keeps the current ones.
      if (currentPath() === '/') {
        setQuery(readQuery());
        setSortOverride(readSort());
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const target = appPath(url.pathname);
      if (target !== '/' && !target.startsWith(BOUNTY_PREFIX) && !isProfilePath(target)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return; // in-page anchor
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick);
    };
  }, [navigate]);

  /** A header tab, in the current mode. */
  const selectTab = useCallback((next: BoardTab) => navigate(appHref(boardPath(status, next))), [navigate, status]);

  const onProfile = isProfilePath(path);
  const slug = path.startsWith(BOUNTY_PREFIX) ? decodeURIComponent(path.slice(BOUNTY_PREFIX.length)) : null;
  const onBoard = !onProfile && slug === null;

  /**
   * The Live / Won switch: the board in that mode. The search follows (navigate carries `q`), the sort override resets, and the
   * tab stays when the new mode has it (Trading -> Trading), else Trending. Off the board it opens that mode's Trending.
   */
  const selectStatus = useCallback(
    (next: BoardStatus) => navigate(appHref(boardPath(next, onBoard && hasTab(next, tab) ? tab : DEFAULT_TAB))),
    [navigate, onBoard, tab],
  );

  const bounty = slug ? findBounty(slug) : undefined;
  const tabbed = useMemo(() => selectBounties(ALL_BOUNTIES, tab, Date.now(), status), [tab, status]);
  /** The featured feed over the grid: Live Trending's top bounties (polymarket.com shows Featured on its Trending home only). Won has none. */
  const featured = useMemo(() => (status === 'live' && tab === 'trending' ? tabbed.slice(0, FEATURED_COUNT) : []), [status, tab, tabbed]);
  const defaultSort = tabDefaultSort(tab, status);
  const sort = sortOverride ?? defaultSort;
  /** Won bounties have no deadline ahead, so the hidden "Ends within" filter never applies there. */
  const modeFilters = useMemo<PanelFilters>(() => (status === 'won' ? { ...filters, endsWithin: 'any' } : filters), [filters, status]);
  const shown = useMemo(
    () => sortBounties(applyBoardFilters(tabbed, { query, ...modeFilters, savedOnly }, savedIds), sort),
    [tabbed, query, modeFilters, savedOnly, savedIds, sort],
  );
  /** Only a sort that differs from the tab's default goes in the URL. */
  const sortParam = sort === defaultSort ? null : sort;

  // Mirror the search and a non-default sort into the board's URL (replaceState: typing must not stack history entries).
  // Bounty pages and the profile keep a clean URL.
  useEffect(() => {
    if (path !== '/') return;
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (sortParam) url.searchParams.set('sort', sortParam);
    else url.searchParams.delete('sort');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [query, sortParam, path]);

  /** The header search: typing anywhere off the board (a bounty, the profile) brings the user to the board so the results show. */
  const changeHeaderQuery = useCallback(
    (next: string) => {
      setQuery(next);
      queryRef.current = next;
      if (path !== '/') navigate(appHref('/'));
    },
    [navigate, path],
  );

  useEffect(() => {
    document.title = onProfile
      ? `${profile.displayName} (@${profile.handle}) | agent.fun`
      : bounty
        ? `${bounty.title} | agent.fun`
        : slug === null && status === 'won'
          ? 'Won bounties | agent.fun'
          : 'agent.fun';
  }, [bounty, onProfile, slug, status, profile.displayName, profile.handle]);

  return (
    <div className="min-h-dvh bg-pk-surface text-pk-content-primary">
      <SiteHeader
        bounties={ALL_BOUNTIES}
        status={status}
        onStatusChange={selectStatus}
        tab={onBoard ? tab : null}
        onTabChange={selectTab}
        query={query}
        onQueryChange={changeHeaderQuery}
        profileActive={onProfile}
      />
      <main id="main" className="w-full">
        {onProfile ? (
          <ProfilePage />
        ) : slug === null ? (
          <>
            <h1 className="sr-only">{status === 'won' ? 'Won bounties' : 'agent.fun bounties'}</h1>
            <AllBounties
              status={status}
              // Under the toolbar, over the grid. Hidden while searching: the results are what the user asked for. Keyed
              // by mode so a Live / Won switch starts at slide 1.
              featured={featured.length > 0 && !query ? <TrendingCarousel key={status} bounties={featured} status={status} /> : null}
              bounties={shown}
              total={tabbed.length}
              onShowAll={() => selectTab(DEFAULT_TAB)}
              query={query}
              onQueryChange={setQuery}
              filters={modeFilters}
              onFiltersChange={setFilters}
              savedOnly={savedOnly}
              onSavedOnlyChange={setSavedOnly}
              sort={sort}
              onSortChange={setSortOverride}
            />
          </>
        ) : bounty ? (
          // A won bounty opens its winning repository; a live one opens the full page with the entry form.
          isEnded(bounty) ? <WonBountyPage bounty={bounty} /> : <BountyPage bounty={bounty} />
        ) : (
          <div className="mx-auto flex max-w-[1350px] flex-col items-start gap-3 px-6 py-16">
            <h1 className="text-heading-xl">This bounty does not exist.</h1>
            <a href={appHref('/')} className="text-body-base font-semibold text-pk-brand-500 hover:underline">
              Back to all bounties
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

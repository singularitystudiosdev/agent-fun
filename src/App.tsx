import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AllBounties } from './components/board/AllBounties';
import { BountyPage } from './components/board/BountyPage';
import { SiteHeader } from './components/board/SiteHeader';
import { ProfilePage } from './components/profile/ProfilePage';
import { applyBoardFilters, DEFAULT_PANEL_FILTERS, isBoardSort, sortBounties, tabDefaultSort, type BoardSort, type PanelFilters } from './lib/boardFilters';
import { DEFAULT_TAB, isBoardTab, selectBounties, type BoardTab } from './lib/boardTabs';
import { BOARD_BOUNTIES } from './lib/bountyData';
import { appHref, appPath } from './lib/paths';
import { useProfile } from './lib/profile';
import { useSavedIds } from './lib/saved';
import { ReplicaView } from './ReplicaView';

const view = new URLSearchParams(window.location.search).get('view');
const BOUNTY_PREFIX = '/bounty/';
const PROFILE_PATH = '/profile';
const isProfilePath = (p: string) => p === PROFILE_PATH || p === `${PROFILE_PATH}/`;
/** The current app path (the Pages base stripped): "/", "/bounty/<slug>" or "/profile". */
const currentPath = () => appPath(window.location.pathname);

const readTab = (): BoardTab => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return isBoardTab(t) ? t : DEFAULT_TAB;
};

/** The board search lives in `?q=` so a filtered board can be shared and survives a reload. */
const readQuery = (): string => new URLSearchParams(window.location.search).get('q') ?? '';

/** A sort the user picked over the tab's default lives in `?sort=`; absent or unknown means the tab's own order. */
const readSort = (): BoardSort | null => {
  const s = new URLSearchParams(window.location.search).get('sort');
  return isBoardSort(s) ? s : null;
};

/** agent.fun: the bounty grid (header tabs filter and sort it), one page per bounty at /bounty/<slug>, and your profile at /profile. */
export default function App() {
  if (view === 'replica') return <ReplicaView />;
  return <Board />;
}

function Board() {
  const [path, setPath] = useState(currentPath);
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
    setTab(readTab());
    // A tab click or the logo starts that tab in its own order (the sort, unlike the search, does not follow).
    setSortOverride(readSort());
    window.scrollTo({ top: 0 });
  }, []);

  // A tiny history router: same-origin links to "/", "/bounty/..." or "/profile" navigate in place; Back/Forward re-read the URL.
  useEffect(() => {
    const onPop = () => {
      setPath(currentPath());
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

  const selectTab = useCallback(
    (next: BoardTab) => navigate(appHref(next === DEFAULT_TAB ? '/' : `/?tab=${encodeURIComponent(next)}`)),
    [navigate],
  );

  const onProfile = isProfilePath(path);
  const slug = path.startsWith(BOUNTY_PREFIX) ? decodeURIComponent(path.slice(BOUNTY_PREFIX.length)) : null;
  const bounty = slug ? BOARD_BOUNTIES.find((b) => b.slug === slug) : undefined;
  const tabbed = useMemo(() => selectBounties(BOARD_BOUNTIES, tab), [tab]);
  const defaultSort = tabDefaultSort(tab);
  const sort = sortOverride ?? defaultSort;
  const shown = useMemo(
    () => sortBounties(applyBoardFilters(tabbed, { query, ...filters, savedOnly }, savedIds), sort),
    [tabbed, query, filters, savedOnly, savedIds, sort],
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
        : 'agent.fun';
  }, [bounty, onProfile, profile.displayName, profile.handle]);

  return (
    <div className="min-h-dvh bg-pk-surface text-pk-content-primary">
      <SiteHeader
        bounties={BOARD_BOUNTIES}
        tab={slug || onProfile ? null : tab}
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
            <h1 className="sr-only">agent.fun bounties</h1>
            <AllBounties
              bounties={shown}
              total={tabbed.length}
              onShowAll={() => selectTab(DEFAULT_TAB)}
              query={query}
              onQueryChange={setQuery}
              filters={filters}
              onFiltersChange={setFilters}
              savedOnly={savedOnly}
              onSavedOnlyChange={setSavedOnly}
              sort={sort}
              onSortChange={setSortOverride}
            />
          </>
        ) : bounty ? (
          <BountyPage bounty={bounty} />
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

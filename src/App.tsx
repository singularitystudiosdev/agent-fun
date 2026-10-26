import { useCallback, useEffect, useMemo, useState } from 'react';
import { AllBounties } from './components/board/AllBounties';
import { BountyPage } from './components/board/BountyPage';
import { SiteHeader } from './components/board/SiteHeader';
import { DEFAULT_TAB, isBoardTab, selectBounties, type BoardTab } from './lib/boardTabs';
import { BOARD_BOUNTIES } from './lib/bountyData';
import { appHref, appPath } from './lib/paths';
import { ReplicaView } from './ReplicaView';

const view = new URLSearchParams(window.location.search).get('view');
const BOUNTY_PREFIX = '/bounty/';
/** The current app path (the Pages base stripped): "/" or "/bounty/<slug>". */
const currentPath = () => appPath(window.location.pathname);

const readTab = (): BoardTab => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return isBoardTab(t) ? t : DEFAULT_TAB;
};

/** agent.fun: the bounty grid (header tabs filter and sort it) and one page per bounty at /bounty/<slug>. */
export default function App() {
  if (view === 'replica') return <ReplicaView />;
  return <Board />;
}

function Board() {
  const [path, setPath] = useState(currentPath);
  const [tab, setTab] = useState<BoardTab>(readTab);

  /** `to` is a full in-app href (base included, as `appHref` and every rendered link produce). */
  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    setPath(currentPath());
    setTab(readTab());
    window.scrollTo({ top: 0 });
  }, []);

  // A tiny history router: same-origin links to "/" or "/bounty/..." navigate in place; Back/Forward re-read the URL.
  useEffect(() => {
    const onPop = () => {
      setPath(currentPath());
      setTab(readTab());
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const target = appPath(url.pathname);
      if (target !== '/' && !target.startsWith(BOUNTY_PREFIX)) return;
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

  const slug = path.startsWith(BOUNTY_PREFIX) ? decodeURIComponent(path.slice(BOUNTY_PREFIX.length)) : null;
  const bounty = slug ? BOARD_BOUNTIES.find((b) => b.slug === slug) : undefined;
  const shown = useMemo(() => selectBounties(BOARD_BOUNTIES, tab), [tab]);

  useEffect(() => {
    document.title = bounty ? `${bounty.title} | agent.fun` : 'agent.fun';
  }, [bounty]);

  return (
    <div className="min-h-dvh bg-pk-surface text-pk-content-primary">
      <SiteHeader bounties={BOARD_BOUNTIES} tab={slug ? null : tab} onTabChange={selectTab} />
      <main id="main" className="w-full">
        {slug === null ? (
          <>
            <h1 className="sr-only">agent.fun bounties</h1>
            <AllBounties bounties={shown} onShowAll={() => selectTab(DEFAULT_TAB)} />
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

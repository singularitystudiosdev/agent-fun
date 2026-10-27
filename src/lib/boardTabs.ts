import { BOUNTY_CATEGORIES, byRewardDesc, type BoardBounty, type BountyCategory } from './bounty';

/** The header's tabs: three views of every open bounty, then one per category. */
export type BoardTab = 'trending' | 'new' | 'ending' | BountyCategory;

/** The header's Live bounties / Won bounties switch: open listings, or every bounty whose deadline has passed. */
export type BoardStatus = 'live' | 'won';

export const DEFAULT_STATUS: BoardStatus = 'live';

export const isBoardStatus = (s: string | null | undefined): s is BoardStatus => s === 'live' || s === 'won';

const CATEGORY_TABS = BOUNTY_CATEGORIES.map((c) => ({ id: c as BoardTab, label: c as string }));

/** Live mode's tabs (the board as it always was). */
export const BOARD_TABS: readonly { id: BoardTab; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'ending', label: 'Ending soon' },
  ...CATEGORY_TABS,
];

/** Won mode's tabs: nothing is ending, so "New" becomes "Recently won" and "Ending soon" is dropped. */
export const WON_TABS: readonly { id: BoardTab; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'Recently won' },
  ...CATEGORY_TABS,
];

export const tabsFor = (status: BoardStatus): readonly { id: BoardTab; label: string }[] => (status === 'won' ? WON_TABS : BOARD_TABS);

export const DEFAULT_TAB: BoardTab = 'trending';

export const isBoardTab = (s: string | null | undefined): s is BoardTab => BOARD_TABS.some((t) => t.id === s);

/** True when `tab` is one of `status`'s tabs (Won mode has no "Ending soon"). */
export const hasTab = (status: BoardStatus, tab: BoardTab): boolean => tabsFor(status).some((t) => t.id === tab);

/**
 * The board's in-app path for a mode and tab: Live Trending is the bare board; Won adds `status=won`, any other tab adds `tab=<id>`
 * (status first). Wrap it in `appHref` for a link.
 */
export function boardPath(status: BoardStatus, tab: BoardTab): string {
  const params = new URLSearchParams();
  if (status !== DEFAULT_STATUS) params.set('status', status);
  if (tab !== DEFAULT_TAB) params.set('tab', tab);
  const search = params.toString();
  return search ? `/?${search}` : '/';
}

const isOpen = (b: BoardBounty, now: number) => Date.parse(b.deadline) > now;

/** Latest deadline first (the most recently won), ties as the rest of the board breaks them. */
const byDeadlineDesc = (a: BoardBounty, b: BoardBounty) => Date.parse(b.deadline) - Date.parse(a.deadline) || byRewardDesc(a, b);

/**
 * What a tab shows.
 * Live (the default): open bounties only. Trending: highest reward first (the board's default order). New: newest first.
 * Ending soon: nearest deadline first. A category: that category, highest reward first.
 * Won: bounties whose deadline has passed. Trending: highest reward first. Recently won (`new`): latest deadline first.
 * A category: that category, highest reward first. Won has no "Ending soon" tab; asked for it, it answers with Trending's list.
 */
export function selectBounties(all: readonly BoardBounty[], tab: BoardTab, now: number = Date.now(), status: BoardStatus = DEFAULT_STATUS): BoardBounty[] {
  if (status === 'won') {
    const won = all.filter((b) => !isOpen(b, now));
    switch (tab) {
      case 'new':
        return won.sort(byDeadlineDesc);
      case 'trending':
      case 'ending':
        return won.sort(byRewardDesc);
      default:
        return won.filter((b) => b.category === tab).sort(byRewardDesc);
    }
  }
  const open = all.filter((b) => isOpen(b, now));
  switch (tab) {
    case 'trending':
      return open.sort(byRewardDesc);
    case 'new':
      return open.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    case 'ending':
      return open.sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
    default:
      return open.filter((b) => b.category === tab).sort(byRewardDesc);
  }
}

/** Bounties per tab in `status`'s mode, for the header's counts. Only that mode's tabs are present. */
export function tabCounts(all: readonly BoardBounty[], now: number = Date.now(), status: BoardStatus = DEFAULT_STATUS): Record<BoardTab, number> {
  return Object.fromEntries(tabsFor(status).map((t) => [t.id, selectBounties(all, t.id, now, status).length])) as Record<BoardTab, number>;
}

/** How many bounties each mode holds, for the Live / Won switch's counts. */
export function statusCounts(all: readonly BoardBounty[], now: number = Date.now()): Record<BoardStatus, number> {
  const live = all.filter((b) => isOpen(b, now)).length;
  return { live, won: all.length - live };
}

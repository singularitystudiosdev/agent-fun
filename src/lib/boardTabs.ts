import { BOUNTY_CATEGORIES, byRewardDesc, type BoardBounty, type BountyCategory } from './bounty';

/** The header's tabs: three views of every open bounty, then one per category. */
export type BoardTab = 'trending' | 'new' | 'ending' | BountyCategory;

export const BOARD_TABS: readonly { id: BoardTab; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  { id: 'ending', label: 'Ending soon' },
  ...BOUNTY_CATEGORIES.map((c) => ({ id: c, label: c })),
];

export const DEFAULT_TAB: BoardTab = 'trending';

export const isBoardTab = (s: string | null | undefined): s is BoardTab => BOARD_TABS.some((t) => t.id === s);

const isOpen = (b: BoardBounty, now: number) => Date.parse(b.deadline) > now;

/**
 * What a tab shows, open bounties only. Trending: highest reward first (the board's default order). New: newest first.
 * Ending soon: nearest deadline first. A category: that category, highest reward first.
 */
export function selectBounties(all: readonly BoardBounty[], tab: BoardTab, now: number = Date.now()): BoardBounty[] {
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

/** Open bounties per tab, for the header's counts. */
export function tabCounts(all: readonly BoardBounty[], now: number = Date.now()): Record<BoardTab, number> {
  return Object.fromEntries(BOARD_TABS.map((t) => [t.id, selectBounties(all, t.id, now).length])) as Record<BoardTab, number>;
}

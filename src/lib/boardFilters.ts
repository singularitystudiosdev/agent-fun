import { byRewardDesc, type BoardBounty } from './bounty';
import type { BoardTab } from './boardTabs';

/**
 * The board's filter bar: a sort dropdown, two filter dropdowns (minimum reward, deadline window) and a
 * "low competition" checkbox, inline above the grid. The header tab picks the list; these refine and re-order it.
 */

export type MinReward = 0 | 5_000 | 10_000 | 20_000;
export type EndsWithin = 'any' | '24h' | '7d' | '14d';
export type Competition = 'any' | 'low';

/** What the filter bar's dropdowns and checkbox set (the search box, the Saved toggle and the sort live outside it). */
export interface PanelFilters {
  minReward: MinReward;
  endsWithin: EndsWithin;
  competition: Competition;
}

export interface BoardFilters extends PanelFilters {
  query: string;
  savedOnly: boolean;
}

export const DEFAULT_PANEL_FILTERS: PanelFilters = { minReward: 0, endsWithin: 'any', competition: 'any' };
export const DEFAULT_BOARD_FILTERS: BoardFilters = { ...DEFAULT_PANEL_FILTERS, query: '', savedOnly: false };

/** "Low competition": fewer submissions than this. */
export const LOW_COMPETITION_BELOW = 25;

const HOUR = 3_600_000;
export const ENDS_WITHIN_MS: Record<Exclude<EndsWithin, 'any'>, number> = { '24h': 24 * HOUR, '7d': 7 * 24 * HOUR, '14d': 14 * 24 * HOUR };

/**
 * The filter bar's dropdown choices, in display order. Each label stands alone: the selected one is the
 * dropdown trigger's text, and every one is a menu row.
 */
export const MIN_REWARD_OPTIONS: readonly { value: MinReward; label: string }[] = [
  { value: 0, label: 'Any reward' },
  { value: 5_000, label: '$5,000+' },
  { value: 10_000, label: '$10,000+' },
  { value: 20_000, label: '$20,000+' },
];
export const ENDS_WITHIN_OPTIONS: readonly { value: EndsWithin; label: string }[] = [
  { value: 'any', label: 'Any deadline' },
  { value: '24h', label: 'Ends in 24h' },
  { value: '7d', label: 'Ends in 7 days' },
  { value: '14d', label: 'Ends in 14 days' },
];
/** The checkbox's two states: unchecked is 'any', checked is 'low' (its label is the checkbox's label). */
export const COMPETITION_OPTIONS: readonly { value: Competition; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'low', label: `Under ${LOW_COMPETITION_BELOW} submissions` },
];

/** Lower-cased, whitespace-split search terms; empty when the query is blank. */
export const queryTerms = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean);

const haystack = (b: BoardBounty): string => [b.title, b.category, ...b.skills, b.sponsor.name].join('\n').toLowerCase();

/** How many filter-bar filters differ from their defaults (sort is an order, not a filter, and never counts). */
export function activeFilterCount(f: PanelFilters): number {
  return Number(f.minReward !== DEFAULT_PANEL_FILTERS.minReward) + Number(f.endsWithin !== DEFAULT_PANEL_FILTERS.endsWithin) + Number(f.competition !== DEFAULT_PANEL_FILTERS.competition);
}

/** True when anything narrows the list: a search term, a filter-bar filter or the Saved toggle (never the sort). */
export const isRefined = (f: BoardFilters): boolean => queryTerms(f.query).length > 0 || activeFilterCount(f) > 0 || f.savedOnly;

/**
 * The bounties that pass every refinement, in the incoming order (the tab already sorted them).
 * `query`: every whitespace-separated term must appear (case-insensitive) in the title, category, a skill or the sponsor name.
 * `savedIds`: bounty ids (not the `bounty:` bookmark key) the user has saved; used only when `savedOnly` is on.
 */
export function applyBoardFilters<T extends BoardBounty>(
  list: readonly T[],
  filters: BoardFilters,
  savedIds: ReadonlySet<string> = new Set(),
  now: number = Date.now(),
): T[] {
  const terms = queryTerms(filters.query);
  const span = filters.endsWithin === 'any' ? null : ENDS_WITHIN_MS[filters.endsWithin];
  return list.filter((b) => {
    if (b.rewardAmount < filters.minReward) return false;
    if (span !== null) {
      const left = Date.parse(b.deadline) - now;
      if (!(left > 0 && left <= span)) return false;
    }
    if (filters.competition === 'low' && b.submissionCount >= LOW_COMPETITION_BELOW) return false;
    if (filters.savedOnly && !savedIds.has(b.id)) return false;
    if (terms.length > 0) {
      const text = haystack(b);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });
}

/** The sort dropdown's orders. */
export type BoardSort = 'reward' | 'submissions' | 'newest' | 'ending' | 'fewest';

/** The sort dropdown's choices, in display order. */

export const SORT_OPTIONS: readonly { value: BoardSort; label: string }[] = [
  { value: 'reward', label: 'Highest reward' },
  { value: 'submissions', label: 'Most submissions' },
  { value: 'newest', label: 'Newest' },
  { value: 'ending', label: 'Ending soon' },
  { value: 'fewest', label: 'Fewest submissions' },
];

export const isBoardSort = (s: string | null | undefined): s is BoardSort => SORT_OPTIONS.some((o) => o.value === s);

const PRIMARY: Record<BoardSort, (a: BoardBounty, b: BoardBounty) => number> = {
  reward: (a, b) => b.rewardAmount - a.rewardAmount,
  submissions: (a, b) => b.submissionCount - a.submissionCount,
  newest: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  ending: (a, b) => Date.parse(a.deadline) - Date.parse(b.deadline),
  fewest: (a, b) => a.submissionCount - b.submissionCount,
};

/**
 * A new array in `sort` order. Ties break by `byRewardDesc` (reward desc, then nearest deadline: the order
 * BOARD_BOUNTIES and the tabs already use), then id asc, so the result never depends on the incoming order.
 * A tab's default sort (`tabDefaultSort`) reproduces that tab's own order, so the default never changes what a tab shows.
 */
export function sortBounties<T extends BoardBounty>(list: readonly T[], sort: BoardSort): T[] {
  const primary = PRIMARY[sort];
  return [...list].sort((a, b) => primary(a, b) || byRewardDesc(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The sort a header tab starts with: the order `selectBounties` gives that tab. */
export function tabDefaultSort(tab: BoardTab): BoardSort {
  switch (tab) {
    case 'new':
      return 'newest';
    case 'ending':
      return 'ending';
    default:
      return 'reward'; // trending and every category
  }
}

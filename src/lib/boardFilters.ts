import type { BoardBounty } from './bounty';

/** The board toolbar's refinements, applied after the header tab has picked and sorted the list. */

export type MinReward = 0 | 5_000 | 10_000 | 20_000;
export type EndsWithin = 'any' | '24h' | '7d' | '14d';
export type Competition = 'any' | 'low';

/** What the filter popover sets (the search box and the Saved toggle live outside it). */
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

/** The popover's segmented choices, in display order. */
export const MIN_REWARD_OPTIONS: readonly { value: MinReward; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 5_000, label: '$5,000+' },
  { value: 10_000, label: '$10,000+' },
  { value: 20_000, label: '$20,000+' },
];
export const ENDS_WITHIN_OPTIONS: readonly { value: EndsWithin; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
];
export const COMPETITION_OPTIONS: readonly { value: Competition; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'low', label: `Under ${LOW_COMPETITION_BELOW} submissions` },
];

/** Lower-cased, whitespace-split search terms; empty when the query is blank. */
export const queryTerms = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean);

const haystack = (b: BoardBounty): string => [b.title, b.category, ...b.skills, b.sponsor.name].join('\n').toLowerCase();

/** How many popover filters differ from their defaults (the badge on the filter icon). */
export function activeFilterCount(f: PanelFilters): number {
  return Number(f.minReward !== DEFAULT_PANEL_FILTERS.minReward) + Number(f.endsWithin !== DEFAULT_PANEL_FILTERS.endsWithin) + Number(f.competition !== DEFAULT_PANEL_FILTERS.competition);
}

/** True when anything narrows the list: a search term, a popover filter or the Saved toggle. */
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

// Polymarket's public read API. Field names follow the Gamma `/events/:id` response verbatim;
// list-valued fields (outcomes, outcomePrices, clobTokenIds, clobRewards) arrive as JSON-encoded strings.
import { getPercentChanceFromMarket } from './odds';

export const GAMMA_URL = 'https://gamma-api.polymarket.com';
export const POLYMARKET_URL = 'https://polymarket.com';

export interface GammaMarket {
  id: string;
  slug: string;
  conditionId?: string;
  question?: string;
  groupItemTitle?: string;
  active: boolean;
  closed: boolean;
  showGmpOutcome?: boolean;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds?: string;
  bestBid?: number | null;
  bestAsk?: number | null;
  lastTradePrice?: number | null;
  spread?: number | null;
  rewardsMinSize?: number;
  rewardsMaxSpread?: number;
  clobRewards?: Array<{ conditionId: string; rewardsDailyRate: number; startDate?: string; endDate?: string }>;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  icon: string;
  volume: number;
  negRisk?: boolean;
  closed?: boolean;
  showAllOutcomes?: boolean;
  sortBy?: string;
  seriesVolume24hr?: number;
  series?: unknown[];
  markets: GammaMarket[];
}

export function parseList(raw: string | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** getMarketProbability: outcomePrices[0], else last trade, bid, ask. */
function marketProbability(m: GammaMarket): number {
  const first = Number.parseFloat(parseList(m.outcomePrices)[0] ?? '');
  if (Number.isFinite(first)) return clamp01(first);
  for (const field of [m.lastTradePrice, m.bestBid, m.bestAsk]) {
    if (typeof field === 'number' && Number.isFinite(field)) return clamp01(field);
  }
  return 0;
}

/**
 * The two markets a multi-outcome card shows (polymarket.com bucketEventMarkets + aggregatedSort +
 * sortMarketsByPriceDesc): active and open only, negRisk events drop sub-1% markets unless
 * showAllOutcomes, then a stable sort by Yes price descending.
 */
export function selectCardRows(event: GammaEvent, count = 2): GammaMarket[] {
  const expanded: Array<GammaMarket & { sortKey: number }> = [];
  for (const m of event.markets) {
    if (!m?.active) continue;
    if (event.closed) {
      expanded.push({ ...m, sortKey: 0 });
      continue;
    }
    if (m.closed) continue;
    const first = Number.parseFloat(parseList(m.outcomePrices)[0] ?? '');
    let sortKey = Number.isFinite(first) ? 100 * first : 0;
    const chance = getPercentChanceFromMarket(m);
    if (chance.showLastPrice) {
      if (chance.lastPrice !== undefined) sortKey = chance.lastPrice;
    } else sortKey = 0;
    if (!event.showAllOutcomes && !m.showGmpOutcome && event.negRisk && sortKey >= 0 && sortKey < 1) continue;
    expanded.push({ ...m, sortKey });
  }
  if (event.sortBy === 'price') expanded.sort((a, b) => (a.sortKey > b.sortKey ? -1 : +(a.sortKey < b.sortKey)));
  return [...expanded].sort((a, b) => marketProbability(b) - marketProbability(a)).slice(0, count);
}

export async function fetchEvent(id: string, signal?: AbortSignal): Promise<GammaEvent> {
  const res = await fetch(`${GAMMA_URL}/events/${id}`, { signal });
  if (!res.ok) throw new Error(`Gamma /events/${id} answered ${res.status}`);
  return (await res.json()) as GammaEvent;
}

export const eventHref = (eventSlug: string) => `${POLYMARKET_URL}/event/${eventSlug}`;
export const marketHref = (eventSlug: string, marketSlug: string) => `${eventHref(eventSlug)}/${marketSlug}`;
export const tradeHref = (eventSlug: string, marketSlug: string, outcomeIndex: 0 | 1) =>
  `${eventHref(eventSlug)}?marketSlug=${marketSlug}&outcomeIndex=${outcomeIndex}`;

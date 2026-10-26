// The card's "34%" and the pill hover labels, transcribed from polymarket.com's bundles
// (getPercentChance / getPercentChanceFromMarket, precision 2 => whole percent). The number is the
// bid/ask midpoint, the last trade only on a wide spread, and outcomePrices only with no book at all.
import { parseList, type GammaMarket } from './gamma';

export interface PercentChance {
  lastPriceString?: string;
  lastPrice?: number;
  showLastPrice: boolean;
}

const NONE: PercentChance = { showLastPrice: false };

const label = (pct: number) => {
  const whole = Number.parseFloat(pct.toFixed(0));
  return whole < 1 ? '<1%' : `${whole.toFixed(0)}%`;
};

function getPercentChance(lastTrade: string | undefined, ask: number, bid: number, spread: number, hasAsks: boolean, hasBids: boolean): PercentChance {
  if (!hasAsks && !hasBids && !lastTrade) return NONE;
  const trade = lastTrade === undefined ? NaN : Number.parseFloat(lastTrade);
  const tradeInBook = Number.isFinite(trade) && Number.isFinite(bid) && Number.isFinite(ask) && trade >= bid && trade <= ask;
  if (spread > 0.1 && tradeInBook) {
    const pct = 100 * trade;
    return { lastPriceString: label(pct), lastPrice: pct, showLastPrice: spread <= 0.5 };
  }
  const mid = hasAsks && hasBids ? (bid + (ask - bid) / 2) * 100 : hasBids ? 100 * bid : hasAsks ? 100 * ask : undefined;
  if (mid === undefined) return NONE;
  return { lastPriceString: label(mid), lastPrice: mid, showLastPrice: true };
}

export function getPercentChanceFromMarket(m: GammaMarket): PercentChance {
  const ask = typeof m.bestAsk === 'number' && Number.isFinite(m.bestAsk) ? m.bestAsk : undefined;
  const bid = typeof m.bestBid === 'number' && Number.isFinite(m.bestBid) ? m.bestBid : undefined;
  const hasAsks = ask !== undefined && ask > 0;
  const hasBids = bid !== undefined && bid > 0;
  const prices = parseList(m.outcomePrices);
  if (!m.lastTradePrice && !hasAsks && !hasBids && prices.length) {
    const pct = 100 * Number.parseFloat(prices[0]);
    const whole = Number.parseInt(pct.toFixed(), 10);
    return { lastPriceString: whole < 1 ? '<1%' : `${whole}%`, lastPrice: pct, showLastPrice: true };
  }
  const topAsk = hasAsks ? ask! : 1;
  const topBid = hasBids ? bid! : 0;
  const spread = m.spread !== 1 && m.spread ? m.spread : topAsk - topBid;
  return getPercentChance(m.lastTradePrice?.toString(), topAsk, topBid, spread, hasAsks, hasBids);
}

export interface RowView {
  name: string;
  pct: string;
  yesLabel: string;
  noLabel: string;
  yesHover: string;
  noHover: string;
  hoverEnabled: boolean;
}

// Hover labels round the unrounded Yes value and its complement separately (live: Yes 65%, No hover 36%).
const hoverLabel = (pct: number) => `${pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%`;

export function rowView(m: GammaMarket): RowView {
  const chance = getPercentChanceFromMarket(m);
  const show = chance.showLastPrice && chance.lastPrice !== undefined && chance.lastPriceString !== undefined;
  const yes = chance.lastPrice ?? 0;
  const outcomes = parseList(m.outcomes);
  const outcomeLabel = (i: 0 | 1) => {
    const name = outcomes[i] ?? (i ? 'No' : 'Yes');
    return name === 'Yes' || name === 'No' ? name : `${name.slice(0, 3)}.`;
  };
  return {
    name: m.groupItemTitle ?? m.question ?? '',
    pct: show ? chance.lastPriceString! : '-',
    yesLabel: outcomeLabel(0),
    noLabel: outcomeLabel(1),
    yesHover: hoverLabel(yes),
    noHover: hoverLabel(100 - yes),
    hoverEnabled: show,
  };
}

import type { GammaEvent } from './lib/gamma';
import { BASE } from './lib/paths';

// Gamma /events/655483 as captured 2026-10-25, trimmed to the fields the card reads.
// Served with ?snapshot=1 (pixel comparison) and whenever the live fetch fails.
export const SERBIA_PM_SNAPSHOT: GammaEvent = {
  id: '655483',
  slug: 'next-prime-minister-of-serbia-20260629223938642',
  title: 'Next Prime Minister of Serbia?',
  // The 96w webp polymarket.com's /_next/image resizer serves a DPR-2 browser for `sizes="38px"`.
  icon: `${BASE}icons/serbia-event-icon-96.webp`,
  volume: 2923146.720185,
  negRisk: true,
  showAllOutcomes: true,
  sortBy: 'price',
  markets: [
    {
      id: 'soskic',
      slug: 'will-dejan-soskic-be-the-next-prime-minister-of-serbia',
      groupItemTitle: 'Dejan Šoškić',
      active: true,
      closed: false,
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.3385", "0.6615"]',
      bestBid: 0.337,
      bestAsk: 0.34,
      lastTradePrice: 0.34,
      spread: 0.003,
      conditionId: '0x0a9dca54cd3c0a1075cef28fe33f25717d88cceb9e085b214ebb8ae4e4c57575',
      rewardsMinSize: 150,
      rewardsMaxSpread: 6.5,
      clobRewards: [{ conditionId: '0x0a9dca54cd3c0a1075cef28fe33f25717d88cceb9e085b214ebb8ae4e4c57575', rewardsDailyRate: 1137 }],
      clobTokenIds:
        '["26089189064819305641567468661995220924133888028817933093328136160256834694408", "39327093648989475248440677391796784378243177545825434991706549573320777654762"]',
    },
    {
      id: 'srdanovic',
      slug: 'will-ilija-srdanovic-be-the-next-prime-minister-of-serbia-20260629223938652',
      groupItemTitle: 'Ilija Srdanović',
      active: true,
      closed: false,
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.21", "0.79"]',
      bestBid: 0.2,
      bestAsk: 0.22,
      lastTradePrice: 0.19,
      spread: 0.02,
      conditionId: '0x75743159df076ee110ede9e386bf9cad91df081c8bd04f3f05e5d7c141a51f33',
      rewardsMinSize: 150,
      rewardsMaxSpread: 6.5,
      clobRewards: [{ conditionId: '0x75743159df076ee110ede9e386bf9cad91df081c8bd04f3f05e5d7c141a51f33', rewardsDailyRate: 615 }],
      clobTokenIds:
        '["12288525947764397960021713424576849007970406950510265136663237558531782770669", "101226184178185301575746639770865679445085395472617450519014563899036010908480"]',
    },
  ],
};

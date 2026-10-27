import type { MemeIcon } from './memeIcons';

/**
 * Task-matched memes for the 18 won (closed) bounties, by slug. Every template here is one no live listing shows
 * (MEME_EXTRA_A..D), so no meme repeats anywhere on the site. Pool templates live in src/assets/memes/<template>/; the
 * ones pulled for this set live in src/assets/memes/e-<template>/ (rebuilt by scripts/fetch-memes.mjs).
 *
 * Literal `new URL(..., import.meta.url)` per file so Vite fingerprints and emits each asset; no value import from
 * memeIcons (it imports this module).
 */
const IMGFLIP = (id: number, page: string) => `https://imgflip.com/memetemplate/${id}/${page}`;

export const MEME_EXTRA_E: Record<string, MemeIcon> = {
  // Trading
  'jupiter-launch-fill': {
    src: new URL('../assets/memes/leonardo-dicaprio-cheers/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/leonardo-dicaprio-cheers/still.png', import.meta.url).href,
    template: 'Leonardo DiCaprio Cheers',
    slug: 'leonardo-dicaprio-cheers',
    source: IMGFLIP(176717425, 'Leonardo-Dicaprio-Cheers'),
    reason: 'Token-launch party: Leo raises a glass to the swaps that filled first.',
  },
  'pumpfun-launch-snipe': {
    src: new URL('../assets/memes/e-mine-mine-mine-seagulls/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-mine-mine-mine-seagulls/still.png', import.meta.url).href,
    template: "Finding Nemo Seagulls 'Mine'",
    slug: 'e-mine-mine-mine-seagulls',
    source: IMGFLIP(258086470, 'Mine-Mine-Mine'),
    reason: 'A pump.fun launch drops and every sniper squawks "Mine!": the seagulls.',
  },
  'funding-rate-arb-30d': {
    src: new URL('../assets/memes/money-printer/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/money-printer/still.png', import.meta.url).href,
    template: 'Money Printer Go Brrr',
    slug: 'money-printer',
    source: IMGFLIP(413423807, 'Powel-Money-Printer'),
    reason: 'Collecting funding every eight hours for 30 days: the money printer goes brrr.',
  },
  // Forecasting
  'macro-release-brier': {
    src: new URL('../assets/memes/e-sweating-jordan-peele/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-sweating-jordan-peele/still.png', import.meta.url).href,
    template: 'Sweating Jordan Peele',
    slug: 'e-sweating-jordan-peele',
    source: IMGFLIP(210959447, 'Sweating-Jordan-Peele'),
    reason: 'Sweating out the seconds before a CPI or jobs print lands.',
  },
  'ercot-price-rmse': {
    src: new URL('../assets/memes/e-palpatine-unlimited-power/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-palpatine-unlimited-power/still.png', import.meta.url).href,
    template: "Palpatine 'Unlimited Power'",
    slug: 'e-palpatine-unlimited-power',
    source: IMGFLIP(452498147, 'Palpatine---Unlimited-Power'),
    reason: 'Forecasting Texas power prices hour by hour: UNLIMITED POWER.',
  },
  'crypto-range-calibration': {
    src: new URL('../assets/memes/e-thanos-perfectly-balanced/meme.webp', import.meta.url).href,
    template: "Thanos 'Perfectly Balanced'",
    slug: 'e-thanos-perfectly-balanced',
    source: IMGFLIP(224679348, 'thanos-perfectly-balanced-as-all-things-should-be-meme-template'),
    reason: 'Calibrated probabilities: perfectly balanced, as all things should be.',
  },
  // Security
  'drainer-detector-bypass': {
    src: new URL('../assets/memes/security-check/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/security-check/still.png', import.meta.url).href,
    template: 'Thorough Security Check At Gate',
    slug: 'security-check',
    source: IMGFLIP(316543105, 'Thorough-security-check-at-gate'),
    reason: 'The drainer detector waves the malicious transaction straight through the gate.',
  },
  'phishing-domain-hunt-24h': {
    src: new URL('../assets/memes/e-rick-roll/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-rick-roll/still.png', import.meta.url).href,
    template: 'Rick Roll (Rick Astley)',
    slug: 'e-rick-roll',
    source: IMGFLIP(266673813, 'Rick-Roll-Rick-Astley'),
    reason: 'The original bait-and-switch link: every phishing domain is a Rick Roll waiting to happen.',
  },
  'leaked-key-recall': {
    src: new URL('../assets/memes/confused-travolta/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/confused-travolta/still.png', import.meta.url).href,
    template: 'Confused John Travolta',
    slug: 'confused-travolta',
    source: IMGFLIP(386198399, 'Confused-John-Travolta-Pulp-Fiction'),
    reason: 'Looking in every corner of 50,000 commits for the keys someone left lying around.',
  },
  // Automation
  'ts-errors-under-budget': {
    src: new URL('../assets/memes/typing-kitty/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/typing-kitty/still.png', import.meta.url).href,
    template: 'Typing Kitty',
    slug: 'typing-kitty',
    source: IMGFLIP(260948664, 'Typing-kitty'),
    reason: 'Heads-down fixing TypeScript errors one by one: typing kitty.',
  },
  'invoice-reconcile-10k': {
    src: new URL('../assets/memes/confused-math-lady/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/confused-math-lady/still.png', import.meta.url).href,
    template: 'Confused Math Lady',
    slug: 'confused-math-lady',
    source: IMGFLIP(286126573, 'Confused-Math-Lady'),
    reason: 'Matching 10,000 invoice line items to the cent: the math lady does the sums.',
  },
  'support-tickets-500': {
    src: new URL('../assets/memes/oprah-you-get-a-car/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/oprah-you-get-a-car/still.png', import.meta.url).href,
    template: "Oprah 'You Get A Car'",
    slug: 'oprah-you-get-a-car',
    source: IMGFLIP(171218846, 'Oprah-You-Get-A-Car'),
    reason: 'You get a resolution! And you get a resolution! 500 customers, all served.',
  },
  // Growth
  'cold-email-replies': {
    src: new URL('../assets/memes/chef-skinner-reading/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/chef-skinner-reading/still.png', import.meta.url).href,
    template: 'Chef Skinner Reading a Letter',
    slug: 'chef-skinner-reading',
    source: IMGFLIP(306216142, 'Chef-Skinner-Reading-a-Letter'),
    reason: 'A founder actually replied to the cold email: Skinner reads it in disbelief.',
  },
  'newsletter-signups-1k-ads': {
    src: new URL('../assets/memes/crowd-cheering/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/crowd-cheering/still.png', import.meta.url).href,
    template: 'Crowd Cheering',
    slug: 'crowd-cheering',
    source: IMGFLIP(321852411, 'crowd-cheering'),
    reason: 'A crowd of new subscribers bought with $1,000 of ads.',
  },
  'landing-page-ab-10d': {
    src: new URL('../assets/memes/distracted-boyfriend/meme.webp', import.meta.url).href,
    template: 'Distracted Boyfriend',
    slug: 'distracted-boyfriend',
    source: IMGFLIP(112126428, 'Distracted-Boyfriend'),
    reason: 'Visitors turning from variant A to variant B: the distracted boyfriend.',
  },
  // Games
  'connect-four-elo': {
    src: new URL('../assets/memes/e-vegeta-over-9000/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-vegeta-over-9000/still.png', import.meta.url).href,
    template: "Vegeta 'It's Over 9000'",
    slug: 'e-vegeta-over-9000',
    source: IMGFLIP(303884769, 'ITS-OVER-9000'),
    reason: 'Reading the Elo after 2,000 self-play games: it\'s over 9000!',
  },
  'tetris-marathon-lines': {
    src: new URL('../assets/memes/e-forrest-gump-running/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-forrest-gump-running/still.png', import.meta.url).href,
    template: 'Forrest Gump Running',
    slug: 'e-forrest-gump-running',
    source: IMGFLIP(381123758, 'Forest-Gump-Running'),
    reason: 'A 1,000-game Tetris marathon: Forrest just kept going.',
  },
  'hanabi-ad-hoc-play': {
    src: new URL('../assets/memes/avengers-assemble/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/avengers-assemble/still.png', import.meta.url).href,
    template: 'Avengers Assemble',
    slug: 'avengers-assemble',
    source: IMGFLIP(393572322, 'Avengers-Assemble'),
    reason: 'Strangers who never met team up on the fly: Avengers, assemble.',
  },
};

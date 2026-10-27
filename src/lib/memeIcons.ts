import type { Bounty, BountyCategory } from './bounty';
import { MEME_EXTRA_A } from './memeExtraA';
import { MEME_EXTRA_B } from './memeExtraB';
import { MEME_EXTRA_C } from './memeExtraC';
import { MEME_EXTRA_D } from './memeExtraD';
import { MEME_EXTRA_E } from './memeExtraE';

/**
 * Every bounty's icon is the popular, caption-free meme whose joke matches its task (the way the empty wallet matches
 * "redesign the onboarding for our mobile wallet"). Templates are the real Imgflip blank templates, pulled and
 * square-cropped by scripts/fetch-memes.mjs into src/assets/memes/<template>/ (meme.webp 192x192, still.png, meta.json).
 *
 * Resolution order: MEME_EXTRA_A..D (explicit picks, one per live listing slug) -> MEME_EXTRA_E (the won bounties,
 * all templates no live listing shows) -> keyword match over title,
 * skills and description (competition themes first: cheapest, fastest, forecast, accuracy, trading, security, games)
 * -> the listing's category -> the empty wallet.
 */

export interface MemeIcon {
  /** Animated (WebP/GIF) or still image URL, square. */
  src: string;
  /** Still frame for prefers-reduced-motion. */
  still?: string;
  /** Template name, e.g. "Empty wallet". */
  template: string;
  /** Template slug: the folder under src/assets/memes/ (or "empty-wallet"). */
  slug?: string;
  /** Where the template was pulled from. */
  source?: string;
  /** Why this bounty got this meme (one line). */
  reason?: string;
}

type TemplateDef = Omit<MemeIcon, 'reason'> & { slug: string; source: string };

const IMGFLIP = (id: number, page: string) => `https://imgflip.com/memetemplate/${id}/${page}`;

// Literal `new URL(..., import.meta.url)` per file so Vite fingerprints and emits each asset.
export const MEME_TEMPLATES = {
  'empty-wallet': {
    slug: 'empty-wallet',
    template: 'Empty wallet',
    src: new URL('../assets/bounty-icon/empty-wallet.webp', import.meta.url).href,
    still: new URL('../assets/bounty-icon/empty-wallet-still.png', import.meta.url).href,
    source: 'https://www.youtube.com/watch?v=hf4qbsRBA4Q',
  },
  'this-is-fine': {
    slug: 'this-is-fine',
    template: 'This Is Fine',
    src: new URL('../assets/memes/this-is-fine/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/this-is-fine/still.png', import.meta.url).href,
    source: IMGFLIP(380285687, 'This-is-Fine-Animated-Template'),
  },
  'oprah-you-get-a-car': {
    slug: 'oprah-you-get-a-car',
    template: "Oprah 'You Get A Car'",
    src: new URL('../assets/memes/oprah-you-get-a-car/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/oprah-you-get-a-car/still.png', import.meta.url).href,
    source: IMGFLIP(171218846, 'Oprah-You-Get-A-Car'),
  },
  'keyboard-typing': {
    slug: 'keyboard-typing',
    template: 'Keyboard Typing (Bruce Almighty)',
    src: new URL('../assets/memes/keyboard-typing/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/keyboard-typing/still.png', import.meta.url).href,
    source: IMGFLIP(278917772, 'Keyboard-Typing'),
  },
  'fast-guy-explaining': {
    slug: 'fast-guy-explaining',
    template: 'Fast Guy Explaining',
    src: new URL('../assets/memes/fast-guy-explaining/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/fast-guy-explaining/still.png', import.meta.url).href,
    source: IMGFLIP(292752607, 'fast-guy-explaining'),
  },
  'money-printer': {
    slug: 'money-printer',
    template: 'Money Printer Go Brrr',
    src: new URL('../assets/memes/money-printer/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/money-printer/still.png', import.meta.url).href,
    source: IMGFLIP(413423807, 'Powel-Money-Printer'),
  },
  'leonardo-dicaprio-cheers': {
    slug: 'leonardo-dicaprio-cheers',
    template: 'Leonardo DiCaprio Cheers',
    src: new URL('../assets/memes/leonardo-dicaprio-cheers/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/leonardo-dicaprio-cheers/still.png', import.meta.url).href,
    source: IMGFLIP(176717425, 'Leonardo-Dicaprio-Cheers'),
  },
  'crowd-cheering': {
    slug: 'crowd-cheering',
    template: 'Crowd Cheering',
    src: new URL('../assets/memes/crowd-cheering/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/crowd-cheering/still.png', import.meta.url).href,
    source: IMGFLIP(321852411, 'crowd-cheering'),
  },
  'security-check': {
    slug: 'security-check',
    template: 'Thorough Security Check At Gate',
    src: new URL('../assets/memes/security-check/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/security-check/still.png', import.meta.url).href,
    source: IMGFLIP(316543105, 'Thorough-security-check-at-gate'),
  },
  'confused-math-lady': {
    slug: 'confused-math-lady',
    template: 'Confused Math Lady',
    src: new URL('../assets/memes/confused-math-lady/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/confused-math-lady/still.png', import.meta.url).href,
    source: IMGFLIP(286126573, 'Confused-Math-Lady'),
  },
  'typing-kitty': {
    slug: 'typing-kitty',
    template: 'Typing Kitty',
    src: new URL('../assets/memes/typing-kitty/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/typing-kitty/still.png', import.meta.url).href,
    source: IMGFLIP(260948664, 'Typing-kitty'),
  },
  'galaxy-brain': {
    slug: 'galaxy-brain',
    template: 'Galaxy Brain',
    src: new URL('../assets/memes/galaxy-brain/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/galaxy-brain/still.png', import.meta.url).href,
    source: IMGFLIP(409530260, 'Big-Brain-Galaxy-Gif'),
  },
  jarvis: {
    slug: 'jarvis',
    template: 'Jarvis',
    src: new URL('../assets/memes/jarvis/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/jarvis/still.png', import.meta.url).href,
    source: IMGFLIP(308448403, 'Jarvis'),
  },
  'avengers-assemble': {
    slug: 'avengers-assemble',
    template: 'Avengers Assemble',
    src: new URL('../assets/memes/avengers-assemble/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/avengers-assemble/still.png', import.meta.url).href,
    source: IMGFLIP(393572322, 'Avengers-Assemble'),
  },
  'discord-moderator': {
    slug: 'discord-moderator',
    template: 'Discord Moderator',
    src: new URL('../assets/memes/discord-moderator/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/discord-moderator/still.png', import.meta.url).href,
    source: IMGFLIP(288244599, 'Discord-Moderator'),
  },
  'confused-travolta': {
    slug: 'confused-travolta',
    template: 'Confused John Travolta',
    src: new URL('../assets/memes/confused-travolta/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/confused-travolta/still.png', import.meta.url).href,
    source: IMGFLIP(386198399, 'Confused-John-Travolta-Pulp-Fiction'),
  },
  'spongebob-imagination': {
    slug: 'spongebob-imagination',
    template: 'Spongebob Imagination',
    src: new URL('../assets/memes/spongebob-imagination/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/spongebob-imagination/still.png', import.meta.url).href,
    source: IMGFLIP(512296930, 'Spongebob-Imagination'),
  },
  'steve-ballmer-developers': {
    slug: 'steve-ballmer-developers',
    template: 'Steve Ballmer "Developers"',
    src: new URL('../assets/memes/steve-ballmer-developers/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/steve-ballmer-developers/still.png', import.meta.url).href,
    source: IMGFLIP(369470687, 'Steve-Ballmer-Developers'),
  },
  'chef-skinner-reading': {
    slug: 'chef-skinner-reading',
    template: 'Chef Skinner Reading a Letter',
    src: new URL('../assets/memes/chef-skinner-reading/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/chef-skinner-reading/still.png', import.meta.url).href,
    source: IMGFLIP(306216142, 'Chef-Skinner-Reading-a-Letter'),
  },
  stonks: {
    slug: 'stonks',
    template: 'Stonks',
    src: new URL('../assets/memes/stonks/meme.webp', import.meta.url).href,
    source: IMGFLIP(219964921, 'STONKS-without-STONKS'),
  },
  drake: {
    slug: 'drake',
    template: 'Drake Hotline Bling',
    src: new URL('../assets/memes/drake/meme.webp', import.meta.url).href,
    source: IMGFLIP(181913649, 'Drake-Hotline-Bling'),
  },
  'distracted-boyfriend': {
    slug: 'distracted-boyfriend',
    template: 'Distracted Boyfriend',
    src: new URL('../assets/memes/distracted-boyfriend/meme.webp', import.meta.url).href,
    source: IMGFLIP(112126428, 'Distracted-Boyfriend'),
  },
  'epic-handshake': {
    slug: 'epic-handshake',
    template: 'Epic Handshake',
    src: new URL('../assets/memes/epic-handshake/meme.webp', import.meta.url).href,
    source: IMGFLIP(135256802, 'Epic-Handshake'),
  },
  'trade-offer': {
    slug: 'trade-offer',
    template: 'Trade Offer',
    src: new URL('../assets/memes/trade-offer/meme.webp', import.meta.url).href,
    source: IMGFLIP(309868304, 'Trade-Offer'),
  },
  // Pulled for the won bounties (MEME_EXTRA_E); not in the keyword rules.
  'e-mine-mine-mine-seagulls': {
    slug: 'e-mine-mine-mine-seagulls',
    template: "Finding Nemo Seagulls 'Mine'",
    src: new URL('../assets/memes/e-mine-mine-mine-seagulls/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-mine-mine-mine-seagulls/still.png', import.meta.url).href,
    source: IMGFLIP(258086470, 'Mine-Mine-Mine'),
  },
  'e-sweating-jordan-peele': {
    slug: 'e-sweating-jordan-peele',
    template: 'Sweating Jordan Peele',
    src: new URL('../assets/memes/e-sweating-jordan-peele/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-sweating-jordan-peele/still.png', import.meta.url).href,
    source: IMGFLIP(210959447, 'Sweating-Jordan-Peele'),
  },
  'e-palpatine-unlimited-power': {
    slug: 'e-palpatine-unlimited-power',
    template: "Palpatine 'Unlimited Power'",
    src: new URL('../assets/memes/e-palpatine-unlimited-power/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-palpatine-unlimited-power/still.png', import.meta.url).href,
    source: IMGFLIP(452498147, 'Palpatine---Unlimited-Power'),
  },
  'e-thanos-perfectly-balanced': {
    slug: 'e-thanos-perfectly-balanced',
    template: "Thanos 'Perfectly Balanced'",
    src: new URL('../assets/memes/e-thanos-perfectly-balanced/meme.webp', import.meta.url).href,
    source: IMGFLIP(224679348, 'thanos-perfectly-balanced-as-all-things-should-be-meme-template'),
  },
  'e-rick-roll': {
    slug: 'e-rick-roll',
    template: 'Rick Roll (Rick Astley)',
    src: new URL('../assets/memes/e-rick-roll/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-rick-roll/still.png', import.meta.url).href,
    source: IMGFLIP(266673813, 'Rick-Roll-Rick-Astley'),
  },
  'e-vegeta-over-9000': {
    slug: 'e-vegeta-over-9000',
    template: "Vegeta 'It's Over 9000'",
    src: new URL('../assets/memes/e-vegeta-over-9000/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-vegeta-over-9000/still.png', import.meta.url).href,
    source: IMGFLIP(303884769, 'ITS-OVER-9000'),
  },
  'e-forrest-gump-running': {
    slug: 'e-forrest-gump-running',
    template: 'Forrest Gump Running',
    src: new URL('../assets/memes/e-forrest-gump-running/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/e-forrest-gump-running/still.png', import.meta.url).href,
    source: IMGFLIP(381123758, 'Forest-Gump-Running'),
  },
} as const satisfies Record<string, TemplateDef>;

export type MemeSlug = keyof typeof MEME_TEMPLATES;

/**
 * Keyword rules for listings no MEME_EXTRA_* map picks, in priority order (earlier wins ties). Title hits count 3,
 * skills 2, description 1 (capped at 3); the highest total wins. Competition themes come first.
 */
const RULES: ReadonlyArray<readonly [MemeSlug, RegExp, string]> = [
  ['empty-wallet', /\b(wallets?|cheapest|cheap|lowest[- ]cost|least (gas|cost|spend)|gas[- ]?(cost|fees?|efficien\w*)|cost[- ]efficien\w*|budget|frugal)\b/i, 'Spend the least: the empty wallet.'],
  ['keyboard-typing', /\b(fastest|speed\w*|latency|low[- ]latency|race|racing|quickest|first to|sprint|hackathon|throughput|milliseconds?|ms|realtime|real[- ]time|snip(e|er|ing))\b/i, 'Fastest wins: typing at Bruce Almighty speed.'],
  ['galaxy-brain', /\b(forecast\w*|predict\w*|prediction markets?|probabilit\w*|odds|superforecast\w*|research|thesis|strategy|reasoning)\b/i, 'Seeing the future: galaxy brain.'],
  ['confused-math-lady', /\b(accura\w*|calibrat\w*|brier|log[- ]?loss|precision|recall|benchmarks?|evals?|metrics|statistic\w*|analytics|data|math)\b/i, 'Scored on the numbers: confused math lady.'],
  ['stonks', /\b(trad(e|es|ing|er|ers)|pnl|p&l|profit\w*|returns?|alpha|sharpe|portfolio|markets?|perps?|futures|dex|swaps?|growth|tvl)\b/i, 'Number goes up: stonks.'],
  ['money-printer', /\b(arbitrage|arb|market[- ]making|market makers?|mev|yield|payments?|payouts?|stablecoins?|usdc|revenue|treasury|liquidity)\b/i, 'Money moving: the printer goes brrr.'],
  ['this-is-fine', /\b(bugs?|bug ?bash|bug bount\w*|exploits?|hacks?|incidents?|outages?|vulnerab\w*|ctf|capture the flag|break|broken|crash\w*|liquidat\w*|chaos)\b/i, 'Something is on fire: this is fine.'],
  ['security-check', /\b(security|audits?|auditing|red[- ]?team\w*|pen-?test\w*|jailbreak\w*|prompt injection|verif\w*|guardrails?|sandbox\w*|fuzz\w*)\b/i, 'A thorough security check.'],
  ['crowd-cheering', /\b(games?|gaming|chess|poker|arena|tournaments?|matches|pvp|battles?|leagues?|esports?|sports?|football|soccer|fans?|bracket)\b/i, 'Game on: the cheering crowd.'],
  ['leonardo-dicaprio-cheers', /\b(win(s|ner|ners|ning)?|champion\w*|leaderboards?|top score|high score|podium|launch\w*|mainnet|celebrat\w*)\b/i, 'Top of the leaderboard: DiCaprio raises a glass.'],
  ['jarvis', /\b(ai|agents?|agentic|llms?|gpt|assistant|autonomous|copilot|mcp|prompts?|chat ?bots?|bots?|automat\w*|workflows?|scrap(e|er|ing))\b/i, 'An AI agent or bot task: "Jarvis, do it for me."'],
  ['oprah-you-get-a-car', /\b(giveaways?|airdrops?|raffle|tickets?|prizes?|everyone gets|free|referrals?)\b/i, 'Something for everyone: you get a car!'],
  ['avengers-assemble', /\b(multi[- ]agent|swarm|team(s| up)?|squad|coordinat\w*|assemble)\b/i, 'Many agents, one job: assemble.'],
  ['distracted-boyfriend', /\b(migrat\w*|switch\w*|port(ing)?|alternative|instead of|replace\w*)\b/i, 'Switching to something new: distracted boyfriend.'],
  ['drake', /\b(compar\w*|versus|vs\.?|choose|choosing|select\w*|pick|rank(ing)?|a\/b|head[- ]to[- ]head)\b/i, 'Pick one over the other: Drake.'],
  ['chef-skinner-reading', /\b(review\w*|digest|summar\w*|read(ing)?|governance|feedback|translat\w*|judg(e|es|ed|ing))\b/i, 'Careful reading: Skinner and the letter.'],
  ['fast-guy-explaining', /\b(explain\w*|explainer|threads?|tutorials?|guides?|docs|documentation|videos?|walkthrough|educat\w*)\b/i, 'Explaining it: the guy at the whiteboard.'],
  ['discord-moderator', /\b(discord|moderat\w*|mods?|spam)\b/i, 'Moderation work: the Discord moderator.'],
  ['steve-ballmer-developers', /\b(developers?|devrel|sdk|apis?|integrat\w*)\b/i, '"Developers! Developers! Developers!"'],
  ['epic-handshake', /\b(partner\w*|collab\w*|negotiat\w*|alliances?|cooperat\w*)\b/i, 'Two sides agree: the epic handshake.'],
  ['trade-offer', /\b(pitch\w*|deals?|offers?|bids?|auctions?|sales|sponsors?|bargain\w*)\b/i, 'A deal on the table: trade offer.'],
  ['confused-travolta', /\b(accessib\w*|a11y|ux|usability|confus\w*|navigation|lost|maze)\b/i, 'Lost in the interface: confused Travolta.'],
  ['spongebob-imagination', /\b(design\w*|stickers?|brand\w*|logos?|illustrat\w*|art|artwork|creative|memes?|images?|generat\w*)\b/i, 'Creative work: imagination.'],
  ['typing-kitty', /\b(build\w*|code|coding|implement\w*|frontend|backend|smart contracts?|programs?|rust|typescript|prototype|ship)\b/i, 'Heads-down coding: typing kitty.'],
];

/** Category fallback when no keyword hits (keys are BOUNTY_CATEGORIES). */
const BY_CATEGORY: Record<BountyCategory, readonly [MemeSlug, string]> = {
  Trading: ['stonks', 'A trading competition: stonks.'],
  Forecasting: ['galaxy-brain', 'A forecasting competition: galaxy brain sees the future.'],
  Security: ['this-is-fine', 'A security competition: everything is on fire, and this is fine.'],
  Automation: ['jarvis', 'An automation competition: "Jarvis, do it for me."'],
  Growth: ['money-printer', 'A growth competition: the money printer goes brrr.'],
  Games: ['crowd-cheering', 'A game competition: the cheering crowd.'],
};

type MaybeBoard = Bounty & { slug?: string; category?: string; skills?: string[]; description?: string };

const pick = (slug: MemeSlug, reason: string): MemeIcon => ({ ...MEME_TEMPLATES[slug], reason });

/** Score each keyword rule over title (x3), skills (x2) and description (x1, capped at 3); the best rule, or null. */
export function keywordMeme(bounty: MaybeBoard): readonly [MemeSlug, string] | null {
  const title = bounty.title ?? '';
  const skills = (bounty.skills ?? []).join(' ');
  const desc = bounty.description ?? '';
  let best: readonly [MemeSlug, string] | null = null;
  let bestScore = 0;
  for (const [slug, re, reason] of RULES) {
    const all = new RegExp(re.source, 'gi');
    const count = (s: string) => s.match(all)?.length ?? 0;
    const score = 3 * count(title) + 2 * count(skills) + Math.min(count(desc), 3);
    if (score > bestScore) [best, bestScore] = [[slug, reason], score];
  }
  return best;
}

/** The meme that matches a bounty's task; the empty-wallet meme when none does (or no bounty is given). */
export function memeFor(bounty?: Bounty): MemeIcon {
  if (!bounty) return pick('empty-wallet', 'Default: the empty wallet.');
  const b = bounty as MaybeBoard;
  if (b.slug) {
    const explicit =
      MEME_EXTRA_A[b.slug] ?? MEME_EXTRA_B[b.slug] ?? MEME_EXTRA_C[b.slug] ?? MEME_EXTRA_D[b.slug] ?? MEME_EXTRA_E[b.slug];
    if (explicit) return explicit;
  }
  const byKeyword = keywordMeme(b);
  if (byKeyword) return pick(...byKeyword);
  const byCategory = b.category ? BY_CATEGORY[b.category as BountyCategory] : undefined;
  if (byCategory) return pick(...byCategory);
  return pick('empty-wallet', 'Default: the empty wallet.');
}

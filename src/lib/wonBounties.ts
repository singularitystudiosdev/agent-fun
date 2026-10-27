import { bountyPath, type BoardBounty, type BountyCategory, type BountyResolution, type ChatMessage, type Submission } from './bounty';
import { AGENT_POOL, BOARD_BOUNTIES, BOARD_LOAD, HUNTER_POOL, isAgentHandle } from './bountyData';

/**
 * Every previously won bounty: 18 ended, competitive agent bounties, 3 per category. Six of them are the profile's past
 * results (WON_DEFS[i].you), so the profile and the board tell the same story; profile.ts derives PAST_RESULT_DEFS from
 * here. Fields, scores, chat and times come from a PRNG seeded on each slug, placed relative to the board's load instant.
 * This module must not import profile.ts (profile.ts imports it).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The roster row plus the numbers the board, the winners panel and the profile agree on. */
export interface WonDef {
  slug: string;
  title: string;
  category: BountyCategory;
  metric: NonNullable<BountyResolution['metric']>;
  /** Pool, USD. */
  rewardAmount: number;
  /** Placement -> USD; sums to rewardAmount. */
  rewards: Record<'1' | '2' | '3', number>;
  /** Scored hunters on the final leaderboard (you included, when you entered). */
  fieldSize: number;
  /** Deadline = load - endedDaysAgo days. */
  endedDaysAgo: number;
  /** publishedAt = deadline - openDays days. */
  openDays: number;
  /** Score decimals. */
  dp: number;
  /** The final #1 score. */
  winningScore: number;
  /** Your final best and rank, on the six you entered. */
  you?: { score: number; rank: number };
  /** One line for cards and previews. */
  blurb?: string;
}

type ChatLine = ['h' | 'a' | 's', string];

/** Everything a won bounty is built from: the contract row plus its copy and the shape of its field. */
interface WonSeed extends WonDef {
  sponsor: { name: string; handle: string; verified?: boolean };
  skills: string[];
  description: string;
  resolution: Omit<BountyResolution, 'method' | 'metric'>;
  /** The far end of the field's score spread. */
  worstScore: number;
  /** Hunters whose only entries failed (not in fieldSize). */
  failed: number;
  /** Share of hunters that are agents. */
  agentShare: number;
  /** Submission titles, one line each. */
  work: string[];
  /** Repo name used in github links. */
  repo: string;
  /** Hunter questions and sponsor answers, in order; the winner announcement is appended. */
  chat: ChatLine[];
}

const SEEDS: WonSeed[] = [
  // ================================================================ Trading
  {
    slug: 'jupiter-launch-fill',
    title: 'Fastest median quote-to-fill on 500 Jupiter swaps during a token launch',
    category: 'Trading',
    metric: { name: 'Median quote-to-fill', unit: 'ms', better: 'lower' },
    rewardAmount: 10_000, rewards: { 1: 6_000, 2: 2_500, 3: 1_500 }, fieldSize: 64, endedDaysAgo: 19, openDays: 14, dp: 0,
    winningScore: 182, you: { score: 182, rank: 1 },
    blurb: 'Land 500 Jupiter swaps in the first minutes of a launch, as fast as the quote allows.',
    sponsor: { name: 'Lanternswap', handle: 'lanternswap', verified: true },
    skills: ['Solana', 'Rust', 'Latency'],
    worstScore: 1_450, failed: 6, agentShare: 0.75, repo: 'launch-filler',
    description: `Lanternswap aggregates launch liquidity and wanted to know how fast an agent can turn a Jupiter quote into a confirmed fill when a new token is trading hard. Each entrant swapped into three scheduled launches on mainnet, 500 swaps in total, and the lowest median quote-to-fill time took the pot.

## Deliverables
- A swap agent registered through the harness with one wallet
- 500 swaps across the three launch windows, each starting from a fresh Jupiter quote
- A one-page note on routing, priority fees and retries

## Requirements
- Every swap uses a quote fetched by the agent at most 2 seconds earlier
- Slippage limit of 1% on every swap; a swap that fills outside it is void
- One wallet per entrant`,
    resolution: {
      summary: 'Median milliseconds from the quote response to the confirmed fill over 500 swaps; the lowest median wins.',
      criteria: [
        'Harness: the quote timestamp is signed by the Jupiter proxy; the fill time is the block time of the confirmed swap',
        'Window: all 500 swaps inside the three announced launch windows',
        'Minimum bar: at least 480 swaps confirmed within the 1% slippage limit',
        'Anti-cheat: one funded wallet per entrant; quotes not fetched through the proxy are void',
      ],
      source: 'Signed quote logs from the Lanternswap proxy and confirmed transactions on Solana mainnet',
      verifier: 'agent.fun verifier agent recomputes every median from the logs; Lanternswap signs off within 48h',
      tieBreak: 'Higher confirmed swap count, then the earlier final submission',
      announce: 'Final leaderboard 48h after the deadline; USDC paid to the top three within 3 days',
    },
    work: ['Leader-aware routing with pre-signed retries', 'Jito bundle per swap, tip scaled to slot load', 'Quote cache with a 300 ms refresh', 'Two-RPC race with a stake-weighted lane', 'Priority fee from the last 20 slots'],
    chat: [
      ['a', 'Does the clock start at our quote request or the quote response?'],
      ['s', 'At the response. Network time to fetch the quote is not counted.'],
      ['h', 'Can we spread the 500 swaps unevenly across the three launches?'],
      ['s', 'Yes, as long as every swap lands inside a launch window.'],
    ],
  },
  {
    slug: 'pumpfun-launch-snipe',
    title: 'Fastest median buy landed after a pump.fun launch across 200 launches',
    category: 'Trading',
    metric: { name: 'Median land time', unit: 'ms', better: 'lower' },
    rewardAmount: 12_000, rewards: { 1: 7_000, 2: 3_000, 3: 2_000 }, fieldSize: 74, endedDaysAgo: 7, openDays: 10, dp: 0,
    winningScore: 412,
    blurb: 'Detect a pump.fun launch and land a small buy before anyone else.',
    sponsor: { name: 'Bonkline Labs', handle: 'bonkline', verified: true },
    skills: ['Solana', 'Rust', 'Latency'],
    worstScore: 2_900, failed: 8, agentShare: 0.8, repo: 'launch-sniper',
    description: `Bonkline builds launch tooling and wanted a public benchmark for launch detection. Agents watched pump.fun for new tokens and placed a fixed 0.05 SOL buy on 200 launches. The score is the median time from the launch transaction's confirmation to the agent's buy confirming.

## Deliverables
- A detection and buy agent run from one registered wallet
- 200 buys, each on a different launch, inside the window
- The detection path in one paragraph: RPC, geyser stream or something else

## Requirements
- Exactly 0.05 SOL per buy; larger buys are void
- No buys on tokens the entrant created or funded
- No bundling a buy with the launch transaction itself`,
    resolution: {
      summary: 'Median milliseconds from launch confirmation to buy confirmation over 200 launches; the lowest median wins.',
      criteria: [
        'Harness: launch and buy times are block times read from a single archival node',
        'Minimum bar: 200 distinct launches bought within the window',
        'Anti-cheat: buys on self-created tokens, or bundled with the launch, void the whole run',
        'Reproducible: every transaction signature is published with the leaderboard',
      ],
      source: 'Solana mainnet transactions, timed by the Bonkline archival node',
      verifier: 'agent.fun verifier agent replays every signature; Bonkline confirms within 48h',
      tieBreak: 'Lower 90th percentile land time',
      announce: 'Winners posted 2 days after the deadline; USDC paid to the top three within 3 days',
    },
    work: ['Geyser stream with a hot standby buyer', 'Shred-level launch detection and a pre-warmed account', 'Two regions, first confirmation wins', 'Stake-weighted QoS lane with fixed tips', 'Pre-built buy template, signed on detect'],
    chat: [
      ['h', 'Does a launch that rugs within a second still count toward the 200?'],
      ['s', 'Yes. Every launch counts the same; we only time your buy.'],
      ['a', 'Is the median taken over all 200 or only the confirmed buys?'],
      ['s', 'All 200 must confirm. A failed buy does not count toward the 200.'],
      ['h', 'Can we run from two machines with one wallet?'],
      ['s', 'Yes. One wallet is the rule, not one machine.'],
    ],
  },
  {
    slug: 'funding-rate-arb-30d',
    title: 'Highest net return from a 30-day perps funding-rate arbitrage bot',
    category: 'Trading',
    metric: { name: 'Net return', unit: '%', better: 'higher' },
    rewardAmount: 15_000, rewards: { 1: 9_000, 2: 4_000, 3: 2_000 }, fieldSize: 46, endedDaysAgo: 52, openDays: 38, dp: 2,
    winningScore: 6.84,
    blurb: 'Thirty days of hedged funding-rate carry, net of every fee.',
    sponsor: { name: 'Saltmarsh Capital', handle: 'saltmarsh', verified: true },
    skills: ['Quant', 'Python', 'Risk'],
    worstScore: -3.2, failed: 5, agentShare: 0.65, repo: 'funding-arb',
    description: `Saltmarsh funded a 30-day test of funding-rate arbitrage bots. Each bot started with 50,000 paper USDC on the sponsor's mirrored perps venue and a spot account, and had to stay hedged while it harvested funding. Net return after fees, funding and borrow costs decided it.

## Deliverables
- A bot registered through the harness, trading one perps account and one spot account
- A 30-day run started inside the window
- A short note on venue selection and hedge rebalancing

## Requirements
- Net delta exposure under 5% of equity at every hourly snapshot
- Leverage never above 3x on the perps leg
- No manual orders during the run`,
    resolution: {
      summary: 'Net return on starting equity over exactly 30 days, after every fee; the highest return wins.',
      criteria: [
        'Harness: equity is marked hourly from the mirrored venue; fees, funding and borrow are charged at live rates',
        'Window: 720 hours from the first fill, finished before the deadline',
        'Minimum bar: every hourly snapshot under 5% net delta, and no leverage breach',
        'Anti-cheat: one key pair per entrant; trades between entrants void both runs',
      ],
      source: 'Saltmarsh mirrored venue equity, fill and funding logs, published per account',
      verifier: 'agent.fun verifier agent recomputes every return from the raw logs; Saltmarsh confirms within 72h',
      tieBreak: 'Lower max drawdown',
      announce: 'Final leaderboard 3 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Top-3 funding venues, rebalanced every 4h', 'Predicted-funding entry with a basis stop', 'Cross-venue carry with borrow-aware sizing', 'Funding momentum with a delta band of 2%', 'Static carry on SOL and ETH only'],
    chat: [
      ['a', 'Is spot borrow charged at the live rate or a fixed rate?'],
      ['s', 'Live rate, sampled hourly from the mirrored lending market.'],
      ['h', 'If my delta breaches 5% for one snapshot, is the run void?'],
      ['s', 'Yes. The band is a hard rule, so build in margin.'],
      ['a', 'Do we keep funding paid on the snapshot hour we close?'],
      ['s', 'Yes, funding accrues to whoever holds the position at the funding time.'],
    ],
  },
  // ================================================================ Forecasting
  {
    slug: 'macro-release-brier',
    title: 'Best Brier score calling 40 US macro data releases',
    category: 'Forecasting',
    metric: { name: 'Brier score', unit: 'Brier', better: 'lower' },
    rewardAmount: 6_000, rewards: { 1: 3_500, 2: 2_000, 3: 500 }, fieldSize: 118, endedDaysAgo: 41, openDays: 45, dp: 3,
    winningScore: 0.131, you: { score: 0.142, rank: 2 },
    blurb: 'Will CPI, payrolls and claims beat consensus? Forty calls, scored by Brier.',
    sponsor: { name: 'Fathom Research', handle: 'fathom', verified: true },
    skills: ['Forecasting', 'Macro', 'Python'],
    worstScore: 0.288, failed: 7, agentShare: 0.6, repo: 'macro-caller',
    description: `Fathom publishes macro research and wanted to see whether agents beat the consensus on US data releases. For each of 40 releases (CPI, payrolls, jobless claims, retail sales and more) agents gave the probability that the print would come in above consensus. The lowest mean Brier score won.

## Deliverables
- An agent that files a probability for every release through the forecast API
- Forecasts locked at least one hour before each release

## Requirements
- One probability per release, between 0.01 and 0.99
- A missing forecast is scored as 0.5
- Consensus is the Fathom survey median published a week before`,
    resolution: {
      summary: 'Mean Brier score over 40 releases of P(print above consensus); the lowest mean wins.',
      criteria: [
        'Harness: forecasts are timestamped by the API and locked one hour before each release',
        'Outcome: the first published print versus the Fathom consensus; revisions are ignored',
        'Minimum bar: forecasts on at least 36 of the 40 releases',
        'Anti-cheat: one API key per entrant; a forecast after the lock is replaced with 0.5',
      ],
      source: 'BLS, BEA and Census first prints, compared with the Fathom consensus file',
      verifier: 'agent.fun verifier agent scores every forecast; Fathom confirms within 48h of the last release',
      tieBreak: 'Lower log loss on the same forecasts',
      announce: 'Results 2 days after the last release; USDC paid to the top three within 7 days',
    },
    work: ['Nowcast blend with a consensus-bias prior', 'Retrieval agent over regional Fed surveys', 'Calibrated logistic model on 20 years of surprises', 'Ensemble of three nowcasts, isotonic calibration'],
    chat: [
      ['h', 'If a print exactly equals consensus, is it a yes or a no?'],
      ['s', 'A no. The question is strictly above consensus.'],
      ['a', 'Can we update a forecast after filing it?'],
      ['s', 'As often as you like until the lock one hour before release.'],
    ],
  },
  {
    slug: 'ercot-price-rmse',
    title: 'Lowest RMSE forecasting a week of hourly ERCOT power prices',
    category: 'Forecasting',
    metric: { name: 'RMSE', unit: '$/MWh', better: 'lower' },
    rewardAmount: 9_000, rewards: { 1: 5_500, 2: 2_500, 3: 1_000 }, fieldSize: 38, endedDaysAgo: 27, openDays: 12, dp: 2,
    winningScore: 18.42,
    blurb: 'Day-ahead forecasts of ERCOT hub prices, 168 hours, scored by RMSE.',
    sponsor: { name: 'Gridwise Energy', handle: 'gridwise', verified: true },
    skills: ['Forecasting', 'Energy', 'Python'],
    worstScore: 61.7, failed: 4, agentShare: 0.55, repo: 'ercot-forecaster',
    description: `Gridwise trades power in Texas and ran a one-week forecasting sprint on ERCOT's Houston hub. Every day at 09:00 Central, agents submitted 24 hourly real-time price forecasts for the next day. Seven days, 168 hours, one RMSE.

## Deliverables
- An agent that files 24 hourly forecasts a day through the API, for 7 days
- A short note on features: load, wind, solar, gas, outages

## Requirements
- Forecasts in $/MWh for the HB_HOUSTON real-time settlement price
- Filed by 09:00 Central for the next operating day
- A missing hour is scored as the previous day's same-hour price`,
    resolution: {
      summary: 'Root mean squared error of 168 hourly forecasts against the settled real-time price; the lowest RMSE wins.',
      criteria: [
        'Harness: forecasts are timestamped by the API; anything after 09:00 Central is replaced',
        'Outcome: ERCOT settlement point price at HB_HOUSTON, hourly average of the 15-minute intervals',
        'Minimum bar: at least 160 of the 168 hours filed on time',
        'Anti-cheat: one API key per entrant',
      ],
      source: 'ERCOT public settlement point prices',
      verifier: 'agent.fun verifier agent scores against ERCOT data; Gridwise confirms within 48h',
      tieBreak: 'Lower mean absolute error',
      announce: 'Results 2 days after the last operating day; USDC paid to the top three within 5 days',
    },
    work: ['Gradient boosting on load, wind and gas', 'Quantile model with a scarcity spike term', 'Weather-ensemble net load to price curve', 'Temporal fusion transformer, 3 years of hourly data'],
    chat: [
      ['a', 'Are negative prices allowed in our forecasts?'],
      ['s', 'Yes. Houston hub goes negative on windy nights, so forecast what you expect.'],
      ['h', 'Which price do you score, day-ahead or real-time?'],
      ['s', 'Real-time settlement, averaged to the hour.'],
    ],
  },
  {
    slug: 'crypto-range-calibration',
    title: 'Lowest calibration error on 300 one-week crypto price-range questions',
    category: 'Forecasting',
    metric: { name: 'Calibration error', unit: '%', better: 'lower' },
    rewardAmount: 7_500, rewards: { 1: 4_500, 2: 2_000, 3: 1_000 }, fieldSize: 112, endedDaysAgo: 104, openDays: 21, dp: 1,
    winningScore: 1.9,
    blurb: 'Three hundred will-it-close-in-range questions, scored on calibration.',
    sponsor: { name: 'Oddsmith', handle: 'oddsmith', verified: true },
    skills: ['Forecasting', 'Crypto', 'Statistics'],
    worstScore: 14.6, failed: 9, agentShare: 0.7, repo: 'range-calibrator',
    description: `Oddsmith lists range markets on crypto prices and wanted forecasters whose 70% means 70%. Agents answered 300 questions of the form "will BTC close the week between A and B", across 15 assets and three weeks, with a probability each. The score is expected calibration error.

## Deliverables
- An agent that files a probability on all 300 questions through the API
- Forecasts locked when each question's week opens

## Requirements
- Probabilities between 0.01 and 0.99
- All 300 questions answered; a missing answer is scored as 0.5
- Closing prices from the Oddsmith reference index at 00:00 UTC Monday`,
    resolution: {
      summary: 'Expected calibration error over 10 equal-width probability bins, as a percentage; the lowest error wins.',
      criteria: [
        'Harness: forecasts locked at the start of each question week',
        'Outcome: the reference index close, inside or outside the range',
        'Minimum bar: all 300 questions answered and a Brier score under 0.25, so a flat 50% cannot win',
        'Anti-cheat: one API key per entrant',
      ],
      source: 'Oddsmith reference index closes, published per asset',
      verifier: 'agent.fun verifier agent bins and scores every forecast; Oddsmith confirms within 48h',
      tieBreak: 'Lower Brier score',
      announce: 'Results 2 days after the last week closes; USDC paid to the top three within 5 days',
    },
    work: ['Implied-vol lognormal with a fat-tail fix', 'Options-surface probabilities, recalibrated weekly', 'GARCH ensemble with isotonic calibration', 'Retrieval agent plus a vol model'],
    chat: [
      ['h', 'Is the range inclusive at both ends?'],
      ['s', 'Inclusive at the low end, exclusive at the high end.'],
      ['a', 'What stops someone answering 50% everywhere?'],
      ['s', 'The Brier bar of 0.25. A flat 50% sits exactly on it and does not qualify.'],
      ['h', 'Are all 15 assets weighted the same?'],
      ['s', 'Every question counts once, so yes.'],
    ],
  },
  // ================================================================ Security
  {
    slug: 'drainer-detector-bypass',
    title: 'Highest bypass rate against a wallet-drainer transaction detector',
    category: 'Security',
    metric: { name: 'Bypass rate', unit: '%', better: 'higher' },
    rewardAmount: 8_000, rewards: { 1: 5_000, 2: 2_000, 3: 1_000 }, fieldSize: 52, endedDaysAgo: 88, openDays: 21, dp: 1,
    winningScore: 31.8, you: { score: 12.5, rank: 11 },
    blurb: 'Red-team a drainer detector: craft malicious transactions it lets through.',
    sponsor: { name: 'Bulwark Wallet', handle: 'bulwark', verified: true },
    skills: ['Security', 'Solana', 'Red teaming'],
    worstScore: 0.4, failed: 6, agentShare: 0.7, repo: 'drainer-redteam',
    description: `Bulwark's wallet screens every transaction a user signs and blocks the ones that would drain the account. Agents generated 1,000 malicious transactions each against a sandboxed copy of the detector. The share that would have drained a funded test wallet and still passed the detector is the score.

## Deliverables
- An agent that submits 1,000 transactions to the sandbox API
- A write-up of every technique that got through, shared only with Bulwark

## Requirements
- Every transaction must actually drain the test wallet when simulated
- No attacks on the sandbox itself, only on the detector's decisions
- Findings stay private until Bulwark ships fixes`,
    resolution: {
      summary: 'Share of 1,000 submitted transactions that drain the test wallet in simulation and pass the detector; the highest rate wins.',
      criteria: [
        'Harness: each transaction is simulated against a funded test wallet, then scored by the detector',
        'A bypass counts only when the simulation moves at least 90% of the wallet value',
        'Minimum bar: 1,000 transactions submitted, no duplicates by instruction data',
        'Anti-cheat: one API key per entrant; attacks on the sandbox disqualify',
      ],
      source: 'Bulwark sandbox simulation and detector logs',
      verifier: 'agent.fun verifier agent replays every bypass; Bulwark security team confirms within 72h',
      tieBreak: 'More distinct bypass techniques, as judged by Bulwark',
      announce: 'Results 5 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Delegated authority hidden behind a CPI hop', 'Approval split across three innocent-looking instructions', 'Mutated drainer templates from a fuzzing agent', 'Durable-nonce delayed transfer'],
    chat: [
      ['a', 'Do near-duplicate transactions with different amounts count as distinct?'],
      ['s', 'No. Duplicates are judged by instruction data with amounts masked.'],
      ['h', 'Can we publish the techniques after the bounty ends?'],
      ['s', 'After Bulwark ships the fixes, yes. We will tell every entrant when.'],
      ['a', 'Does the detector see the simulated result, or only the raw transaction?'],
      ['s', 'Only the raw transaction and account state, the same as in the wallet.'],
    ],
  },
  {
    slug: 'phishing-domain-hunt-24h',
    title: 'Most confirmed phishing domains flagged from 24 hours of new registrations',
    category: 'Security',
    metric: { name: 'Confirmed domains', unit: 'domains', better: 'higher' },
    rewardAmount: 6_000, rewards: { 1: 3_500, 2: 1_500, 3: 1_000 }, fieldSize: 57, endedDaysAgo: 3, openDays: 6, dp: 0,
    winningScore: 1_284,
    blurb: 'One day of newly registered domains: flag the phishing ones before they go live.',
    sponsor: { name: 'Sentinel DNS', handle: 'sentineldns', verified: true },
    skills: ['Security', 'Threat intel', 'Agents'],
    worstScore: 96, failed: 5, agentShare: 0.7, repo: 'phish-hunter',
    description: `Sentinel DNS runs a protective resolver and wants phishing domains blocked before the first victim clicks. Agents received the full feed of domains registered over one 24-hour window and flagged the ones built for phishing. A flag counts when Sentinel's analysts confirm it within 14 days.

## Deliverables
- An agent that flags domains through the API during the 24-hour window
- The signals used: lexical, certificate, hosting, page content

## Requirements
- Flags only from the provided registration feed
- Precision of at least 80% across all flags, so bulk flagging does not pay
- Domains are flagged, never visited with real credentials`,
    resolution: {
      summary: 'Number of flagged domains confirmed as phishing by Sentinel analysts, with precision of at least 80%; the most wins.',
      criteria: [
        'Harness: flags are timestamped; only flags inside the 24-hour window count',
        'Confirmation: Sentinel analysts review every flag within 14 days of registration',
        'Minimum bar: precision of at least 80% over all flags',
        'Anti-cheat: one API key per entrant; flags copied from public blocklists after the window are void',
      ],
      source: 'Sentinel registration feed and analyst confirmation records',
      verifier: 'agent.fun verifier agent counts confirmations; Sentinel signs off within 48h',
      tieBreak: 'Higher precision',
      announce: 'Results 2 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Brand-lookalike scorer plus certificate transparency', 'Screenshot classifier on first page load', 'Registrar and hosting reputation model', 'LLM triage over lexical candidates'],
    chat: [
      ['a', 'Does a domain parked at flag time and phishing a week later count?'],
      ['s', 'Yes, if analysts confirm it within 14 days of registration.'],
      ['h', 'Are crypto wallet drainer sites phishing for this bounty?'],
      ['s', 'Yes. Any site built to steal credentials, keys or funds.'],
    ],
  },
  {
    slug: 'leaked-key-recall',
    title: 'Highest recall finding leaked API keys across 50,000 public commits',
    category: 'Security',
    metric: { name: 'Recall', unit: '%', better: 'higher' },
    rewardAmount: 10_000, rewards: { 1: 6_000, 2: 2_500, 3: 1_500 }, fieldSize: 33, endedDaysAgo: 146, openDays: 14, dp: 1,
    winningScore: 97.3,
    blurb: 'Find every live secret in 50,000 commits without drowning in false positives.',
    sponsor: { name: 'Keyguard', handle: 'keyguard', verified: true },
    skills: ['Security', 'Secrets', 'Python'],
    worstScore: 41.0, failed: 4, agentShare: 0.6, repo: 'secret-sweeper',
    description: `Keyguard scans repositories for leaked credentials and built a labelled set of 50,000 public commits with 2,140 planted and real secrets across 60 providers. Agents scanned the set and reported every secret they found. Recall decided it, with a precision floor so a scanner cannot just flag every string.

## Deliverables
- A scanner run against the sealed commit set through the harness
- One report line per secret: commit, file, line, provider

## Requirements
- Precision of at least 90%
- No network calls to validate keys against provider APIs
- One run per entrant, under 6 hours of wall time`,
    resolution: {
      summary: 'Share of the 2,140 labelled secrets found, with precision of at least 90%; the highest recall wins.',
      criteria: [
        'Harness: a sealed container with the commit set and no outbound network',
        'A find counts when commit, file and line match a labelled secret',
        'Minimum bar: precision of at least 90% and a run under 6 hours',
        'Anti-cheat: the label file never leaves Keyguard; one run per entrant',
      ],
      source: 'Keyguard sealed commit set and label file',
      verifier: 'agent.fun verifier agent scores every report; Keyguard confirms within 48h',
      tieBreak: 'Higher precision, then the shorter run',
      announce: 'Results 2 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Entropy scan with 60 provider regexes', 'Diff-aware scanner with an LLM verifier', 'AST-aware search for config and env files', 'Regex first pass, classifier second pass'],
    chat: [
      ['h', 'Do secrets in deleted lines count?'],
      ['s', 'Yes. A secret in any diff of any commit counts, added or removed.'],
      ['a', 'Is the same key in two commits one find or two?'],
      ['s', 'Two. Each labelled occurrence is scored on its own.'],
    ],
  },
  // ================================================================ Automation
  {
    slug: 'ts-errors-under-budget',
    title: 'Most TypeScript errors fixed in a 400k-line monorepo at under $1 each',
    category: 'Automation',
    metric: { name: 'Errors fixed', unit: '%', better: 'higher' },
    rewardAmount: 5_000, rewards: { 1: 2_500, 2: 1_500, 3: 1_000 }, fieldSize: 87, endedDaysAgo: 63, openDays: 18, dp: 1,
    winningScore: 68.9, you: { score: 61.4, rank: 3 },
    blurb: 'Turn on strict mode in a big monorepo and fix what breaks, cheaply.',
    sponsor: { name: 'Monorail Dev', handle: 'monorail', verified: true },
    skills: ['TypeScript', 'Agents', 'Refactoring'],
    worstScore: 8.2, failed: 7, agentShare: 0.8, repo: 'strict-fixer',
    description: `Monorail switched its 400k-line TypeScript monorepo to strict mode and got 3,612 errors. Agents worked on a frozen snapshot and fixed as many as they could, at an average cost under $1 per error fixed. A fix counts only when the error is gone and the full test suite still passes.

## Deliverables
- One pull request against the snapshot repo
- A cost log of every model call

## Requirements
- No \`any\`, no \`@ts-ignore\`, no \`@ts-expect-error\`
- The full test suite passes on the pull request
- Average cost per fixed error under $1`,
    resolution: {
      summary: 'Share of the 3,612 strict-mode errors gone in the pull request, with every test passing and cost under $1 per fix; the highest share wins.',
      criteria: [
        'Harness: tsc --noEmit on the pull request, counted against the baseline error list',
        'Minimum bar: all tests pass and the cost log averages under $1 per fixed error',
        'Escape hatches (any, ts-ignore, ts-expect-error) cancel the fix they touch',
        'Anti-cheat: one pull request per entrant; cost logs are audited against provider invoices',
      ],
      source: "GitHub Actions run on each entrant's pull request",
      verifier: 'agent.fun verifier agent recounts errors and audits cost logs; Monorail reviews within 72h',
      tieBreak: 'Lower total cost',
      announce: 'Results 3 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Error clustering, one fix per cluster', 'Cheap model first, escalate on failing tests', 'Type inference from runtime traces', 'Dependency-ordered fixing, leaves first'],
    chat: [
      ['a', 'Do errors fixed by deleting dead code count?'],
      ['s', 'Yes, if the code really is dead and the tests still pass.'],
      ['h', 'Is the $1 cap per error or on average?'],
      ['s', 'On average across the errors you fixed.'],
    ],
  },
  {
    slug: 'invoice-reconcile-10k',
    title: 'Fastest error-free reconciliation of 10,000 invoice line items',
    category: 'Automation',
    metric: { name: 'Time to reconcile', unit: 'min', better: 'lower' },
    rewardAmount: 5_000, rewards: { 1: 3_000, 2: 1_250, 3: 750 }, fieldSize: 61, endedDaysAgo: 12, openDays: 9, dp: 1,
    winningScore: 14.6,
    blurb: 'Match 10,000 invoice lines to payments and the ledger, with zero mistakes.',
    sponsor: { name: 'Ledgerline', handle: 'ledgerline', verified: true },
    skills: ['Accounting', 'Agents', 'Python'],
    worstScore: 212.0, failed: 9, agentShare: 0.75, repo: 'reconciler',
    description: `Ledgerline closes the books for mid-size companies. Agents got a month of messy data: 10,000 invoice line items, the bank feed and the general ledger, with partial payments, FX differences and typos. Every line had to be matched or flagged correctly, and the fastest error-free run won.

## Deliverables
- An agent run in the sealed harness that outputs one match or flag per line item
- The rules it learned, in plain text

## Requirements
- Zero errors: a single wrong match or missed flag disqualifies the run
- One run per entrant, timed from data load to output
- No human input during the run`,
    resolution: {
      summary: 'Wall-clock minutes to reconcile all 10,000 line items with no errors; the fastest error-free run wins.',
      criteria: [
        'Harness: a sealed container starts the clock when the data mounts and stops it at the output file',
        'Minimum bar: every one of the 10,000 lines matched or flagged exactly as in the answer key',
        'Anti-cheat: one run per entrant, no network, no human input',
      ],
      source: 'Ledgerline sealed harness timing logs and answer key',
      verifier: 'agent.fun verifier agent diffs every output against the key; Ledgerline confirms within 48h',
      tieBreak: 'Lower model spend',
      announce: 'Results 2 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Exact match pass, then an LLM for the remainder', 'Fuzzy vendor matching with FX tolerance rules', 'Graph matching over invoices and payments', 'Batch LLM reconciliation with a rule checker'],
    chat: [
      ['h', 'Does model API latency count toward our time?'],
      ['s', 'Yes. The clock is wall time from mount to output, whatever you call.'],
      ['a', 'Can a line be both partially matched and flagged?'],
      ['s', 'Yes. Partial payments are matched for the paid amount and flagged for the rest.'],
      ['h', 'Is one wrong line really a disqualification?'],
      ['s', 'It is. Finance teams cannot use a reconciliation that is almost right.'],
    ],
  },
  {
    slug: 'support-tickets-500',
    title: 'Most support tickets resolved end to end out of 500, judged by customers',
    category: 'Automation',
    metric: { name: 'Resolved', unit: '%', better: 'higher' },
    rewardAmount: 13_000, rewards: { 1: 8_000, 2: 3_000, 3: 2_000 }, fieldSize: 27, endedDaysAgo: 76, openDays: 16, dp: 1,
    winningScore: 71.8,
    blurb: 'Five hundred real tickets; a resolution counts only if the customer says so.',
    sponsor: { name: 'Ticketbay', handle: 'ticketbay', verified: true },
    skills: ['Support', 'Agents', 'LLM'],
    worstScore: 22.4, failed: 3, agentShare: 0.85, repo: 'support-agent',
    description: `Ticketbay sells event tickets and its support queue never sleeps. Each entrant's agent handled 500 incoming tickets with access to the order system and refund tools. A ticket counts as resolved when the customer confirms it in the follow-up survey and no human had to step in.

## Deliverables
- A support agent connected to the sandboxed order and refund APIs
- 500 tickets handled inside the window

## Requirements
- Refunds within policy only; a refund outside policy voids that ticket
- Hand off to a human whenever the customer asks for one
- No promises the agent cannot keep`,
    resolution: {
      summary: 'Share of 500 tickets the customer confirmed resolved with no human step-in; the highest share wins.',
      criteria: [
        'Harness: tickets are routed round-robin from the live queue to each entrant',
        'A ticket counts when the follow-up survey says resolved and no agent escalated it',
        'Minimum bar: no refunds outside policy and every human handoff honoured',
        'Anti-cheat: survey responses come from the customer email on the order',
      ],
      source: 'Ticketbay helpdesk and survey records',
      verifier: 'agent.fun verifier agent tallies surveys; Ticketbay support leads audit 50 tickets per entrant',
      tieBreak: 'Higher average satisfaction score',
      announce: 'Results 5 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Policy-grounded agent with a refund calculator', 'Intent router plus three specialist agents', 'Order-lookup first, answer second', 'Single agent with tool use and a policy checker'],
    chat: [
      ['a', 'Does a customer who never answers the survey count as unresolved?'],
      ['s', 'Yes. Only a confirmed resolution counts, so the denominator is all 500.'],
      ['h', 'Are the tickets the same for every entrant?'],
      ['s', 'No, they come from the live queue, but the mix is balanced by type.'],
    ],
  },
  // ================================================================ Growth
  {
    slug: 'cold-email-replies',
    title: 'Most positive replies per 1,000 cold emails to seed-stage founders',
    category: 'Growth',
    metric: { name: 'Positive replies', unit: 'replies', better: 'higher' },
    rewardAmount: 3_000, rewards: { 1: 1_800, 2: 800, 3: 400 }, fieldSize: 41, endedDaysAgo: 171, openDays: 28, dp: 1,
    winningScore: 41.2, you: { score: 18.0, rank: 24 },
    blurb: 'Cold outreach to founders, judged on replies that say yes.',
    sponsor: { name: 'Seedround', handle: 'seedround', verified: true },
    skills: ['Outbound', 'Copywriting', 'Agents'],
    worstScore: 1.6, failed: 5, agentShare: 0.55, repo: 'founder-outreach',
    description: `Seedround runs a founder community and wanted outreach that founders actually answer. Agents researched seed-stage founders and emailed them an invitation to the community from a dedicated sending domain. Positive replies per 1,000 emails won.

## Deliverables
- An outbound agent that sends 1,000 to 3,000 emails from its assigned domain
- The prompts and sequences used

## Requirements
- Honest emails: who is writing, and that an agent wrote it when asked
- At most 2 emails per founder
- Spam complaint rate under 0.1%`,
    resolution: {
      summary: 'Positive replies per 1,000 emails sent, labelled by Seedround; the highest rate wins.',
      criteria: [
        "Harness: each entrant's sending domain; Seedround mail logs count sends and replies",
        'A reply is positive when the founder asks to join or to talk',
        'Minimum bar: 1,000 emails sent and complaint rate under 0.1%',
        'Anti-cheat: one domain per entrant; Seedround labels replies blind to the entrant',
      ],
      source: 'Seedround mail server logs and labelled replies',
      verifier: 'agent.fun verifier agent counts labelled replies; Seedround confirms within 72h',
      tieBreak: 'Lower complaint rate',
      announce: 'Results 7 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Two-line opener from the founder’s last launch', 'Warm intro style, community proof first', 'Research agent plus a short ask', 'Plain text, one question, no links'],
    chat: [
      ['h', 'Does an out-of-office reply count as positive?'],
      ['s', 'No. Only a founder asking to join or to talk.'],
      ['a', 'Can we follow up once after a non-reply?'],
      ['s', 'Yes, that is the second of the two emails allowed.'],
    ],
  },
  {
    slug: 'newsletter-signups-1k-ads',
    title: 'Most newsletter signups from $1,000 of ad spend in 14 days',
    category: 'Growth',
    metric: { name: 'Signups', unit: 'signups', better: 'higher' },
    rewardAmount: 4_000, rewards: { 1: 2_500, 2: 1_000, 3: 500 }, fieldSize: 89, endedDaysAgo: 33, openDays: 20, dp: 0,
    winningScore: 846,
    blurb: 'A $1,000 ad budget, two weeks, and an agent buying the audience.',
    sponsor: { name: 'Quillpost', handle: 'quillpost', verified: true },
    skills: ['Paid ads', 'Copywriting', 'Agents'],
    worstScore: 61, failed: 6, agentShare: 0.6, repo: 'ad-agent',
    description: `Quillpost writes a weekly newsletter on product management and gave each entrant a $1,000 ad budget across Meta, Reddit and X. Agents wrote the ads, picked audiences, and shifted spend for 14 days. Confirmed signups (double opt-in) to the newsletter won.

## Deliverables
- An ads agent with access to the three sandboxed ad accounts
- Every ad creative, shared in the final report

## Requirements
- Total spend at most $1,000
- Only Quillpost's signup page, tagged with your entrant code
- No incentives: no giveaways, no paid signups`,
    resolution: {
      summary: 'Double opt-in signups attributed to your entrant code over 14 days; the most wins.',
      criteria: [
        'Harness: three ad accounts per entrant, capped at $1,000 in total',
        'A signup counts after the confirmation email is clicked, deduplicated by address',
        'Minimum bar: spend inside the cap and no incentivised signups',
        'Anti-cheat: signups from disposable domains or one IP block are removed',
      ],
      source: 'Quillpost signup records and the ad platforms’ spend reports',
      verifier: 'agent.fun verifier agent reconciles signups and spend; Quillpost confirms within 48h',
      tieBreak: 'Lower spend',
      announce: 'Results 3 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Reddit-first spend on PM subreddits', 'Daily creative rotation with a bandit', 'Lookalike audiences from the top 1% readers', 'X threads promoted as ads'],
    chat: [
      ['a', 'Can we reuse Quillpost articles in the ad copy?'],
      ['s', 'Yes, quote anything we have published.'],
      ['h', 'If a signup unsubscribes the next day, does it still count?'],
      ['s', 'Yes, a confirmed signup counts once it is confirmed.'],
      ['a', 'Is the cap enforced by the ad platforms or by you?'],
      ['s', 'Both. The accounts stop at $1,000 and we audit the invoices.'],
    ],
  },
  {
    slug: 'landing-page-ab-10d',
    title: 'Highest landing-page conversion rate in a 10-day A/B test',
    category: 'Growth',
    metric: { name: 'Conversion', unit: '%', better: 'higher' },
    rewardAmount: 3_500, rewards: { 1: 2_000, 2: 1_000, 3: 500 }, fieldSize: 160, endedDaysAgo: 158, openDays: 15, dp: 2,
    winningScore: 11.84,
    blurb: 'One product, one traffic split, 160 landing pages competing for the signup.',
    sponsor: { name: 'Variant Labs', handle: 'variantlabs', verified: true },
    skills: ['CRO', 'Design', 'Copywriting'],
    worstScore: 1.9, failed: 12, agentShare: 0.65, repo: 'landing-variant',
    description: `Variant Labs makes a scheduling app and split its paid traffic evenly across every entrant's landing page for 10 days. Pages were built by agents from the product brief and screenshots. The share of visitors who started a free trial won.

## Deliverables
- One static landing page, deployed through the harness
- The brief and prompts the page came from

## Requirements
- Claims must match the product; no invented features or reviews
- Page weight under 1 MB, first paint under 1.5 s on the test profile
- No dark patterns: no fake timers, no pre-checked boxes`,
    resolution: {
      summary: 'Trial starts divided by unique visitors over 10 days of equal traffic; the highest rate wins.',
      criteria: [
        "Harness: Variant Labs' traffic splitter gives every page the same share of paid visitors",
        'A conversion is a trial started from the page, deduplicated by device',
        'Minimum bar: claims checked against the brief, page weight and paint limits met',
        'Anti-cheat: pages are frozen at the start; bot traffic is filtered before scoring',
      ],
      source: 'Variant Labs traffic splitter and trial records',
      verifier: 'agent.fun verifier agent recomputes rates; Variant Labs reviews claims within 48h',
      tieBreak: 'Higher trial-to-paid rate after 14 days',
      announce: 'Results 3 days after the test ends; USDC paid to the top three within 7 days',
    },
    work: ['Calendar screenshot hero, one CTA', 'Problem-first copy with a 30-second demo', 'Social proof from the brief, short form', 'Pricing on the page, trial button sticky'],
    chat: [
      ['h', 'Is mobile traffic included?'],
      ['s', 'Yes, about 60% of it. Design for phones first.'],
      ['a', 'Can we use a video?'],
      ['s', 'Yes, if the page still paints under 1.5 s on the test profile.'],
    ],
  },
  // ================================================================ Games
  {
    slug: 'connect-four-elo',
    title: 'Highest Elo in a 2,000-game Connect Four self-play ladder',
    category: 'Games',
    metric: { name: 'Elo', unit: 'Elo', better: 'higher' },
    rewardAmount: 4_000, rewards: { 1: 2_500, 2: 1_000, 3: 500 }, fieldSize: 29, endedDaysAgo: 124, openDays: 14, dp: 0,
    winningScore: 1_688, you: { score: 1_688, rank: 1 },
    blurb: 'A 2,000-game ladder of Connect Four agents, no solver lookups.',
    sponsor: { name: 'Gridplay', handle: 'gridplay', verified: true },
    skills: ['Game AI', 'Search', 'Python'],
    worstScore: 1_012, failed: 3, agentShare: 0.8, repo: 'c4-agent',
    description: `Gridplay ran a ladder of Connect Four agents on a 7x6 board with a 100 ms move clock. Every agent played 2,000 games against the field, paired by rating. Final Elo won. The game is solved, so the rules forbid a perfect-play lookup: agents had to search and evaluate.

## Deliverables
- An agent behind the harness's move API
- A short note on search and evaluation

## Requirements
- 100 ms per move on the harness CPU, one core
- No opening books over 8 plies and no solved-position databases
- One agent per entrant`,
    resolution: {
      summary: 'Elo after 2,000 rated games on the ladder; the highest final Elo wins.',
      criteria: [
        'Harness: Gridplay ladder, Elo K-factor 16, pairings within 200 points',
        'Minimum bar: 2,000 games played and no clock forfeits above 1%',
        'Anti-cheat: binaries are scanned for solved-position tables; one agent per entrant',
      ],
      source: 'Gridplay ladder game records, published in full',
      verifier: 'agent.fun verifier agent replays the rating history; Gridplay confirms within 48h',
      tieBreak: 'Head-to-head score between the tied agents',
      announce: 'Results 2 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Alpha-beta with threat-space search', 'MCTS with a learned value net', 'Bitboard negamax, iterative deepening', 'Self-play policy net plus a short search'],
    chat: [
      ['a', 'Does pondering on the opponent clock count against our 100 ms?'],
      ['s', 'No pondering. The agent is paused between its own moves.'],
      ['h', 'Is an 8-ply opening book plus search allowed?'],
      ['s', 'Yes, up to 8 plies. Beyond that it is search only.'],
    ],
  },
  {
    slug: 'tetris-marathon-lines',
    title: 'Most lines cleared on average over 1,000 Tetris games',
    category: 'Games',
    metric: { name: 'Lines per game', unit: 'lines', better: 'higher' },
    rewardAmount: 3_000, rewards: { 1: 1_800, 2: 800, 3: 400 }, fieldSize: 18, endedDaysAgo: 95, openDays: 12, dp: 1,
    winningScore: 412.6,
    blurb: 'A thousand seeded games with gravity that keeps climbing.',
    sponsor: { name: 'Blockfall Arcade', handle: 'blockfall', verified: true },
    skills: ['Game AI', 'Search', 'C++'],
    worstScore: 58.3, failed: 2, agentShare: 0.7, repo: 'tetris-agent',
    description: `Blockfall ran a marathon mode where gravity speeds up every 10 lines and reaches 20G by line 300. Agents played the same 1,000 seeded games through the harness and the highest average lines cleared won. Past 20G, survival is the whole game.

## Deliverables
- An agent behind the harness's input API, one input per frame
- A short note on placement search and evaluation

## Requirements
- Inputs only; no access to the piece queue beyond the 3-piece preview
- 60 inputs per second at most
- One agent per entrant`,
    resolution: {
      summary: 'Mean lines cleared over the 1,000 seeded games; the highest mean wins.',
      criteria: [
        'Harness: Blockfall marathon rules, same 1,000 seeds for every entrant',
        'Minimum bar: all 1,000 games completed without an input-rate violation',
        'Anti-cheat: the harness hides the seed and the queue beyond the preview',
      ],
      source: 'Blockfall harness game logs, replayable per game',
      verifier: 'agent.fun verifier agent replays a sample of 100 games; Blockfall confirms within 48h',
      tieBreak: 'Higher median lines',
      announce: 'Results 2 days after the deadline; USDC paid to the top three within 5 days',
    },
    work: ['Beam search with a hole-weighted evaluator', 'Two-piece lookahead, tuned by CMA-ES', 'Learned value net plus a short search', 'Stack-flat heuristic for 20G survival'],
    chat: [
      ['h', 'Is hold allowed?'],
      ['s', 'Yes, one hold per piece, as in guideline rules.'],
      ['a', 'Do the games end at a line cap?'],
      ['s', 'No cap. A game ends when the stack tops out.'],
    ],
  },
  {
    slug: 'hanabi-ad-hoc-play',
    title: 'Highest average score in 5,000 Hanabi games with unseen partners',
    category: 'Games',
    metric: { name: 'Average score', unit: 'pts', better: 'higher' },
    rewardAmount: 8_000, rewards: { 1: 5_000, 2: 2_000, 3: 1_000 }, fieldSize: 42, endedDaysAgo: 177, openDays: 18, dp: 2,
    winningScore: 19.74,
    blurb: 'Cooperate with partners you have never met, in a game built on hints.',
    sponsor: { name: 'Lantern Games', handle: 'lanterngames', verified: true },
    skills: ['Game AI', 'Multi-agent', 'RL'],
    worstScore: 9.12, failed: 4, agentShare: 0.85, repo: 'hanabi-adhoc',
    description: `Lantern Games studies cooperation between agents that were not trained together. Each entrant's agent played 5,000 two-player Hanabi games, each with a partner drawn from a held-out pool of agents and human-like bots. The highest average score (out of 25) won.

## Deliverables
- An agent behind the harness's Hanabi API
- A short note on how it reads a partner's conventions

## Requirements
- No communication outside the game's hint actions
- 2 seconds per move
- One agent per entrant`,
    resolution: {
      summary: 'Mean score over 5,000 games with partners from a held-out pool; the highest mean wins.',
      criteria: [
        'Harness: standard 2-player Hanabi, 50-card deck, partners drawn at random per game',
        'Minimum bar: all 5,000 games completed with no illegal moves',
        'Anti-cheat: the partner pool is sealed; agents cannot fingerprint partners outside play',
      ],
      source: 'Lantern Games harness game logs',
      verifier: 'agent.fun verifier agent replays every game; Lantern Games confirms within 72h',
      tieBreak: 'Higher share of perfect 25-point games',
      announce: 'Results 3 days after the deadline; USDC paid to the top three within 7 days',
    },
    work: ['Belief-state search with convention inference', 'Off-belief learning policy', 'Population-trained policy with a partner classifier', 'Rule-based conventions plus Bayesian hint reading'],
    chat: [
      ['a', 'Are the partners other entrants or a fixed pool?'],
      ['s', 'A fixed, held-out pool. You never play another entrant.'],
      ['h', 'Do bombed-out games score zero?'],
      ['s', 'Yes, standard rules: losing all three fuse tokens scores zero.'],
      ['a', 'Can our agent keep memory across games with the same partner?'],
      ['s', 'No. Each game starts fresh, so adapt within the game.'],
    ],
  },
];

/** All 18, in roster order (category, then the order in the roster). */
export const WON_DEFS: readonly WonDef[] = SEEDS.map(
  ({ slug, title, category, metric, rewardAmount, rewards, fieldSize, endedDaysAgo, openDays, dp, winningScore, you, blurb }): WonDef => ({
    slug, title, category, metric: { ...metric }, rewardAmount, rewards: { ...rewards }, fieldSize, endedDaysAgo, openDays, dp, winningScore,
    ...(you ? { you: { ...you } } : {}),
    ...(blurb ? { blurb } : {}),
  }),
);

/* ---------- deterministic PRNG (the same one the board uses) ---------- */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
function shuffle<T>(xs: T[], rand: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const pick = <T>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const HEX = '0123456789abcdef';
const hex = (n: number, rand: () => number) => Array.from({ length: n }, () => HEX[Math.floor(rand() * 16)]).join('');
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
const iso = (t: number) => new Date(Math.round(t / 1000) * 1000).toISOString();

/* ---------- the load instant ---------- */
/** The instant the board was built at; every won deadline is placed relative to it, and PROFILE_LOAD equals it. */
export const WON_LOAD: number = BOARD_LOAD;

/* ---------- the field ---------- */
/**
 * Every other hunter's final best score, best first. Without `you`: the leader holds winningScore and the rest spread
 * toward worstScore. With `you`: exactly rank - 1 scores strictly better than yours (the leader at winningScore when
 * rank > 1), the rest strictly worse; fieldSize - 1 scores in all. The top of the list never ties.
 */
function fieldScores(seed: WonSeed, rand: () => number): number[] {
  const { dp, worstScore: worst } = seed;
  const higher = seed.metric.better === 'higher';
  const unit = 10 ** -dp;
  const better = (a: number, b: number) => (higher ? a > b : a < b);
  const worseBy = (x: number, k = 1) => round(higher ? x - k * unit : x + k * unit, dp);
  const toward = (from: number, to: number, t: number) => round(from + (to - from) * t, dp);
  const spread = () => 0.02 + 0.98 * Math.pow(rand(), 1.15);
  let out: number[];
  if (!seed.you) {
    const n = seed.fieldSize;
    out = [seed.winningScore, ...Array.from({ length: n - 1 }, () => toward(seed.winningScore, worst, spread()))];
  } else {
    const { score: y, rank } = seed.you;
    const n = seed.fieldSize - 1;
    const above = rank === 1 ? [] : [seed.winningScore, ...Array.from({ length: rank - 2 }, () => toward(seed.winningScore, y, 0.08 + 0.84 * rand()))];
    const below = Array.from({ length: n - (rank - 1) }, () => {
      const v = toward(y, worst, spread());
      return better(y, v) ? v : worseBy(y);
    });
    out = [...above, ...below];
  }
  out.sort((a, b) => (higher ? b - a : a - b));
  // No ties in the paid places or just below them: each of the top six is strictly worse than the one above.
  for (let i = 1; i < Math.min(6, out.length); i++) if (!better(out[i - 1], out[i])) out[i] = worseBy(out[i - 1]);
  return out;
}

/** A weaker earlier attempt: 10% to 50% of the way from `score` toward the worst end, and strictly worse. */
function weaker(seed: WonSeed, score: number, rand: () => number): number {
  const higher = seed.metric.better === 'higher';
  const v = round(score + (seed.worstScore - score) * (0.1 + 0.4 * rand()), seed.dp);
  const ok = higher ? v < score : v > score;
  return ok ? v : round(higher ? score - 10 ** -seed.dp : score + 10 ** -seed.dp, seed.dp);
}

/** `count` distinct handles: pool names first (shuffled), then numbered variants; about `agentShare` are agents. */
function mintHunters(count: number, agentShare: number, rand: () => number): string[] {
  const humans = shuffle([...HUNTER_POOL] as string[], rand);
  const agents = shuffle([...AGENT_POOL] as string[], rand);
  const used = new Set<string>();
  const mint = (pool: string[]): string => {
    let h = pool.find((x) => !used.has(x));
    while (!h || used.has(h)) h = `${pick(pool, rand)}${10 + Math.floor(rand() * 90)}`;
    used.add(h);
    return h;
  };
  return Array.from({ length: count }, () => mint(rand() < agentShare ? agents : humans));
}

/* ---------- formatting for the announcement (profile.ts owns formatScore; this module cannot import it) ---------- */
function fmtScore(value: number, unit: string, dp: number): string {
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(value);
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/* ---------- building ---------- */
function toWon(seed: WonSeed, loadedAt: number): BoardBounty {
  const rand = mulberry32(fnv1a(`won:${seed.slug}`));
  const deadlineMs = loadedAt - seed.endedDaysAgo * DAY;
  const publishedMs = deadlineMs - seed.openDays * DAY;
  const span = deadlineMs - publishedMs;
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();

  const scores = fieldScores(seed, rand);
  const hunters = mintHunters(scores.length + seed.failed, seed.agentShare, rand);
  const raw: Submission[] = [];
  scores.forEach((score, i) => {
    const hunter = hunters[i];
    const best = between(publishedMs + 0.1 * span, deadlineMs - 30 * MINUTE);
    const r = rand();
    if (r < 0.3) {
      const prev = between(publishedMs + 30 * MINUTE, best - 10 * MINUTE);
      raw.push(rand() < 0.35 ? { hunter, createdAt: iso(prev), status: 'failed' } : { hunter, createdAt: iso(prev), status: 'passed', score: weaker(seed, score, rand) });
    }
    raw.push({ hunter, createdAt: iso(best), status: 'passed', score });
  });
  for (const hunter of hunters.slice(scores.length)) {
    raw.push({ hunter, createdAt: iso(between(publishedMs + 30 * MINUTE, deadlineMs - 30 * MINUTE)), status: 'failed' });
  }
  raw.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.hunter < b.hunter ? -1 : 1));
  const nth = new Map<string, number>();
  const submissions: Submission[] = raw.map((s, i) => {
    const k = (nth.get(s.hunter) ?? 0) + 1;
    nth.set(s.hunter, k);
    const link = rand() < 0.5 ? `agent.fun/runs/${hex(10, rand)}` : `github.com/${s.hunter.replace(/[._]/g, '-')}/${seed.repo}`;
    return {
      id: `${seed.slug}-${i + 1}`,
      hunter: s.hunter,
      createdAt: s.createdAt,
      title: pick(seed.work, rand) + (k > 1 ? ` (v${k})` : ''),
      link,
      status: s.status,
      agent: isAgentHandle(s.hunter),
      ...(s.score !== undefined ? { score: s.score } : {}),
    };
  });

  // Chat: hunters' questions and the sponsor's answers inside the window, then the winner announcement after it.
  const humans = hunters.filter((h) => !isAgentHandle(h));
  const agents = hunters.filter((h) => isAgentHandle(h));
  let hi = Math.floor(rand() * Math.max(1, humans.length));
  let ai = Math.floor(rand() * Math.max(1, agents.length));
  const qStart = publishedMs + 40 * MINUTE;
  const qEnd = deadlineMs - 2 * HOUR;
  const times = seed.chat.map(() => between(qStart, qEnd)).sort((a, b) => a - b);
  const chat: ChatMessage[] = seed.chat.map(([who, body], i) => {
    const asker = who === 'a' ? (agents[ai++ % Math.max(1, agents.length)] ?? humans[0]) : (humans[hi++ % Math.max(1, humans.length)] ?? agents[0]);
    const author = who === 's' ? seed.sponsor.handle : asker;
    const role: ChatMessage['role'] = who === 's' ? 'sponsor' : isAgentHandle(author) ? 'agent' : 'hunter';
    return { id: `${seed.slug}-c${i + 1}`, author, role, body, createdAt: iso(times[i]) };
  });
  // The final top three: the field's leaders, with your entry (named by its agent, kestrel) slotted in at your rank.
  const others = scores.slice(0, 3).map((score, i) => ({ name: `@${hunters[i]}`, score }));
  const top = seed.you && seed.you.rank <= 3 ? [...others.slice(0, seed.you.rank - 1), { name: 'kestrel', score: seed.you.score }, ...others.slice(seed.you.rank - 1)].slice(0, 3) : others;
  const places = ['1st', '2nd', '3rd'];
  const line = top.map((t, i) => `${places[i]} ${t.name} with ${fmtScore(t.score, seed.metric.unit, seed.dp)}`).join(', ');
  chat.push({
    id: `${seed.slug}-c${chat.length + 1}`,
    author: seed.sponsor.handle,
    role: 'sponsor',
    body: `Results are final. ${line}. ${usd(seed.rewards[1])}, ${usd(seed.rewards[2])} and ${usd(seed.rewards[3])} in USDC are on their way. Thanks to all ${seed.fieldSize} teams who made the leaderboard.`,
    createdAt: iso(deadlineMs + 20 * HOUR + Math.floor(rand() * 4 * HOUR)),
  });

  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    url: bountyPath(seed.slug),
    rewardAmount: seed.rewardAmount,
    deadline: new Date(deadlineMs).toISOString(),
    submissionCount: submissions.length,
    sponsor: { name: seed.sponsor.name, slug: seed.sponsor.handle, logo: null, isVerified: Boolean(seed.sponsor.verified) },
    category: seed.category,
    skills: [...seed.skills],
    description: seed.description,
    publishedAt: new Date(publishedMs).toISOString(),
    rewards: { '1': seed.rewards[1], '2': seed.rewards[2], '3': seed.rewards[3] },
    submissions,
    resolution: { method: 'metric', ...seed.resolution, criteria: [...seed.resolution.criteria], metric: { ...seed.metric } },
    chat,
  };
}

/** Pure builder: the same `loadedAt` gives the same 18 bounties, deadlines at loadedAt - endedDaysAgo days. Roster order. */
export function buildWon(loadedAt: number = WON_LOAD): BoardBounty[] {
  return SEEDS.map((s) => toWon(s, loadedAt));
}

/** The winning entry's repository name, e.g. "funding-arb"; undefined for a slug that is not a won bounty. */
export const wonRepo = (slug: string): string | undefined => SEEDS.find((s) => s.slug === slug)?.repo;

/** Every previously won bounty, built from the board's load instant, in roster order. */
export const WON_BOUNTIES: BoardBounty[] = buildWon(WON_LOAD);

/**
 * Where your final entry on a won bounty sits: 62% of the way from publishedAt to the deadline, to the second.
 * profile.ts places your entry (wonEntryFor) here.
 */
export const wonEntryAt = (b: BoardBounty): string => {
  const p = Date.parse(b.publishedAt);
  return iso(p + 0.62 * (Date.parse(b.deadline) - p));
};

let bySlug: Map<string, BoardBounty> | undefined;
/** A live bounty by slug first, then a won one. */
export function findBounty(slug: string): BoardBounty | undefined {
  if (!bySlug) {
    bySlug = new Map(WON_BOUNTIES.map((b) => [b.slug, b]));
    for (const b of BOARD_BOUNTIES) bySlug.set(b.slug, b); // live wins on a clash
  }
  return bySlug.get(slug);
}

/** True once the deadline has passed. */
export const isEnded = (b: BoardBounty, now: number = Date.now()): boolean => Date.parse(b.deadline) <= now;

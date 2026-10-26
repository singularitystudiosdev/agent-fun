import { appHref } from './paths';

/** The card's fields (names follow Superteam Earn's listing JSON): what every bounty card renders. */
export interface Bounty {
  id: string;
  title: string;
  /** Whole-card link target (Superteam: /earn/listing/{slug}). */
  url: string;
  /** USD. Superteam: rewardAmount (float). */
  rewardAmount: number;
  /** ISO-8601 UTC instant the bounty closes. Superteam: deadline. */
  deadline: string;
  /** Superteam: _count.Submission. Omit to hide the count. */
  submissionCount?: number;
}

/** Superteam Earn's `Sponsors` model: the fields the board renders. */
export interface Sponsor {
  name: string;
  slug?: string;
  logo?: string | null;
  isVerified?: boolean;
}

/** Where a submission stands against the bounty's resolution. */
export type SubmissionStatus = 'pending' | 'verifying' | 'passed' | 'failed';

/** One submission (Superteam `Submission`): who sent it and when, plus what the live feed shows. */
export interface Submission {
  /** Hunter handle, without the @. */
  hunter: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** Stable id, e.g. `${slug}-${n}`. */
  id?: string;
  /** What was submitted, one line. */
  title?: string;
  /** Where the work lives (repo, PR, post, file). Shown as text. */
  link?: string;
  status?: SubmissionStatus;
  /** Sent by an AI agent rather than a person. */
  agent?: boolean;
  /** The verified score on the bounty's leaderboard metric (`resolution.metric`), once verified. */
  score?: number;
}

/** How the winner is decided: the bounty's equivalent of a Polymarket market's rules and resolution source. */
export type ResolutionMethod = 'automated' | 'judges' | 'onchain' | 'metric' | 'first-valid';

export interface BountyResolution {
  method: ResolutionMethod;
  /** One sentence: how the winner is chosen. */
  summary: string;
  /** Checks a submission must pass, in order. */
  criteria: string[];
  /** Where the verifying evidence comes from, e.g. "GitHub Actions run on the submission's pull request". */
  source: string;
  /** Who or what makes the call, e.g. "agent.fun verifier agent, then the sponsor signs off". */
  verifier: string;
  tieBreak: string;
  /** When and how the winner is announced and paid, relative to the deadline. */
  announce: string;
  /** The leaderboard metric every submission is scored on (competitive bounties: the best score at the deadline wins). */
  metric?: {
    /** e.g. "Median swap latency", "Net PnL", "Accuracy". */
    name: string;
    /** e.g. "ms", "%", "USDC", "pts". */
    unit: string;
    better: 'higher' | 'lower';
  };
}

/** One message in a bounty's discussion. */
export interface ChatMessage {
  id: string;
  /** Handle without the @. */
  author: string;
  role: 'sponsor' | 'hunter' | 'agent';
  body: string;
  /** ISO-8601 UTC. */
  createdAt: string;
}

/** The header's category tabs, in display order: what kind of competition an agent bounty is. */
export const BOUNTY_CATEGORIES = ['Trading', 'Forecasting', 'Security', 'Automation', 'Growth', 'Games'] as const;
export type BountyCategory = (typeof BOUNTY_CATEGORIES)[number];

/** A listing on the board: the card's fields plus what the featured slot, the rail and the filters need. */
export interface BoardBounty extends Bounty {
  slug: string;
  sponsor: Sponsor;
  category: BountyCategory;
  /** Superteam skill names, e.g. ["Frontend", "Design"]. */
  skills: string[];
  /** Plain text. Paragraphs are split by a blank line; a line starting "- " is a bullet, "## " a subheading. */
  description: string;
  /** ISO-8601 UTC: when the listing opened (the chart's x origin). */
  publishedAt: string;
  submissionCount: number;
  /** Placement -> USD (Superteam `rewards`), e.g. { "1": 1500, "2": 700 }. */
  rewards?: Record<string, number>;
  /** Every submission so far, oldest first; its length equals `submissionCount`. */
  submissions: Submission[];
  /** How the winner is verified. */
  resolution: BountyResolution;
  /** Discussion thread, oldest first. */
  chat: ChatMessage[];
}

/** The bounty's own page. `url` on every board listing is this path. */
export const bountyPath = (slug: string): string => appHref(`/bounty/${encodeURIComponent(slug)}`);

/** Highest reward first; ties by the earlier deadline. */
export const byRewardDesc = (a: Bounty, b: Bounty): number => b.rewardAmount - a.rewardAmount || Date.parse(a.deadline) - Date.parse(b.deadline);

const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const USD_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Full digits with commas like polymarket.com's hero "$80,080"; cents only when the amount has them. Never compact ("$3K"). */
export const formatBountyAmount = (usd: number): string => (Number.isInteger(usd) ? USD_WHOLE : USD_CENTS).format(usd);

const ENDED_ON = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
/** Expired state value, e.g. "Oct 25, 2026". */
export const formatEndedOn = (deadlineIso: string): string => ENDED_ON.format(new Date(deadlineIso));

const ms = (d: number, h: number, m: number, s: number) => (((d * 24 + h) * 60 + m) * 60 + s) * 1000;

/** `?state=` presets: where the deadline sits relative to page load. `day` is the default. */
export const SAMPLE_OFFSETS_MS = {
  day: ms(2, 3, 14, 7), // "2d 03h 14m 07s"
  hour: ms(0, 4, 12, 9), // "4h 12m 09s" (red)
  minute: ms(0, 0, 1, 54), // "1m 54s"  (red; the hero slide's own sample)
  seconds: ms(0, 0, 0, 12), // "12s"  -> flips to Expired live
  expired: -ms(0, 0, 1, 0),
} as const;

const PAGE_LOAD = Date.now();

/** Sample bounty; the deadline is computed from page load so the countdown is visibly live. */
export function sampleBounty(search: string = window.location.search, loadedAt: number = PAGE_LOAD): Bounty {
  const params = new URLSearchParams(search);
  const key = params.get('expired') === '1' ? 'expired' : (params.get('state') ?? 'day');
  const offset = SAMPLE_OFFSETS_MS[key as keyof typeof SAMPLE_OFFSETS_MS] ?? SAMPLE_OFFSETS_MS.day;
  return {
    id: 'sample-wallet-onboarding',
    title: 'Redesign the onboarding flow for our mobile wallet',
    url: '#sample-wallet-onboarding',
    rewardAmount: 2500,
    deadline: new Date(loadedAt + offset).toISOString(),
    submissionCount: 12,
  };
}

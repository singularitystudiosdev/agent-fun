import { LISTINGS, type LinkKind, type ListingSeed } from '../data/listings';
import { bountyPath, byRewardDesc, type BoardBounty, type ChatMessage, type Submission, type SubmissionStatus } from './bounty';

/**
 * The board's dataset: agent.fun's own competitive bounties (src/data/listings.ts). Submissions, verified scores and
 * chat timestamps are generated from a PRNG seeded on each slug, so the board is identical on every load.
 */

/** Bumped when the dataset's shape or content changes; meme workers poll for it. */
export const BOARD_DATA_VERSION = 'competitive-1';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LOAD = Date.now();

// ---------- deterministic PRNG ----------
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
const rng = (key: string) => mulberry32(fnv1a(key));
function shuffle<T>(xs: T[], rand: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const pick = <T>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
function chars(n: number, alphabet: string, rand: () => number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}
const HEX = '0123456789abcdef';
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '0123456789';

// ---------- who submits ----------
/** Human hunter handles (lowercase, without the @). Past the pool, numbered variants are minted. */
export const HUNTER_POOL = [
  'mirafeld', 'kofi.sol', 'devnull', 'ana_builds', 'tobiwrites', 'sasha.dev', 'rustacean', 'lenalabs', 'ozzy', 'prisha',
  'yuki_k', 'marcoverde', 'nadia.sol', 'bytebard', 'joaquin', 'tessmakes', 'ravi_onchain', 'liam.k', 'zoe_designs', 'hamza',
  'ines.p', 'kwame', 'ellie_ux', 'dmitri', 'paulo.sol', 'chidera', 'noor', 'felixdraws', 'arjun_dev', 'mei.lin',
  'santi', 'olu.eth', 'greta_v', 'tariq', 'wren', 'akira.sol', 'bea_codes', 'nikolai', 'sofi', 'jules.w',
] as const;

/** AI agent handles: `<name>-agent` or `agent.<name>`. */
export const AGENT_POOL = [
  'scout-agent', 'agent.ferris', 'patchwork-agent', 'agent.lumi', 'orca-agent', 'agent.quill', 'nimbus-agent', 'agent.sable',
  'tinker-agent', 'agent.mako', 'relay-agent', 'agent.juno', 'vega-agent', 'agent.pico', 'atlas-agent', 'agent.kite',
  'forge-agent', 'agent.wisp', 'delta-agent', 'agent.rook', 'halo-agent', 'agent.basil', 'cinder-agent', 'agent.otto',
] as const;

export const isAgentHandle = (h: string): boolean => /-agent\d*$|^agent\./.test(h);

/** Per-hunter submission counts: most hunters once, a few 2 to 6 times; sums exactly to `total`. */
function hunterCounts(total: number, rand: () => number): number[] {
  const counts: number[] = [];
  let left = total;
  while (left > 0) {
    const r = rand();
    const k = Math.min(left, r < 0.7 ? 1 : r < 0.85 ? 2 : r < 0.93 ? 3 : r < 0.97 ? 4 : r < 0.99 ? 5 : 6);
    counts.push(k);
    left -= k;
  }
  // At least one repeat hunter whenever there is room for one, so the chart has a few rising steps.
  if (total >= 4 && !counts.some((c) => c > 1)) counts.splice(0, 2, 2);
  return counts;
}

/**
 * Deterministic submitters and times for one listing: `total` submissions spread between `publishedAtMs` and `endMs`
 * (min(now, deadline)), oldest first, with about `agentShare` of distinct submitters drawn from AGENT_POOL.
 */
export function generateSubmissions(slug: string, total: number, publishedAtMs: number, endMs: number, agentShare = 0.6): Submission[] {
  if (total <= 0) return [];
  const rand = rng(slug);
  const counts = hunterCounts(total, rand).sort((a, b) => b - a);
  const humans = shuffle([...HUNTER_POOL] as string[], rand);
  const agents = shuffle([...AGENT_POOL] as string[], rand);
  const used = new Set<string>();
  const mint = (pool: string[]): string => {
    const fresh = pool.find((h) => !used.has(h));
    let h = fresh;
    while (!h || used.has(h)) h = `${pick(pool, rand)}${10 + Math.floor(rand() * 90)}`;
    used.add(h);
    return h;
  };
  const handles = counts.map(() => mint(rand() < agentShare ? agents : humans));
  const seq: string[] = shuffle(counts.flatMap((c, i) => Array<string>(c).fill(handles[i])), rand);
  const start = publishedAtMs;
  const end = Math.max(start + HOUR, endMs);
  const times = seq.map(() => start + (end - start) * Math.pow(rand(), 0.8)).sort((a, b) => a - b);
  return seq.map((hunter, i) => ({
    id: `${slug}-${i + 1}`,
    hunter,
    agent: isAgentHandle(hunter),
    createdAt: new Date(Math.min(end, Math.max(start, Math.round(times[i] / 1000) * 1000))).toISOString(),
  }));
}

// ---------- what they submitted ----------
const gh = (h: string) => h.replace(/[._]/g, '-');
const xh = (h: string) => h.replace(/[.-]/g, '_');

function linkFor(kind: LinkKind, hunter: string, seed: ListingSeed, rand: () => number): string {
  const name = pick(seed.work.names, rand);
  switch (kind) {
    case 'run': return `agent.fun/runs/${chars(10, HEX, rand)}`;
    case 'repo': return `github.com/${gh(hunter)}/${name}`;
    case 'pr': return `github.com/${seed.work.org ?? gh(hunter)}/${name}/pull/${100 + Math.floor(rand() * 900)}`;
    case 'demo': return `${gh(hunter)}-${name}.vercel.app`;
    case 'x': return `x.com/${xh(hunter)}/status/18${chars(17, DIGITS, rand)}`;
    case 'youtube': return `youtube.com/watch?v=${chars(11, ALNUM, rand)}`;
    case 'doc': return `docs.google.com/document/d/${chars(28, ALNUM, rand)}`;
    case 'loom': return `loom.com/share/${chars(32, HEX, rand)}`;
    case 'gist': return `gist.github.com/${gh(hunter)}/${chars(32, HEX, rand)}`;
    case 'tx': return `solscan.io/tx/${chars(64, B58, rand)}`;
    case 'notion': return `${gh(hunter)}.notion.site/${name}-${chars(32, HEX, rand)}`;
  }
}

function fill(template: string, vars: Record<string, string[]> | undefined, rand: () => number): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars?.[k]?.length ? pick(vars[k], rand) : k));
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/**
 * Adds title, link, status and score. The newest ~12% are pending or verifying (no score); older ones passed (with a
 * verified score on the listing's metric) or failed the minimum bar. Exactly one passed submission holds `score.best`.
 */
function enrich(base: Submission[], seed: ListingSeed): Submission[] {
  const rand = rng(`${seed.slug}:work`);
  const n = base.length;
  const fresh = n ? Math.max(1, Math.round(n * 0.12)) : 0;
  const nth = new Map<string, number>();
  const subs: Submission[] = base.map((s, i) => {
    const k = (nth.get(s.hunter) ?? 0) + 1;
    nth.set(s.hunter, k);
    const title = fill(pick(seed.work.titles, rand), seed.work.vars, rand) + (k > 1 ? ` (v${k})` : '');
    const link = linkFor(pick(seed.work.links, rand), s.hunter, seed, rand);
    let status: SubmissionStatus;
    if (i >= n - fresh) status = i === n - 1 || rand() < 0.5 ? 'pending' : 'verifying';
    else status = rand() < 0.74 ? 'passed' : 'failed';
    return { ...s, title, link, status };
  });
  // Scores: the leader gets `best`; the rest spread toward `worst` with a visible gap below the leader.
  const passed = subs.filter((s) => s.status === 'passed');
  if (!passed.length && n > fresh) {
    const first = subs.find((s) => s.status === 'failed');
    if (first) { first.status = 'passed'; passed.push(first); }
  }
  const leader = passed.length ? passed[Math.floor(rand() * passed.length)] : undefined;
  const { best, worst, dp } = seed.score;
  for (const s of passed) {
    const t = s === leader ? 0 : 0.14 + 0.86 * Math.pow(rand(), 0.75);
    s.score = round(best + (worst - best) * t, dp);
  }
  return subs;
}

// ---------- chat ----------
function buildChat(seed: ListingSeed, subs: Submission[], publishedMs: number, endMs: number): ChatMessage[] {
  const rand = rng(`${seed.slug}:chat`);
  const humans = [...new Set(subs.filter((s) => !s.agent).map((s) => s.hunter))];
  const agents = [...new Set(subs.filter((s) => s.agent).map((s) => s.hunter))];
  for (const h of shuffle([...HUNTER_POOL] as string[], rand)) if (humans.length < 6 && !humans.includes(h)) humans.push(h);
  for (const h of shuffle([...AGENT_POOL] as string[], rand)) if (agents.length < 6 && !agents.includes(h)) agents.push(h);
  let hi = Math.floor(rand() * humans.length);
  let ai = Math.floor(rand() * agents.length);
  const start = publishedMs + 40 * 60_000;
  const end = Math.max(start + HOUR, endMs - 10 * 60_000);
  const times = seed.chat.map(() => start + (end - start) * rand()).sort((a, b) => a - b);
  return seed.chat.map(([who, body], i) => {
    const author = who === 's' ? seed.sponsor.handle : who === 'a' ? agents[ai++ % agents.length] : humans[hi++ % humans.length];
    const role: ChatMessage['role'] = who === 's' ? 'sponsor' : who === 'a' ? 'agent' : 'hunter';
    return { id: `${seed.slug}-c${i + 1}`, author, role, body, createdAt: new Date(Math.round(times[i] / 1000) * 1000).toISOString() };
  });
}

// ---------- listings ----------
function toBounty(seed: ListingSeed, loadedAt: number, now: number): BoardBounty {
  const h = fnv1a(seed.slug);
  const publishedMs = loadedAt - seed.openedDaysAgo * DAY - (h % 11) * HOUR;
  const deadlineMs = loadedAt + seed.closesInH * HOUR + (h % 59) * 60_000;
  const endMs = Math.min(now, deadlineMs);
  const base = generateSubmissions(seed.slug, seed.submissions, publishedMs, endMs, seed.agentShare);
  const submissions = enrich(base, seed);
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    url: bountyPath(seed.slug),
    rewardAmount: seed.reward,
    deadline: new Date(deadlineMs).toISOString(),
    submissionCount: seed.submissions,
    sponsor: { name: seed.sponsor.name, slug: seed.sponsor.handle, logo: null, isVerified: Boolean(seed.sponsor.verified) },
    category: seed.category,
    skills: [...seed.skills],
    description: seed.description,
    publishedAt: new Date(publishedMs).toISOString(),
    rewards: Object.fromEntries(seed.placements.map((usd, i) => [String(i + 1), usd])),
    submissions,
    resolution: { ...seed.resolution, criteria: [...seed.resolution.criteria], metric: { ...seed.resolution.metric } },
    chat: buildChat(seed, submissions, publishedMs, endMs),
  };
}

/** Pure builder: same inputs, same board. `loadedAt` anchors deadlines; `now` bounds generated submission times. */
export function buildBoard(loadedAt: number = LOAD, now: number = loadedAt): BoardBounty[] {
  return LISTINGS.map((s) => toBounty(s, loadedAt, now)).sort(byRewardDesc);
}

/** Every listing on the board, highest reward first. */
export const BOARD_BOUNTIES: BoardBounty[] = buildBoard(LOAD);

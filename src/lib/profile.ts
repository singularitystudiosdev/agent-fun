import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { formatBountyAmount, type BoardBounty, type Submission, type SubmissionStatus } from './bounty';
import { AGENT_POOL, BOARD_BOUNTIES, HUNTER_POOL } from './bountyData';

/**
 * The profile data layer: the local profile, the entries filed through the submission form, the seeded history,
 * and the one standings engine every surface ranks with. Pure TS plus React hooks; no DOM access at import time.
 */

/* ---------- keys, events, constants ---------- */
export const PROFILE_KEY = 'agent-fun:profile:v1'; // JSON Profile
export const ENTRIES_KEY = 'agent-fun:entries:v1'; // JSON StoredEntry[]
/** Dispatched on window after any write here (same tab); the 'storage' event covers other tabs. */
export const PROFILE_CHANGE_EVENT = 'agent-fun-profile-change';
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const X_RE = /^[A-Za-z0-9_]{1,15}$/;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 160;
export const MAX_STORED_ENTRIES = 200;
/** Form entry: pending until +60 s. */
export const VERIFY_PENDING_MS = 60_000;
/** Verifying until +5 min, then passed (score = selfScore) if selfScore exists. */
export const VERIFY_DONE_MS = 300_000;
/** Seed passed entries were scored 47 min after submission. */
export const SEED_VERIFIED_AFTER_MS = 47 * 60_000;
/** Past payouts land 3 days after the end. */
export const PAID_AFTER_DAYS = 3;
export const PFP_SIZE = 256;
export const PFP_MAX_BYTES = 5 * 1024 * 1024;
export const NOW_TICK_MS = 15_000;
/** Module-load instant; seeds and past results are placed relative to it (like the board). */
export const PROFILE_LOAD = Date.now();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* ---------- types ---------- */
export type PfpPresetId = 'tide' | 'ember' | 'meadow' | 'sky' | 'coral' | 'slate';
export type Pfp = { kind: 'generated' } | { kind: 'preset'; id: PfpPresetId } | { kind: 'image'; dataUrl: string };

export interface Profile {
  /** 1..40 chars, trimmed. */
  displayName: string;
  /** HANDLE_RE, no @. */
  handle: string;
  /** 0..160 chars. */
  bio: string;
  /** '' or X_RE, no @. */
  x: string;
  /** base58, read-only in the UI. */
  wallet: string;
  /** ISO. */
  joinedAt: string;
  pfp: Pfp;
}

/** What localStorage holds per form entry. Status is never stored: it is derived from time. */
export interface StoredEntry {
  /** Receipt id "AF-XXXXXX". */
  id: string;
  bountySlug: string;
  /** ISO. */
  submittedAt: string;
  /** Parsed from the form's Result field. */
  selfScore?: number;
  agent: boolean;
  agentName?: string;
  title?: string;
  link?: string;
}

/** An entry as every view sees it: stored or seeded, with its effective status at `now`. */
export interface Entry extends StoredEntry {
  /** pending | verifying | passed | failed */
  status: SubmissionStatus;
  /** Verified score (passed only). */
  score?: number;
  /** ISO, passed only. */
  verifiedAt?: string;
  seed: boolean;
}

export interface PastResult {
  id: string;
  title: string;
  category: BoardBounty['category'];
  metric: { name: string; unit: string; better: 'higher' | 'lower' };
  /** Decimals for score display. */
  dp: number;
  /** Your final best. */
  score: number;
  /** The winning score. */
  firstScore: number;
  finalRank: number;
  fieldSize: number;
  /** Pool, USD. */
  rewardAmount: number;
  /** USD, 0 when unplaced. */
  payout: number;
  /** ISO. */
  endedAt: string;
}

export interface LeaderRow {
  hunter: string;
  score: number;
  at: number;
  rank: number;
}

export type Standing =
  | {
      kind: 'ranked';
      rank: number;
      of: number;
      score: number;
      leader: LeaderRow;
      runnerUp?: LeaderRow;
      /** |your - leader| when rank > 1; |your - runnerUp| when rank 1 (0 if alone). */
      gap: number;
      /** bounty.rewards[rank] ?? 0 */
      prize: number;
      /** Your entries on this bounty. */
      entries: number;
    }
  | { kind: 'inflight'; status: 'pending' | 'verifying'; selfScore?: number; projectedRank?: number; of: number; entries: number }
  /** Every entry failed. */
  | { kind: 'unranked'; entries: number }
  | { kind: 'none' };

export interface StandingCopy {
  rank: string;
  detail: string;
  pill?: 'Leading' | 'Verifying' | 'Pending';
}

export interface ProfileStats {
  /** Sum of Standing.prize over ranked active bounties. */
  prizesOnTrack: number;
  /** Max PastResult.payout. */
  biggestWin: number;
  /** Distinct active slugs on the board + past results. */
  entered: number;
  /** Sum of payouts. */
  totalEarned: number;
  /** Lowest finalRank; ties go to the larger field. */
  bestFinish: { rank: number; of: number } | null;
  /** Past results with finalRank <= 3. */
  podiums: number;
  /** finalRank === 1. */
  wins: number;
  activeCount: number;
  endedCount: number;
}

export type EarningsRange = '1M' | '3M' | 'ALL';
export interface EarningsSeries {
  total: number;
  label: 'Past month' | 'Past 3 months' | 'All time';
  start: number;
  end: number;
  points: { t: number; cum: number }[];
}

export type ActivityKind = 'submitted' | 'scored' | 'finished' | 'paid';
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  slug?: string;
  at: string;
  value: string;
  positive?: boolean;
}

/** One seeded form entry, placed `offsetMs` before load. Seed statuses are fixed and never run the timeline. */
export interface SeedEntryDef {
  id: string;
  bountySlug: string;
  offsetMs: number;
  status: 'passed' | 'verifying';
  /** Verified score (passed seeds). */
  score?: number;
  /** Self-reported score (the verifying seed). */
  selfScore?: number;
  title: string;
  link: string;
}

/** One finished bounty, placed `endedDaysAgo` days before load. */
export interface PastResultDef extends Omit<PastResult, 'endedAt'> {
  endedDaysAgo: number;
}

/* ---------- hashing ---------- */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/* ---------- defaults and seeds ---------- */
export const DEFAULT_PROFILE: Profile = {
  displayName: 'Adrian',
  handle: 'adrian',
  bio: 'Building kestrel, an agent that trades and forecasts. Mostly Solana, sometimes poker.',
  x: '',
  wallet: 'AdRn5fK2mQx8Wb3TzLp9VhYc4NjE7sGu1oRkDqHeMaZt', // 44 chars, base58; fnv1a % 6 = 1 -> 'ember'
  joinedAt: '2026-03-14T16:00:00.000Z', // "Joined Mar 2026"
  pfp: { kind: 'generated' },
};

const pk = (token: string, hex: string) => `var(--color-pk-${token}, ${hex})`;

/** Curated `pk` palettes, order fixed. None mixes a blue stop with a red or pink stop; none uses chart-1 or chart-5. */
export const PFP_PRESETS: readonly { id: PfpPresetId; label: string; stops: readonly [string, string, string] }[] = [
  { id: 'tide', label: 'Tide', stops: [pk('chart-2', '#7ab3f0'), pk('green-400', '#04af52'), pk('blue-200', '#e0e7ff')] },
  { id: 'ember', label: 'Ember', stops: [pk('chart-3', '#f5b70a'), pk('chart-4', '#e0632a'), pk('red-100', '#ffcfc6')] },
  { id: 'meadow', label: 'Meadow', stops: [pk('green-400', '#04af52'), pk('chart-3', '#f5b70a'), pk('gray-100', '#f4f5f7')] },
  { id: 'sky', label: 'Sky', stops: [pk('chart-2', '#7ab3f0'), pk('brand-500', '#2e5cff'), pk('blue-100', '#f0f3ff')] },
  { id: 'coral', label: 'Coral', stops: [pk('red-200', '#ffa597'), pk('chart-3', '#f5b70a'), pk('gray-100', '#f4f5f7')] },
  { id: 'slate', label: 'Slate', stops: [pk('gray-500', '#abb2bb'), pk('chart-2', '#7ab3f0'), pk('gray-100', '#f4f5f7')] },
];

const SEED_AGENT_NAME = 'kestrel';

/** The seeded form entries (agent `true`, agentName `kestrel`). Ranks are computed live against BOARD_BOUNTIES. */
export const SEED_ENTRY_DEFS: readonly SeedEntryDef[] = [
  {
    id: 'AF-7Q2K9D', bountySlug: 'solana-tx-landing-latency', offsetMs: 30 * HOUR, status: 'passed', score: 1.04,
    title: 'Leader-aware bundle routing with slot-ahead retries', link: 'github.com/adrian/kestrel-landing',
  },
  {
    id: 'AF-2BPC7W', bountySlug: 'sol-perps-sharpe-14d', offsetMs: 96 * HOUR, status: 'passed', score: 2.21,
    title: 'Funding-skew momentum, first cut', link: 'agent.fun/runs/7c1e04b9a2',
  },
  {
    id: 'AF-M4X8TB', bountySlug: 'sol-perps-sharpe-14d', offsetMs: 52 * HOUR, status: 'passed', score: 2.64,
    title: 'Funding-skew momentum with volatility-scaled sizing', link: 'agent.fun/runs/e93a5d10f4',
  },
  {
    id: 'AF-3HWN6P', bountySlug: 'prediction-market-log-loss', offsetMs: 76 * HOUR, status: 'passed', score: 0.538,
    title: 'Base-rate ensemble with news-retrieval updates', link: 'github.com/adrian/kestrel-forecast',
  },
  {
    id: 'AF-K9ZR2E', bountySlug: 'fuzzing-agent-48h-bug-count', offsetMs: 18 * MINUTE, status: 'verifying', selfScore: 36,
    title: 'Grammar-aware fuzzing with a crash-triage agent', link: 'github.com/adrian/kestrel-fuzz',
  },
];

/** Finished bounties (none match a board title; none use a meme). */
export const PAST_RESULT_DEFS: readonly PastResultDef[] = [
  {
    id: 'jupiter-launch-fill', title: 'Fastest median quote-to-fill on 500 Jupiter swaps during a token launch', category: 'Trading',
    metric: { name: 'Median quote-to-fill', unit: 'ms', better: 'lower' }, dp: 0, score: 182, firstScore: 182,
    finalRank: 1, fieldSize: 64, rewardAmount: 10_000, payout: 6_000, endedDaysAgo: 19,
  },
  {
    id: 'macro-release-brier', title: 'Best Brier score calling 40 US macro data releases', category: 'Forecasting',
    metric: { name: 'Brier score', unit: 'Brier', better: 'lower' }, dp: 3, score: 0.142, firstScore: 0.131,
    finalRank: 2, fieldSize: 118, rewardAmount: 6_000, payout: 2_000, endedDaysAgo: 41,
  },
  {
    id: 'ts-errors-under-budget', title: 'Most TypeScript errors fixed in a 400k-line monorepo at under $1 each', category: 'Automation',
    metric: { name: 'Errors fixed', unit: '%', better: 'higher' }, dp: 1, score: 61.4, firstScore: 68.9,
    finalRank: 3, fieldSize: 87, rewardAmount: 5_000, payout: 1_000, endedDaysAgo: 63,
  },
  {
    id: 'drainer-detector-bypass', title: 'Highest bypass rate against a wallet-drainer transaction detector', category: 'Security',
    metric: { name: 'Bypass rate', unit: '%', better: 'higher' }, dp: 1, score: 12.5, firstScore: 31.8,
    finalRank: 11, fieldSize: 52, rewardAmount: 8_000, payout: 0, endedDaysAgo: 88,
  },
  {
    id: 'connect-four-elo', title: 'Highest Elo in a 2,000-game Connect Four self-play ladder', category: 'Games',
    metric: { name: 'Elo', unit: 'Elo', better: 'higher' }, dp: 0, score: 1688, firstScore: 1688,
    finalRank: 1, fieldSize: 29, rewardAmount: 4_000, payout: 2_500, endedDaysAgo: 124,
  },
  {
    id: 'cold-email-replies', title: 'Most positive replies per 1,000 cold emails to seed-stage founders', category: 'Growth',
    metric: { name: 'Positive replies', unit: 'replies', better: 'higher' }, dp: 1, score: 18.0, firstScore: 41.2,
    finalRank: 24, fieldSize: 41, rewardAmount: 3_000, payout: 0, endedDaysAgo: 171,
  },
];

const iso = (t: number) => new Date(t).toISOString();

/** Seed entries materialised relative to `loadedAt` (submittedAt = loadedAt - offset; verifiedAt = +47 min for passed). */
export function seedEntries(loadedAt: number = PROFILE_LOAD): Entry[] {
  return SEED_ENTRY_DEFS.map((d) => {
    const submitted = loadedAt - d.offsetMs;
    const passed = d.status === 'passed';
    return {
      id: d.id,
      bountySlug: d.bountySlug,
      submittedAt: iso(submitted),
      selfScore: passed ? d.score : d.selfScore,
      agent: true,
      agentName: SEED_AGENT_NAME,
      title: d.title,
      link: d.link,
      status: d.status,
      score: passed ? d.score : undefined,
      verifiedAt: passed ? iso(submitted + SEED_VERIFIED_AFTER_MS) : undefined,
      seed: true,
    };
  }).sort(byOldest);
}

/** Past results materialised relative to `loadedAt` (endedAt = loadedAt - endedDaysAgo days). */
export function pastResults(loadedAt: number = PROFILE_LOAD): PastResult[] {
  return PAST_RESULT_DEFS.map(({ endedDaysAgo, ...d }) => ({ ...d, metric: { ...d.metric }, endedAt: iso(loadedAt - endedDaysAgo * DAY) }));
}

/* ---------- storage ---------- */
type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KeyValueStore | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined; // storage disabled (privacy mode, sandboxed frame)
  }
}

function readRaw(key: string, storage: KeyValueStore | undefined): string {
  if (!storage) return '';
  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
}

function parseJson(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PRESET_IDS = new Set<string>(PFP_PRESETS.map((p) => p.id));
const validDate = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

function parsePfp(v: unknown): Pfp | undefined {
  if (!isObject(v)) return undefined;
  if (v.kind === 'generated') return { kind: 'generated' };
  if (v.kind === 'preset' && typeof v.id === 'string' && PRESET_IDS.has(v.id)) return { kind: 'preset', id: v.id as PfpPresetId };
  if (v.kind === 'image' && typeof v.dataUrl === 'string' && v.dataUrl.startsWith('data:image/')) return { kind: 'image', dataUrl: v.dataUrl };
  return undefined;
}

/** A raw stored string to a Profile: each field validated on its own, falling back to DEFAULT_PROFILE's. */
function parseProfile(raw: string): Profile {
  const v = parseJson(raw);
  if (!isObject(v)) return DEFAULT_PROFILE;
  const d = DEFAULT_PROFILE;
  const name = typeof v.displayName === 'string' ? v.displayName.trim() : '';
  return {
    displayName: name && name.length <= DISPLAY_NAME_MAX ? name : d.displayName,
    handle: typeof v.handle === 'string' && HANDLE_RE.test(v.handle) ? v.handle : d.handle,
    bio: typeof v.bio === 'string' && v.bio.length <= BIO_MAX ? v.bio : d.bio,
    x: typeof v.x === 'string' && (v.x === '' || X_RE.test(v.x)) ? v.x : d.x,
    wallet: typeof v.wallet === 'string' && BASE58_RE.test(v.wallet) ? v.wallet : d.wallet,
    joinedAt: validDate(v.joinedAt) ? v.joinedAt : d.joinedAt,
    pfp: parsePfp(v.pfp) ?? d.pfp,
  };
}

/** Stored profile merged over DEFAULT_PROFILE field by field; an invalid or missing field takes the default; corrupt JSON -> DEFAULT_PROFILE. */
export function readProfile(storage: KeyValueStore | undefined = defaultStorage()): Profile {
  return parseProfile(readRaw(PROFILE_KEY, storage));
}

/** Validates nothing (call validateProfile first); writes JSON, dispatches PROFILE_CHANGE_EVENT; false if setItem throws (quota). */
export function writeProfile(next: Profile, storage: KeyValueStore | undefined = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  notify();
  return true;
}

const byOldest = (a: { submittedAt: string }, b: { submittedAt: string }) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt);

function parseStoredEntry(v: unknown): StoredEntry | undefined {
  if (!isObject(v)) return undefined;
  if (typeof v.id !== 'string' || !v.id || typeof v.bountySlug !== 'string' || !v.bountySlug || !validDate(v.submittedAt)) return undefined;
  const str = (x: unknown) => (typeof x === 'string' && x ? x : undefined);
  const e: StoredEntry = { id: v.id, bountySlug: v.bountySlug, submittedAt: v.submittedAt, agent: v.agent === true };
  if (typeof v.selfScore === 'number' && Number.isFinite(v.selfScore)) e.selfScore = v.selfScore;
  const agentName = str(v.agentName);
  const title = str(v.title);
  const link = str(v.link);
  if (agentName) e.agentName = agentName;
  if (title) e.title = title;
  if (link) e.link = link;
  return e;
}

function parseStoredEntries(raw: string): StoredEntry[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  const out: StoredEntry[] = [];
  for (const item of v) {
    const e = parseStoredEntry(item);
    if (e) out.push(e);
  }
  return out.sort(byOldest);
}

/** Stored form entries, oldest first; malformed items (no id/slug/valid date) are skipped; corrupt JSON -> []. */
export function readStoredEntries(storage: KeyValueStore | undefined = defaultStorage()): StoredEntry[] {
  return parseStoredEntries(readRaw(ENTRIES_KEY, storage));
}

/** Upserts by id (same receipt id replaces), keeps the newest MAX_STORED_ENTRIES, writes, dispatches; false on quota. */
export function recordEntry(entry: StoredEntry, storage: KeyValueStore | undefined = defaultStorage()): boolean {
  if (!storage) return false;
  const list = parseStoredEntries(readRaw(ENTRIES_KEY, storage)).filter((e) => e.id !== entry.id);
  list.push(entry);
  list.sort(byOldest);
  const kept = list.slice(-MAX_STORED_ENTRIES);
  try {
    storage.setItem(ENTRIES_KEY, JSON.stringify(kept));
  } catch {
    return false;
  }
  notify();
  return true;
}

/* ---------- status timeline and merge ---------- */
/** Effective status of a stored entry at `now`: pending < 60 s, verifying < 5 min, then passed with score = selfScore (or verifying forever without one). */
export function resolveEntry(e: StoredEntry, now: number): Entry {
  const submitted = Date.parse(e.submittedAt);
  const age = now - submitted;
  if (age < VERIFY_PENDING_MS) return { ...e, status: 'pending', seed: false };
  if (age < VERIFY_DONE_MS || e.selfScore === undefined || !Number.isFinite(e.selfScore)) return { ...e, status: 'verifying', seed: false };
  return { ...e, status: 'passed', score: e.selfScore, verifiedAt: iso(submitted + VERIFY_DONE_MS), seed: false };
}

/** Seeds plus resolved stored entries, oldest first. */
export function allEntries(stored: StoredEntry[], now: number, loadedAt: number = PROFILE_LOAD): Entry[] {
  return [...seedEntries(loadedAt), ...stored.map((e) => resolveEntry(e, now))].sort(byOldest);
}

/** A Submission built from one of your entries; `selfScore` rides along so rankOf can project an inflight entry. */
type MineSubmission = Submission & { selfScore?: number };

/** One bounty's entries as `Submission`s for the leaderboard and the live feed: hunter = handle, id = receipt id, status/score effective. Oldest first. */
export function toSubmissions(entries: Entry[], slug: string, handle: string): Submission[] {
  return entries
    .filter((e) => e.bountySlug === slug)
    .sort(byOldest)
    .map((e): MineSubmission => {
      const s: MineSubmission = { hunter: handle, createdAt: e.submittedAt, id: e.id, status: e.status, agent: e.agent };
      if (e.title) s.title = e.title;
      if (e.link) s.link = e.link;
      if (e.status === 'passed' && e.score !== undefined) s.score = e.score;
      if (e.selfScore !== undefined) s.selfScore = e.selfScore;
      return s;
    });
}

/* ---------- the standings engine (the only ranking code in the app) ---------- */
const isScored = (s: Submission): s is Submission & { score: number } =>
  s.status === 'passed' && typeof s.score === 'number' && Number.isFinite(s.score);

/** Every hunter's best passed+scored submission over bounty.submissions plus `extra`, sorted by metric.better, ties by earlier createdAt; rank = index + 1. */
export function leaderboard(bounty: BoardBounty, extra: Submission[] = []): LeaderRow[] {
  const sign = bounty.resolution.metric?.better === 'lower' ? 1 : -1; // ascending for lower, descending for higher
  const cmp = (a: { score: number; at: number }, b: { score: number; at: number }) => sign * (a.score - b.score) || a.at - b.at;
  const best = new Map<string, { hunter: string; score: number; at: number }>();
  for (const s of [...bounty.submissions, ...extra]) {
    if (!isScored(s)) continue;
    const row = { hunter: s.hunter, score: s.score, at: Date.parse(s.createdAt) };
    const cur = best.get(s.hunter);
    if (!cur || cmp(row, cur) < 0) best.set(s.hunter, row);
  }
  return [...best.values()].sort(cmp).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Rounds away float noise (1.12 - 1.04 = 0.0800000000000001). */
const clean = (x: number) => Number(Math.abs(x).toFixed(9));

/** `handle`'s standing on `bounty`, with `extra` (normally toSubmissions(..., handle)) merged in. Ranked beats inflight; projectedRank ranks selfScore as if passed at its submittedAt. */
export function rankOf(bounty: BoardBounty, handle: string, extra: Submission[] = []): Standing {
  const mine = [...bounty.submissions, ...extra].filter((s) => s.hunter === handle) as MineSubmission[];
  if (!mine.length) return { kind: 'none' };
  const entries = mine.length;
  const rows = leaderboard(bounty, extra);
  const me = rows.find((r) => r.hunter === handle);
  if (me) {
    const leader = rows[0];
    const runnerUp = rows[1];
    const gap = me.rank > 1 ? clean(me.score - leader.score) : runnerUp ? clean(me.score - runnerUp.score) : 0;
    return { kind: 'ranked', rank: me.rank, of: rows.length, score: me.score, leader, runnerUp, gap, prize: prizeFor(bounty, me.rank), entries };
  }
  const inflight = mine.filter((s) => s.status === 'pending' || s.status === 'verifying');
  if (!inflight.length) return { kind: 'unranked', entries };
  // The inflight entry that would place best; without any self-reported score, the newest one.
  const lowerWins = bounty.resolution.metric?.better === 'lower';
  const withScore = inflight.filter((s) => typeof s.selfScore === 'number' && Number.isFinite(s.selfScore));
  const pickBest = (a: MineSubmission, b: MineSubmission) => (lowerWins ? a.selfScore! < b.selfScore! : a.selfScore! > b.selfScore!) ? a : b;
  const chosen = withScore.length ? withScore.reduce(pickBest) : inflight[inflight.length - 1];
  const status = chosen.status === 'verifying' ? 'verifying' : 'pending';
  const of = rows.length + 1;
  if (chosen.selfScore === undefined) return { kind: 'inflight', status, of, entries };
  const projected = leaderboard(bounty, [...extra, { hunter: handle, createdAt: chosen.createdAt, status: 'passed', score: chosen.selfScore }]);
  const projectedRank = projected.find((r) => r.hunter === handle)?.rank;
  return { kind: 'inflight', status, selfScore: chosen.selfScore, projectedRank, of, entries };
}

/** USD the rank pays now: bounty.rewards[String(rank)] ?? 0. */
export function prizeFor(bounty: BoardBounty, rank: number): number {
  return bounty.rewards?.[String(rank)] ?? 0;
}

/** The shared strings every surface prints for a standing. */
export function standingCopy(s: Standing, bounty: BoardBounty): StandingCopy {
  const metric = bounty.resolution.metric ?? { unit: '' };
  const fmt = (x: number) => formatScore(x, metric, scoreDecimals(bounty));
  switch (s.kind) {
    case 'ranked':
      if (s.rank === 1) return { rank: `#1 of ${s.of}`, detail: s.runnerUp ? `Ahead by ${fmt(s.gap)}` : 'Only scored entry', pill: 'Leading' };
      return { rank: `#${s.rank} of ${s.of}`, detail: `${fmt(s.gap)} behind #1` };
    case 'inflight': {
      const label = s.status === 'verifying' ? 'Verifying' : 'Pending';
      const detail = s.selfScore !== undefined && s.projectedRank !== undefined ? `Would place #${s.projectedRank} of ${s.of}` : 'Awaiting score';
      return { rank: label, detail, pill: label };
    }
    case 'unranked':
      return { rank: 'Not ranked', detail: 'Below the minimum bar' };
    case 'none':
      return { rank: '', detail: '' };
  }
}

/* ---------- formatting ---------- */
function fractionDigits(x: number): number {
  for (let d = 0; d < 3; d++) if (Math.abs(Math.round(x * 10 ** d) - x * 10 ** d) < 1e-6) return d;
  return 3;
}

/** Max fraction digits among the bounty's scores, capped at 3 (sol-perps 2, log-loss 3, fuzzing 0). */
export function scoreDecimals(bounty: BoardBounty): number {
  let dp = 0;
  for (const s of bounty.submissions) if (typeof s.score === 'number' && Number.isFinite(s.score)) dp = Math.max(dp, fractionDigits(s.score));
  return dp;
}

const numberFormats = new Map<number, Intl.NumberFormat>();
function grouped(value: number, dp: number): string {
  let f = numberFormats.get(dp);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    numberFormats.set(dp, f);
  }
  return f.format(value);
}

/** "2.64 Sharpe", "0.538 nats", "61.4%", "1.18°C", "$0.018" (USD), "18,420 USDC", "1,688 Elo": en-US grouping, fixed dp; '%' and '°C' attach, 'USD' prefixes '$'. */
export function formatScore(value: number, metric: { unit: string }, dp: number): string {
  const unit = metric.unit;
  if (unit === 'USD') return `${value < 0 ? '-' : ''}$${grouped(Math.abs(value), dp)}`;
  const n = grouped(value, dp);
  if (!unit) return n;
  if (unit === '%' || unit === '°C') return `${n}${unit}`;
  return `${n} ${unit}`;
}

/** "9d 4h", "5h 12m", "12m", "Ended": compact time left for the Ends in column. */
export function formatTimeLeft(ms: number): string {
  if (!(ms > 0)) return 'Ended';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m` : '<1m';
}

/** "1st", "2nd", "3rd", "11th", "24th". */
export function ordinal(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/* ---------- stats, earnings, activity ---------- */
/** The identity card's numbers, from entries on boards that still list them plus past results. */
export function profileStats(entries: Entry[], past: PastResult[], handle: string, bounties: BoardBounty[] = BOARD_BOUNTIES): ProfileStats {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  const activeSlugs = [...new Set(entries.map((e) => e.bountySlug))].filter((slug) => bySlug.has(slug));
  let prizesOnTrack = 0;
  for (const slug of activeSlugs) {
    const bounty = bySlug.get(slug)!;
    const s = rankOf(bounty, handle, toSubmissions(entries, slug, handle));
    if (s.kind === 'ranked') prizesOnTrack += s.prize;
  }
  let bestFinish: ProfileStats['bestFinish'] = null;
  for (const p of past) {
    if (!bestFinish || p.finalRank < bestFinish.rank || (p.finalRank === bestFinish.rank && p.fieldSize > bestFinish.of)) {
      bestFinish = { rank: p.finalRank, of: p.fieldSize };
    }
  }
  return {
    prizesOnTrack,
    biggestWin: past.reduce((m, p) => Math.max(m, p.payout), 0),
    entered: activeSlugs.length + past.length,
    totalEarned: past.reduce((sum, p) => sum + p.payout, 0),
    bestFinish,
    podiums: past.filter((p) => p.finalRank <= 3).length,
    wins: past.filter((p) => p.finalRank === 1).length,
    activeCount: activeSlugs.length,
    endedCount: past.length,
  };
}

const paidAt = (p: PastResult) => Date.parse(p.endedAt) + PAID_AFTER_DAYS * DAY;

const RANGE_LABEL: Record<EarningsRange, EarningsSeries['label']> = { '1M': 'Past month', '3M': 'Past 3 months', ALL: 'All time' };

/** Cumulative payouts (paid at endedAt + 3 d) inside the range: 1M = 30 d, 3M = 90 d, ALL = since joinedAt. Points start with (start, cum before start), end with (now, final). */
export function earningsSeries(past: PastResult[], range: EarningsRange, now: number, joinedAt: string): EarningsSeries {
  const payouts = past
    .filter((p) => p.payout > 0)
    .map((p) => ({ t: paidAt(p), amount: p.payout }))
    .filter((p) => p.t <= now)
    .sort((a, b) => a.t - b.t);
  let start: number;
  if (range === '1M') start = now - 30 * DAY;
  else if (range === '3M') start = now - 90 * DAY;
  else {
    const joined = Date.parse(joinedAt);
    // All time never hides a payout, even one dated before the profile's join date.
    start = Math.min(Number.isFinite(joined) ? joined : now, payouts[0]?.t ?? now);
  }
  let cum = 0;
  for (const p of payouts) if (p.t < start) cum += p.amount;
  const before = cum;
  const points = [{ t: start, cum }];
  for (const p of payouts) {
    if (p.t < start) continue;
    cum += p.amount;
    points.push({ t: p.t, cum });
  }
  points.push({ t: now, cum });
  return { total: cum - before, label: RANGE_LABEL[range], start, end: now, points };
}

/** submitted (each entry, value = receipt id), scored (passed, value = formatted score), finished (each past, value "#k of N"), paid (payout > 0, value "+$6,000", positive). Newest first. */
export function activity(entries: Entry[], past: PastResult[], bounties: BoardBounty[] = BOARD_BOUNTIES): ActivityItem[] {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  const items: ActivityItem[] = [];
  for (const e of entries) {
    const bounty = bySlug.get(e.bountySlug);
    const title = bounty?.title ?? e.title ?? e.bountySlug;
    const slug = bounty ? e.bountySlug : undefined;
    items.push({ id: `submitted:${e.id}`, kind: 'submitted', title, slug, at: e.submittedAt, value: e.id });
    if (e.status === 'passed' && e.score !== undefined) {
      const value = bounty?.resolution.metric ? formatScore(e.score, bounty.resolution.metric, scoreDecimals(bounty)) : String(e.score);
      const at = e.verifiedAt ?? e.submittedAt;
      items.push({ id: `scored:${e.id}`, kind: 'scored', title, slug, at, value });
    }
  }
  const now = Date.now();
  for (const p of past) {
    items.push({ id: `finished:${p.id}`, kind: 'finished', title: p.title, at: p.endedAt, value: `#${p.finalRank} of ${p.fieldSize}` });
    const paid = paidAt(p);
    if (p.payout > 0 && paid <= now) {
      items.push({ id: `paid:${p.id}`, kind: 'paid', title: p.title, at: iso(paid), value: `+${formatBountyAmount(p.payout)}`, positive: true });
    }
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/* ---------- validation and identity ---------- */
export type ProfileErrors = Partial<Record<'displayName' | 'handle' | 'bio' | 'x' | 'pfp', string>>;

/** Every field's problem, or {}. `currentHandle` is never "taken". */
export function validateProfile(draft: Profile, currentHandle?: string): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = draft.displayName.trim();
  if (!name) errors.displayName = 'Enter a display name.';
  else if (name.length > DISPLAY_NAME_MAX) errors.displayName = `At most ${DISPLAY_NAME_MAX} characters.`;
  if (!HANDLE_RE.test(draft.handle)) errors.handle = 'Use 3 to 20 lowercase letters, numbers or underscores.';
  else if (draft.handle !== currentHandle && isHandleTaken(draft.handle)) errors.handle = 'That handle is taken.';
  if (draft.bio.length > BIO_MAX) errors.bio = `At most ${BIO_MAX} characters (${draft.bio.length} now).`;
  if (draft.x !== '' && !X_RE.test(draft.x)) errors.x = 'X handles are 1 to 15 letters, numbers or underscores.';
  if (!parsePfp(draft.pfp)) errors.pfp = 'Could not read that image.';
  return errors;
}

let takenHandles: Set<string> | undefined;
function takenSet(): Set<string> {
  if (takenHandles) return takenHandles;
  const set = new Set<string>();
  const add = (h: string | undefined) => h && set.add(h.toLowerCase());
  for (const h of HUNTER_POOL) add(h);
  for (const h of AGENT_POOL) add(h);
  for (const b of BOARD_BOUNTIES) {
    add(b.sponsor.slug);
    for (const s of b.submissions) add(s.hunter);
    for (const m of b.chat) add(m.author);
  }
  takenHandles = set;
  return set;
}

/** True if any board hunter, chat author, sponsor slug, HUNTER_POOL or AGENT_POOL name equals it (lowercased). */
export function isHandleTaken(handle: string): boolean {
  return takenSet().has(handle.trim().toLowerCase());
}

/* ---------- pfp ---------- */
/** 10..90 from one byte of the hash. */
const pos = (h: number, byte: number) => 10 + (((h >>> (byte * 8)) & 0xff) % 81);

function gradientFor(stops: readonly [string, string, string], h: number): string {
  const [s0, s1, s2] = stops;
  return (
    `radial-gradient(circle at ${pos(h, 0)}% ${pos(h, 1)}%, ${s0} 0%, transparent 62%), ` +
    `radial-gradient(circle at ${pos(h, 2)}% ${pos(h, 3)}%, ${s1} 0%, transparent 58%), ${s2}`
  );
}

/** A CSS `background` shorthand value (its last layer is a plain colour, which `background-image` rejects) for a generated or preset pfp; null for an image pfp.Generated = PFP_PRESETS[fnv1a(wallet) % 6] with radial positions from the hash; preset = fixed positions from fnv1a(id). */
export function pfpGradient(pfp: Pfp, wallet: string): string | null {
  if (pfp.kind === 'image') return null;
  if (pfp.kind === 'preset') {
    const preset = PFP_PRESETS.find((p) => p.id === pfp.id) ?? PFP_PRESETS[0];
    return gradientFor(preset.stops, fnv1a(preset.id));
  }
  const h = fnv1a(wallet);
  return gradientFor(PFP_PRESETS[h % PFP_PRESETS.length].stops, h);
}

/** Centre-crop square of a w x h image: { sx, sy, size }. */
export function coverCrop(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}

const PFP_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Browser only: validates type (png/jpeg/webp/gif) and <= 5 MB, decodes (createImageBitmap, falling back to Image), cover-crops to 256x256, returns a WebP data URL at 0.85 quality (JPEG 0.88 if the browser cannot encode WebP). Rejects with Error(message) using the shared copy. */
export async function downscalePfp(file: File): Promise<string> {
  if (!PFP_TYPES.has(file.type)) throw new Error('That file is not an image.');
  if (file.size > PFP_MAX_BYTES) throw new Error('Images up to 5 MB.');
  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error('Could not read that image.');
  }
  try {
    if (!decoded.width || !decoded.height) throw new Error('empty');
    const canvas = document.createElement('canvas');
    canvas.width = PFP_SIZE;
    canvas.height = PFP_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no context');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const { sx, sy, size } = coverCrop(decoded.width, decoded.height);
    ctx.drawImage(decoded.source, sx, sy, size, size, 0, 0, PFP_SIZE, PFP_SIZE);
    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    throw new Error('Could not read that image.');
  } finally {
    decoded.close?.();
  }
}

/* ---------- hooks ---------- */
const subscribe = (onChange: () => void) => {
  window.addEventListener(PROFILE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PROFILE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};
const profileSnapshot = () => readRaw(PROFILE_KEY, defaultStorage());
const entriesSnapshot = () => readRaw(ENTRIES_KEY, defaultStorage());
const serverSnapshot = () => '';

/** The profile, live across this tab and others. */
export function useProfile(): Profile {
  const raw = useSyncExternalStore(subscribe, profileSnapshot, serverSnapshot);
  return useMemo(() => parseProfile(raw), [raw]);
}

/** A clock that re-renders every `ms` (default 15 s). */
export function useNow(ms: number = NOW_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Seeds plus stored entries, resolved at the current tick, oldest first; array identity changes only when the raw string or a tick changes. */
export function useEntries(): Entry[] {
  const raw = useSyncExternalStore(subscribe, entriesSnapshot, serverSnapshot);
  const now = useNow();
  return useMemo(() => allEntries(parseStoredEntries(raw), now), [raw, now]);
}

/** This bounty's entries as Submissions under the current handle, oldest first: what BountyPage passes as `injected`. */
export function useMyEntries(slug: string): Submission[] {
  const { handle } = useProfile();
  const entries = useEntries();
  return useMemo(() => toSubmissions(entries, slug, handle), [entries, slug, handle]);
}

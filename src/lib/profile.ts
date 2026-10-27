import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { formatBountyAmount, type BoardBounty, type Submission, type SubmissionStatus } from './bounty';
import { AGENT_POOL, BOARD_BOUNTIES, HUNTER_POOL, isAgentHandle } from './bountyData';
import { WON_BOUNTIES, WON_DEFS, WON_LOAD, wonEntryAt } from './wonBounties';

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
/** Verifying until +5 min, then passed: score = selfScore, or the verifier's score (verifierScore) when the Result field was left blank. */
export const VERIFY_DONE_MS = 300_000;
/** Seed passed entries were scored 47 min after submission. */
export const SEED_VERIFIED_AFTER_MS = 47 * 60_000;
/** Past payouts land 3 days after the end. */
export const PAID_AFTER_DAYS = 3;
export const PFP_SIZE = 256;
export const PFP_MAX_BYTES = 5 * 1024 * 1024;
export const NOW_TICK_MS = 15_000;
/** Module-load instant, shared with the board and the won bounties (WON_LOAD): seeds and past results are placed relative to it, so a past result's endedAt is its won bounty's deadline. */
export const PROFILE_LOAD = WON_LOAD;

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
  /** Set on a board bounty that ended with your entries on it (endedBoardResults): the bounty page it links to. */
  slug?: string;
  /** True when none of your entries was scored by the deadline: no final rank, no payout. */
  unscored?: boolean;
}

/** A board bounty whose deadline passed, as a past result. */
export type EndedBoardResult = PastResult & { slug: string };

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
  /** Distinct active slugs (board bounties still open) + ended results. */
  entered: number;
  /** Sum of payouts over ended results (seeded past results and ended board bounties). */
  totalEarned: number;
  /** Lowest finalRank over scored ended results; ties go to the larger field. */
  bestFinish: { rank: number; of: number } | null;
  /** Scored ended results with finalRank <= 3. */
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

/**
 * Finished bounties you entered: the won bounties with a `you` row (wonBounties.ts holds the numbers), most recent
 * first. id and slug are the won bounty's slug; payout = rewards[your rank] (0 when unplaced).
 */
export const PAST_RESULT_DEFS: readonly PastResultDef[] = WON_DEFS.filter((d) => d.you)
  .map((d): PastResultDef => {
    const you = d.you!;
    return {
      id: d.slug, slug: d.slug, title: d.title, category: d.category, metric: { ...d.metric }, dp: d.dp,
      score: you.score, firstScore: d.winningScore, finalRank: you.rank, fieldSize: d.fieldSize, rewardAmount: d.rewardAmount,
      payout: d.rewards[String(you.rank) as '1' | '2' | '3'] ?? 0, endedDaysAgo: d.endedDaysAgo,
    };
  })
  .sort((a, b) => a.endedDaysAgo - b.endedDaysAgo);

const WON_SLUGS = new Set(WON_DEFS.map((d) => d.slug));

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

/** Past results materialised relative to `loadedAt` (endedAt = loadedAt - endedDaysAgo days: at PROFILE_LOAD, the won bounty's deadline). Each carries its won bounty's slug. */
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
/**
 * Effective status of a stored entry at `now`: pending < 60 s, verifying < 5 min, then passed. The score is the
 * self-reported one; with none, the verifier scores it (verifierScore against `bounty`). Without a bounty, or on a
 * bounty with no scored field to place it in, a blank-score entry stays verifying.
 */
export function resolveEntry(e: StoredEntry, now: number, bounty?: BoardBounty): Entry {
  const submitted = Date.parse(e.submittedAt);
  const age = now - submitted;
  if (age < VERIFY_PENDING_MS) return { ...e, status: 'pending', seed: false };
  if (age < VERIFY_DONE_MS) return { ...e, status: 'verifying', seed: false };
  const score = e.selfScore !== undefined && Number.isFinite(e.selfScore) ? e.selfScore : bounty ? verifierScore(e.id, bounty) : undefined;
  if (score === undefined) return { ...e, status: 'verifying', seed: false };
  return { ...e, status: 'passed', score, verifiedAt: iso(submitted + VERIFY_DONE_MS), seed: false };
}

/** Seeds plus resolved stored entries (each against its board bounty, looked up by slug), oldest first. */
export function allEntries(stored: StoredEntry[], now: number, loadedAt: number = PROFILE_LOAD, bounties: BoardBounty[] = BOARD_BOUNTIES): Entry[] {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  return [...seedEntries(loadedAt), ...stored.map((e) => resolveEntry(e, now, bySlug.get(e.bountySlug)))].sort(byOldest);
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

/**
 * Your final entry on a won bounty you entered (WON_DEFS.you), under `handle`: passed with your score, placed at a
 * fixed instant inside the open window (62% of the way from publishedAt to the deadline). Undefined for any other slug.
 */
export function wonEntryFor(slug: string, handle: string): Submission | undefined {
  const def = WON_DEFS.find((d) => d.slug === slug);
  const bounty = WON_BOUNTIES.find((b) => b.slug === slug);
  if (!def?.you || !bounty) return undefined;
  return { hunter: handle, status: 'passed', score: def.you.score, createdAt: wonEntryAt(bounty), id: `past-${slug}`, agent: true };
}

/** toSubmissions(entries, slug, handle), plus your final entry when `slug` is a won bounty you entered. */
export function myEntriesFor(entries: Entry[], slug: string, handle: string): Submission[] {
  const subs = toSubmissions(entries, slug, handle);
  const past = wonEntryFor(slug, handle);
  return past ? [...subs, past] : subs;
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

/** One paid place on a bounty's final (or current) leaderboard. */
export interface Winner {
  place: number;
  hunter: string;
  score: number;
  /** USD: bounty.rewards[place]. */
  payout: number;
  agent: boolean;
  /** hunter === the handle passed in. */
  you: boolean;
}

/**
 * The paid places (the keys of bounty.rewards, in place order) filled from leaderboard(bounty, extra); a place with
 * nobody scored in it is left out. `agent` comes from the hunter's submissions (falling back to the handle's shape).
 */
export function winnersOf(bounty: BoardBounty, extra: Submission[] = [], handle?: string): Winner[] {
  const rows = leaderboard(bounty, extra);
  const rewards = bounty.rewards ?? {};
  const places = Object.keys(rewards).map(Number).filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
  const agentOf = new Map<string, boolean>();
  for (const s of [...bounty.submissions, ...extra]) if (typeof s.agent === 'boolean') agentOf.set(s.hunter, s.agent);
  const out: Winner[] = [];
  for (const place of places) {
    const r = rows[place - 1];
    if (!r) continue;
    out.push({
      place,
      hunter: r.hunter,
      score: r.score,
      payout: rewards[String(place)] ?? 0,
      agent: agentOf.get(r.hunter) ?? isAgentHandle(r.hunter),
      you: handle !== undefined && r.hunter === handle,
    });
  }
  return out;
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

/** The verifier's score for an entry submitted with a blank Result: fnv1a(id) picks a percentile in 30..90 of the bounty's passed scores (oriented so 90 is the better end), linearly interpolated and rounded to scoreDecimals. Undefined when the bounty has no scored field. */
export function verifierScore(id: string, bounty: BoardBounty): number | undefined {
  const scores = bounty.submissions.filter(isScored).map((s) => s.score);
  if (!scores.length) return undefined;
  const lowerWins = bounty.resolution.metric?.better === 'lower';
  scores.sort((a, b) => (lowerWins ? b - a : a - b)); // worst first, best last
  const p = 0.3 + (fnv1a(id) % 6001) / 10_000; // 0.3000..0.9000
  const at = p * (scores.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(scores.length - 1, lo + 1);
  const v = scores[lo] + (scores[hi] - scores[lo]) * (at - lo);
  return Number(v.toFixed(scoreDecimals(bounty)));
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
const FALLBACK_METRIC: PastResult['metric'] = { name: 'Score', unit: '', better: 'higher' };

/** Stands in for your handle where only the ranking matters (activity): '@' keeps it off every board hunter's name. */
const SELF = '@you';

/** True while the board bounty still takes entries at `now`. */
const isOpen = (bounty: BoardBounty, now: number) => Date.parse(bounty.deadline) > now;

/**
 * Your entered board bounties whose deadline has passed at `now`, as past results (id = slug). Final standing is
 * rankOf at the deadline: the field's submissions and your entries made by then (an in-time entry the verifier scores
 * afterwards still counts). fieldSize is that leaderboard's length, payout prizeFor(rank), endedAt the deadline. With
 * no entry of yours scored by the deadline the row is `unscored`: finalRank fieldSize + 1, no payout.
 */
export function endedBoardResults(entries: Entry[], handle: string, now: number, bounties: BoardBounty[] = BOARD_BOUNTIES): EndedBoardResult[] {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  const out: EndedBoardResult[] = [];
  for (const slug of new Set(entries.map((e) => e.bountySlug))) {
    const bounty = bySlug.get(slug);
    // A won bounty is a past result (pastResults), never a board entry: skipping it here keeps it from counting twice.
    if (!bounty || isOpen(bounty, now) || WON_SLUGS.has(slug)) continue;
    const end = Date.parse(bounty.deadline);
    const atEnd: BoardBounty = { ...bounty, submissions: bounty.submissions.filter((s) => Date.parse(s.createdAt) <= end) };
    const mine = toSubmissions(entries.filter((e) => Date.parse(e.submittedAt) <= end), slug, handle);
    const standing = rankOf(atEnd, handle, mine);
    if (standing.kind === 'none') continue; // every entry came after the close
    const base = {
      id: slug,
      slug,
      title: bounty.title,
      category: bounty.category,
      metric: bounty.resolution.metric ? { ...bounty.resolution.metric } : { ...FALLBACK_METRIC },
      dp: scoreDecimals(bounty),
      rewardAmount: bounty.rewardAmount,
      endedAt: iso(end),
    };
    if (standing.kind === 'ranked') {
      out.push({ ...base, score: standing.score, firstScore: standing.leader.score, finalRank: standing.rank, fieldSize: standing.of, payout: prizeFor(bounty, standing.rank) });
    } else {
      const field = leaderboard(atEnd, mine);
      const self = standing.kind === 'inflight' ? standing.selfScore : undefined;
      out.push({ ...base, score: self ?? 0, firstScore: field[0]?.score ?? 0, finalRank: field.length + 1, fieldSize: field.length, payout: 0, unscored: true });
    }
  }
  return out.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}

/** `past` plus `extra`, one row per id (`past` wins): callers may pass rows that already include the ended board results. */
export function mergeEnded(past: PastResult[], extra: PastResult[]): PastResult[] {
  if (!extra.length) return past;
  const ids = new Set(past.map((p) => p.id));
  return [...past, ...extra.filter((p) => !ids.has(p.id))];
}

/**
 * The identity card's numbers: entries on board bounties still open, plus ended results (`past` and your board
 * bounties whose deadline passed by `now`).
 */
export function profileStats(entries: Entry[], past: PastResult[], handle: string, bounties: BoardBounty[] = BOARD_BOUNTIES, now: number = Date.now()): ProfileStats {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  const activeSlugs = [...new Set(entries.map((e) => e.bountySlug))].filter((slug) => {
    const b = bySlug.get(slug);
    return b !== undefined && isOpen(b, now);
  });
  let prizesOnTrack = 0;
  for (const slug of activeSlugs) {
    const bounty = bySlug.get(slug)!;
    const s = rankOf(bounty, handle, toSubmissions(entries, slug, handle));
    if (s.kind === 'ranked') prizesOnTrack += s.prize;
  }
  const ended = mergeEnded(past, endedBoardResults(entries, handle, now, bounties));
  const scored = ended.filter((p) => !p.unscored);
  let bestFinish: ProfileStats['bestFinish'] = null;
  for (const p of scored) {
    if (!bestFinish || p.finalRank < bestFinish.rank || (p.finalRank === bestFinish.rank && p.fieldSize > bestFinish.of)) {
      bestFinish = { rank: p.finalRank, of: p.fieldSize };
    }
  }
  return {
    prizesOnTrack,
    biggestWin: ended.reduce((m, p) => Math.max(m, p.payout), 0),
    entered: activeSlugs.length + ended.length,
    // Paid, not just won: the same 3-day payout delay as the Earnings chart and the Activity "paid" rows, so all three agree.
    totalEarned: ended.reduce((sum, p) => sum + (paidAt(p) <= now ? p.payout : 0), 0),
    bestFinish,
    podiums: scored.filter((p) => p.finalRank <= 3).length,
    wins: scored.filter((p) => p.finalRank === 1).length,
    activeCount: activeSlugs.length,
    endedCount: ended.length,
  };
}

const paidAt = (p: PastResult) => Date.parse(p.endedAt) + PAID_AFTER_DAYS * DAY;

const RANGE_LABEL: Record<EarningsRange, EarningsSeries['label']> = { '1M': 'Past month', '3M': 'Past 3 months', ALL: 'All time' };

/**
 * Cumulative payouts (paid at endedAt + 3 d) inside the range: 1M = 30 d, 3M = 90 d, ALL = since joinedAt. Points start
 * with (start, cum before start), end with (now, final). `ended` adds rows such as endedBoardResults (deduped by id).
 */
export function earningsSeries(past: PastResult[], range: EarningsRange, now: number, joinedAt: string, ended: PastResult[] = []): EarningsSeries {
  const payouts = mergeEnded(past, ended)
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

/**
 * submitted (each entry, value = receipt id), scored (passed, value = formatted score), finished (each ended result,
 * value "#k of N", or "Not ranked"; a board bounty's carries its slug), paid (payout > 0 and landed by `now`, value
 * "+$6,000", positive). Ended results are `past` plus your board bounties whose deadline passed by `now`. Newest first.
 */
export function activity(entries: Entry[], past: PastResult[], bounties: BoardBounty[] = BOARD_BOUNTIES, now: number = Date.now()): ActivityItem[] {
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
  for (const p of mergeEnded(past, endedBoardResults(entries, SELF, now, bounties))) {
    const value = p.unscored ? 'Not ranked' : `#${p.finalRank} of ${p.fieldSize}`;
    items.push({ id: `finished:${p.id}`, kind: 'finished', title: p.title, slug: p.slug, at: p.endedAt, value });
    const paid = paidAt(p);
    if (p.payout > 0 && paid <= now) {
      items.push({ id: `paid:${p.id}`, kind: 'paid', title: p.title, slug: p.slug, at: iso(paid), value: `+${formatBountyAmount(p.payout)}`, positive: true });
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
  for (const b of [...BOARD_BOUNTIES, ...WON_BOUNTIES]) {
    add(b.sponsor.slug);
    for (const s of b.submissions) add(s.hunter);
    for (const m of b.chat) add(m.author);
  }
  takenHandles = set;
  return set;
}

/** True if any board or won-bounty hunter, chat author, sponsor slug, HUNTER_POOL or AGENT_POOL name equals it (lowercased). */
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

/** This bounty's entries as Submissions under the current handle, oldest first: what BountyPage passes as `injected`. On a won bounty you entered, your final entry rides along (myEntriesFor). */
export function useMyEntries(slug: string): Submission[] {
  const { handle } = useProfile();
  const entries = useEntries();
  return useMemo(() => myEntriesFor(entries, slug, handle), [entries, slug, handle]);
}

/** The paid places of `bounty` (with your entries and handle): what the won bounty card and page show. */
export function useWinners(bounty: BoardBounty): Winner[] {
  const { handle } = useProfile();
  const mine = useMyEntries(bounty.slug);
  return useMemo(() => winnersOf(bounty, mine, handle), [bounty, mine, handle]);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// src/ uses bundler-style extensionless imports ("./paths"); let Node resolve them to the .ts file the way Vite does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});

const { BOARD_BOUNTIES } = await import('../src/lib/bountyData.ts');
const P = await import('../src/lib/profile.ts');
const {
  DEFAULT_PROFILE, PFP_PRESETS, SEED_ENTRY_DEFS, PAST_RESULT_DEFS, PROFILE_KEY, ENTRIES_KEY, PROFILE_CHANGE_EVENT,
  readProfile, writeProfile, readStoredEntries, recordEntry, validateProfile, isHandleTaken,
  seedEntries, pastResults, resolveEntry, allEntries, toSubmissions, leaderboard, rankOf, prizeFor, standingCopy,
  scoreDecimals, formatScore, formatTimeLeft, ordinal, profileStats, earningsSeries, activity, pfpGradient, coverCrop,
} = P;

type Bounty = (typeof BOARD_BOUNTIES)[number];
type Sub = Bounty['submissions'][number];
type Profile = typeof DEFAULT_PROFILE;
type StoredEntry = Parameters<typeof recordEntry>[0];

const EM_DASH = '\u2014';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const LOAD = P.PROFILE_LOAD;

/** An in-memory `Storage`; `failWrites` makes setItem throw like a full quota. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  failWrites = false;
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    this.map.set(k, String(v));
  }
}

const bounty = (slug: string): Bounty => {
  const b = BOARD_BOUNTIES.find((x) => x.slug === slug);
  assert.ok(b, `board has ${slug}`);
  return b;
};
const SOLANA = 'solana-tx-landing-latency';
const PERPS = 'sol-perps-sharpe-14d';
const LOGLOSS = 'prediction-market-log-loss';
const FUZZ = 'fuzzing-agent-48h-bug-count';

const seeds = seedEntries(LOAD);
const past = pastResults(LOAD);
const handle = DEFAULT_PROFILE.handle;
const standingOn = (slug: string, extra: Sub[] = []) =>
  rankOf(bounty(slug), handle, [...toSubmissions(seeds, slug, handle), ...extra]);

/** A board bounty with its submissions replaced (for leaderboard edge cases). */
const synthetic = (better: 'higher' | 'lower', submissions: Sub[]): Bounty => {
  const base = bounty(PERPS);
  return { ...base, submissions, resolution: { ...base.resolution, metric: { name: 'Score', unit: 'pts', better } } };
};
const at = (h: number) => new Date(Date.UTC(2026, 9, 1, h)).toISOString();

test('U1.1 DEFAULT_PROFILE is valid, its wallet is 44-char base58, and its generated pfp uses the ember stops', () => {
  assert.deepEqual(validateProfile(DEFAULT_PROFILE), {});
  assert.deepEqual(validateProfile(DEFAULT_PROFILE, DEFAULT_PROFILE.handle), {});
  assert.equal(DEFAULT_PROFILE.wallet.length, 44);
  assert.match(DEFAULT_PROFILE.wallet, /^[1-9A-HJ-NP-Za-km-z]+$/);
  assert.equal(isHandleTaken('adrian'), false);
  const css = pfpGradient({ kind: 'generated' }, DEFAULT_PROFILE.wallet);
  assert.ok(css);
  const ember = PFP_PRESETS.find((p) => p.id === 'ember')!;
  for (const stop of ember.stops) assert.ok(css.includes(stop), `has ${stop}`);
  for (const other of PFP_PRESETS.filter((p) => p.id !== 'ember')) assert.ok(!other.stops.every((s) => css.includes(s)));
  // Three layers, positions in 10..90.
  assert.match(css, /^radial-gradient\(circle at \d+% \d+%, .+ 0%, transparent 62%\), radial-gradient\(circle at \d+% \d+%, .+ 0%, transparent 58%\), var\(/);
  for (const m of css.matchAll(/at (\d+)% (\d+)%/g)) for (const n of [Number(m[1]), Number(m[2])]) assert.ok(n >= 10 && n <= 90);
  // Presets are fixed per id; an image pfp has no gradient.
  assert.equal(pfpGradient({ kind: 'preset', id: 'sky' }, 'x'), pfpGradient({ kind: 'preset', id: 'sky' }, 'y'));
  assert.equal(pfpGradient({ kind: 'image', dataUrl: 'data:image/webp;base64,AA' }, DEFAULT_PROFILE.wallet), null);
});

test('U1.2 readProfile: empty, corrupt, invalid field and valid partial', () => {
  const s = new MemoryStorage();
  assert.deepEqual(readProfile(s), DEFAULT_PROFILE);
  s.setItem(PROFILE_KEY, '{not json');
  assert.deepEqual(readProfile(s), DEFAULT_PROFILE);
  s.setItem(PROFILE_KEY, '[1,2]');
  assert.deepEqual(readProfile(s), DEFAULT_PROFILE);
  s.setItem(PROFILE_KEY, JSON.stringify({ handle: 'BAD' }));
  assert.deepEqual(readProfile(s), DEFAULT_PROFILE);
  s.setItem(PROFILE_KEY, JSON.stringify({ handle: 'kestrel_dev', bio: '', x: 'adrian_k', pfp: { kind: 'preset', id: 'sky' }, displayName: 7 }));
  assert.deepEqual(readProfile(s), { ...DEFAULT_PROFILE, handle: 'kestrel_dev', bio: '', x: 'adrian_k', pfp: { kind: 'preset', id: 'sky' } });
  s.setItem(PROFILE_KEY, JSON.stringify({ pfp: { kind: 'preset', id: 'purple' }, x: 'a-b', bio: 'x'.repeat(161) }));
  assert.deepEqual(readProfile(s), DEFAULT_PROFILE);
});

test('U1.3 writeProfile round-trips, dispatches the change event, and returns false when setItem throws', () => {
  const s = new MemoryStorage();
  const next: Profile = { ...DEFAULT_PROFILE, displayName: 'Adrian K', handle: 'adrian_k', pfp: { kind: 'image', dataUrl: 'data:image/webp;base64,AAAA' } };
  // A stand-in window, only for this test, to observe the same-tab event.
  const g = globalThis as { window?: EventTarget };
  const events: string[] = [];
  g.window = new EventTarget();
  g.window.addEventListener(PROFILE_CHANGE_EVENT, (e) => events.push(e.type));
  try {
    assert.equal(writeProfile(next, s), true);
    assert.deepEqual(readProfile(s), next);
    assert.deepEqual(events, [PROFILE_CHANGE_EVENT]);
    s.failWrites = true;
    assert.equal(writeProfile(DEFAULT_PROFILE, s), false);
    assert.deepEqual(readProfile(s), next);
    assert.equal(events.length, 1);
  } finally {
    delete g.window;
  }
});

test('U1.4 validateProfile gives the exact messages', () => {
  const bad = 'Use 3 to 20 lowercase letters, numbers or underscores.';
  for (const h of ['ab', 'Adrian', 'a'.repeat(21)]) assert.equal(validateProfile({ ...DEFAULT_PROFILE, handle: h }).handle, bad, h);
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, handle: 'devnull' }, 'adrian').handle, 'That handle is taken.');
  assert.deepEqual(validateProfile({ ...DEFAULT_PROFILE, handle: 'adrian' }, 'adrian'), {});
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, displayName: '   ' }).displayName, 'Enter a display name.');
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, displayName: 'x'.repeat(41) }).displayName, 'At most 40 characters.');
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, bio: 'b'.repeat(161) }).bio, 'At most 160 characters (161 now).');
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, x: 'a-b' }).x, 'X handles are 1 to 15 letters, numbers or underscores.');
  assert.equal(validateProfile({ ...DEFAULT_PROFILE, x: 'adrian_k' }).x, undefined);
  // Taken covers every source: pools, board hunters, chat authors, sponsor slugs; case-insensitively.
  assert.equal(isHandleTaken('agent.kite'), true);
  assert.equal(isHandleTaken('OZZY'), true);
  const b = bounty(PERPS);
  assert.equal(isHandleTaken(b.sponsor.slug!), true);
  assert.equal(isHandleTaken(b.chat[0].author), true);
  assert.equal(isHandleTaken(b.submissions.at(-1)!.hunter), true);
});

test('U1.5 seeds against BOARD_BOUNTIES give the specified standings and copy', () => {
  const sol = standingOn(SOLANA);
  assert.equal(sol.kind, 'ranked');
  assert.deepEqual(standingCopy(sol, bounty(SOLANA)), { rank: '#1 of 16', detail: 'Ahead by 0.08 slots', pill: 'Leading' });
  assert.ok(sol.kind === 'ranked' && sol.runnerUp?.hunter === 'agent.ferris' && sol.runnerUp.score === 1.12 && sol.prize === 9000);

  const perps = standingOn(PERPS);
  assert.deepEqual(standingCopy(perps, bounty(PERPS)), { rank: '#3 of 20', detail: '0.77 Sharpe behind #1' });
  assert.ok(perps.kind === 'ranked');
  assert.equal(perps.entries, 2);
  assert.equal(perps.score, 2.64);
  assert.equal(perps.prize, 4000);
  assert.equal(perps.leader.hunter, 'agent.kite');
  assert.equal(perps.gap, 0.77);

  const ll = standingOn(LOGLOSS);
  assert.deepEqual(standingCopy(ll, bounty(LOGLOSS)), { rank: '#8 of 21', detail: '0.126 nats behind #1' });
  assert.ok(ll.kind === 'ranked' && ll.prize === 0);

  const fz = standingOn(FUZZ);
  assert.deepEqual(standingCopy(fz, bounty(FUZZ)), { rank: 'Verifying', detail: 'Would place #2 of 21', pill: 'Verifying' });
  assert.ok(fz.kind === 'inflight' && fz.selfScore === 36 && fz.projectedRank === 2 && fz.of === 21);

  // Every seed offset fits inside its bounty's open window, and the remaining copy rows match the table.
  for (const d of SEED_ENTRY_DEFS) assert.ok(LOAD - d.offsetMs > Date.parse(bounty(d.bountySlug).publishedAt), d.id);
  assert.equal(scoreDecimals(bounty(PERPS)), 2);
  assert.equal(scoreDecimals(bounty(LOGLOSS)), 3);
  assert.equal(scoreDecimals(bounty(FUZZ)), 0);
  const b = bounty(FUZZ);
  assert.deepEqual(standingCopy({ kind: 'inflight', status: 'pending', selfScore: 36, projectedRank: 2, of: 21, entries: 1 }, b), { rank: 'Pending', detail: 'Would place #2 of 21', pill: 'Pending' });
  assert.deepEqual(standingCopy({ kind: 'inflight', status: 'pending', of: 21, entries: 1 }, b), { rank: 'Pending', detail: 'Awaiting score', pill: 'Pending' });
  assert.deepEqual(standingCopy({ kind: 'inflight', status: 'verifying', of: 21, entries: 1 }, b), { rank: 'Verifying', detail: 'Awaiting score', pill: 'Verifying' });
  assert.deepEqual(standingCopy({ kind: 'unranked', entries: 1 }, b), { rank: 'Not ranked', detail: 'Below the minimum bar' });
  assert.deepEqual(standingCopy({ kind: 'none' }, b), { rank: '', detail: '' });
  const alone = rankOf(synthetic('higher', []), 'me', [{ hunter: 'me', createdAt: at(1), status: 'passed', score: 5 }]);
  assert.deepEqual(standingCopy(alone, synthetic('higher', [])), { rank: '#1 of 1', detail: 'Only scored entry', pill: 'Leading' });
  assert.ok(alone.kind === 'ranked' && alone.gap === 0);
  assert.equal(rankOf(synthetic('higher', []), 'me', [{ hunter: 'me', createdAt: at(1), status: 'failed' }]).kind, 'unranked');
  assert.deepEqual(rankOf(bounty(PERPS), 'nobody_here', []), { kind: 'none' });
  assert.equal(prizeFor(bounty(PERPS), 1), 15000);
  assert.equal(prizeFor(bounty(PERPS), 4), 0);
});

test('U1.6 leaderboard: per-hunter best, earlier createdAt wins ties, lower sorts ascending, non-scored rows ignored', () => {
  const subs: Sub[] = [
    { hunter: 'a', createdAt: at(1), status: 'passed', score: 5 },
    { hunter: 'a', createdAt: at(2), status: 'passed', score: 9 },
    { hunter: 'b', createdAt: at(3), status: 'passed', score: 7 },
    { hunter: 'c', createdAt: at(0), status: 'passed', score: 7 },
    { hunter: 'd', createdAt: at(1), status: 'failed', score: 99 },
    { hunter: 'e', createdAt: at(1), status: 'pending', score: 98 },
    { hunter: 'f', createdAt: at(1), status: 'verifying' },
    { hunter: 'g', createdAt: at(1), status: 'passed' },
  ];
  const hi = leaderboard(synthetic('higher', subs));
  assert.deepEqual(hi.map((r) => [r.hunter, r.score, r.rank]), [['a', 9, 1], ['c', 7, 2], ['b', 7, 3]]);
  assert.equal(hi[0].at, Date.parse(at(2)));
  const lo = leaderboard(synthetic('lower', subs));
  assert.deepEqual(lo.map((r) => [r.hunter, r.score, r.rank]), [['a', 5, 1], ['c', 7, 2], ['b', 7, 3]]);
  // Same score twice from one hunter: the earlier submission is the one that counts.
  const dup = leaderboard(synthetic('higher', [{ hunter: 'x', createdAt: at(5), status: 'passed', score: 3 }, { hunter: 'x', createdAt: at(4), status: 'passed', score: 3 }]));
  assert.equal(dup[0].at, Date.parse(at(4)));
  // `extra` merges in.
  assert.equal(leaderboard(synthetic('higher', subs), [{ hunter: 'z', createdAt: at(9), status: 'passed', score: 10 }])[0].hunter, 'z');
});

test('U1.7 stream invariance: 20 pending stream submissions leave every seed standing unchanged', () => {
  for (const slug of [SOLANA, PERPS, LOGLOSS, FUZZ]) {
    const before = standingOn(slug);
    const stream: Sub[] = Array.from({ length: 20 }, (_, i) => ({
      hunter: i % 2 ? `stream_${i}` : bounty(slug).submissions[i % bounty(slug).submissions.length].hunter,
      createdAt: new Date(LOAD - i * MIN).toISOString(),
      status: 'pending',
      agent: true,
    }));
    assert.deepEqual(standingOn(slug, stream), before, slug);
    assert.deepEqual(standingCopy(standingOn(slug, stream), bounty(slug)), standingCopy(before, bounty(slug)));
  }
});

test('U1.8 status timeline: pending, verifying, passed at +5 min; no selfScore stays verifying; seeds are fixed', () => {
  const t0 = Date.parse('2026-10-20T12:00:00.000Z');
  const e: StoredEntry = { id: 'AF-TEST01', bountySlug: 'heads-up-poker-bb100', submittedAt: new Date(t0).toISOString(), selfScore: 3, agent: false };
  assert.equal(resolveEntry(e, t0 + 59_000).status, 'pending');
  assert.equal(resolveEntry(e, t0 + 61_000).status, 'verifying');
  assert.equal(resolveEntry(e, t0 + 299_000).status, 'verifying');
  const done = resolveEntry(e, t0 + 301_000);
  assert.equal(done.status, 'passed');
  assert.equal(done.score, e.selfScore);
  assert.equal(done.verifiedAt, new Date(t0 + 300_000).toISOString());
  assert.equal(done.seed, false);
  assert.equal(resolveEntry(e, t0 + 59_000).score, undefined);
  const noScore = { ...e, selfScore: undefined };
  assert.equal(resolveEntry(noScore, t0 + HOUR).status, 'verifying');
  assert.equal(resolveEntry(noScore, t0 + HOUR).score, undefined);
  // Seeds keep their fixed statuses at any clock.
  for (const now of [LOAD, LOAD + HOUR, LOAD + 30 * DAY]) {
    const all = allEntries([], now, LOAD);
    assert.equal(all.length, 5);
    assert.equal(all.find((x) => x.id === 'AF-K9ZR2E')!.status, 'verifying');
    assert.equal(all.filter((x) => x.status === 'passed').length, 4);
  }
  for (const s of seeds) {
    assert.equal(s.seed, true);
    assert.equal(s.agent, true);
    assert.equal(s.agentName, 'kestrel');
    if (s.status === 'passed') assert.equal(Date.parse(s.verifiedAt!) - Date.parse(s.submittedAt), 47 * MIN);
  }
  // Merge is oldest first.
  const merged = allEntries([e], t0, LOAD);
  for (let i = 1; i < merged.length; i++) assert.ok(Date.parse(merged[i - 1].submittedAt) <= Date.parse(merged[i].submittedAt));
});

test('U1.9 recordEntry upserts by id, caps at 200 keeping the newest, persists; readStoredEntries skips malformed items', () => {
  const s = new MemoryStorage();
  const t0 = Date.parse('2026-01-01T00:00:00.000Z');
  const make = (i: number, extra: Partial<StoredEntry> = {}): StoredEntry => ({
    id: `AF-${String(i).padStart(6, '0')}`, bountySlug: PERPS, submittedAt: new Date(t0 + i * MIN).toISOString(), agent: false, ...extra,
  });
  assert.equal(recordEntry(make(1, { selfScore: 1 }), s), true);
  assert.equal(recordEntry(make(1, { selfScore: 2, title: 'v2' }), s), true);
  let stored = readStoredEntries(s);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].selfScore, 2);
  assert.equal(stored[0].title, 'v2');
  for (let i = 2; i <= 205; i++) recordEntry(make(i), s);
  stored = readStoredEntries(s);
  assert.equal(stored.length, 200);
  assert.equal(stored[0].id, make(6).id);
  assert.equal(stored.at(-1)!.id, make(205).id);
  assert.equal(JSON.parse(s.getItem(ENTRIES_KEY)!).length, 200);
  s.failWrites = true;
  assert.equal(recordEntry(make(999), s), false);
  assert.equal(readStoredEntries(s).length, 200);

  const m = new MemoryStorage();
  assert.deepEqual(readStoredEntries(m), []);
  m.setItem(ENTRIES_KEY, 'nope');
  assert.deepEqual(readStoredEntries(m), []);
  m.setItem(ENTRIES_KEY, JSON.stringify({ id: 'x' }));
  assert.deepEqual(readStoredEntries(m), []);
  m.setItem(ENTRIES_KEY, JSON.stringify([
    null, 7, 'x', { bountySlug: PERPS, submittedAt: at(1) }, { id: 'AF-NOSLUG', submittedAt: at(1) },
    { id: 'AF-BADDATE', bountySlug: PERPS, submittedAt: 'yesterday' },
    { id: 'AF-GOOD02', bountySlug: PERPS, submittedAt: at(2), agent: true, selfScore: 'high' },
    { id: 'AF-GOOD01', bountySlug: PERPS, submittedAt: at(1), selfScore: 2.5 },
  ]));
  const ok = readStoredEntries(m);
  assert.deepEqual(ok.map((e) => e.id), ['AF-GOOD01', 'AF-GOOD02']);
  assert.equal(ok[0].selfScore, 2.5);
  assert.equal(ok[0].agent, false);
  assert.equal(ok[1].selfScore, undefined);
});

test('U1.10 toSubmissions relabels every entry with the given handle', () => {
  const subs = toSubmissions(seeds, PERPS, 'newname');
  assert.equal(subs.length, 2);
  assert.ok(subs.every((s) => s.hunter === 'newname'));
  assert.deepEqual(subs.map((s) => s.id), ['AF-2BPC7W', 'AF-M4X8TB']);
  assert.deepEqual(subs.map((s) => s.score), [2.21, 2.64]);
  assert.ok(subs.every((s) => s.status === 'passed' && s.agent === true));
  const fz = toSubmissions(seeds, FUZZ, 'newname');
  assert.equal(fz[0].status, 'verifying');
  assert.equal(fz[0].score, undefined);
  // A renamed handle still ranks the same.
  assert.deepEqual(standingCopy(rankOf(bounty(PERPS), 'newname', subs), bounty(PERPS)), { rank: '#3 of 20', detail: '0.77 Sharpe behind #1' });
});

test('U1.11 profileStats, earningsSeries and activity on the seeds equal the spec numbers', () => {
  const stats = profileStats(seeds, past, handle);
  assert.deepEqual(stats, {
    prizesOnTrack: 13_000, biggestWin: 6_000, entered: 10, totalEarned: 11_500, bestFinish: { rank: 1, of: 64 },
    podiums: 4, wins: 2, activeCount: 4, endedCount: 6,
  });
  const now = LOAD;
  const m1 = earningsSeries(past, '1M', now, DEFAULT_PROFILE.joinedAt);
  const m3 = earningsSeries(past, '3M', now, DEFAULT_PROFILE.joinedAt);
  const all = earningsSeries(past, 'ALL', now, DEFAULT_PROFILE.joinedAt);
  assert.deepEqual([m1.total, m3.total, all.total], [6000, 9000, 11500]);
  assert.deepEqual([m1.label, m3.label, all.label], ['Past month', 'Past 3 months', 'All time']);
  assert.equal(m1.start, now - 30 * DAY);
  assert.equal(m3.start, now - 90 * DAY);
  assert.equal(all.start, Date.parse(DEFAULT_PROFILE.joinedAt));
  assert.deepEqual(all.points.slice(1, -1).map((p) => Math.round((now - p.t) / DAY)), [121, 60, 38, 16]);
  assert.deepEqual(all.points.map((p) => p.cum), [0, 2500, 3500, 5500, 11500, 11500]);
  assert.deepEqual(m1.points, [{ t: now - 30 * DAY, cum: 5500 }, { t: now - 16 * DAY, cum: 11500 }, { t: now, cum: 11500 }]);
  assert.equal(all.end, now);

  const items = activity(seeds, past);
  assert.equal(items.length, 19);
  const count = (k: string) => items.filter((i) => i.kind === k).length;
  assert.deepEqual([count('submitted'), count('scored'), count('finished'), count('paid')], [5, 4, 6, 4]);
  for (let i = 1; i < items.length; i++) assert.ok(Date.parse(items[i - 1].at) >= Date.parse(items[i].at), 'newest first');
  assert.equal(items[0].kind, 'submitted');
  assert.equal(items[0].value, 'AF-K9ZR2E');
  assert.equal(items[0].slug, FUZZ);
  const paid = items.find((i) => i.id === 'paid:jupiter-launch-fill')!;
  assert.equal(paid.value, '+$6,000');
  assert.equal(paid.positive, true);
  assert.equal(paid.slug, undefined);
  assert.equal(items.find((i) => i.id === 'finished:jupiter-launch-fill')!.value, '#1 of 64');
  assert.equal(items.find((i) => i.id === 'scored:AF-M4X8TB')!.value, '2.64 Sharpe');
  assert.equal(items.find((i) => i.id === 'scored:AF-3HWN6P')!.value, '0.538 nats');
});

test('U1.12 past results are off the board, mixed, paid exactly when placed, ended before load and internally consistent', () => {
  const boardTitles = new Set(BOARD_BOUNTIES.map((b) => b.title.toLowerCase()));
  assert.equal(past.length, 6);
  assert.equal(new Set(past.map((p) => p.id)).size, 6);
  for (const p of past) {
    assert.ok(!boardTitles.has(p.title.toLowerCase()), p.title);
    assert.equal(p.payout > 0, p.finalRank <= 3, p.id);
    assert.ok(Date.parse(p.endedAt) < LOAD, p.id);
    assert.ok(p.metric.better === 'higher' ? p.firstScore >= p.score : p.firstScore <= p.score, p.id);
    assert.equal(p.finalRank === 1, p.firstScore === p.score, p.id);
    assert.ok(p.finalRank >= 1 && p.finalRank <= p.fieldSize);
    assert.ok(p.payout <= p.rewardAmount);
  }
  assert.ok(past.some((p) => p.finalRank === 1));
  assert.ok(past.some((p) => p.finalRank > 3));
  assert.equal(PAST_RESULT_DEFS.length, past.length);
});

test('U1.13 formatScore, formatTimeLeft, ordinal and coverCrop', () => {
  assert.equal(formatScore(61.4, { unit: '%' }, 1), '61.4%');
  assert.equal(formatScore(1.18, { unit: '°C' }, 2), '1.18°C');
  assert.equal(formatScore(0.018, { unit: 'USD' }, 3), '$0.018');
  assert.equal(formatScore(18420, { unit: 'USDC' }, 0), '18,420 USDC');
  assert.equal(formatScore(1688, { unit: 'Elo' }, 0), '1,688 Elo');
  assert.equal(formatScore(2.64, { unit: 'Sharpe' }, 2), '2.64 Sharpe');
  assert.equal(formatScore(0.538, { unit: 'nats' }, 3), '0.538 nats');
  assert.equal(formatScore(18, { unit: 'replies' }, 1), '18.0 replies');
  assert.equal(formatTimeLeft(9 * DAY + 4 * HOUR + 30 * MIN), '9d 4h');
  assert.equal(formatTimeLeft(5 * HOUR + 12 * MIN + 40_000), '5h 12m');
  assert.equal(formatTimeLeft(12 * MIN + 59_000), '12m');
  assert.equal(formatTimeLeft(0), 'Ended');
  assert.equal(formatTimeLeft(-HOUR), 'Ended');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 24, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '24th', '101st', '111th']);
  assert.deepEqual(coverCrop(400, 300), { sx: 50, sy: 0, size: 300 });
  assert.deepEqual(coverCrop(300, 500), { sx: 0, sy: 100, size: 300 });
  assert.deepEqual(coverCrop(256, 256), { sx: 0, sy: 0, size: 256 });
});

test('U1.14 pfp presets: 6 unique ids, no blue mixed with red or pink, no chart-1 or chart-5', () => {
  assert.equal(PFP_PRESETS.length, 6);
  assert.deepEqual(PFP_PRESETS.map((p) => p.id), ['tide', 'ember', 'meadow', 'sky', 'coral', 'slate']);
  const token = (stop: string) => /--color-pk-([a-z0-9-]+)/.exec(stop)?.[1];
  const BLUE = new Set(['brand-500', 'chart-2', 'blue-100', 'blue-200']);
  const RED = new Set(['red-100', 'red-200']);
  for (const p of PFP_PRESETS) {
    assert.equal(p.stops.length, 3);
    const tokens = p.stops.map(token);
    for (const [i, t] of tokens.entries()) {
      assert.ok(t, `${p.id} stop is a pk token`);
      assert.match(p.stops[i], /^var\(--color-pk-[a-z0-9-]+, #[0-9a-f]{6}\)$/, 'token with a hex fallback');
    }
    assert.ok(!(tokens.some((t) => BLUE.has(t!)) && tokens.some((t) => RED.has(t!))), p.id);
    assert.ok(!tokens.includes('chart-1') && !tokens.includes('chart-5'), p.id);
    assert.ok(!/#1c3fe2|#8f3dd7/i.test(p.stops.join()), p.id);
  }
});

test('U1.15 no exported string, title, bio or standingCopy output contains an em dash', () => {
  const seen: string[] = [];
  const walk = (v: unknown, depth = 0): void => {
    if (depth > 6) return;
    if (typeof v === 'string') seen.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
    else if (v && typeof v === 'object' && !(v instanceof RegExp)) for (const x of Object.values(v)) walk(x, depth + 1);
  };
  for (const v of Object.values(P)) if (typeof v !== 'function') walk(v);
  walk(seeds);
  walk(past);
  walk(activity(seeds, past));
  for (const slug of [SOLANA, PERPS, LOGLOSS, FUZZ]) walk(standingCopy(standingOn(slug), bounty(slug)));
  for (const s of [{ kind: 'unranked', entries: 1 }, { kind: 'none' }, { kind: 'inflight', status: 'pending', of: 3, entries: 1 }] as const) walk(standingCopy(s, bounty(PERPS)));
  walk(validateProfile({ ...DEFAULT_PROFILE, displayName: '', handle: 'X', bio: 'b'.repeat(200), x: '-' }));
  assert.ok(seen.length > 50);
  for (const s of seen) assert.ok(!s.includes(EM_DASH), s);
  // And the module source itself carries none.
  assert.ok(!readFileSync(new URL('../src/lib/profile.ts', import.meta.url), 'utf8').includes(EM_DASH));
});

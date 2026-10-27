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

const { BOARD_BOUNTIES, AGENT_POOL, HUNTER_POOL, isAgentHandle } = await import('../src/lib/bountyData.ts');
const { BOUNTY_CATEGORIES, bountyPath } = await import('../src/lib/bounty.ts');
const { LISTINGS } = await import('../src/data/listings.ts');
const W = await import('../src/lib/wonBounties.ts');
const P = await import('../src/lib/profile.ts');
const { WON_DEFS, WON_BOUNTIES, WON_LOAD, buildWon, findBounty, isEnded } = W;
const { rankOf, prizeFor, leaderboard, winnersOf, wonEntryFor, standingCopy, DEFAULT_PROFILE, PAST_RESULT_DEFS } = P;

type Bounty = (typeof WON_BOUNTIES)[number];
const DAY = 86_400_000;
const handle = DEFAULT_PROFILE.handle;
const ROSTER = [
  'jupiter-launch-fill', 'pumpfun-launch-snipe', 'funding-rate-arb-30d',
  'macro-release-brier', 'ercot-price-rmse', 'crypto-range-calibration',
  'drainer-detector-bypass', 'phishing-domain-hunt-24h', 'leaked-key-recall',
  'ts-errors-under-budget', 'invoice-reconcile-10k', 'support-tickets-500',
  'cold-email-replies', 'newsletter-signups-1k-ads', 'landing-page-ab-10d',
  'connect-four-elo', 'tetris-marathon-lines', 'hanabi-ad-hoc-play',
];
const won = (slug: string): Bounty => {
  const b = WON_BOUNTIES.find((x) => x.slug === slug);
  assert.ok(b, slug);
  return b;
};
const defOf = (slug: string) => WON_DEFS.find((d) => d.slug === slug)!;
const better = (b: Bounty, a: number, c: number) => (b.resolution.metric!.better === 'higher' ? a > c : a < c);
const yourEntry = (slug: string) => wonEntryFor(slug, handle)!;

test('W1 18 won bounties, 3 per category, the roster slugs in order, unique', () => {
  assert.equal(WON_BOUNTIES.length, 18);
  assert.equal(WON_DEFS.length, 18);
  assert.deepEqual(WON_BOUNTIES.map((b) => b.slug), ROSTER);
  assert.deepEqual(WON_DEFS.map((d) => d.slug), ROSTER);
  assert.equal(new Set(ROSTER).size, 18);
  for (const c of BOUNTY_CATEGORIES) assert.equal(WON_BOUNTIES.filter((b) => b.category === c).length, 3, c);
  for (const b of WON_BOUNTIES) {
    assert.equal(b.id, b.slug);
    assert.equal(b.url, bountyPath(b.slug));
    assert.ok(!BOARD_BOUNTIES.some((x) => x.slug === b.slug), `${b.slug} not live`);
  }
  assert.equal(WON_DEFS.filter((d) => d.you).length, 6);
});

test('W2 times: deadline = load - endedDaysAgo, publishedAt = deadline - openDays, everything inside the window, before load', () => {
  // The won bounties share the board's load instant.
  for (const b of BOARD_BOUNTIES) {
    const seed = LISTINGS.find((s) => s.slug === b.slug)!;
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.slug.length; i++) h = Math.imul(h ^ seed.slug.charCodeAt(i), 0x01000193);
    assert.equal(Date.parse(b.deadline) - seed.closesInH * 3_600_000 - ((h >>> 0) % 59) * 60_000, WON_LOAD, b.slug);
  }
  assert.ok(WON_LOAD <= Date.now());
  const days = new Set<number>();
  for (const b of WON_BOUNTIES) {
    const d = defOf(b.slug);
    const end = Date.parse(b.deadline);
    const pub = Date.parse(b.publishedAt);
    assert.equal(end, WON_LOAD - d.endedDaysAgo * DAY, b.slug);
    assert.equal(pub, end - d.openDays * DAY, b.slug);
    assert.ok(end < WON_LOAD && pub < end, b.slug);
    assert.ok(isEnded(b) && isEnded(b, WON_LOAD), b.slug);
    for (const s of b.submissions) assert.ok(Date.parse(s.createdAt) >= pub && Date.parse(s.createdAt) <= end, `${b.slug} ${s.id}`);
    for (let i = 1; i < b.submissions.length; i++) assert.ok(Date.parse(b.submissions[i - 1].createdAt) <= Date.parse(b.submissions[i].createdAt), `${b.slug} oldest first`);
    for (const m of b.chat) assert.ok(Date.parse(m.createdAt) > pub && Date.parse(m.createdAt) < WON_LOAD, `${b.slug} chat ${m.id}`);
    days.add(d.endedDaysAgo);
  }
  assert.equal(days.size, 18, 'every bounty ended on a different day');
  for (const b of BOARD_BOUNTIES) assert.equal(isEnded(b, WON_LOAD), false, b.slug);
});

test('W3 money and field: rewards sum to rewardAmount, submissionCount matches, ranges hold', () => {
  for (const b of WON_BOUNTIES) {
    const d = defOf(b.slug);
    assert.deepEqual(Object.keys(b.rewards!), ['1', '2', '3']);
    assert.equal(b.rewards!['1'] + b.rewards!['2'] + b.rewards!['3'], b.rewardAmount, b.slug);
    assert.deepEqual(b.rewards, { '1': d.rewards[1], '2': d.rewards[2], '3': d.rewards[3] });
    assert.ok(b.rewards!['1'] > b.rewards!['2'] && b.rewards!['2'] > b.rewards!['3'], b.slug);
    assert.equal(b.submissionCount, b.submissions.length, b.slug);
    assert.equal(new Set(b.submissions.map((s) => s.id)).size, b.submissions.length);
    const scored = new Set(b.submissions.filter((s) => s.status === 'passed' && typeof s.score === 'number').map((s) => s.hunter));
    assert.equal(scored.size, d.fieldSize - (d.you ? 1 : 0), `${b.slug} field`);
    assert.ok(b.submissions.some((s) => s.status === 'failed'), `${b.slug} has failures`);
    for (const s of b.submissions) {
      assert.equal(s.agent, isAgentHandle(s.hunter));
      assert.notEqual(s.hunter, handle);
      if (s.status === 'failed') assert.equal(s.score, undefined);
      else assert.equal(s.status, 'passed');
      assert.ok(s.title && s.link);
    }
    const pool = new Set<string>([...HUNTER_POOL, ...AGENT_POOL]);
    for (const h of new Set(b.submissions.map((s) => s.hunter))) assert.ok(pool.has(h) || pool.has(h.replace(/\d+$/, '')), h);
    assert.equal(b.resolution.method, 'metric');
    assert.deepEqual(b.resolution.metric, d.metric);
    assert.ok(b.resolution.criteria.length >= 3, b.slug);
    for (const k of ['summary', 'source', 'verifier', 'tieBreak', 'announce'] as const) assert.ok(b.resolution[k].length > 10, `${b.slug} ${k}`);
    assert.ok(b.description.length > 200, b.slug);
    assert.ok(b.chat.length >= 4 && b.chat.length <= 8, `${b.slug} chat ${b.chat.length}`);
    assert.ok(b.chat.every((m) => m.author !== handle));
    const last = b.chat.at(-1)!;
    assert.equal(last.role, 'sponsor');
    assert.equal(last.author, b.sponsor.slug);
    assert.match(last.body, /^Results are final\./);
    assert.ok(b.chat.some((m) => m.role !== 'sponsor'));
    if (!d.you) {
      assert.ok(b.rewardAmount >= 3_000 && b.rewardAmount <= 15_000, b.slug);
      assert.ok(d.fieldSize >= 18 && d.fieldSize <= 160, b.slug);
      assert.ok(d.endedDaysAgo >= 2 && d.endedDaysAgo <= 180, b.slug);
    }
  }
});

test('W4 the best passed score is winningScore (your entry merged in where you entered), oriented by better', () => {
  for (const b of WON_BOUNTIES) {
    const d = defOf(b.slug);
    const extra = d.you ? [yourEntry(b.slug)] : [];
    const rows = leaderboard(b, extra);
    assert.equal(rows[0].score, d.winningScore, b.slug);
    assert.equal(rows.length, d.fieldSize, b.slug);
    for (const s of [...b.submissions, ...extra]) if (s.status === 'passed') assert.ok(!better(b, s.score!, d.winningScore), `${b.slug} ${s.id}`);
    // No ties in the paid places.
    assert.ok(better(b, rows[0].score, rows[1].score) && better(b, rows[1].score, rows[2].score) && better(b, rows[2].score, rows[3].score), b.slug);
    // Without you, the field's own leader: winningScore unless you took first.
    const field = leaderboard(b);
    if (!d.you || d.you.rank > 1) assert.equal(field[0].score, d.winningScore, b.slug);
    else assert.ok(better(b, d.winningScore, field[0].score), b.slug);
  }
});

test('W5 no title equals a live title; titles unique; no em dash anywhere', () => {
  const live = new Set(BOARD_BOUNTIES.map((b) => b.title.toLowerCase()));
  for (const b of WON_BOUNTIES) assert.ok(!live.has(b.title.toLowerCase()), b.title);
  assert.equal(new Set(WON_BOUNTIES.map((b) => b.title.toLowerCase())).size, 18);
  const json = JSON.stringify([WON_DEFS, WON_BOUNTIES]);
  assert.ok(!json.includes('—'));
  assert.ok(!readFileSync(new URL('../src/lib/wonBounties.ts', import.meta.url), 'utf8').includes('—'));
});

test('W6 deterministic: building twice gives the same data; a second module instance agrees', async () => {
  assert.deepEqual(buildWon(WON_LOAD), WON_BOUNTIES);
  const t0 = Date.UTC(2026, 9, 25, 12);
  const a = buildWon(t0);
  const b = buildWon(t0);
  assert.deepEqual(a, b);
  // Shifting the load shifts every instant and nothing else.
  const c = buildWon(t0 + DAY);
  assert.deepEqual(a.map((x) => x.submissions.map((s) => [s.hunter, s.score, s.status])), c.map((x) => x.submissions.map((s) => [s.hunter, s.score, s.status])));
  assert.deepEqual(c.map((x) => Date.parse(x.deadline) - Date.parse(a.find((y) => y.slug === x.slug)!.deadline)), Array(18).fill(DAY));
  const again = await import('../src/lib/wonBounties.ts?again');
  assert.deepEqual(again.buildWon(t0), a);
});

test('W7 findBounty finds live and won bounties; isEnded', () => {
  for (const b of BOARD_BOUNTIES) assert.equal(findBounty(b.slug), b);
  for (const b of WON_BOUNTIES) assert.equal(findBounty(b.slug), b);
  assert.equal(findBounty('no-such-bounty'), undefined);
  const b = WON_BOUNTIES[0];
  assert.equal(isEnded(b, Date.parse(b.deadline)), true);
  assert.equal(isEnded(b, Date.parse(b.deadline) - 1), false);
});

test('W8 the six you entered: your rank of fieldSize, the winner holds firstScore, prizeFor pays the old payout', () => {
  const expected: Record<string, [number, number, number, number]> = {
    // rank, of, firstScore, payout
    'jupiter-launch-fill': [1, 64, 182, 6_000],
    'macro-release-brier': [2, 118, 0.131, 2_000],
    'ts-errors-under-budget': [3, 87, 68.9, 1_000],
    'drainer-detector-bypass': [11, 52, 31.8, 0],
    'connect-four-elo': [1, 29, 1688, 2_500],
    'cold-email-replies': [24, 41, 41.2, 0],
  };
  assert.deepEqual(Object.keys(expected).sort(), WON_DEFS.filter((d) => d.you).map((d) => d.slug).sort());
  for (const [slug, [rank, of, first, payout]] of Object.entries(expected)) {
    const b = won(slug);
    const d = defOf(slug);
    const s = rankOf(b, handle, [yourEntry(slug)]);
    assert.ok(s.kind === 'ranked', slug);
    assert.equal(standingCopy(s, b).rank, `#${rank} of ${of}`, slug);
    assert.deepEqual([s.rank, s.of, s.score, s.leader.score], [rank, of, d.you!.score, first], slug);
    assert.equal(prizeFor(b, s.rank), payout, slug);
    assert.equal(s.prize, payout, slug);
    // Exactly rank - 1 other hunters beat your score.
    assert.equal(leaderboard(b).filter((r) => better(b, r.score, d.you!.score)).length, rank - 1, slug);
    assert.equal(leaderboard(b).filter((r) => r.score === d.you!.score).length, 0, `${slug} no tie with you`);
    // And the profile's past result says the same.
    const p = PAST_RESULT_DEFS.find((x) => x.id === slug)!;
    assert.deepEqual([p.finalRank, p.fieldSize, p.firstScore, p.payout, p.score], [rank, of, first, payout, d.you!.score], slug);
  }
});

test('W9 winnersOf: three paid places in order, payouts from rewards, you on jupiter and connect four', () => {
  for (const b of WON_BOUNTIES) {
    const w = winnersOf(b);
    assert.deepEqual(w.map((x) => x.place), [1, 2, 3], b.slug);
    assert.deepEqual(w.map((x) => x.payout), [b.rewards!['1'], b.rewards!['2'], b.rewards!['3']]);
    const rows = leaderboard(b);
    assert.deepEqual(w.map((x) => [x.hunter, x.score]), rows.slice(0, 3).map((r) => [r.hunter, r.score]));
    for (const x of w) {
      assert.equal(x.you, false);
      assert.equal(x.agent, isAgentHandle(x.hunter));
    }
  }
  for (const slug of ['jupiter-launch-fill', 'connect-four-elo']) {
    const w = winnersOf(won(slug), [yourEntry(slug)], handle);
    assert.deepEqual([w[0].place, w[0].hunter, w[0].you, w[0].agent, w[0].score], [1, handle, true, true, defOf(slug).you!.score], slug);
    assert.ok(!w[1].you && !w[2].you);
    assert.equal(w[0].payout, defOf(slug).rewards[1]);
  }
  // Rank 2 and 3 entries show at their place; unplaced entries do not appear.
  assert.deepEqual(winnersOf(won('macro-release-brier'), [yourEntry('macro-release-brier')], handle).map((x) => x.you), [false, true, false]);
  assert.deepEqual(winnersOf(won('ts-errors-under-budget'), [yourEntry('ts-errors-under-budget')], handle).map((x) => x.you), [false, false, true]);
  assert.ok(winnersOf(won('cold-email-replies'), [yourEntry('cold-email-replies')], handle).every((x) => !x.you));
  // A renamed handle carries through.
  const renamed = wonEntryFor('jupiter-launch-fill', 'kes_trel')!;
  assert.equal(winnersOf(won('jupiter-launch-fill'), [renamed], 'kes_trel')[0].hunter, 'kes_trel');
  // Live bounties: the current leaders.
  const live = BOARD_BOUNTIES[0];
  assert.deepEqual(winnersOf(live).map((x) => x.hunter), leaderboard(live).slice(0, Object.keys(live.rewards!).length).map((r) => r.hunter));
  // Missing places are left out, not padded.
  assert.deepEqual(winnersOf({ ...live, submissions: [] }), []);
});

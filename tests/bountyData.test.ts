import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// src/ uses bundler-style extensionless imports ("./bounty"); let Node resolve them to the .ts file the way Vite does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});

const data = await import('../src/lib/bountyData.ts');
const again = await import('../src/lib/bountyData.ts?again');
const { bountyPath, BOUNTY_CATEGORIES } = await import('../src/lib/bounty.ts');
const { BOARD_BOUNTIES, buildBoard } = data;
const t0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const BOARDS = [BOARD_BOUNTIES, buildBoard(t0)];

test('about thirty listings, every category used, sorted highest reward first', () => {
  assert.ok(BOARD_BOUNTIES.length >= 28 && BOARD_BOUNTIES.length <= 34, `${BOARD_BOUNTIES.length}`);
  for (const c of BOUNTY_CATEGORIES) assert.ok(BOARD_BOUNTIES.some((b) => b.category === c), c);
  for (let i = 1; i < BOARD_BOUNTIES.length; i++) assert.ok(BOARD_BOUNTIES[i - 1].rewardAmount >= BOARD_BOUNTIES[i].rewardAmount, `index ${i}`);
  assert.equal(BOARD_BOUNTIES[0].rewardAmount, Math.max(...BOARD_BOUNTIES.map((b) => b.rewardAmount)));
  assert.equal(new Set(BOARD_BOUNTIES.map((b) => b.slug)).size, BOARD_BOUNTIES.length, 'unique slugs');
});

test('url is the bounty page path', () => {
  for (const b of BOARD_BOUNTIES) assert.equal(b.url, bountyPath(b.slug), b.slug);
});

test('submissions: length equals submissionCount, unique ids, oldest first inside the window', () => {
  for (const board of BOARDS) {
    for (const b of board) {
      assert.equal(b.submissions.length, b.submissionCount, b.slug);
      assert.equal(new Set(b.submissions.map((s) => s.id)).size, b.submissions.length, `${b.slug} ids`);
      const times = b.submissions.map((s) => Date.parse(s.createdAt));
      for (let i = 1; i < times.length; i++) assert.ok(times[i - 1] <= times[i], `${b.slug} order`);
      if (times.length) assert.ok(times[0] >= Date.parse(b.publishedAt) && times.at(-1)! <= Date.parse(b.deadline), `${b.slug} window`);
      for (const s of b.submissions) {
        assert.match(s.hunter, /^[a-z0-9._-]+$/);
        assert.ok(s.title && s.link && s.status, `${b.slug} ${s.id} enriched`);
      }
    }
  }
});

test('scores exist only on passed submissions; every listing with verified entries has a clear leader', () => {
  for (const b of BOARD_BOUNTIES) {
    for (const s of b.submissions) {
      if (s.status === 'passed') assert.equal(typeof s.score, 'number', `${b.slug} ${s.id}`);
      else assert.equal(s.score, undefined, `${b.slug} ${s.id} ${s.status}`);
    }
    const scores = b.submissions.flatMap((s) => (s.score === undefined ? [] : [s.score]));
    if (scores.length >= 2) {
      const sorted = [...scores].sort((x, y) => (b.resolution.metric!.better === 'higher' ? y - x : x - y));
      assert.notEqual(sorted[0], sorted[1], `${b.slug} leader is unique`);
    }
    if (b.submissions.length) assert.ok(['pending', 'verifying'].includes(b.submissions.at(-1)!.status!), `${b.slug} newest unverified`);
  }
});

test('roughly half to two-thirds of submitters are agents, and agent handles look like agents', () => {
  const hunters = new Map<string, boolean>();
  for (const b of BOARD_BOUNTIES) for (const s of b.submissions) hunters.set(`${b.slug}/${s.hunter}`, Boolean(s.agent));
  const share = [...hunters.values()].filter(Boolean).length / hunters.size;
  assert.ok(share >= 0.5 && share <= 0.8, `agent share ${share.toFixed(2)}`);
  for (const b of BOARD_BOUNTIES) for (const s of b.submissions) assert.equal(Boolean(s.agent), /-agent\d*$|^agent\./.test(s.hunter), s.hunter);
});

test('every resolution is specific: metric, 3+ criteria, source, verifier, tie-break, announce', () => {
  for (const b of BOARD_BOUNTIES) {
    const r = b.resolution;
    assert.ok(r.metric && r.metric.name && r.metric.unit && ['higher', 'lower'].includes(r.metric.better), `${b.slug} metric`);
    assert.ok(r.criteria.length >= 3 && r.criteria.length <= 6, `${b.slug} criteria`);
    for (const k of ['summary', 'source', 'verifier', 'tieBreak', 'announce'] as const) assert.ok(r[k].trim().length > 10, `${b.slug} ${k}`);
  }
  assert.equal(new Set(BOARD_BOUNTIES.map((b) => b.resolution.summary)).size, BOARD_BOUNTIES.length, 'no boilerplate summaries');
});

test('every chat is 3 to 10 messages, oldest first, inside the listing window', () => {
  for (const board of BOARDS) {
    for (const b of board) {
      assert.ok(b.chat.length >= 3 && b.chat.length <= 10, `${b.slug} ${b.chat.length}`);
      const times = b.chat.map((m) => Date.parse(m.createdAt));
      for (let i = 1; i < times.length; i++) assert.ok(times[i - 1] <= times[i], `${b.slug} chat order`);
      assert.ok(times[0] >= Date.parse(b.publishedAt) && times.at(-1)! <= Date.parse(b.deadline), `${b.slug} chat window`);
      assert.ok(b.chat.some((m) => m.role === 'sponsor') && b.chat.some((m) => m.role !== 'sponsor'), `${b.slug} roles`);
      assert.equal(new Set(b.chat.map((m) => m.id)).size, b.chat.length, `${b.slug} chat ids`);
    }
  }
});

test('deterministic across calls and across imports', () => {
  assert.deepEqual(buildBoard(t0), buildBoard(t0));
  const shape = (bs: typeof BOARD_BOUNTIES) => bs.map((b) => [b.slug, b.rewardAmount, b.submissions.map((s) => `${s.hunter}|${s.title}|${s.link}|${s.status}|${s.score}`).join(','), b.chat.map((m) => m.author).join(',')]);
  assert.deepEqual(shape(again.BOARD_BOUNTIES), shape(BOARD_BOUNTIES));
});

test('descriptions are plain text with sections', () => {
  for (const b of BOARD_BOUNTIES) {
    assert.ok(b.description.trim().length > 0, b.slug);
    assert.doesNotMatch(b.description, /<\/?[a-z][^>]*>|&(?:[a-z]+|#\d+);/i, b.slug);
    assert.match(b.description, /\n## [A-Z]/, `${b.slug} has a subhead`);
  }
});

test('no third-party attribution, placeholder wording, emoji or em dashes in shown text', () => {
  const banned = /sample|superteam|illustrative|—|\p{Extended_Pictographic}/iu;
  for (const b of BOARD_BOUNTIES) {
    const r = b.resolution;
    const texts = [
      b.slug, b.title, b.sponsor.name, b.description, r.summary, r.source, r.verifier, r.tieBreak, r.announce, r.metric!.name, ...r.criteria,
      ...b.chat.map((m) => m.body), ...b.submissions.map((s) => `${s.title} ${s.link}`),
    ];
    for (const t of texts) assert.doesNotMatch(t, banned, `${b.slug}: ${t.slice(0, 80)}`);
  }
});

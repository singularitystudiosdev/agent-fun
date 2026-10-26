import assert from 'node:assert/strict';
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

const { activeFilterCount, applyBoardFilters, DEFAULT_BOARD_FILTERS, DEFAULT_PANEL_FILTERS, isRefined } = await import('../src/lib/boardFilters.ts');
const { readSavedIds } = await import('../src/lib/saved.ts');
type BoardBounty = import('../src/lib/bounty.ts').BoardBounty;

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const H = 3_600_000;

const make = (id: string, over: Partial<BoardBounty>): BoardBounty => ({
  id,
  slug: id,
  title: `Bounty ${id}`,
  url: `/bounty/${id}`,
  rewardAmount: 1_000,
  deadline: new Date(NOW + 30 * 24 * H).toISOString(),
  publishedAt: new Date(NOW - 24 * H).toISOString(),
  submissionCount: 40,
  sponsor: { name: 'Acme' },
  category: 'Trading',
  skills: ['Python'],
  description: '',
  submissions: [],
  resolution: { method: 'automated', summary: '', criteria: [], source: '', verifier: '', tieBreak: '', announce: '' },
  chat: [],
  ...over,
});

// Deliberately not sorted by any key: the filter must keep the incoming order.
const LIST: BoardBounty[] = [
  make('a', { title: 'Beat the Sharpe ratio benchmark', rewardAmount: 25_000, deadline: new Date(NOW + 10 * H).toISOString(), submissionCount: 12 }),
  make('b', { title: 'Phishing site detector', category: 'Security', skills: ['Rust', 'Smart Contracts'], rewardAmount: 5_000, deadline: new Date(NOW + 3 * 24 * H).toISOString(), submissionCount: 24 }),
  make('c', { title: 'Grow the Discord', category: 'Growth', sponsor: { name: 'Jupiter Exchange' }, rewardAmount: 20_000, deadline: new Date(NOW + 10 * 24 * H).toISOString(), submissionCount: 25 }),
  make('d', { title: 'Market-making bot', rewardAmount: 9_999, skills: ['Python', 'Backend'] }),
  make('e', { title: 'Expired one', rewardAmount: 50_000, deadline: new Date(NOW - H).toISOString(), submissionCount: 1 }),
];
const ids = (list: BoardBounty[]) => list.map((b) => b.id);
const run = (over: Partial<typeof DEFAULT_BOARD_FILTERS>, saved: Set<string> = new Set()) => ids(applyBoardFilters(LIST, { ...DEFAULT_BOARD_FILTERS, ...over }, saved, NOW));

test('defaults pass everything through, in the incoming order', () => {
  assert.deepEqual(run({}), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(run({ query: '   ' }), ['a', 'b', 'c', 'd', 'e']);
  assert.notEqual(applyBoardFilters(LIST, DEFAULT_BOARD_FILTERS, new Set(), NOW), LIST, 'returns a new array');
});

test('query: case-insensitive over title, category, skills and sponsor; terms are ANDed', () => {
  assert.deepEqual(run({ query: 'SHARPE' }), ['a']);
  assert.deepEqual(run({ query: 'security' }), ['b'], 'category');
  assert.deepEqual(run({ query: 'smart contracts' }), ['b'], 'skill, two terms');
  assert.deepEqual(run({ query: 'jupiter' }), ['c'], 'sponsor');
  assert.deepEqual(run({ query: 'python' }), ['a', 'c', 'd', 'e']);
  assert.deepEqual(run({ query: 'python backend' }), ['d'], 'AND across fields');
  assert.deepEqual(run({ query: '  market   BOT ' }), ['d'], 'extra whitespace');
  assert.deepEqual(run({ query: 'python rust' }), [], 'no bounty has both');
});

test('minReward is inclusive', () => {
  assert.deepEqual(run({ minReward: 5_000 }), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(run({ minReward: 10_000 }), ['a', 'c', 'e']);
  assert.deepEqual(run({ minReward: 20_000 }), ['a', 'c', 'e']);
});

test('endsWithin keeps open bounties whose deadline is inside the window', () => {
  assert.deepEqual(run({ endsWithin: '24h' }), ['a']);
  assert.deepEqual(run({ endsWithin: '7d' }), ['a', 'b']);
  assert.deepEqual(run({ endsWithin: '14d' }), ['a', 'b', 'c']);
  const edge = [make('x', { deadline: new Date(NOW + 24 * H).toISOString() }), make('y', { deadline: new Date(NOW + 24 * H + 1).toISOString() })];
  assert.deepEqual(ids(applyBoardFilters(edge, { ...DEFAULT_BOARD_FILTERS, endsWithin: '24h' }, new Set(), NOW)), ['x']);
});

test('competition "low" means fewer than 25 submissions', () => {
  assert.deepEqual(run({ competition: 'low' }), ['a', 'b', 'e']);
});

test('savedOnly keeps only saved ids; filters combine', () => {
  assert.deepEqual(run({ savedOnly: true }), []);
  assert.deepEqual(run({ savedOnly: true }, new Set(['c', 'a', 'zzz'])), ['a', 'c']);
  assert.deepEqual(run({}, new Set(['c'])), ['a', 'b', 'c', 'd', 'e'], 'ignored when off');
  assert.deepEqual(run({ minReward: 20_000, endsWithin: '14d', competition: 'low' }), ['a']);
  assert.deepEqual(run({ minReward: 20_000, savedOnly: true, query: 'discord' }, new Set(['c', 'd'])), ['c']);
});

test('activeFilterCount and isRefined', () => {
  assert.equal(activeFilterCount(DEFAULT_PANEL_FILTERS), 0);
  assert.equal(activeFilterCount({ minReward: 5_000, endsWithin: 'any', competition: 'any' }), 1);
  assert.equal(activeFilterCount({ minReward: 20_000, endsWithin: '7d', competition: 'low' }), 3);
  assert.equal(activeFilterCount({ ...DEFAULT_BOARD_FILTERS, query: 'x', savedOnly: true }), 0, 'query and Saved are not popover filters');
  assert.equal(isRefined(DEFAULT_BOARD_FILTERS), false);
  assert.equal(isRefined({ ...DEFAULT_BOARD_FILTERS, query: '  ' }), false);
  assert.equal(isRefined({ ...DEFAULT_BOARD_FILTERS, query: 'x' }), true);
  assert.equal(isRefined({ ...DEFAULT_BOARD_FILTERS, savedOnly: true }), true);
  assert.equal(isRefined({ ...DEFAULT_BOARD_FILTERS, competition: 'low' }), true);
});

test('readSavedIds reads only bounty bookmarks set to "1"', () => {
  const data: Record<string, string> = {
    'pm-card:favorite:bounty:a': '1',
    'pm-card:favorite:bounty:b': '0',
    'pm-card:favorite:bounty:c-d': '1',
    'pm-card:favorite:market-1': '1',
    unrelated: '1',
  };
  const keys = Object.keys(data);
  const storage = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => data[k] ?? null };
  assert.deepEqual([...readSavedIds(storage)].sort(), ['a', 'c-d']);
  assert.deepEqual([...readSavedIds(undefined)], []);
});

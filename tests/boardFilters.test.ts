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

const {
  activeFilterCount,
  applyBoardFilters,
  COMPETITION_OPTIONS,
  DEFAULT_BOARD_FILTERS,
  DEFAULT_PANEL_FILTERS,
  ENDS_WITHIN_OPTIONS,
  isBoardSort,
  isRefined,
  MIN_REWARD_OPTIONS,
  recentSubmissions,
  SORT_OPTIONS,
  sortBounties,
  topPrize,
  tabDefaultSort,
} = await import('../src/lib/boardFilters.ts');
const { BOARD_TABS, selectBounties } = await import('../src/lib/boardTabs.ts');
const { buildBoard } = await import('../src/lib/bountyData.ts');
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

// A submission `hoursAgo` before NOW.
const sub = (hoursAgo: number) => ({ hunter: 'h', createdAt: new Date(NOW - hoursAgo * H).toISOString() });

// Sort keys deliberately collide so every tie-break is exercised: p/q tie on everything but id; r/s tie on submissions and reward.
// r and t split their reward into placements (first prize 7,000 and 6,000); t and s have submissions inside the last 24h.
const SORTABLE: BoardBounty[] = [
  make('q', { rewardAmount: 5_000, submissionCount: 10, publishedAt: new Date(NOW - 5 * H).toISOString(), deadline: new Date(NOW + 50 * H).toISOString() }),
  make('r', { rewardAmount: 8_000, rewards: { '1': 7_000, '2': 1_000 }, submissionCount: 30, publishedAt: new Date(NOW - 2 * H).toISOString(), deadline: new Date(NOW + 20 * H).toISOString() }),
  make('p', { rewardAmount: 5_000, submissionCount: 10, publishedAt: new Date(NOW - 5 * H).toISOString(), deadline: new Date(NOW + 50 * H).toISOString() }),
  make('t', { rewardAmount: 12_000, rewards: { '1': 6_000, '2': 4_000, '3': 2_000 }, submissionCount: 3, submissions: [sub(1), sub(5), sub(23)], publishedAt: new Date(NOW - 9 * H).toISOString(), deadline: new Date(NOW + 90 * H).toISOString() }),
  make('s', { rewardAmount: 8_000, submissionCount: 30, submissions: [sub(2), sub(30), sub(48)], publishedAt: new Date(NOW - 1 * H).toISOString(), deadline: new Date(NOW + 70 * H).toISOString() }),
];

test('SORT_OPTIONS: ten sorts in display order, each next to its reverse', () => {
  assert.deepEqual(
    SORT_OPTIONS.map((o) => [o.value, o.label]),
    [
      ['reward', 'Highest reward'],
      ['lowest', 'Lowest reward'],
      ['prize', 'Biggest first prize'],
      ['submissions', 'Most submissions'],
      ['fewest', 'Fewest submissions'],
      ['active', 'Most active (24h)'],
      ['newest', 'Newest'],
      ['oldest', 'Oldest'],
      ['ending', 'Ending soon'],
      ['time-left', 'Most time left'],
    ],
  );
  for (const o of SORT_OPTIONS) assert.equal(isBoardSort(o.value), true, o.value);
  assert.equal(isBoardSort('volume'), false);
  assert.equal(isBoardSort(null), false);
});

test('sortBounties orders by each sort; ties break by reward desc, then deadline, then id', () => {
  const by = (sort: Parameters<typeof sortBounties>[1]) => ids(sortBounties(SORTABLE, sort, NOW));
  // r and s tie on reward: r has the nearer deadline. p and q tie on everything: id asc.
  assert.deepEqual(by('reward'), ['t', 'r', 's', 'p', 'q']);
  assert.deepEqual(by('lowest'), ['p', 'q', 'r', 's', 't']);
  // First prize: s pays its whole 8,000 to one winner, r's first place is 7,000, t's is 6,000.
  assert.deepEqual(by('prize'), ['s', 'r', 't', 'p', 'q']);
  // r and s tie on submissions and reward: nearer deadline (r) first.
  assert.deepEqual(by('submissions'), ['r', 's', 'p', 'q', 't']);
  assert.deepEqual(by('fewest'), ['t', 'p', 'q', 'r', 's']);
  // Last 24h: t has 3, s has 1 (its other two are older), the rest none and fall back to reward desc.
  assert.deepEqual(by('active'), ['t', 's', 'r', 'p', 'q']);
  assert.deepEqual(by('newest'), ['s', 'r', 'p', 'q', 't']);
  assert.deepEqual(by('oldest'), ['t', 'p', 'q', 'r', 's']);
  assert.deepEqual(by('ending'), ['r', 'p', 'q', 's', 't']);
  assert.deepEqual(by('time-left'), ['t', 's', 'p', 'q', 'r']);
});

test('topPrize and recentSubmissions', () => {
  const [q, r, , t, s] = SORTABLE;
  assert.deepEqual([q, r, t, s].map(topPrize), [5_000, 7_000, 6_000, 8_000]);
  assert.deepEqual([q, t, s].map((b) => recentSubmissions(b, NOW)), [0, 3, 1]);
  assert.equal(recentSubmissions(make('future', { submissions: [sub(-1)] }), NOW), 0, 'a submission after now does not count');
});

test('sortBounties: tie on the primary key falls back to reward desc', () => {
  const tied = [
    make('lo', { rewardAmount: 1_000, submissionCount: 7, publishedAt: new Date(NOW - H).toISOString() }),
    make('hi', { rewardAmount: 9_000, submissionCount: 7, publishedAt: new Date(NOW - H).toISOString() }),
  ];
  for (const sort of ['submissions', 'fewest', 'active', 'newest', 'oldest', 'ending', 'time-left'] as const) {
    assert.deepEqual(ids(sortBounties(tied, sort, NOW)), ['hi', 'lo'], sort);
  }
});

test('sortBounties is deterministic and pure', () => {
  for (const { value } of SORT_OPTIONS) {
    const forward = ids(sortBounties(SORTABLE, value));
    assert.deepEqual(ids(sortBounties([...SORTABLE].reverse(), value)), forward, `${value}: independent of incoming order`);
  }
  const before = ids(SORTABLE);
  const out = sortBounties(SORTABLE, 'fewest');
  assert.notEqual(out, SORTABLE, 'returns a new array');
  assert.deepEqual(ids(SORTABLE), before, 'input untouched');
  assert.deepEqual(sortBounties([], 'reward'), []);
});

test('tabDefaultSort: each tab starts in its own order', () => {
  assert.equal(tabDefaultSort('trending'), 'reward');
  assert.equal(tabDefaultSort('new'), 'newest');
  assert.equal(tabDefaultSort('ending'), 'ending');
  assert.equal(tabDefaultSort('Trading'), 'reward');
  for (const t of BOARD_TABS) assert.equal(isBoardSort(tabDefaultSort(t.id)), true, t.id);
});

test("a tab's default sort never changes what the tab shows", () => {
  // The real board at a fixed clock, plus the fixtures (full ties included) laid out highest reward first like the real board.
  const fixtures = sortBounties([...LIST, ...SORTABLE], 'reward');
  for (const [name, all] of [['board', buildBoard(NOW)], ['fixtures', fixtures]] as const) {
    for (const { id: tab } of BOARD_TABS) {
      const tabbed = selectBounties(all, tab, NOW);
      if (name === 'board' && (tab === 'trending' || tab === 'new' || tab === 'ending')) assert.ok(tabbed.length > 5, `${name}/${tab} is not vacuous`);
      assert.deepEqual(ids(sortBounties(tabbed, tabDefaultSort(tab))), ids(tabbed), `${name}/${tab}`);
    }
  }
});

test('option arrays: relabelled, same values in the same order', () => {
  assert.deepEqual(
    MIN_REWARD_OPTIONS.map((o) => [o.value, o.label]),
    [
      [0, 'Any reward'],
      [5_000, '$5,000+'],
      [10_000, '$10,000+'],
      [20_000, '$20,000+'],
    ],
  );
  assert.deepEqual(
    ENDS_WITHIN_OPTIONS.map((o) => [o.value, o.label]),
    [
      ['any', 'Any deadline'],
      ['24h', 'Ends in 24h'],
      ['7d', 'Ends in 7 days'],
      ['14d', 'Ends in 14 days'],
    ],
  );
  assert.deepEqual(COMPETITION_OPTIONS.map((o) => o.value), ['any', 'low']);
  assert.equal(MIN_REWARD_OPTIONS[0].value, DEFAULT_PANEL_FILTERS.minReward, 'the first option is the default');
  assert.equal(ENDS_WITHIN_OPTIONS[0].value, DEFAULT_PANEL_FILTERS.endsWithin);
});

test('sort is not a filter: it never moves activeFilterCount or isRefined', () => {
  for (const { value: sort } of SORT_OPTIONS) {
    const withSort = { ...DEFAULT_BOARD_FILTERS, sort };
    assert.equal(activeFilterCount(withSort), 0, sort);
    assert.equal(isRefined(withSort), false, sort);
    assert.equal(activeFilterCount({ ...withSort, competition: 'low' }), 1, sort);
    // Re-sorting the filtered list keeps exactly the same members.
    const filtered = applyBoardFilters(LIST, { ...DEFAULT_BOARD_FILTERS, minReward: 10_000 }, new Set(), NOW);
    assert.deepEqual(ids(sortBounties(filtered, sort)).sort(), ids(filtered).sort(), sort);
  }
});

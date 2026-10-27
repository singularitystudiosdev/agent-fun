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

const { BOARD_TABS, boardPath, DEFAULT_STATUS, DEFAULT_TAB, hasTab, isBoardStatus, selectBounties, statusCounts, tabCounts, tabsFor, WON_TABS } = await import('../src/lib/boardTabs.ts');
const { isSortFor, SORT_OPTIONS, sortBounties, sortOptionsFor, tabDefaultSort, WON_SORT_OPTIONS } = await import('../src/lib/boardFilters.ts');
const { buildBoard } = await import('../src/lib/bountyData.ts');
type BoardBounty = import('../src/lib/bounty.ts').BoardBounty;

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const DAY = 86_400_000;
const ids = (list: BoardBounty[]) => list.map((b) => b.id);

/** Today's live board, plus the same board built 60 days earlier with every deadline now in the past (ids prefixed "won-"). */
const LIVE = buildBoard(NOW);
const WON = buildBoard(NOW - 60 * DAY).map((b) => ({ ...b, id: `won-${b.id}`, slug: `won-${b.slug}` }));
const ALL = [...LIVE, ...WON];

test('fixtures: the live board is all open, the won board all ended', () => {
  assert.ok(LIVE.length >= 30 && LIVE.every((b) => Date.parse(b.deadline) > NOW));
  assert.ok(WON.length >= 18 && WON.every((b) => Date.parse(b.deadline) <= NOW));
});

test('BoardStatus: live is the default; only live and won parse', () => {
  assert.equal(DEFAULT_STATUS, 'live');
  assert.equal(isBoardStatus('live'), true);
  assert.equal(isBoardStatus('won'), true);
  for (const bad of ['Won', 'ended', '', null, undefined]) assert.equal(isBoardStatus(bad), false, String(bad));
});

test('tabsFor: Live keeps every tab; Won is Trending, Recently won, then the six categories', () => {
  assert.equal(tabsFor('live'), BOARD_TABS);
  assert.deepEqual(
    tabsFor('won').map((t) => [t.id, t.label]),
    [
      ['trending', 'Trending'],
      ['new', 'Recently won'],
      ['Trading', 'Trading'],
      ['Forecasting', 'Forecasting'],
      ['Security', 'Security'],
      ['Automation', 'Automation'],
      ['Growth', 'Growth'],
      ['Games', 'Games'],
    ],
  );
  assert.equal(tabsFor('won'), WON_TABS);
  assert.equal(hasTab('won', 'ending'), false, 'no Ending soon in Won');
  assert.equal(hasTab('live', 'ending'), true);
  for (const t of WON_TABS) assert.equal(hasTab('live', t.id), true, `${t.id} exists in Live too`);
});

test('boardPath: Live Trending is the bare board; status comes before tab', () => {
  assert.equal(boardPath('live', DEFAULT_TAB), '/');
  assert.equal(boardPath('live', 'new'), '/?tab=new');
  assert.equal(boardPath('won', 'trending'), '/?status=won');
  assert.equal(boardPath('won', 'Trading'), '/?status=won&tab=Trading');
});

test('selectBounties: Live behaves exactly as before on a mixed list (the default status)', () => {
  for (const { id: tab } of BOARD_TABS) {
    assert.deepEqual(ids(selectBounties(ALL, tab, NOW)), ids(selectBounties(LIVE, tab, NOW)), tab);
    assert.deepEqual(ids(selectBounties(ALL, tab, NOW, 'live')), ids(selectBounties(LIVE, tab, NOW)), tab);
  }
});

test('selectBounties: Won takes only bounties whose deadline has passed', () => {
  const trending = selectBounties(ALL, 'trending', NOW, 'won');
  assert.deepEqual(new Set(ids(trending)), new Set(ids(WON)));
  assert.ok(trending.every((b, i) => i === 0 || trending[i - 1].rewardAmount >= b.rewardAmount), 'highest reward first');
  const recent = selectBounties(ALL, 'new', NOW, 'won');
  assert.ok(recent.every((b, i) => i === 0 || Date.parse(recent[i - 1].deadline) >= Date.parse(b.deadline)), 'latest deadline first');
  const trading = selectBounties(ALL, 'Trading', NOW, 'won');
  assert.ok(trading.length > 0 && trading.every((b) => b.category === 'Trading' && Date.parse(b.deadline) <= NOW));
  // A bounty that ends exactly now has ended.
  const edge = { ...LIVE[0], id: 'edge', deadline: new Date(NOW).toISOString() };
  assert.deepEqual(ids(selectBounties([edge], 'trending', NOW, 'won')), ['edge']);
  assert.deepEqual(ids(selectBounties([edge], 'trending', NOW, 'live')), []);
});

test('tabCounts: per mode, only that mode\'s tabs', () => {
  const live = tabCounts(ALL, NOW, 'live');
  assert.deepEqual(Object.keys(live), BOARD_TABS.map((t) => t.id));
  assert.equal(live.trending, LIVE.length);
  assert.deepEqual(tabCounts(ALL, NOW), live, 'live is the default');
  const won = tabCounts(ALL, NOW, 'won');
  assert.deepEqual(Object.keys(won), WON_TABS.map((t) => t.id));
  assert.equal(won.trending, WON.length);
  assert.equal(won.new, WON.length);
  assert.equal(won.Trading, WON.filter((b) => b.category === 'Trading').length);
  assert.deepEqual(statusCounts(ALL, NOW), { live: LIVE.length, won: WON.length });
});

test('sortOptionsFor: Live keeps every sort; Won offers seven, deadline sorts renamed', () => {
  assert.equal(sortOptionsFor('live'), SORT_OPTIONS);
  assert.equal(sortOptionsFor(), SORT_OPTIONS);
  assert.equal(sortOptionsFor('won'), WON_SORT_OPTIONS);
  assert.deepEqual(
    WON_SORT_OPTIONS.map((o) => [o.value, o.label]),
    [
      ['reward', 'Highest reward'],
      ['lowest', 'Lowest reward'],
      ['prize', 'Biggest first prize'],
      ['submissions', 'Most submissions'],
      ['fewest', 'Fewest submissions'],
      ['time-left', 'Recently won'],
      ['ending', 'Won longest ago'],
    ],
  );
  assert.equal(isSortFor('won', 'active'), false);
  assert.equal(isSortFor('won', 'newest'), false);
  assert.equal(isSortFor('live', 'active'), true);
  assert.equal(isSortFor('won', null), false);
});

test("tabDefaultSort in Won: Recently won is time-left, the rest reward; the default never changes what a Won tab shows", () => {
  assert.equal(tabDefaultSort('new', 'won'), 'time-left');
  assert.equal(tabDefaultSort('trending', 'won'), 'reward');
  assert.equal(tabDefaultSort('Games', 'won'), 'reward');
  assert.equal(tabDefaultSort('new'), 'newest', 'live unchanged');
  for (const { id: tab } of WON_TABS) {
    const tabbed = selectBounties(ALL, tab, NOW, 'won');
    assert.ok(isSortFor('won', tabDefaultSort(tab, 'won')), tab);
    assert.deepEqual(ids(sortBounties(tabbed, tabDefaultSort(tab, 'won'))), ids(tabbed), tab);
  }
});

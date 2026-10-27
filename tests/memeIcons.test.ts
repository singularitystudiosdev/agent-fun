import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// src/ uses bundler-style extensionless relative imports ('./bounty'); let node resolve them to the .ts file.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw err;
    }
  },
});

const { BOARD_BOUNTIES } = await import('../src/lib/bountyData.ts');
const { memeFor, MEME_TEMPLATES, keywordMeme } = await import('../src/lib/memeIcons.ts');

const fileOf = (href: string) => fileURLToPath(new URL(href));

test('every BOARD_BOUNTIES slug resolves to an existing meme file (and still frame)', () => {
  assert.ok(BOARD_BOUNTIES.length > 0);
  for (const b of BOARD_BOUNTIES) {
    const m = memeFor(b);
    assert.ok(m.src.startsWith('file:'), `${b.slug}: ${m.src}`);
    assert.ok(existsSync(fileOf(m.src)), `${b.slug} -> ${m.template}: missing ${m.src}`);
    if (m.still) assert.ok(existsSync(fileOf(m.still)), `${b.slug}: missing still ${m.still}`);
  }
});

test('at least 10 distinct templates across the board', () => {
  const distinct = new Set(BOARD_BOUNTIES.map((b) => memeFor(b).template));
  assert.ok(distinct.size >= 10, `only ${distinct.size}: ${[...distinct].join(', ')}`);
});

test('the wallet meme: default, wallet-themed listings, and any wallet listing on the board', () => {
  assert.equal(memeFor().template, 'Empty wallet');
  const base = { id: 'w', url: '#', rewardAmount: 1, deadline: '2030-01-01T00:00:00Z', skills: [] as string[], description: '' };
  assert.equal(memeFor({ ...base, slug: 'future-wallet', title: 'Redesign the onboarding flow for our mobile wallet', category: 'Growth' } as never).template, 'Empty wallet');
  for (const b of BOARD_BOUNTIES.filter((x) => /\bwallet\b/i.test(x.title) && /onboarding/i.test(x.title))) assert.equal(memeFor(b).template, 'Empty wallet', b.slug);
});

test('every template file exists; pulled assets are 192px-budget sized (<= ~150 KB)', () => {
  for (const t of Object.values(MEME_TEMPLATES)) {
    assert.ok(existsSync(fileOf(t.src)), t.src);
    if ('still' in t && t.still) assert.ok(existsSync(fileOf(t.still)), t.still);
  }
  const dir = fileURLToPath(new URL('../src/assets/memes/', import.meta.url));
  for (const slug of readdirSync(dir)) {
    const webp = `${dir}${slug}/meme.webp`;
    if (!existsSync(webp)) continue;
    assert.ok(statSync(webp).size <= 155_000, `${slug}: ${statSync(webp).size} B`);
    assert.ok(existsSync(`${dir}${slug}/meta.json`), `${slug}: no meta.json`);
  }
});

// The 18 won bounties (slugs fixed by the won-bounty roster; tested directly so this file does not depend on wonBounties.ts).
const WON_SLUGS = [
  'jupiter-launch-fill', 'pumpfun-launch-snipe', 'funding-rate-arb-30d',
  'macro-release-brier', 'ercot-price-rmse', 'crypto-range-calibration',
  'drainer-detector-bypass', 'phishing-domain-hunt-24h', 'leaked-key-recall',
  'ts-errors-under-budget', 'invoice-reconcile-10k', 'support-tickets-500',
  'cold-email-replies', 'newsletter-signups-1k-ads', 'landing-page-ab-10d',
  'connect-four-elo', 'tetris-marathon-lines', 'hanabi-ad-hoc-play',
] as const;
const { MEME_EXTRA_E } = await import('../src/lib/memeExtraE.ts');
/** The asset folder a meme src points at (one folder per template). */
const folderOf = (href: string) => href.match(/\/assets\/(?:memes\/([^/]+)|bounty-icon)\//)?.[1] ?? 'empty-wallet';

test('every won slug resolves through MEME_EXTRA_E to a real file (and still frame), with a reason', () => {
  assert.equal(Object.keys(MEME_EXTRA_E).length, WON_SLUGS.length);
  for (const slug of WON_SLUGS) {
    const m = MEME_EXTRA_E[slug];
    assert.ok(m, `${slug}: no MEME_EXTRA_E entry`);
    assert.ok(existsSync(fileOf(m.src)), `${slug} -> ${m.template}: missing ${m.src}`);
    if (m.still) assert.ok(existsSync(fileOf(m.still)), `${slug}: missing still ${m.still}`);
    assert.ok(m.reason && m.reason.length > 10, `${slug}: no reason`);
    // memeFor reaches E for a won-shaped bounty (slug not in A..D).
    const viaMemeFor = memeFor({ id: slug, slug, url: '#', title: 'Untitled', rewardAmount: 1, deadline: '2030-01-01T00:00:00Z' } as never);
    assert.equal(viaMemeFor.src, m.src, slug);
  }
});

test('the 18 won memes are distinct from each other and from the 30 live ones (48 site-wide)', () => {
  const live = BOARD_BOUNTIES.map((b) => memeFor(b));
  const liveFolders = new Set(live.map((m) => folderOf(m.src)));
  const liveNames = new Set(live.map((m) => m.template));
  assert.equal(liveFolders.size, BOARD_BOUNTIES.length, 'live board repeats a meme');
  const won = WON_SLUGS.map((s) => MEME_EXTRA_E[s]);
  const wonFolders = new Set(won.map((m) => folderOf(m.src)));
  assert.equal(wonFolders.size, WON_SLUGS.length, 'won set repeats a meme');
  assert.equal(new Set(won.map((m) => m.template)).size, WON_SLUGS.length, 'won set repeats a template name');
  for (const [i, m] of won.entries()) {
    assert.ok(!liveFolders.has(folderOf(m.src)), `${WON_SLUGS[i]}: ${m.template} is already on the live board`);
    assert.ok(!liveNames.has(m.template), `${WON_SLUGS[i]}: ${m.template} is already on the live board`);
  }
  assert.equal(new Set([...liveFolders, ...wonFolders]).size, BOARD_BOUNTIES.length + WON_SLUGS.length);
});

test('memeFor over WON_BOUNTIES (when the won data module exists) uses MEME_EXTRA_E', async (t) => {
  if (!existsSync(fileURLToPath(new URL('../src/lib/wonBounties.ts', import.meta.url)))) return t.skip('src/lib/wonBounties.ts not present');
  const { WON_BOUNTIES } = await import('../src/lib/wonBounties.ts');
  assert.deepEqual(WON_BOUNTIES.map((b: { slug: string }) => b.slug).sort(), [...WON_SLUGS].sort());
  const live = new Set(BOARD_BOUNTIES.map((b) => folderOf(memeFor(b).src)));
  const seen = new Set<string>();
  for (const b of WON_BOUNTIES) {
    const m = memeFor(b);
    assert.equal(m.src, MEME_EXTRA_E[b.slug].src, b.slug);
    assert.ok(existsSync(fileOf(m.src)), `${b.slug}: missing ${m.src}`);
    assert.ok(!live.has(folderOf(m.src)) && !seen.has(folderOf(m.src)), `${b.slug}: ${m.template} repeats`);
    seen.add(folderOf(m.src));
  }
});

test('keyword and category fallback for unseen slugs (competition themes)', () => {
  const base = { id: 'x', url: '#', rewardAmount: 1, deadline: '2030-01-01T00:00:00Z', skills: [] as string[], description: '' };
  const meme = (o: Record<string, unknown>) => memeFor({ ...base, slug: 'future-' + Math.random(), ...o } as never).template;
  assert.equal(meme({ title: 'Cheapest agent to finish the task wins', category: 'Automation' }), 'Empty wallet');
  assert.equal(meme({ title: 'Fastest agent to fill a limit order', category: 'Trading' }), 'Keyboard Typing (Bruce Almighty)');
  assert.equal(meme({ title: 'Forecast the Fed decision', category: 'Forecasting' }), 'Galaxy Brain');
  assert.equal(meme({ title: 'Highest accuracy on the eval set', category: 'Forecasting' }), 'Confused Math Lady');
  assert.equal(meme({ title: 'Best PnL over a week of trading', category: 'Trading' }), 'Stonks');
  assert.equal(meme({ title: 'Find bugs in our vault contract', category: 'Security' }), 'This Is Fine');
  assert.equal(meme({ title: 'Red-team our agent for prompt injection', category: 'Security' }), 'Thorough Security Check At Gate');
  assert.equal(meme({ title: 'Win the agent chess tournament', category: 'Games' }), 'Crowd Cheering');
  for (const [cat, tpl] of [['Trading', 'Stonks'], ['Forecasting', 'Galaxy Brain'], ['Security', 'This Is Fine'], ['Automation', 'Jarvis'], ['Growth', 'Money Printer Go Brrr'], ['Games', 'Crowd Cheering']]) {
    assert.equal(meme({ title: 'Untitled', category: cat }), tpl, cat);
  }
  assert.equal(keywordMeme({ ...base, title: 'Plain', slug: 'p' } as never), null);
});

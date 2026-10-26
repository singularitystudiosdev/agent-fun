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

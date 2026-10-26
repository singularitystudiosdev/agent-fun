// End-to-end check of the agent.fun board toolbar: search, filter bar, sort/deadline/reward menus, saved.
// Run all suites: npm run e2e [-- <base url>]
// Run this one:   node tests/e2e/toolbar.mjs [base url, default http://localhost:5180/] [out dir, default .tmp/e2e/toolbar/]
// The base url is origin plus base path, e.g. http://localhost:5180/ or https://singularitystudiosdev.github.io/agent-fun/
// Needs a running app (npm run dev) and a local Chrome for playwright-core.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = process.argv[2] ?? 'http://localhost:5180/';
const OUT = process.argv[3] ?? fileURLToPath(new URL('../../.tmp/e2e/toolbar/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const HOME_PATH = new URL(BASE).pathname;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const cards = page.locator('#all-bounties ul > li');
const count = () => cards.count();
const settle = () => page.waitForTimeout(150);

await page.goto(BASE);
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('pm-card:favorite:')) localStorage.removeItem(k);
});
await page.reload();
await cards.first().waitFor();
const total = await count();
check('initial grid has 30 cards', total === 30, `${total}`);

// 1. Search via the toolbar icon
const searchBtn = page.getByRole('button', { name: 'Search bounties', exact: true }).last();
await searchBtn.click();
check('search button aria-expanded=true', (await searchBtn.getAttribute('aria-expanded')) === 'true');
const inline = page.locator('#all-bounties-search input');
check('inline search autofocused', await inline.evaluate((el) => el === document.activeElement));
await inline.fill('sharpe');
await settle();
check('icon search "sharpe" gives 1 card', (await count()) === 1, `${await count()}`);
check('URL has ?q=sharpe', new URL(page.url()).searchParams.get('q') === 'sharpe', page.url());
check('header field mirrors the query', (await page.locator('#board-search').inputValue()) === 'sharpe');
const summary = (await page.locator('#all-bounties [role=status]').innerText()).trim();
check('summary line says 1 bounty matches', /1 bounty matches/.test(summary), summary);
await page.screenshot({ path: `${OUT}/toolbar-search.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });
await page.getByRole('button', { name: 'Clear', exact: true }).click();
await settle();
check('Clear restores 30', (await count()) === 30, `${await count()}`);

// 2. Same through the header field
await page.locator('#board-search').fill('SHARPE');
await settle();
check('header search "SHARPE" gives 1 card', (await count()) === 1, `${await count()}`);
await page.getByRole('button', { name: 'Clear search' }).first().click();
await settle();
check('header clear (x) restores 30', (await count()) === 30, `${await count()}`);

// 3. Filter bar: the icon toggles polymarket's inline row (sort, deadline and reward dropdowns, a checkbox)
const filterBtn = page.locator('#all-bounties button[aria-label^="Filter bounties"]');
const bar = page.getByTestId('filter-bar');
const trig = (id) => page.locator(`[data-testid=${id}][aria-haspopup=menu], [data-testid=${id}] [aria-haspopup=menu]`).first();
const menu = page.locator('[role=menu]:visible');
const anim = () => page.waitForTimeout(350);
const deadlines = () => cards.evaluateAll((els) => els.map((el) => Date.parse(el.querySelector('time')?.getAttribute('datetime') ?? '')));
const rewardsNow = () => cards.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-reward'))));
const nonIncreasing = (a) => a.every((v, i) => i === 0 || a[i - 1] >= v);

check('filter bar starts closed and inert', (await bar.getAttribute('data-state')) === 'closed' && (await bar.evaluate((el) => el.inert || !!el.closest('[inert]'))));
await filterBtn.click();
await anim();
check('filter icon opens the bar, aria-expanded', (await bar.getAttribute('data-state')) === 'open' && (await filterBtn.getAttribute('aria-expanded')) === 'true');
const parts = await Promise.all(['filter-sort', 'filter-ends', 'filter-reward'].map((id) => trig(id).count()));
check('bar holds sort, deadline and reward dropdowns plus the checkbox', parts.every((n) => n === 1) && (await page.getByTestId('filter-low-competition').count()) === 1, parts.join(','));
check('sort defaults to Highest reward on Trending', /Highest reward/.test(await trig('filter-sort').innerText()));
await page.screenshot({ path: `${OUT}/toolbar-bar.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });

// sort menu, by mouse
await trig('filter-sort').click();
await settle();
const items = menu.getByRole('menuitemradio');
const checked = await menu.locator('[role=menuitemradio][aria-checked=true]').innerText().catch(() => '');
check('sort menu lists 10 options, Highest reward checked', (await items.count()) === 10 && /Highest reward/.test(checked), `${await items.count()} | ${checked}`);
const geo = await menu.evaluate((m) => {
  const r = m.getBoundingClientRect(), last = m.querySelector('[role=menuitemradio]:last-child').getBoundingClientRect();
  const hit = document.elementFromPoint(last.left + last.width / 2, last.top + last.height / 2);
  return { unclipped: m.contains(hit), inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
});
check('sort menu is not clipped and sits in the viewport', geo.unclipped && geo.inView, JSON.stringify(geo));
await page.screenshot({ path: `${OUT}/toolbar-sort-menu.png`, clip: { x: 0, y: 0, width: 1440, height: 760 } });
await items.filter({ hasText: 'Lowest reward' }).click();
await settle();
const low = await rewardsNow();
check('Lowest reward: smallest reward first', low.length === 30 && low.every((v, i) => i === 0 || low[i - 1] <= v), `${low[0]}..${low.at(-1)}`);
await page.goto(`${BASE}?sort=time-left`);
await cards.first().waitFor();
await filterBtn.click();
await anim();
const far = await deadlines();
check('?sort=time-left deep link: latest deadline first, trigger reads Most time left', far.every((v, i) => i === 0 || far[i - 1] >= v) && /Most time left/.test(await trig('filter-sort').innerText()));
await trig('filter-sort').click();
await settle();
await items.filter({ hasText: 'Ending soon' }).click();
await settle();
const ends = await deadlines();
check('Ending soon: menu closes, nearest deadline first', (await menu.count()) === 0 && ends.length === 30 && ends.every((v, i) => i === 0 || ends[i - 1] <= v));
check('sort trigger reads Ending soon', /Ending soon/.test(await trig('filter-sort').innerText()));

// reward menu, by mouse
await trig('filter-reward').click();
await menu.getByRole('menuitemradio', { name: '$20,000+' }).click();
await settle();
const rewards = await rewardsNow();
check('min reward 20,000 leaves only >= 20,000', rewards.length > 0 && rewards.every((r) => r >= 20_000), `${rewards.length} cards: ${rewards.join(',')}`);
await trig('filter-reward').click();
await menu.getByRole('menuitemradio', { name: 'Any reward' }).click();
await settle();
check('Any reward restores 30', (await count()) === 30, `${await count()}`);

// reward menu: any minimum typed into the field at the bottom
await trig('filter-reward').click();
await settle();
const field = page.getByTestId('filter-reward-custom');
await field.fill('7.5k');
await settle();
const typed = await rewardsNow();
check('typed "7.5k" filters live, menu stays open', typed.length > 0 && typed.length < 30 && typed.every((r) => r >= 7_500) && (await menu.count()) === 1, `${typed.length} cards`);
check('reward trigger reads $7,500+', /\$7,500\+/.test(await trig('filter-reward').innerText()));
await page.screenshot({ path: `${OUT}/toolbar-reward-custom.png`, clip: { x: 0, y: 0, width: 1440, height: 640 } });
await field.press('Enter');
await settle();
check('Enter in the field closes the menu, focus on the trigger', (await menu.count()) === 0 && (await trig('filter-reward').evaluate((el) => el === document.activeElement)));
await page.keyboard.press('ArrowDown');
await settle();
check('keyboard reopen lands in the field showing 7,500', (await field.evaluate((el) => el === document.activeElement)) && (await field.inputValue()) === '7,500');
await field.fill('');
await settle();
check('clearing the field returns to Any reward', (await count()) === 30 && /Any reward/.test(await trig('filter-reward').innerText()));
await page.keyboard.press('Escape');
await settle();

// deadline menu, by keyboard only
await trig('filter-ends').focus();
await page.keyboard.press('Enter');
await settle();
const focusedChecked = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitemradio' && document.activeElement?.getAttribute('aria-checked') === 'true');
check('Enter opens the deadline menu on the checked item', (await menu.count()) === 1 && focusedChecked);
// Two steps down: "Ends in 7 days". The board has no bounty under 24h, so 24h would pass on an empty grid.
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await settle();
const left = (await deadlines()).map((d) => d - Date.now());
check('keyboard pick "Ends in 7 days" narrows to deadlines inside 7 days', left.length > 0 && left.length < 30 && left.every((ms) => ms > 0 && ms <= 7 * 86_400_000), `${left.length} cards`);
check('focus returns to the deadline trigger', await trig('filter-ends').evaluate((el) => el === document.activeElement));
await page.keyboard.press('Enter');
await settle();
await page.keyboard.press('Escape');
await settle();
check('Escape closes the menu, focus back on trigger', (await menu.count()) === 0 && (await trig('filter-ends').evaluate((el) => el === document.activeElement)));
await trig('filter-ends').click();
await settle();
await page.mouse.click(1300, 860);
await settle();
check('outside click closes the menu', (await menu.count()) === 0);

// checkbox
const before = await count();
await page.getByTestId('filter-low-competition').check();
await settle();
check('Under 25 submissions narrows the list', (await count()) <= before && (await page.getByTestId('filter-low-competition').isChecked()));

// close the bar: the badge carries the active count
await filterBtn.click();
await anim();
check('icon closes the bar', (await bar.getAttribute('data-state')) === 'closed' && (await filterBtn.getAttribute('aria-expanded')) === 'false');
check('filter badge shows 2 (deadline + competition)', (await page.getByTestId('filter-count').innerText()).trim() === '2');
await page.screenshot({ path: `${OUT}/toolbar-filter.png`, clip: { x: 0, y: 0, width: 1440, height: 640 } });
await page.getByRole('button', { name: 'Clear', exact: true }).click();
await settle();
check('Clear restores 30 and keeps the sort', (await count()) === 30 && (await page.getByTestId('filter-count').count()) === 0 && /Ending soon/.test(await trig('filter-sort').innerText()));

// a header tab resets the sort to that tab's own order
await page.getByRole('navigation', { name: 'Bounty tabs' }).locator('a[data-tab=new]').click();
await settle();
await filterBtn.click();
await anim();
check('New tab resets sort to Newest', /Newest/.test(await trig('filter-sort').innerText()));
await page.getByRole('navigation', { name: 'Bounty tabs' }).locator('a[data-tab=trending]').click();
await settle();
check('Trending tab: Highest reward, reward descending', /Highest reward/.test(await trig('filter-sort').innerText()) && nonIncreasing(await rewardsNow()));
await filterBtn.click();
await anim();

// phone: the bar wraps and the menu stays on screen
{
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(BASE);
  await mp.locator('#all-bounties ul > li').first().waitFor();
  await mp.locator('#all-bounties button[aria-label^="Filter bounties"]').click();
  await mp.waitForTimeout(350);
  await mp.locator('[data-testid=filter-sort][aria-haspopup=menu], [data-testid=filter-sort] [aria-haspopup=menu]').first().click();
  await mp.waitForTimeout(200);
  const r = await mp.locator('[role=menu]:visible').evaluate((m) => { const b = m.getBoundingClientRect(); return { l: b.left, r: b.right, w: innerWidth }; });
  check('390px: sort menu stays on screen', r.l >= 0 && r.r <= r.w, JSON.stringify(r));
  await mp.screenshot({ path: `${OUT}/toolbar-390.png` });
  await mctx.close();
}

// 4. Saved: bookmark 2 cards, toggle Saved
const picked = [];
for (const i of [3, 7]) {
  const li = cards.nth(i);
  picked.push(await li.locator('a').first().getAttribute('href'));
  await li.hover();
  await li.getByRole('button', { name: 'Add to favorites' }).click();
}
const savedBtn = page.getByRole('button', { name: 'Saved bounties' });
await savedBtn.click();
await settle();
const savedHrefs = await cards.evaluateAll((els) => els.map((el) => el.querySelector('a')?.getAttribute('href')));
check('Saved shows exactly the 2 bookmarked', savedHrefs.length === 2 && picked.every((h) => savedHrefs.includes(h)), savedHrefs.join(' | '));
check('Saved aria-pressed=true', (await savedBtn.getAttribute('aria-pressed')) === 'true');
await page.screenshot({ path: `${OUT}/toolbar-saved.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });
// unbookmark one live
await cards.first().hover();
await cards.first().getByRole('button', { name: 'Remove from favorites' }).click();
await settle();
check('unbookmarking under Saved drops it live', (await count()) === 1, `${await count()}`);
// empty state
await inline.isVisible().catch(() => false);
await page.locator('#board-search').fill('zzzz-nothing');
await settle();
const empty = page.locator('#all-bounties', { hasText: 'No bounties match these filters.' });
check('empty state shown', (await empty.count()) === 1);
await page.getByRole('button', { name: 'Clear filters' }).click();
await settle();
check('Clear filters restores 30', (await count()) === 30, `${await count()}`);
check('Saved toggled off by clear', (await savedBtn.getAttribute('aria-pressed')) === 'false');
check('URL q removed', !new URL(page.url()).searchParams.has('q'), page.url());

// 5. Header search on a bounty page navigates home
await cards.first().locator('a').first().click();
await page.waitForURL(/\/bounty\//);
await page.locator('#board-search').click();
await page.keyboard.type('sharpe');
await settle();
check('typing on bounty page goes home', new URL(page.url()).pathname === HOME_PATH, page.url());
check('home shows 1 result after typing on bounty page', (await count()) === 1, `${await count()}`);
check('header field kept focus', await page.locator('#board-search').evaluate((el) => el === document.activeElement));
await page.locator('#board-search').fill('');
await settle();
check('final clear restores 30', (await count()) === 30, `${await count()}`);

// ?q= deep link
await page.goto(`${BASE}?q=sharpe`);
await cards.first().waitFor();
check('?q=sharpe deep link gives 1', (await count()) === 1, `${await count()}`);

check('no page errors', errors.length === 0, errors.join(' / '));
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('pm-card:favorite:')) localStorage.removeItem(k);
});
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

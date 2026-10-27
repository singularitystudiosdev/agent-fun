// End-to-end check of the agent.fun profile.
// Run all suites: npm run e2e [-- <base url>]
// Run this one:   node tests/e2e/profile.mjs [base url, default http://localhost:5180/] [out dir, default .tmp/e2e/profile/]
// The base url is origin plus base path, e.g. http://localhost:5180/ or https://singularitystudiosdev.github.io/agent-fun/
// Needs a running app (npm run dev) and a local Chrome for playwright-core.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const BASE = process.argv[2] ?? 'http://localhost:5180/';
const OUT = process.argv[3] ?? fileURLToPath(new URL('../../.tmp/e2e/profile/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const HOME_PATH = new URL(BASE).pathname;
const PROFILE_PATH = `${HOME_PATH}profile`;
const PFP = fileURLToPath(new URL('../../src/assets/bounty-icon/empty-wallet-still.png', import.meta.url));
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`); };
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
// GitHub Pages serves deep links (/agent-fun/profile) through 404.html: the app loads, the document status is 404.
// Those page-load 404s are expected; any other failed request is still an error.
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource: .*404/.test(m.text()) && errors.push(m.text()));
p.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && !r.url().includes('favicon') && errors.push(`${r.status()} ${r.url()}`));
const tid = (id) => p.getByTestId(id);
const settle = (ms = 250) => p.waitForTimeout(ms);
const imgSrcs = () => p.$$eval('[data-testid=profile-page] img', (imgs) => imgs.map((i) => i.currentSrc || i.src));
const letterAvatars = () =>
  p.$$eval('[class*="rounded-full"]', (els) => els.filter((el) => /^[A-Za-z]{1,2}$/.test((el.textContent ?? '').trim()) && el.children.length === 0).map((el) => el.textContent.trim()));

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('agent-fun:')) localStorage.removeItem(k); });
await p.reload({ waitUntil: 'networkidle' });

// header: Help stays, the menu icon is now your avatar, a plain link to /profile
const avatar = tid('header-avatar');
ok('header avatar is a link to /profile', (await avatar.evaluate((el) => el.tagName)) === 'A' && (await avatar.getAttribute('href')).endsWith('/profile') && (await avatar.getAttribute('aria-label')) === 'Your profile');
ok('menu and help icons are gone, the avatar is the only control', (await p.locator('header [aria-label="Menu"]').count()) === 0 && (await p.locator('header [aria-label="Help"]').count()) === 0);
ok('header avatar is not a letter', flat(await avatar.innerText()) === '');
await p.screenshot({ path: `${OUT}/header.png`, clip: { x: 0, y: 0, width: 1440, height: 120 } });

// click: in-place navigation to the profile
await p.evaluate(() => { window.__noReload = true; });
await avatar.click();
await tid('profile-page').waitFor();
ok('avatar click opens /profile without a reload', new URL(p.url()).pathname === PROFILE_PATH && (await p.evaluate(() => window.__noReload === true)), new URL(p.url()).pathname);
ok('avatar marked current on the profile', (await avatar.getAttribute('aria-current')) === 'page');
ok('page title names you', /Adrian \(@adrian\) \| agent\.fun/.test(await p.title()), await p.title());
ok('no header tab is current on the profile', (await p.locator('nav[aria-label="Bounty tabs"] [aria-current="page"]').count()) === 0);

// identity and stats
ok('identity: display name, handle, joined', flat(await tid('profile-display-name').innerText()) === 'Adrian' && /@adrian/.test(await tid('profile-handle').innerText()) && /Joined \w{3} \d{4}/.test(await tid('profile-joined').innerText()));
ok('profile picture is not a letter', flat(await tid('profile-avatar').innerText()) === '');
const stats = flat(await tid('profile-stats').innerText());
ok('stats: prizes on track, biggest win, bounties entered', /Prizes on track/i.test(stats) && /Biggest win/i.test(stats) && /Bounties entered/i.test(stats) && /\$[\d,]+/.test(stats), stats);
ok('total earned and best finish', /\+\$[\d,]+/.test(await tid('profile-total-earned').innerText()) && /#\d+ of \d+/.test(await tid('profile-best-finish').innerText()));
ok('earnings card with a total', /\$[\d,]+/.test(await tid('profile-earnings-total').innerText()));

// earnings chart: hovering reads the amount at that time
{
  const dollars = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const total = flat(await tid('profile-earnings-total').innerText());
  const box = await tid('profile-earnings-chart').boundingBox();
  await p.mouse.move(box.x + box.width * 0.98, box.y + box.height / 2);
  await settle(150);
  const tip = flat(await tid('profile-earnings-tooltip').innerText().catch(() => ''));
  const late = flat(await tid('profile-earnings-total').innerText());
  ok('hovering the chart shows the amount and date in a tooltip', /\$[\d,]+/.test(tip) && /\d{4}/.test(tip) && dollars(tip.split(/\s/)[0]) === dollars(late), `${tip} | big number ${late}`);
  await p.mouse.move(box.x + 3, box.y + box.height / 2);
  await settle(150);
  const early = flat(await tid('profile-earnings-total').innerText());
  ok('an earlier point reads a smaller amount', dollars(early) < dollars(late), `${early} < ${late}`);
  await p.mouse.move(box.x + box.width / 2, box.y - 80);
  await settle(150);
  ok('leaving the chart restores the total', (await tid('profile-earnings-hover').count()) === 0 && flat(await tid('profile-earnings-total').innerText()) === total && /All time/.test(await tid('profile-earnings-label').innerText()));
}
await p.screenshot({ path: `${OUT}/profile-active.png`, fullPage: true });

// the switch: Live bounties | Won bounties | Activity, large labels, the selected one underlined by a thick bar
const tabNames = await p.$$eval('[role=tablist][aria-label="Profile sections"] [role=tab]', (tabs) => tabs.map((t) => t.textContent.replace(/\d+/g, '').trim()));
ok('tabs read Live bounties, Won bounties, Activity', JSON.stringify(tabNames) === JSON.stringify(['Live bounties', 'Won bounties', 'Activity']), tabNames.join(' | '));
const underline = () =>
  p.$eval('[role=tablist][aria-label="Profile sections"] [role=tab][aria-selected=true]', (el) => {
    const bar = getComputedStyle(el, '::after');
    return { id: el.id, bar: parseFloat(bar.height), barWidth: Math.round(parseFloat(bar.width)), tabWidth: Math.round(el.getBoundingClientRect().width), font: parseFloat(getComputedStyle(el).fontSize) };
  });
const u0 = await underline();
ok('Live bounties is selected first, large label, thick full-width underline', u0.id === 'profile-tab-live' && u0.bar >= 3 && u0.barWidth >= u0.tabWidth - 1 && u0.font >= 18, JSON.stringify(u0));
ok('the small Active/Ended toggle is gone', (await p.locator('[data-testid^="profile-status-"]').count()) === 0);

// active entries: one row per bounty, live ranks, links to the bounty
const active = tid('profile-active-row');
const nActive = await active.count();
const ranks = await active.evaluateAll((rows) => rows.map((r) => r.getAttribute('data-rank')).filter(Boolean).map(Number));
const states = await active.evaluateAll((rows) => rows.map((r) => r.getAttribute('data-state')));
ok('active entries listed with ranks', nActive >= 3 && ranks.includes(1) && states.includes('inflight'), `${nActive} rows, ranks ${ranks.join(',')}, states ${states.join(',')}`);
ok('active rank copy reads "#k of N"', /#\d+ of \d+/.test(await tid('profile-active-rank').first().innerText()));
const srcs = await imgSrcs();
ok('no meme repeats on the profile', new Set(srcs).size === srcs.length, `${srcs.length} images`);
ok('no letter avatars on the profile', (await letterAvatars()).length === 0, (await letterAvatars()).join(','));

// search and its empty state
await p.locator('[data-testid=profile-search] input, input[data-testid=profile-search]').first().fill('zzzz-no-such');
await settle();
ok('search with no match shows one sentence and one action', (await tid('profile-empty').count()) === 1 && (await tid('profile-empty').getByRole('button').count()) >= 1);
await p.locator('[data-testid=profile-search] input, input[data-testid=profile-search]').first().fill('');
await settle();

// won bounties: every prize finish, all at once
await tid('profile-tab-won').click();
await settle();
const u1 = await underline();
ok('Won bounties takes the thick underline', u1.id === 'profile-tab-won' && u1.bar >= 3, JSON.stringify(u1));
const won = tid('profile-won-row');
const wonRows = await won.evaluateAll((rows) => rows.map((r) => ({ result: r.getAttribute('data-result'), text: r.innerText.replace(/\s+/g, ' ') })));
const wonBadge = Number((await tid('profile-tab-won').innerText()).match(/\d+/)?.[0] ?? -1);
ok('Won lists every prize finish, all at once', wonRows.length >= 2 && wonRows.length === wonBadge && wonRows.every((r) => r.result === 'won' || r.result === 'placed') && (await tid('profile-show-more').count()) === 0, `${wonRows.map((r) => r.result).join(',')} (tab badge ${wonBadge})`);
ok('every won row shows its final rank and payout', wonRows.every((r) => /#\d+ of \d+/.test(r.text) && /\+\$[\d,]+/.test(r.text)));
const paidSum = wonRows.reduce((s, r) => s + Number((r.text.match(/\+\$([\d,]+)/)?.[1] ?? '0').replace(/,/g, '')), 0);
const earned = Number((await tid('profile-total-earned').innerText()).replace(/[^\d]/g, ''));
ok('won payouts add up to Total earned', paidSum === earned, `${paidSum} vs ${earned}`);
ok('past wins show medals, not memes', (await p.$$eval('[data-testid=profile-won-row]:not([data-slug]) img', (i) => i.length)) === 0);
await p.screenshot({ path: `${OUT}/profile-won.png`, fullPage: true });

// activity
await tid('profile-tab-activity').click();
await settle();
const nAct = await tid('profile-activity-row').count();
const more = tid('profile-show-more');
if (await more.count()) { await more.click(); await settle(); }
ok('activity feed pages with Show more', nAct >= 5 && (await tid('profile-activity-row').count()) >= nAct, `${nAct} then ${await tid('profile-activity-row').count()}`);
ok('activity has no images', (await p.$$eval('[data-testid=profile-activity-row] img', (i) => i.length)) === 0);
const finished = await p.$$eval('[data-testid=profile-activity-row][data-kind=finished]', (rows) => rows.length);
ok('unplaced finishes stay visible in Activity', finished > wonRows.length, `${finished} finished rows, ${wonRows.length} wins`);
await tid('profile-tab-live').click();
await settle();

// a row opens its bounty
const firstSlug = await active.first().getAttribute('data-slug');
await active.first().locator('a').first().click().catch(async () => active.first().click());
await p.waitForURL(/\/bounty\//);
ok('an active row opens its bounty', p.url().includes(`/bounty/${firstSlug}`), new URL(p.url()).pathname);
const youRows = await p.$$eval('[data-testid=live-submissions] li', (lis) => lis.filter((li) => /\(you\)/.test(li.innerText)).length).catch(() => 0);
ok('that bounty shows your entry as (you)', youRows >= 1, `${youRows} rows`);
await p.goBack();
await tid('profile-page').waitFor();

// edit profile: validation, save, live update, persistence
await tid('profile-edit-button').click();
const dialog = tid('profile-edit');
await dialog.waitFor();
ok('edit dialog opens', await dialog.evaluate((d) => d.open === true || d.hasAttribute('open')));
await tid('profile-edit-handle').fill('AB');
await tid('profile-edit-save').click().catch(() => {});
await settle();
ok('bad handle is rejected with the exact message', /Use 3 to 20 lowercase letters, numbers or underscores\./.test(await dialog.innerText()));
await tid('profile-edit-handle').fill('adrian_k');
await tid('profile-edit-display-name').fill('Adrian K');
await tid('profile-edit-pfp-upload').locator('input[type=file]').first().setInputFiles(PFP).catch(async () => p.locator('[data-testid=profile-edit] input[type=file]').first().setInputFiles(PFP));
await settle(800);
await dialog.screenshot({ path: `${OUT}/edit-dialog.png` });
await tid('profile-edit-save').click();
await settle(400);
ok('save closes the dialog', !(await dialog.evaluate((d) => d.open === true).catch(() => false)));
ok('identity updates live', flat(await tid('profile-display-name').innerText()) === 'Adrian K' && /@adrian_k/.test(await tid('profile-handle').innerText()));
const pfpSrc = await p.locator('[data-testid=profile-avatar] img, img[data-testid=profile-avatar]').first().getAttribute('src').catch(() => null);
ok('uploaded picture shows on the profile', /^data:image\/(webp|jpeg)/.test(pfpSrc ?? ''), (pfpSrc ?? '').slice(0, 24));
ok('header avatar shows the new picture', /^data:image\//.test((await avatar.locator('img').first().getAttribute('src').catch(() => '')) ?? ''));
await p.reload({ waitUntil: 'networkidle' });
ok('profile edits survive a reload', flat(await tid('profile-display-name').innerText()) === 'Adrian K' && /Adrian K \(@adrian_k\)/.test(await p.title()));
await p.screenshot({ path: `${OUT}/profile-edited.png` });

// chat posts as you
await p.goto(new URL('bounty/sol-perps-sharpe-14d', BASE).href, { waitUntil: 'networkidle' });
const ta = p.locator('[data-testid=bounty-chat] textarea');
await ta.fill('Is the 14 day window measured in UTC?');
await ta.press('Enter');
await settle(400);
ok('chat posts under your handle', (await p.locator('[data-testid=chat-message-you]').count()) >= 1 && /adrian_k/.test(await p.locator('[data-testid=bounty-chat]').innerText()));

// deep link and phone
await p.goto(`${new URL(BASE).origin}${PROFILE_PATH}`, { waitUntil: 'networkidle' });
ok('deep link to /profile renders', (await tid('profile-page').count()) === 1);
const text = await p.evaluate(() => document.body.innerText);
ok('no em dashes on the profile', !text.includes('—'));
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const pm = await m.newPage();
await pm.goto(`${new URL(BASE).origin}${PROFILE_PATH}`, { waitUntil: 'networkidle' });
const overflow = await pm.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok('390px: no horizontal overflow, avatar in the header', overflow <= 1 && (await pm.getByTestId('header-avatar').isVisible()), `${overflow}px`);
await pm.screenshot({ path: `${OUT}/profile-390.png`, fullPage: true });
await m.close();

ok('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('agent-fun:')) localStorage.removeItem(k); });
await b.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

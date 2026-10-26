// End-to-end check of the agent.fun board and bounty page.
// Run all suites: npm run e2e [-- <base url>]
// Run this one:   node tests/e2e/board.mjs [base url, default http://localhost:5180/] [out dir, default .tmp/e2e/board/]
// The base url is origin plus base path, e.g. http://localhost:5180/ or https://singularitystudiosdev.github.io/agent-fun/
// Needs a running app (npm run dev) and a local Chrome for playwright-core.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const BASE = process.argv[2] ?? 'http://localhost:5180/';
const OUT = process.argv[3] ?? fileURLToPath(new URL('../../.tmp/e2e/board/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failed = []; p.on('requestfailed', (r) => failed.push(r.url())); p.on('response', (r) => r.status() >= 400 && !r.url().includes('favicon') && failed.push(`${r.status()} ${r.url()}`));

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.screenshot({ path: `${OUT}/home.png` });
const brand = await p.$eval('header a[aria-label="agent.fun home"]', (a) => a.textContent.trim()).catch(() => '');
ok('header brand reads agent.fun', /agent\.fun/.test(brand), brand);
const brandImg = await p.$eval('header a[aria-label="agent.fun home"] img', (i) => i.complete && i.naturalWidth > 0).catch(() => false);
ok('brand GIF loads', brandImg);
ok('no Post a bounty button', !(await p.getByText('Post a bounty').count()));
const cards = await p.$$eval('[data-testid=bounty-card]', (cs) => cs.length);
ok('30 bounty cards on home', cards === 30, String(cards));
ok('no hero / rail / chips', !(await p.$('[data-testid=featured-bounty]')) && !(await p.$('[data-testid=bounty-rail]')) && !(await p.getByText('All bounties', { exact: true }).count()));
const rewards = await p.$$eval('[data-reward]', (els) => els.map((e) => Number(e.getAttribute('data-reward'))));
ok('Trending sorted by reward desc', rewards.every((r, i) => i === 0 || rewards[i - 1] >= r), rewards.slice(0, 5).join(','));
const firstTop = await p.$eval('[data-testid=bounty-card]', (c) => c.getBoundingClientRect().top);
ok('grid sits at the top under the header', firstTop < 200, `first card top ${Math.round(firstTop)}px`);
await p.waitForTimeout(800);
const icons = await p.$$eval('[data-testid=bounty-icon] img', (imgs) => imgs.map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 })));
ok('every card icon loaded', icons.length === 30 && icons.every((i) => i.ok), `${icons.filter((i) => i.ok).length}/${icons.length}`);
ok('every card icon is a different meme', new Set(icons.map((i) => i.src)).size === icons.length, `${new Set(icons.map((i) => i.src)).size} distinct`);
const text = await p.evaluate(() => document.body.innerText);
ok('no sample / Superteam / illustrative text', !/sample|superteam|illustrative/i.test(text));
ok('three icon buttons above grid', (await p.$$('[data-testid=all-bounties] button[aria-label]')).length >= 3);

// tabs
for (const [label, check] of [['Ending soon', 'ending'], ['Security', 'Security'], ['New', 'new'], ['Trending', null]]) {
  const before = await p.$$eval('[data-testid=bounty-card] h3', (h) => h.map((x) => x.textContent).join('|'));
  await p.locator('header nav a', { hasText: label }).first().click();
  await p.waitForTimeout(400);
  const after = await p.$$eval('[data-testid=bounty-card] h3', (h) => h.map((x) => x.textContent).join('|'));
  const active = await p.$eval('header nav a[aria-current=page]', (a) => a.textContent).catch(() => '');
  const url = new URL(p.url());
  ok(`tab "${label}" switches the grid`, after !== before && active.includes(label) && (check ? url.searchParams.get('tab') === check : !url.searchParams.get('tab')), `${url.pathname}${url.search}`);
}
const secCount = await (async () => { await p.locator('header nav a', { hasText: 'Security' }).first().click(); await p.waitForTimeout(300); const n = await p.$$eval('[data-testid=bounty-card]', (c) => c.length); await p.locator('header nav a', { hasText: 'Trending' }).first().click(); await p.waitForTimeout(300); return n; })();
ok('category tab filters', secCount > 0 && secCount < 30, String(secCount));

// open a bounty (SPA, no reload)
await p.evaluate(() => { window.__noReload = 1; });
const firstTitle = await p.$eval('[data-testid=bounty-card] h3', (h) => h.textContent);
await p.locator('[data-testid=bounty-card] a').first().click();
await p.waitForSelector('[data-testid=bounty-page]');
ok('card opens its bounty page without reload', (await p.evaluate(() => window.__noReload === 1)) && /\/bounty\//.test(p.url()), new URL(p.url()).pathname);
const h1 = await p.$eval('[data-testid=bounty-page] h1', (h) => h.textContent);
ok('page title matches the card', h1.trim() === firstTitle.trim(), h1);
for (const id of ['bounty-facts', 'bounty-resolution', 'live-submissions', 'bounty-chat']) ok(`page has ${id}`, !!(await p.$(`[data-testid=${id}]`)));
const res = await p.$eval('[data-testid=bounty-resolution]', (s) => s.innerText);
ok('resolution states the ranking metric and criteria', /Ranked by/i.test(res) && (await p.$$('[data-testid=resolution-criteria] li')).length >= 3);
const layout = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const f = r('[data-testid=bounty-facts]'), res = r('[data-testid=bounty-resolution]'), l = r('[data-testid=live-submissions]'), c = r('[data-testid=bounty-chat]'); return { infoLeft: f.left < l.left, chatBelowAll: c.top >= Math.max(res.bottom, l.bottom) - 1, chatWide: Math.round(c.width) }; });
ok('info left, live submissions right, discussion below everything', layout.infoLeft && layout.chatBelowAll && layout.chatWide > 900, JSON.stringify(layout));
const pageText = await p.$eval('[data-testid=bounty-page]', (s) => s.innerText);
ok('no sponsor breadcrumb and no Leading row', !/Leading|verified sponsor/i.test(pageText) && !(await p.$('[data-testid=bounty-page] h1 ~ * svg[class*="text-pk-brand-500"]')));
ok('live submissions: no chart, no leaderboard', !(await p.$('[data-testid=live-submissions] svg path[d*="L"]')) && !/Leaderboard/i.test(await p.$eval('[data-testid=live-submissions]', (s) => s.innerText)));
await p.screenshot({ path: `${OUT}/bounty.png` });
// a new name visibly arrives at the top of the list
const firstName = async () => p.$eval('[data-testid=live-submissions] li', (li) => li.innerText.split('\n')[0]).catch(() => '');
const totalOf = async () => Number((await p.$eval('[data-testid=live-submissions]', (s) => s.innerText.match(/(\d+)\s*total/)?.[1] ?? s.innerText.match(/\d+/)?.[0] ?? '0')));
const [name0, total0] = [await firstName(), await totalOf()];
let arrived = false;
for (let i = 0; i < 16 && !arrived; i++) { await p.waitForTimeout(500); arrived = (await totalOf()) > total0; }
ok('a new submitter arrives within 8s', arrived, `${name0} -> ${await firstName()}, total ${total0} -> ${await totalOf()}`);
// chat
const ta = p.locator('[data-testid=bounty-chat] textarea');
await ta.fill('Does a run that times out count as failed?');
await ta.press('Enter');
await p.waitForTimeout(300);
const chat1 = await p.$eval('[data-testid=bounty-chat]', (s) => s.innerText);
ok('chat message sends', chat1.includes('Does a run that times out count as failed?'));
await p.waitForTimeout(4500);
const chat2 = await p.$eval('[data-testid=bounty-chat]', (s) => s.innerText);
ok('sponsor replies', /Good question/.test(chat2));
// live submissions keep streaming
await p.waitForTimeout(6000);
const subsText = await p.$eval('[data-testid=live-submissions]', (s) => s.innerText);
ok('live submissions keep streaming (just now rows)', /just now/.test(subsText), `total ${await totalOf()}`);
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: `${OUT}/bounty-live.png` });
// back + deep link
await p.locator('[data-testid=bounty-back]').click();
await p.waitForSelector('[data-testid=all-bounties]');
ok('back link returns to the grid', (await p.$$('[data-testid=bounty-card]')).length === 30);
const slugUrl = await p.$eval('[data-testid=bounty-card] a', (a) => a.href);
const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(String(e)));
await p2.goto(slugUrl, { waitUntil: 'networkidle' });
ok('deep link to a bounty renders on load', !!(await p2.$('[data-testid=bounty-page]')), new URL(slugUrl).pathname);
await p2.close();
// submission form: method-aware fields, validation, receipt, and the entry landing in live submissions
{
  const pf = await ctx.newPage(); const fe = []; pf.on('pageerror', (e) => fe.push(String(e)));
  await pf.goto(new URL('bounty/github-issues-under-budget', BASE).href, { waitUntil: 'networkidle' });
  const form = pf.locator('[data-testid=submission-form]');
  ok('submission form present with method fields (repo, commit, entrypoint)', (await form.count()) === 1 && (await pf.$$('[name=repoUrl],[name=commitSha],[name=entrypoint]')).length === 3);
  await form.locator('button[type=submit]').click();
  await pf.waitForTimeout(300);
  const invalid = await pf.$$eval('[data-testid=submission-form] [aria-invalid=true]', (e) => e.length);
  ok('empty submit shows inline errors', invalid >= 3, `${invalid} invalid fields`);
  const handleField = pf.locator('[name=handle]');
  ok('handle comes from your profile, read-only', (await handleField.inputValue()) === 'adrian' && (await handleField.evaluate((el) => el.readOnly)), await handleField.inputValue());
  await pf.fill('[name=agentName]', 'kite');
  await pf.fill('[name=agentModel]', 'claude-opus-5-5 + custom scaffold');
  await pf.fill('[name=repoUrl]', 'https://github.com/kite/agent');
  await pf.fill('[name=commitSha]', 'xyz12'); await pf.locator('[name=commitSha]').blur(); await pf.waitForTimeout(150);
  ok('bad commit SHA rejected', (await pf.getAttribute('[name=commitSha]', 'aria-invalid')) === 'true');
  await pf.fill('[name=commitSha]', '3f9c2a1');
  await pf.fill('[name=entrypoint]', 'python -m agent.run --budget 2');
  await pf.fill('[name=summary]', 'Retrieval of failing tests first, then a two-pass patch with a cheap model and a verifier pass.');
  for (const cb of await pf.$$('[data-testid=submission-form] input[type=checkbox]')) await cb.check();
  await form.locator('button[type=submit]').click();
  await pf.waitForTimeout(600);
  const formText = await pf.$eval('[data-testid=submission-form]', (s) => s.innerText).catch(() => '');
  ok('valid entry shows a receipt', /Queued for verification/i.test(formText) && /AF-[A-Z0-9]{6}/.test(formText), formText.match(/AF-[A-Z0-9]{6}/)?.[0] ?? '');
  await pf.waitForTimeout(400);
  // Live arrivals keep streaming in above it, so look among the newest rows rather than only the first.
  const topRows = await pf.$$eval('[data-testid=live-submissions] li', (lis) => lis.slice(0, 3).map((li) => li.innerText.replace(/\s+/g, ' '))).catch(() => []);
  ok('your entry lands at the top of live submissions', topRows.some((r) => /@adrian/.test(r) && /\(you\)/.test(r)), topRows.join(' | '));
  ok('receipt links to your profile', (await pf.locator('[data-testid=submission-profile-link]').count()) === 1);
  await pf.screenshot({ path: `${OUT}/form-receipt.png` });
  // the entry is kept: after a reload it is still in live submissions and on the profile as an active entry
  await pf.reload({ waitUntil: 'networkidle' });
  const afterReload = await pf.$$eval('[data-testid=live-submissions] li', (lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' '))).catch(() => []);
  ok('your entry survives a reload', afterReload.some((r) => /@adrian/.test(r) && /\(you\)/.test(r)), `${afterReload.length} rows`);
  await pf.goto(new URL('profile', BASE).href, { waitUntil: 'networkidle' });
  const row = pf.locator('[data-testid=profile-active-row][data-slug=github-issues-under-budget]');
  ok('your entry shows on your profile as active', (await row.count()) === 1 && /Pending|Verifying/.test(await row.innerText()), (await row.innerText().catch(() => '')).replace(/\s+/g, ' '));
  ok('form flow has no page errors', fe.length === 0, fe.slice(0, 2).join(' | '));
  await pf.evaluate(() => { localStorage.removeItem('agent-fun:entries:v1'); });
  await pf.close();
}
// reduced motion
const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p3 = await rm.newPage();
await p3.goto(BASE, { waitUntil: 'networkidle' }); await p3.waitForTimeout(500);
const stills = await p3.$$eval('[data-testid=bounty-icon] img', (imgs) => imgs.filter((i) => /still/.test(i.currentSrc)).length);
ok('reduced motion swaps in still frames', stills >= 20, `${stills}/30 stills`);
await rm.close();
// mobile
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const pm = await m.newPage();
await pm.goto(BASE, { waitUntil: 'networkidle' });
const overflow = await pm.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok('mobile: no horizontal overflow', overflow <= 1, `${overflow}px`);
await pm.screenshot({ path: `${OUT}/mobile.png` });
await m.close();
ok('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
ok('no failed requests', failed.length === 0, failed.slice(0, 3).join(' | '));
await b.close();
const failedN = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failedN}/${results.length} passed`);
process.exit(failedN ? 1 : 0);

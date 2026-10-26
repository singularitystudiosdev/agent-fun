#!/usr/bin/env node
// Pixel + computed-style + hover diff of the clone's market card vs the live polymarket.com reference.
//   node scripts/verify.mjs [--url http://localhost:5180/?view=replica&snapshot=1] [--core] [--no-hover] [--out DIR] [--self-test]
// Exit 0 iff pixel mismatch < 1% AND 0 style mismatches AND 0 hover mismatches; else 1 (2 = could not run).
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectInPage, readNodeInPage } from './lib/collect.mjs';
import { alignNodes, compareNodes, compareStates, CORE_PROPS, ROLES } from './lib/style-diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Ground truth captured from live polymarket.com (2026-10-25).
export const REF = path.resolve(HERE, '../reference');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
export const SEL = '[data-testid=market-card]';

if (flag('--self-test')) { await import('./self-test.mjs'); process.exit(process.exitCode ?? 0); }

const URL_ = opt('--url', 'http://localhost:5180/?view=replica&snapshot=1');
const OUT = path.resolve(opt('--out', path.resolve(HERE, '../.tmp/diff')));
const PX_THRESHOLD_PCT = 1;
fs.mkdirSync(OUT, { recursive: true });

const liveDom = JSON.parse(fs.readFileSync(path.join(REF, 'card-dom.json'), 'utf8'));
const liveStates = JSON.parse(fs.readFileSync(path.join(REF, 'card-states.json'), 'utf8'));
const livePng = PNG.sync.read(fs.readFileSync(path.join(REF, 'live-card.png')));
const keys = [...new Set(liveDom.nodes.flatMap((n) => Object.keys(n.style)))];

const log = (s = '') => console.log(s);
const hr = (t) => log(`\n── ${t} ${'─'.repeat(Math.max(2, 78 - t.length))}`);
const table = (rows, cols) => {
  const w = cols.map((c) => Math.min(60, Math.max(c.length, ...rows.map((r) => String(r[c]).length))));
  const fmt = (r) => cols.map((c, i) => String(r[c]).slice(0, 60).padEnd(w[i])).join('  ');
  log(fmt(Object.fromEntries(cols.map((c) => [c, c])))); log(w.map((x) => '─'.repeat(x)).join('  '));
  rows.forEach((r) => log(fmt(r)));
};

// ── a. browser ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
log(`verify: ${URL_}`);
log(`chromium ${browser.version()} · viewport 1440x900 · DPR 2 · light · out ${OUT}`);
try {
  await page.goto(URL_, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector(SEL, { timeout: 15000 });
} catch (e) {
  log(`FATAL: could not load ${URL_} / find ${SEL}: ${e.message.split('\n')[0]}`);
  await browser.close(); process.exit(2);
}
await page.evaluate(() => document.fonts.ready);
const ready = await page.waitForFunction((sel) => { const imgs = [...document.querySelector(sel).querySelectorAll('img')]; return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, SEL, { timeout: 15000 }).then(() => true).catch(() => false);
const fontInfo = await page.evaluate(() => ({ status: document.fonts.status, loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')) }));
log(`fonts: ${fontInfo.status}, loaded faces: ${fontInfo.loaded.join(', ') || 'NONE (system fallback in use!)'}`);
if (!ready) log('WARN: card <img> did not finish loading within 15s (pixel diff will show a hole at the icon).');
await page.mouse.move(1439, 899);
await page.waitForTimeout(300);

// ── b. screenshot ───────────────────────────────────────────────────────────
const card = page.locator(SEL);
// The card is centred, so its left edge is fractional (e.g. 561.75px) and an element screenshot would be rasterised at a
// half-pixel offset vs the live capture (whose card sat on a whole pixel). Nudge it with `left` (layout, not transform)
// to the nearest whole CSS px for the screenshot only, then restore. --snap none disables.
const snapMode = opt('--snap', 'int');
const snapDx = await page.evaluate(({ sel, mode }) => { const el = document.querySelector(sel); const x = el.getBoundingClientRect().x; const dx = mode === 'none' ? 0 : mode === 'half' ? Math.round(x * 2) / 2 - x : Math.round(x) - x; if (Math.abs(dx) > 1e-4) { el.dataset.verifyLeft = el.style.left; el.style.left = dx + 'px'; } return dx; }, { sel: SEL, mode: snapMode });
if (Math.abs(snapDx) > 1e-4) { await page.waitForTimeout(100); log(`snap: card x was fractional → shifted ${snapDx > 0 ? '+' : ''}${snapDx}px (left) for the screenshot only (--snap ${snapMode})`); }
const rawBuf = await card.screenshot({ animations: 'disabled', caret: 'hide' });
await page.evaluate((sel) => { const el = document.querySelector(sel); if ('verifyLeft' in el.dataset) { el.style.left = el.dataset.verifyLeft; delete el.dataset.verifyLeft; } }, SEL);
const raw = PNG.sync.read(rawBuf);
const W = livePng.width, H = livePng.height;
let ours = raw;
hr('pixel diff');
if (raw.width !== W || raw.height !== H) {
  fs.writeFileSync(path.join(OUT, 'ours-raw.png'), rawBuf);
  ours = new PNG({ width: W, height: H }); // transparent fill ⇒ any padded px counts as mismatch
  PNG.bitblt(raw, ours, 0, 0, Math.min(raw.width, W), Math.min(raw.height, H), 0, 0);
  log(`SIZE: ours is ${raw.width}x${raw.height}px, live is ${W}x${H}px → ${raw.width > W || raw.height > H ? 'cropped' : ''}${(raw.width > W || raw.height > H) && (raw.width < W || raw.height < H) ? ' and ' : ''}${raw.width < W || raw.height < H ? 'padded with transparent' : ''} to ${W}x${H}, anchored top-left (ours-raw.png keeps the original).`);
} else log(`size: ours ${raw.width}x${raw.height}px = live ${W}x${H}px (no crop/pad)`);
fs.writeFileSync(path.join(OUT, 'ours.png'), PNG.sync.write(ours));

// ── c. pixelmatch ───────────────────────────────────────────────────────────
const diff = new PNG({ width: W, height: H });
const mismatched = pixelmatch(ours.data, livePng.data, diff.data, W, H, { threshold: 0.1, includeAA: false, diffColor: [255, 0, 0], aaColor: [255, 200, 0] });
fs.writeFileSync(path.join(OUT, 'diff.png'), PNG.sync.write(diff));
const GAP = 16;
const comp = new PNG({ width: W * 3 + GAP * 2, height: H });
comp.data.fill(0xe8);
for (let i = 3; i < comp.data.length; i += 4) comp.data[i] = 255;
[ours, livePng, diff].forEach((img, k) => PNG.bitblt(img, comp, 0, 0, W, H, k * (W + GAP), 0));
fs.writeFileSync(path.join(OUT, 'compare.png'), PNG.sync.write(comp));
const pct = (mismatched / (W * H)) * 100;
log(`mismatched pixels: ${mismatched} / ${W * H} = ${pct.toFixed(3)}%   (threshold 0.1, includeAA false; limit < ${PX_THRESHOLD_PCT}%)`);
// attribute mismatches to live node rects (DPR 2)
const isMis = (x, y) => { const i = (y * W + x) * 4; return diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0 && diff.data[i + 3] === 255; };
const regions = [2, 8, 17, 21, 22, 25, 32, 36, 37, 40, 47, 46, 50, 52].map((i) => liveDom.nodes[i]);
const claimed = new Uint8Array(W * H);
const regRows = regions.filter((n) => n.rect.w > 0).map((n) => {
  const x0 = Math.max(0, Math.floor(n.rect.x * 2)), y0 = Math.max(0, Math.floor(n.rect.y * 2)), x1 = Math.min(W, Math.ceil((n.rect.x + n.rect.w) * 2)), y1 = Math.min(H, Math.ceil((n.rect.y + n.rect.h) * 2));
  let c = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (isMis(x, y)) { c++; claimed[y * W + x] = 1; }
  return { region: `#${n.i} ${ROLES[n.i]}`, mismatched: c, area: (x1 - x0) * (y1 - y0), pct: ((c / ((x1 - x0) * (y1 - y0))) * 100).toFixed(1) + '%' };
});
let other = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isMis(x, y) && !claimed[y * W + x]) other++;
if (mismatched) { log('where (mismatched px per live-node rect; "other" = outside all listed rects, e.g. card edge/shadow/gaps):'); table([...regRows.filter((r) => r.mismatched), { region: 'other', mismatched: other, area: '-', pct: '-' }], ['region', 'mismatched', 'area', 'pct']); }
const pxOk = pct < PX_THRESHOLD_PCT;

// ── d. computed-style diff ──────────────────────────────────────────────────
hr('computed-style diff (walker: card + querySelectorAll("*") minus svg descendants)');
const oursNodes = await page.evaluate(collectInPage, { sel: SEL, keys });
const propFilter = flag('--core') ? CORE_PROPS : undefined;
const { mismatches, checks } = compareNodes(oursNodes, liveDom.nodes, { props: propFilter });
log(`our nodes: ${oursNodes.length}   live nodes: ${liveDom.nodes.length}   checks: ${checks}${propFilter ? '  (--core: only the 15 core props + rect)' : '  (every captured prop + rect + ::after + tag/class/text)'}`);
const byTier = { structure: 0, core: 0, extra: 0 };
mismatches.forEach((m) => byTier[m.tier]++);
if (mismatches.length) table(mismatches.slice(0, +opt("--max-rows", 150)).map((m) => ({ node: m.path, prop: m.prop, ours: m.ours, live: m.live, tier: m.tier })), ['node', 'prop', 'ours', 'live', 'tier']);
else log('no style mismatches');
if (mismatches.length > +opt('--max-rows', 150)) log(`… ${mismatches.length - +opt('--max-rows', 150)} more rows (all of them are in style-diff.json; raise with --max-rows N)`);
log(`STYLE MISMATCHES: ${mismatches.length}  (structure ${byTier.structure}, core ${byTier.core}, extra ${byTier.extra}) of ${checks} checks`);

// ── e. hover / active states ────────────────────────────────────────────────
let hoverMism = [], hoverChecks = 0, oursStates = {};
if (!flag('--no-hover')) {
  hr('hover / active states vs card-states.json');
  const map = new Map(); // live node index → our node index (via the structural alignment)
  for (const [o, l] of alignNodes(oursNodes, liveDom.nodes)) if (o && l) map.set(l.i, o.i);
  const read = async (i, props) => (await page.evaluate(readNodeInPage, { sel: SEL, i: map.get(i), props }));
  const propsOf = (st) => (typeof liveStates[st] === 'string' ? ['opacity'] : Object.keys(liveStates[st]));
  const grab = async (state, i) => { if (!map.has(i)) return; oursStates[state] = (await read(i, propsOf(state))).style; if (typeof liveStates[state] === 'string') oursStates[state] = oursStates[state].opacity; };
  const settle = () => page.waitForTimeout(450);
  const hoverTo = async (i) => { if (!map.has(i)) return; await page.mouse.move(1439, 899); await page.waitForTimeout(120); const c = (await read(i, ['opacity'])).center; await page.mouse.move(c.x, c.y, { steps: 4 }); await settle(); };
  await page.mouse.move(1439, 899); await settle();
  for (const [s, i] of [['yes_rest', 22], ['yesLabel_rest', 23], ['yesPrice_rest', 24], ['no_rest', 25], ['gift_rest', 50], ['bm_rest', 52]]) await grab(s, i);
  await hoverTo(22); for (const [s, i] of [['yes_hover', 22], ['yesLabel_hover', 23], ['yesPrice_hover', 24], ['card_whileHoverYes', 0]]) await grab(s, i);
  await hoverTo(25); await grab('no_hover', 25);
  await hoverTo(50); await grab('gift_hover', 50);
  await hoverTo(52); await grab('bm_hover', 52);
  await page.mouse.down(); await page.waitForTimeout(300); await grab('bm_active', 52); await page.mouse.up();
  await hoverTo(8); await grab('title_whileHover', 8);
  await hoverTo(17); await grab('rowName_hover', 17);
  await page.mouse.move(1439, 899);
  const r = compareStates(oursStates, liveStates);
  hoverMism = r.mismatches; hoverChecks = r.checks;
  const untested = Object.keys(liveStates).filter((k) => !(k in oursStates));
  if (hoverMism.length) table(hoverMism, ['state', 'prop', 'ours', 'live']); else log('no hover mismatches');
  log(`HOVER MISMATCHES: ${hoverMism.length} of ${hoverChecks} checks (states not exercised: ${untested.join(', ') || 'none'})`);
}

// ── write JSON ──────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'style-diff.json'), JSON.stringify({ url: URL_, generated: new Date().toISOString(), summary: { pixelMismatched: mismatched, pixelPct: pct, styleMismatches: mismatches.length, styleChecks: checks, byTier, hoverMismatches: hoverMism.length, hoverChecks }, mismatches, hoverMismatches: hoverMism, oursStates, oursNodes }, null, 1));
await browser.close();

// ── f. verdict ──────────────────────────────────────────────────────────────
hr('verdict');
if (consoleErrors.length) log(`page errors: ${consoleErrors.join(' | ')}`);
log(`pixel   : ${pct.toFixed(3)}% (${mismatched}px) ${pxOk ? 'PASS' : 'FAIL'}`);
log(`styles  : ${mismatches.length} mismatches ${mismatches.length === 0 ? 'PASS' : 'FAIL'}`);
log(`hover   : ${hoverMism.length} mismatches ${hoverMism.length === 0 ? 'PASS' : 'FAIL'}`);
log(`files   : ${OUT}/{ours,diff,compare}.png, style-diff.json`);
const ok = pxOk && mismatches.length === 0 && hoverMism.length === 0;
log(ok ? 'RESULT: PASS (exit 0)' : 'RESULT: FAIL (exit 1)');
process.exit(ok ? 0 : 1);

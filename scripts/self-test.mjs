// node scripts/self-test.mjs   (or: node scripts/verify.mjs --self-test)
// Tests the comparison logic itself, without needing our page: colour normaliser (incl. a cross-check against the
// browser's own canvas), the DOM walker (run on live card.html), and the diff engine (live-vs-live = 0, mutations caught).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { colorEq, normColor, parseColor } from './lib/color.mjs';
import { collectInPage } from './lib/collect.mjs';
import { cmpProp, compareNodes, compareStates, alignNodes } from './lib/style-diff.mjs';

const REF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../reference');
const dom = JSON.parse(fs.readFileSync(path.join(REF, 'card-dom.json'), 'utf8'));
const states = JSON.parse(fs.readFileSync(path.join(REF, 'card-states.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };
const clone = (x) => JSON.parse(JSON.stringify(x));

console.log('── colour normaliser ──');
for (const [src, hex] of [['lab(100 0 0)', '#ffffff'], ['lab(15.4544 -0.764295 -4.69404)', '#23272d'], ['lab(47.7217 -1.37293 -5.88264)', '#6b727b'], ['lab(91.9748 -0.136733 -1.92862)', '#e6e8ec'], ['lab(45.7361 -45.2267 37.3056)', '#007e26'], ['lab(47.8918 72.1772 58.3835)', '#df0c10'], ['lab(56.1642 -52.1702 40.2684)', '#009c39'], ['rgb(255, 255, 255)', '#ffffff'], ['oklab(0.603598 -0.149933 0.0964872 / 0.15)', 'rgba(0, 156, 57, 0.15)'], ['oklab(0.570509 0.201896 0.109506 / 0.09)', 'rgba(223, 12, 16, 0.09)'], ['lab(0 0 0 / 0.05)', 'rgba(0, 0, 0, 0.05)'], ['rgba(0, 0, 0, 0)', 'transparent'], ['oklch(0.271499 0.0128939 256.761 / 0.06)', 'rgba(35, 39, 45, 0.06)'], ['color(srgb 1 0 0)', '#ff0000'], ['#fff', '#ffffff'], ['white', '#ffffff']]) {
  ok(`${src} → ${hex}`, normColor(src) === hex, `got ${normColor(src)}`);
}
ok('notations equal: lab / #hex / rgb()', colorEq('lab(15.4544 -0.764295 -4.69404)', '#23272d') && colorEq('#23272d', 'rgb(35, 39, 45)'));
ok('different colours differ', !colorEq('#23272d', '#6b727b') && !colorEq('rgba(0,156,57,.15)', 'rgba(0,156,57,.2)'));
ok('transparent == rgba(0,0,0,0) == lab(0 0 0 / 0)', colorEq('transparent', 'rgba(0, 0, 0, 0)') && colorEq('lab(0 0 0 / 0)', 'transparent'));
ok('box-shadow equal across notations', cmpProp('box-shadow', 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.025) 0px 2px 6px -0.5px', 'lab(0 0 0 / 0) 0px 0px 0px 0px inset, lab(0 0 0 / 0.06) 0px 0px 0px 1px, lab(0 0 0 / 0.025) 0px 2px 6px -0.5px, lab(0 0 0 / 0) 0px 0px 0px 0px') === null);
ok('box-shadow blur change caught', cmpProp('box-shadow', 'rgba(0,0,0,0.06) 0px 0px 0px 1px, rgba(0,0,0,0.025) 0px 2px 8px -0.5px', 'lab(0 0 0 / 0.06) 0px 0px 0px 1px, lab(0 0 0 / 0.025) 0px 2px 6px -0.5px') !== null);
ok('font-family case/quotes/spacing normalised', cmpProp('font-family', 'Inter,"Inter Fallback"', 'inter, "inter Fallback"') === null);
ok('font-family trailing sans-serif caught', cmpProp('font-family', 'inter, "inter Fallback"', 'inter, "inter Fallback", sans-serif') !== null);
ok('font-feature-settings order-insensitive, "x" == "x" 1', cmpProp('font-feature-settings', '"liga" 1, "calt"', '"calt", "liga"') === null && cmpProp('font-feature-settings', '"calt"', '"calt" 0') !== null);
ok('letter-spacing -0.09 vs -0.1 caught, -0.09 vs -0.09 ok', cmpProp('letter-spacing', '-0.1px', '-0.09px') !== null && cmpProp('letter-spacing', '-0.09px', '-0.09px') === null);

console.log('── every colour in card-dom.json / card-states.json: pure-JS parser vs Chromium canvas ──');
const colors = new Set();
const grab = (v) => { if (typeof v === 'string' && /^(lab|oklab|oklch|rgba?|color)\(/.test(v.trim())) colors.add(v.trim()); };
dom.nodes.forEach((n) => Object.entries(n.style).forEach(([k, v]) => { if (k === 'color' || k.endsWith('-color')) grab(v); if (k === 'box-shadow') (v.match(/(?:lab|oklab|oklch|rgba?)\([^)]*\)/g) || []).forEach(grab); }));
Object.values(states).forEach((s) => typeof s === 'object' && Object.entries(s).forEach(([k, v]) => { if (k === 'color' || k.endsWith('-color')) grab(v); if (k === 'box-shadow') (v.match(/(?:lab|oklab|oklch|rgba?)\([^)]*\)/g) || []).forEach(grab); }));
const browser = await chromium.launch();
const page = await (await browser.newContext({ colorScheme: 'light' })).newPage();
const canvasRes = await page.evaluate((list) => {
  const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d', { willReadFrequently: true });
  return list.map((col) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1, 1); g.fillStyle = col; g.fillRect(0, 0, 1, 1); return [col, [...g.getImageData(0, 0, 1, 1).data]]; });
}, [...colors]);
let worst = 0;
for (const [col, px] of canvasRes) {
  const p = parseColor(col); const comp = [p.r, p.g, p.b].map((v) => v * p.a + 255 * (1 - p.a));
  const d = Math.max(...comp.map((v, i) => Math.abs(v - px[i]))); worst = Math.max(worst, d);
  if (d > 1.01) console.log(`   mismatch ${col}: js=${comp.map(Math.round)} canvas=${px.slice(0, 3)}`);
}
ok(`${colors.size} distinct colours: max |js − canvas| over white = ${worst.toFixed(2)}/255 (≤1)`, worst <= 1.01);

console.log('── walker on live card.html (must reproduce card-dom.json structure) ──');
const html = fs.readFileSync(path.join(REF, 'card.html'), 'utf8');
await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
const keys = [...new Set(dom.nodes.flatMap((n) => Object.keys(n.style)))];
const walked = await page.evaluate(collectInPage, { sel: 'body > div', keys });
ok(`walker yields ${dom.nodes.length} nodes (got ${walked.length}; card.html has 59 elements, 5 are <svg> children)`, walked.length === dom.nodes.length);
const st = compareNodes(walked, dom.nodes, { structureOnly: true });
ok('tag + class + text identical for every node (fresnel ids normalised)', st.mismatches.length === 0, JSON.stringify(st.mismatches.slice(0, 3)));
// card.html is unstyled here (Polymarket's CSS is not available), so inject an equivalent ::after rule to test the pseudo reader.
await page.addStyleTag({ content: 'a::after{content:"";position:absolute;inset:0;border-radius:15.2px}' });
const withAfter = await page.evaluate(collectInPage, { sel: 'body > div', keys: ['color'] });
const aIdx = withAfter.filter((n) => n.after).map((n) => n.i).join();
ok('::after reader finds every <a> (#6 #16 #22 #25 #31 #37 #40) with content/position/inset/borderRadius', aIdx === '6,16,22,25,31,37,40' && withAfter[6].after.borderRadius === '15.2px' && withAfter[6].after.inset === '0px', aIdx);
ok('alignment is identity on identical lists', alignNodes(walked, dom.nodes).every(([o, l], i) => o && l && o.i === i && l.i === i));

console.log('── diff engine ──');
const self = compareNodes(clone(dom.nodes), dom.nodes);
ok(`live vs live: 0 mismatches (${self.checks} checks)`, self.mismatches.length === 0, JSON.stringify(self.mismatches.slice(0, 3)));
ok('live states vs live states: 0 mismatches', compareStates(clone(states), states).mismatches.length === 0);
const mut = clone(dom.nodes);
mut[8].style['font-size'] = '15px';                       // 1  core
mut[8].style.color = 'rgb(35, 39, 45)';                    // equal in another notation → 0
mut[21].style.color = '#23272e';                           // 1-channel diff → within tolerance → 0
mut[22].style['background-color'] = 'rgba(0, 156, 57, 0.2)'; // 1 core
mut[0].style['box-shadow'] = mut[0].style['box-shadow'].replace('0px 2px 6px -0.5px', '0px 2px 8px -0.5px'); // 1 core
mut[17].rect.x += 0.4;                                     // within 0.5 → 0
mut[17].rect.w += 0.6;                                     // 1 core
mut[32].style['font-family'] = '"Inter", "Inter Fallback", sans-serif'; // case/quote only → 0
mut[36].style['font-weight'] = '600'; mut[36].style['font-weight'] = '590'; // 1 core
mut[43].style['font-feature-settings'] = '"calt"';          // 1 core
mut[12].style.padding = 'x';                                // unknown prop on ours side only → ignored (0)
mut[3].class += ' extra-class';                              // 1 structure
mut[50].style.gap = '9px';                                   // 1 core
const r = compareNodes(mut, dom.nodes);
const expect = 8;
ok(`mutation run: exactly ${expect} real mismatches caught, 4 benign changes ignored (got ${r.mismatches.length})`, r.mismatches.length === expect, r.mismatches.map((m) => `${m.path}:${m.prop}`).join(' | '));
const dropped = clone(dom.nodes); dropped.splice(10, 2);
const rd = compareNodes(dropped, dom.nodes, { structureOnly: true }).mismatches;
ok('dropping nodes #10,#11 → reported as MISSING #10,#11 and nothing else cascades', rd.filter((m) => m.prop === 'MISSING in ours').map((m) => m.i).join() === '10,11' && rd.length === 3, JSON.stringify(rd.map((m) => m.path + m.prop)));
const sm = clone(states); sm.yes_hover['background-color'] = '#007e27x';
const mutS = clone(states); mutS.yes_hover['background-color'] = 'rgb(0, 126, 40)'; mutS.bm_hover.color = '#000'; // 38→40 is >1 → caught; color changed → caught
ok('state compare catches 2 injected hover diffs', compareStates(mutS, states).mismatches.length === 2);

await browser.close();
console.log(`\nself-test: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

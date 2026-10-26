import { colorEq, isColorProp, normColor, parseColor } from './color.mjs';

export const CORE_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'border-top-left-radius', 'box-shadow', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'font-feature-settings'];
export const RECT_TOL = 0.5;
export const ROLES = { 0: 'card', 2: 'icon-box', 3: 'icon-img', 6: 'title-link', 8: 'title-h3', 9: 'body', 12: 'rows-box', 13: 'row1', 17: 'row1-name', 21: 'row1-pct', 22: 'row1-yes', 23: 'row1-yes-label', 24: 'row1-yes-price', 25: 'row1-no', 26: 'row1-no-label', 27: 'row1-no-price', 28: 'row2', 32: 'row2-name', 36: 'row2-pct', 37: 'row2-yes', 38: 'row2-yes-label', 39: 'row2-yes-price', 40: 'row2-no', 41: 'row2-no-label', 42: 'row2-no-price', 43: 'footer', 46: 'vol-p', 47: 'vol-span', 50: 'gift-btn', 51: 'gift-svg', 52: 'bookmark-btn', 53: 'bookmark-sprite' };

export const nodePath = (n) => `#${n.i} ${n.tag}${ROLES[n.i] ? `[${ROLES[n.i]}]` : ''}${n.text ? ` "${n.text.slice(0, 18)}"` : ''}`;

const normWs = (s) => String(s).replace(/\s+/g, ' ').trim();
// fresnel suffixes are React useId values: `_R_…_` when server-rendered (live), `_r_…_` when client-rendered (ours).
const normClass = (c) => (c == null ? null : [...new Set(c.trim().split(/\s+/).map((t) => t.replace(/fresnel-_[Rr]_[^\s]*/, 'fresnel-_R_*')))].sort());
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;

function numericEq(a, b, tol) {
  const ta = a.replace(NUM, '#'), tb = b.replace(NUM, '#');
  if (ta !== tb) return false;
  const na = a.match(NUM) || [], nb = b.match(NUM) || [];
  return na.length === nb.length && na.every((v, i) => Math.abs(parseFloat(v) - parseFloat(nb[i])) <= tol + 1e-9);
}
const normFamily = (s) => normWs(s).split(',').map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase()).join(',');
function normFeatures(s) {
  if (!s || s === 'normal') return 'normal';
  return s.split(',').map((t) => { const m = /^\s*["']([^"']+)["']\s*(on|off|\d+)?\s*$/.exec(t); if (!m) return normWs(t); const v = m[2] === undefined || m[2] === 'on' ? '1' : m[2] === 'off' ? '0' : m[2]; return `${m[1]}=${v}`; }).sort().join(',');
}
function splitTop(s, sep) {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++; if (ch === ')') d--;
    if (ch === sep && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim());
}
export function parseShadow(s) {
  if (!s || s === 'none') return [];
  return splitTop(s, ',').map((layer) => {
    const toks = splitTop(layer.replace(/\s+/g, ' '), ' ');
    let inset = false, color = null; const nums = [];
    for (const t of toks) {
      if (t === 'inset') inset = true;
      else if (/^-?[\d.]/.test(t)) nums.push(parseFloat(t));
      else color = t;
    }
    while (nums.length < 4) nums.push(0);
    return { inset, nums, color: color ?? 'currentcolor' };
  }).filter((l) => { const c = parseColor(l.color); return !(c && c.a <= 0.0005); }); // invisible layers are no-ops
}
const fmtShadow = (s) => parseShadow(s).map((l) => `${l.inset ? 'inset ' : ''}${l.nums.join(' ')} ${normColor(l.color)}`).join(' | ') || 'none';

/** Compare one CSS property value. Returns null when equal, else {ours, live} (display strings). */
export function cmpProp(prop, ours, live) {
  ours = ours ?? ''; live = live ?? '';
  if (isColorProp(prop)) return colorEq(ours, live) ? null : { ours: normColor(ours), live: normColor(live) };
  if (prop === 'box-shadow') {
    const a = parseShadow(ours), b = parseShadow(live);
    const eq = a.length === b.length && a.every((l, i) => l.inset === b[i].inset && l.nums.every((v, j) => Math.abs(v - b[i].nums[j]) <= 0.01) && colorEq(l.color, b[i].color));
    return eq ? null : { ours: fmtShadow(ours), live: fmtShadow(live) };
  }
  if (prop === 'background-image' && /url\(/.test(ours + live)) { // asset host/hash differ by design; only check "an image is set" + file type
    const k = (v) => (/url\(/.test(v) ? 'url(' + ((/\.(\w+)(?:["')?#]|$)/.exec(v.replace(/\)$/, '')) || [])[1] || '?') + ')' : v);
    return k(ours) === k(live) ? null : { ours: k(ours), live: k(live) };
  }
  if (prop === 'font-family') return normFamily(ours) === normFamily(live) ? null : { ours: normWs(ours), live: normWs(live) };
  if (prop === 'font-feature-settings') return normFeatures(ours) === normFeatures(live) ? null : { ours: normWs(ours), live: normWs(live) };
  const tol = ['width', 'height', 'min-width', 'min-height', 'max-width'].includes(prop) ? RECT_TOL : prop === 'letter-spacing' ? 0.005 : 0.01;
  const a = normWs(ours), b = normWs(live);
  return a === b || numericEq(a, b, tol) ? null : { ours: a, live: b };
}

const sigOf = (n) => `${n.tag}|${(normClass(n.class) || []).join(' ')}`;
/** Align two walked node lists (LCS on tag+class signature; leftover gaps paired by tag, in order). Returns [[ours|null, live|null], ...]. */
export function alignNodes(ours, live) {
  const A = ours.map(sigOf), B = live.map(sigOf);
  const dp = Array.from({ length: A.length + 1 }, () => new Int32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const anchors = []; let i = 0, j = 0;
  while (i < A.length && j < B.length) { if (A[i] === B[j]) { anchors.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  anchors.push([A.length, B.length]);
  const pairs = []; let pi = 0, pj = 0;
  for (const [ai, bj] of anchors) {
    const go = ours.slice(pi, ai), gl = live.slice(pj, bj); const used = new Set(); let from = 0;
    const out = [];
    for (const l of gl) { let k = from; while (k < go.length && (used.has(k) || go[k].tag !== l.tag)) k++; if (k < go.length) { used.add(k); from = k + 1; out.push([go[k], l, k]); } else out.push([null, l, -1]); }
    // keep document order: merge by live order, then ours-only leftovers after
    out.forEach(([o, l]) => pairs.push([o, l]));
    go.forEach((o, k) => { if (!used.has(k)) pairs.push([o, null]); });
    if (ai < A.length) pairs.push([ours[ai], live[bj]]);
    pi = ai + 1; pj = bj + 1;
  }
  return pairs;
}

/** Compare two node lists (shape of card-dom.json nodes). opts.props: restrict style props; opts.structureOnly. */
export function compareNodes(oursNodes, liveNodes, opts = {}) {
  const mism = [];
  const push = (n, prop, ours, live, tier) => mism.push({ i: n.i, path: nodePath(n), prop, ours, live, tier });
  let checks = 0;
  const pairs = alignNodes(oursNodes, liveNodes);
  if (oursNodes.length !== liveNodes.length) mism.push({ i: -1, path: 'DOM', prop: 'node-count', ours: String(oursNodes.length), live: String(liveNodes.length), tier: 'structure' });
  for (const [o, l] of pairs) {
    checks += 3;
    if (!o) { push(l, 'MISSING in ours', '(absent)', `<${l.tag}>`, 'structure'); continue; }
    if (!l) { push(o, 'EXTRA in ours', `<${o.tag}> ${String(o.class ?? '').slice(0, 40)}`, '(absent)', 'structure'); continue; }
    if (o.tag !== l.tag) push(l, 'tag', o.tag, l.tag, 'structure');
    const oc = normClass(o.class), lc = normClass(l.class);
    if (JSON.stringify(oc) !== JSON.stringify(lc)) {
      const so = new Set(oc || []), sl = new Set(lc || []);
      push(l, 'class', `+[${[...so].filter((x) => !sl.has(x)).join(' ')}]`, `-[${[...sl].filter((x) => !so.has(x)).join(' ')}]`, 'structure');
    }
    if ((o.text ?? '') !== (l.text ?? '')) push(l, 'text', o.text ?? '', l.text ?? '', 'structure');
    if (opts.structureOnly) continue;
    if (!(l.rect.w === 0 && l.rect.h === 0)) { // display:none / contents nodes have no box
      for (const key of ['x', 'y', 'w', 'h']) {
        checks++;
        if (Math.abs(o.rect[key] - l.rect[key]) > RECT_TOL + 1e-9) push(l, `rect.${key}`, String(o.rect[key]), String(l.rect[key]), 'core');
      }
    }
    for (const prop of Object.keys(l.style)) {
      if (opts.props && !opts.props.includes(prop)) continue;
      checks++;
      const d = cmpProp(prop, o.style?.[prop], l.style[prop]);
      if (d) push(l, prop, d.ours, d.live, CORE_PROPS.includes(prop) ? 'core' : 'extra');
    }
    if (l.after || o.after) {
      for (const key of ['content', 'position', 'inset', 'borderRadius']) {
        checks++;
        const a = o.after?.[key] ?? '(none)', b = l.after?.[key] ?? '(none)';
        if (!numericEq(String(a), String(b), 0.01)) push(l, `::after.${key}`, String(a), String(b), 'extra');
      }
    }
  }
  return { mismatches: mism, checks };
}

/** Hover/active state comparison: ours {state:{prop:val}} vs card-states.json. */
export function compareStates(oursStates, liveStates) {
  const mism = []; let checks = 0;
  for (const [state, props] of Object.entries(oursStates)) {
    const live = liveStates[state];
    if (live === undefined) continue;
    if (typeof live === 'string') { checks++; if (props !== live && !numericEq(String(props), live, 0.01)) mism.push({ state, prop: 'value', ours: String(props), live }); continue; }
    for (const [prop, lv] of Object.entries(live)) {
      checks++;
      const ov = props?.[prop];
      const d = cmpProp(prop, ov, lv);
      if (d) mism.push({ state, prop, ours: d.ours, live: d.live });
    }
  }
  return { mismatches: mism, checks };
}

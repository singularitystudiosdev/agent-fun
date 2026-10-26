// Runs INSIDE the page (Playwright serialises it via toString) — must stay self-contained.
// Walker = how card-dom.json was produced: [card, ...card.querySelectorAll('*')] minus descendants of <svg>
// (card.html has 59 elements; 54 survive; the 5 dropped are the gift <svg>'s <line>/<path>/<rect> children).
export function collectInPage({ sel, keys }) {
  const card = document.querySelector(sel);
  if (!card) return null;
  const all = [card, ...card.querySelectorAll('*')].filter((el) => !(el.parentElement && el.parentElement.closest('svg')));
  const cr = card.getBoundingClientRect();
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return all.map((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const style = {};
    for (const k of keys) style[k] = cs.getPropertyValue(k);
    const n = { i, tag: el.tagName.toLowerCase(), class: el.getAttribute('class'), rect: { x: r3(r.x - cr.x), y: r3(r.y - cr.y), w: r3(r.width), h: r3(r.height) }, style };
    if (el.children.length === 0) { const t = el.textContent.trim(); if (t) n.text = t; }
    const a = getComputedStyle(el, '::after');
    if (a.content && a.content !== 'none' && a.content !== 'normal') n.after = { content: a.content, position: a.position, inset: a.inset, borderRadius: a.borderRadius };
    return n;
  });
}
// Read computed props of the i-th walked node (used for hover/active states).
export function readNodeInPage({ sel, i, props }) {
  const card = document.querySelector(sel);
  const all = [card, ...card.querySelectorAll('*')].filter((el) => !(el.parentElement && el.parentElement.closest('svg')));
  const el = all[i];
  if (!el) return null;
  const cs = getComputedStyle(el);
  const out = {};
  for (const p of props) out[p] = cs.getPropertyValue(p);
  const r = el.getBoundingClientRect();
  return { style: out, center: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
}

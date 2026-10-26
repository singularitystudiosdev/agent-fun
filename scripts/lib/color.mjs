// CSS colour normaliser: any computed-style colour notation → {r,g,b (0-255 floats, sRGB), a (0-1)}.
// Pure maths (no browser) so it can be unit-tested and so "lab()/oklab()/oklch()/rgb()/#hex" compare equal.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const enc = (v) => { // linear-light → sRGB gamma
  const s = Math.sign(v), x = Math.abs(v);
  return s * (x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x);
};
const dec = (v) => { const s = Math.sign(v), x = Math.abs(v); return s * (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); };
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const XYZ65_TO_LIN = [[3.2409699419045226, -1.537383177570094, -0.4986107602930034], [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559], [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]];
const D50_TO_D65 = [[0.9554734527042182, -0.023098536874261423, 0.0632593086610217], [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008], [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]];
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const NAMED = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

function labToRgb(L, a, b) {
  const e = 216 / 24389, k = 24389 / 27;
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const y = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
  const z = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  const lin = mul(XYZ65_TO_LIN, mul(D50_TO_D65, [x * D50[0], y * D50[1], z * D50[2]]));
  return lin.map((v) => enc(v) * 255);
}
function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => enc(v) * 255);
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function args(body) {
  // "a b c / d" or "a, b, c, d" → {c:[..3], a}
  const [main, alpha] = body.split('/');
  const parts = main.replace(/,/g, ' ').trim().split(/\s+/);
  const num = (t, pctScale = 1) => (t === 'none' ? 0 : t.endsWith('%') ? (parseFloat(t) / 100) * pctScale : t.endsWith('deg') ? parseFloat(t) : parseFloat(t));
  let a = 1;
  let c = parts;
  if (alpha !== undefined) a = num(alpha.trim(), 1);
  else if (parts.length === 4) { a = num(parts[3], 1); c = parts.slice(0, 3); }
  return { c, a: clamp01(a), num };
}

export function parseColor(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (s in NAMED) { const n = NAMED[s]; return { r: n[0], g: n[1], b: n[2], a: n[3] }; }
  if (s === 'currentcolor' || s === 'inherit') return null;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!m) return null;
  const fn = m[1];
  if (fn === 'color') {
    const [space, ...rest] = m[2].replace('/', ' / ').trim().split(/\s+/);
    const idx = rest.indexOf('/');
    const comps = (idx < 0 ? rest : rest.slice(0, idx)).map((t) => (t === 'none' ? 0 : t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t)));
    const a = idx < 0 ? 1 : clamp01(rest[idx + 1].endsWith('%') ? parseFloat(rest[idx + 1]) / 100 : parseFloat(rest[idx + 1]));
    if (space === 'srgb') return { r: comps[0] * 255, g: comps[1] * 255, b: comps[2] * 255, a };
    if (space === 'srgb-linear') { const c = comps.map((v) => enc(v) * 255); return { r: c[0], g: c[1], b: c[2], a }; }
    return null;
  }
  const { c, a, num } = args(m[2]);
  let rgb;
  if (fn === 'rgb' || fn === 'rgba') rgb = c.slice(0, 3).map((t) => (t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t)));
  else if (fn === 'hsl' || fn === 'hsla') rgb = hslToRgb(num(c[0]), parseFloat(c[1]), parseFloat(c[2]));
  else if (fn === 'lab') rgb = labToRgb(num(c[0], 100), num(c[1], 125), num(c[2], 125));
  else if (fn === 'lch') { const C = num(c[1], 150), h = (num(c[2]) * Math.PI) / 180; rgb = labToRgb(num(c[0], 100), C * Math.cos(h), C * Math.sin(h)); }
  else if (fn === 'oklab') rgb = oklabToRgb(num(c[0], 1), num(c[1], 0.4), num(c[2], 0.4));
  else if (fn === 'oklch') { const C = num(c[1], 0.4), h = (num(c[2]) * Math.PI) / 180; rgb = oklabToRgb(num(c[0], 1), C * Math.cos(h), C * Math.sin(h)); }
  else return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2], a };
}

const q = (v) => Math.min(255, Math.max(0, Math.round(v)));
/** Canonical display string: #rrggbb or rgba(r,g,b,a) (alpha to 3dp). Unparseable → original string. */
export function normColor(input) {
  const c = parseColor(input);
  if (!c) return String(input).trim();
  const [r, g, b] = [q(c.r), q(c.g), q(c.b)];
  if (c.a >= 0.9995) return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (c.a <= 0.0005) return 'transparent';
  return `rgba(${r}, ${g}, ${b}, ${+c.a.toFixed(3)})`;
}
/** Equal when each sRGB channel is within `ch` (default 1.0/255) and alpha within `al` (default 0.004). */
export function colorEq(x, y, ch = 1.0, al = 0.004) {
  const a = parseColor(x), b = parseColor(y);
  if (!a || !b) return String(x).trim() === String(y).trim();
  if (a.a <= 0.0005 && b.a <= 0.0005) return true;
  return Math.abs(a.a - b.a) <= al && Math.abs(a.r - b.r) <= ch + 1e-9 && Math.abs(a.g - b.g) <= ch + 1e-9 && Math.abs(a.b - b.b) <= ch + 1e-9;
}
export const isColorProp = (p) => p === 'color' || p.endsWith('-color') || p === 'fill' || p === 'stroke';

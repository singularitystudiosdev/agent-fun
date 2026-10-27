#!/usr/bin/env node
/**
 * Pull the board's meme icons: the REAL popular, caption-free Imgflip templates, square-cropped on their subject.
 *
 *   node scripts/fetch-memes.mjs              # download (cached) + encode every template
 *   node scripts/fetch-memes.mjs --only=drake # one template
 *   node scripts/fetch-memes.mjs --preview    # also write a crop-check sheet to the scratch dir
 *
 * Sources: Imgflip's blank templates. A template's id in base36 is its file key: animated templates live at
 * https://i.imgflip.com/<key>.mp4, still ones at https://i.imgflip.com/<key>.jpg|png (the same files the template pages
 * at https://imgflip.com/memetemplate/<id> serve). No API key is needed.
 *
 * Output per template: src/assets/memes/<slug>/meme.webp (192x192; looping animated WebP, <= ~150 KB), still.png (the
 * reduced-motion frame, animated templates only) and meta.json (name, source URL, retrieved date, crop).
 * Tools: ffmpeg (-fps_mode, never -vsync), img2webp, magick — all in /opt/homebrew/bin.
 *
 * The "Empty wallet" default is NOT pulled here: it is the user's own crop at src/assets/bounty-icon/ (see its meta.json).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/memes');
const SCRATCH = process.env.MEME_SCRATCH ?? '/Users/adrianagne/Documents/cosmos/projects/quick-chats/.tmp/memes';
const RETRIEVED = process.env.MEME_RETRIEVED ?? '2026-10-25';
const SIZE = 192;
const MAX_BYTES = 150_000;
const BIN = (t) => (existsSync(`/opt/homebrew/bin/${t}`) ? `/opt/homebrew/bin/${t}` : t);

/**
 * kind: 'gif' = Imgflip GIF template (mp4), 'still' = image template.
 * crop: [x, y, size] in SOURCE pixels — a square on the face / key action, chosen by eye from the source frames.
 * ss/t: trim window (seconds) for clips with a caption-like or off-subject stretch. fps: frame-rate cap. stillAt: the
 * reduced-motion frame (seconds into the trimmed clip).
 */
export const TEMPLATES = [
  { slug: 'this-is-fine', name: 'This Is Fine', id: 380285687, page: 'This-is-Fine-Animated-Template', kind: 'gif', crop: [110, 0, 215], fps: 10, stillAt: 1.6 },
  { slug: 'oprah-you-get-a-car', name: "Oprah 'You Get A Car'", id: 171218846, page: 'Oprah-You-Get-A-Car', kind: 'gif', crop: [110, 16, 240], stillAt: 1.2 },
  { slug: 'keyboard-typing', name: 'Keyboard Typing (Bruce Almighty)', id: 278917772, page: 'Keyboard-Typing', kind: 'gif', crop: [135, 0, 370], stillAt: 1 },
  { slug: 'fast-guy-explaining', name: 'Fast Guy Explaining', id: 292752607, page: 'fast-guy-explaining', kind: 'gif', crop: [150, 30, 300], fps: 15, stillAt: 0.4 },
  { slug: 'money-printer', name: 'Money Printer Go Brrr', id: 413423807, page: 'Powel-Money-Printer', kind: 'gif', crop: [500, 0, 320], fps: 15, stillAt: 1.2 },
  { slug: 'leonardo-dicaprio-cheers', name: 'Leonardo DiCaprio Cheers', id: 176717425, page: 'Leonardo-Dicaprio-Cheers', kind: 'gif', crop: [370, 20, 560], fps: 12, stillAt: 2.2 },
  { slug: 'crowd-cheering', name: 'Crowd Cheering', id: 321852411, page: 'crowd-cheering', kind: 'gif', crop: [156, 0, 200], fps: 15, stillAt: 1.2 },
  { slug: 'security-check', name: 'Thorough Security Check At Gate', id: 316543105, page: 'Thorough-security-check-at-gate', kind: 'gif', crop: [0, 96, 170], stillAt: 2.4 },
  { slug: 'confused-math-lady', name: 'Confused Math Lady', id: 286126573, page: 'Confused-Math-Lady', kind: 'gif', crop: [40, 0, 140], stillAt: 2.5 },
  { slug: 'typing-kitty', name: 'Typing Kitty', id: 260948664, page: 'Typing-kitty', kind: 'gif', crop: [130, 110, 330], fps: 25, stillAt: 0.5 },
  { slug: 'galaxy-brain', name: 'Galaxy Brain', id: 409530260, page: 'Big-Brain-Galaxy-Gif', kind: 'gif', crop: [340, 60, 600], ss: 1.6, t: 2.4, fps: 12, stillAt: 1 },
  { slug: 'jarvis', name: 'Jarvis', id: 308448403, page: 'Jarvis', kind: 'gif', crop: [109, 0, 280], fps: 15, stillAt: 1.4 },
  { slug: 'avengers-assemble', name: 'Avengers Assemble', id: 393572322, page: 'Avengers-Assemble', kind: 'gif', crop: [90, 92, 506], ss: 2.5, fps: 12, stillAt: 1.5 },
  { slug: 'discord-moderator', name: 'Discord Moderator', id: 288244599, page: 'Discord-Moderator', kind: 'gif', crop: [16, 0, 330], fps: 15, stillAt: 2 },
  { slug: 'confused-travolta', name: 'Confused John Travolta', id: 386198399, page: 'Confused-John-Travolta-Pulp-Fiction', kind: 'gif', crop: [107, 0, 212], fps: 12, stillAt: 0.2 },
  { slug: 'spongebob-imagination', name: 'Spongebob Imagination', id: 512296930, page: 'Spongebob-Imagination', kind: 'gif', crop: [330, 40, 640], fps: 12, stillAt: 3 },
  { slug: 'steve-ballmer-developers', name: 'Steve Ballmer "Developers"', id: 369470687, page: 'Steve-Ballmer-Developers', kind: 'gif', crop: [60, 20, 200], t: 2.6, fps: 15, stillAt: 1 },
  { slug: 'chef-skinner-reading', name: 'Chef Skinner Reading a Letter', id: 306216142, page: 'Chef-Skinner-Reading-a-Letter', kind: 'gif', crop: [92, 0, 236], fps: 12, stillAt: 2.4 },
  { slug: 'stonks', name: 'Stonks', id: 219964921, page: 'STONKS-without-STONKS', kind: 'still', crop: [0, 0, 960] },
  { slug: 'drake', name: 'Drake Hotline Bling', id: 181913649, page: 'Drake-Hotline-Bling', kind: 'still', crop: [0, 600, 600] },
  { slug: 'distracted-boyfriend', name: 'Distracted Boyfriend', id: 112126428, page: 'Distracted-Boyfriend', kind: 'still', crop: [200, 0, 800] },
  { slug: 'epic-handshake', name: 'Epic Handshake', id: 135256802, page: 'Epic-Handshake', kind: 'still', crop: [230, 40, 440] },
  { slug: 'trade-offer', name: 'Trade Offer', id: 309868304, page: 'Trade-Offer', kind: 'still', crop: [83, 190, 440] },
  // Won-bounty picks (src/lib/memeExtraE.ts): templates no live listing shows.
  { slug: 'e-mine-mine-mine-seagulls', name: "Finding Nemo Seagulls 'Mine'", id: 258086470, page: 'Mine-Mine-Mine', kind: 'gif', crop: [200, 0, 358], t: 1.9, fps: 15, stillAt: 1.3 },
  { slug: 'e-sweating-jordan-peele', name: 'Sweating Jordan Peele', id: 210959447, page: 'Sweating-Jordan-Peele', kind: 'gif', crop: [60, 0, 1000], fps: 12, stillAt: 0.5 },
  { slug: 'e-palpatine-unlimited-power', name: "Palpatine 'Unlimited Power'", id: 452498147, page: 'Palpatine---Unlimited-Power', kind: 'gif', crop: [160, 32, 232], t: 2.5, fps: 12, stillAt: 0.5 },
  { slug: 'e-thanos-perfectly-balanced', name: "Thanos 'Perfectly Balanced'", id: 224679348, page: 'thanos-perfectly-balanced-as-all-things-should-be-meme-template', kind: 'still', crop: [210, 286, 280] },
  { slug: 'e-rick-roll', name: 'Rick Roll (Rick Astley)', id: 266673813, page: 'Rick-Roll-Rick-Astley', kind: 'gif', crop: [140, 0, 360], fps: 12, stillAt: 1 },
  { slug: 'e-vegeta-over-9000', name: "Vegeta 'It's Over 9000'", id: 303884769, page: 'ITS-OVER-9000', kind: 'gif', crop: [150, 30, 660], fps: 10, stillAt: 0.3 },
  { slug: 'e-forrest-gump-running', name: 'Forrest Gump Running', id: 381123758, page: 'Forest-Gump-Running', kind: 'gif', crop: [300, 0, 786], t: 2.3, fps: 12, stillAt: 1.5 },
];

const sh = (cmd, args) => execFileSync(BIN(cmd), args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const key = (id) => id.toString(36);
const pageUrl = (t) => `https://imgflip.com/memetemplate/${t.id}/${t.page}`;

async function download(t) {
  const dir = join(SCRATCH, 'src');
  mkdirSync(dir, { recursive: true });
  for (const ext of t.kind === 'gif' ? ['mp4'] : ['jpg', 'png']) {
    const file = join(dir, `${t.slug}.${ext}`);
    const url = `https://i.imgflip.com/${key(t.id)}.${ext}`;
    if (existsSync(file) && statSync(file).size > 0) return { file, url };
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (meme-icons fetch script)' } });
    if (!res.ok) continue;
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return { file, url };
  }
  throw new Error(`${t.slug}: no media at https://i.imgflip.com/${key(t.id)}.*`);
}

const vf = (t, fps) => {
  const [x, y, s] = t.crop;
  return [`crop=${s}:${s}:${x}:${y}`, `scale=${SIZE}:${SIZE}:flags=lanczos`, fps ? `fps=${fps}` : null].filter(Boolean).join(',');
};

/** Animated: frames -> img2webp at decreasing quality, then every-other frame, until <= MAX_BYTES. */
function encodeGif(t, src, outDir) {
  const work = join(SCRATCH, 'work', t.slug);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const trim = [...(t.ss ? ['-ss', String(t.ss)] : []), ...(t.t ? ['-t', String(t.t)] : [])];
  const fpsOut = Number(sh('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src]).trim().split('/').reduce((a, b) => a / b));
  const fps = Math.min(t.fps ?? 30, Math.round(fpsOut * 100) / 100);
  sh('ffmpeg', ['-v', 'error', '-y', ...trim, '-i', src, '-vf', vf(t, fps), '-fps_mode', 'cfr', join(work, 'f%04d.png')]);
  const frames = readdirSync(work).filter((f) => f.endsWith('.png')).sort().map((f) => join(work, f));
  // reduced-motion still
  const stillIdx = Math.min(frames.length - 1, Math.round((t.stillAt ?? 0) * fps));
  sh('magick', [frames[stillIdx], '-strip', join(outDir, 'still.png')]);

  const out = join(outDir, 'meme.webp');
  let step = 1;
  for (;;) {
    const use = frames.filter((_, i) => i % step === 0);
    const d = Math.round((1000 / fps) * step);
    for (const q of [80, 70, 60, 50, 42]) {
      sh('img2webp', ['-loop', '0', '-lossy', '-q', String(q), '-m', '6', '-d', String(d), ...use, '-o', out]);
      const bytes = statSync(out).size;
      if (bytes <= MAX_BYTES) return { bytes, frames: use.length, frameMs: d, quality: q, fps: fps / step };
    }
    step++;
    if (step > 4) throw new Error(`${t.slug}: cannot fit ${MAX_BYTES} bytes`);
  }
}

function encodeStill(t, src, outDir) {
  const [x, y, s] = t.crop;
  const out = join(outDir, 'meme.webp');
  sh('magick', [src, '-crop', `${s}x${s}+${x}+${y}`, '+repage', '-filter', 'Lanczos', '-resize', `${SIZE}x${SIZE}!`, '-strip', '-quality', '86', out]);
  rmSync(join(outDir, 'still.png'), { force: true });
  return { bytes: statSync(out).size, frames: 1, quality: 86 };
}

async function main() {
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
  const preview = process.argv.includes('--preview');
  const list = TEMPLATES.filter((t) => !only || t.slug === only);
  let total = 0;
  for (const t of list) {
    const { file, url } = await download(t);
    const outDir = join(OUT, t.slug);
    mkdirSync(outDir, { recursive: true });
    const enc = t.kind === 'gif' ? encodeGif(t, file, outDir) : encodeStill(t, file, outDir);
    total += enc.bytes;
    const meta = {
      name: t.name,
      slug: t.slug,
      kind: t.kind === 'gif' ? 'animated' : 'still',
      source: { url: pageUrl(t), media: url, imgflipTemplateId: t.id, retrieved: RETRIEVED, note: 'Imgflip blank (caption-free) template' },
      crop: { x: t.crop[0], y: t.crop[1], size: t.crop[2], ...(t.ss ? { startSec: t.ss } : {}), ...(t.t ? { durationSec: t.t } : {}) },
      output: { width: SIZE, height: SIZE, ...enc, still: t.kind === 'gif' ? 'still.png' : null },
    };
    writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(`${t.slug.padEnd(26)} ${String(enc.bytes).padStart(7)} B  ${enc.frames} fr  q${enc.quality}`);
  }
  console.log(`total ${total} B`);
  if (preview) {
    const args = [];
    for (const t of list) args.push('-label', t.slug, join(OUT, t.slug, t.kind === 'gif' ? 'still.png' : 'meme.webp'));
    sh('magick', ['montage', '-font', '/System/Library/Fonts/Supplemental/Arial.ttf', ...args, '-tile', '6x', '-geometry', '192x192+4+4', '-pointsize', '12', join(SCRATCH, 'crops.png')]);
    console.log(`preview ${join(SCRATCH, 'crops.png')}`);
  }
}

main().catch((e) => {
  console.error(e.stderr?.toString() || e);
  process.exit(1);
});

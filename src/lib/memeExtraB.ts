import type { MemeIcon } from './memeIcons';

/**
 * Task-matched memes for the second quarter (by slug, alphabetical) of the board's listings. Filled by meme unit B.
 * Each template is unique across the board (claimed in .tmp/meme-claims). New pulls live in src/assets/memes/b-<template>/
 * (meme.webp 192x192, still.png, meta.json with the source); `stonks` and `epic-handshake` reuse the shared still dirs.
 */
export const MEME_EXTRA_B: Record<string, MemeIcon> = {
  'diplomacy-win-rate-20': {
    src: new URL('../assets/memes/epic-handshake/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/epic-handshake/meme.webp', import.meta.url).href,
    template: 'Epic Handshake',
    slug: 'epic-handshake',
    source: 'https://imgflip.com/memetemplate/135256802/Epic-Handshake',
    reason: 'Diplomacy is won by alliances: the epic handshake.',
  },
  'due-diligence-cost-per-correct': {
    src: new URL('../assets/memes/b-pawn-stars-best-i-can-do/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-pawn-stars-best-i-can-do/still.png', import.meta.url).href,
    template: 'Pawn Stars Best I Can Do',
    slug: 'b-pawn-stars-best-i-can-do',
    source: 'https://imgflip.com/memetemplate/77045868/Pawn-Stars-Best-I-Can-Do',
    reason: 'Cheapest cost per correct answer: "best I can do is..."',
  },
  'earnings-beat-brier': {
    src: new URL('../assets/memes/stonks/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/stonks/meme.webp', import.meta.url).href,
    template: 'Stonks',
    slug: 'stonks',
    source: 'https://imgflip.com/memetemplate/219964921/STONKS-without-STONKS',
    reason: 'Calling earnings beats: stonks.',
  },
  'funding-arb-delta-neutral': {
    src: new URL('../assets/memes/b-roll-safe/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-roll-safe/still.png', import.meta.url).href,
    template: 'Roll Safe Think About It',
    slug: 'b-roll-safe',
    source: 'https://imgflip.com/memetemplate/175149934/Roll-Safe-Think-About-It',
    reason: "Delta-neutral: can't lose money if you're hedged both ways (taps head).",
  },
  'fuzzing-agent-48h-bug-count': {
    src: new URL('../assets/memes/b-x-x-everywhere/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-x-x-everywhere/still.png', import.meta.url).href,
    template: 'X, X Everywhere',
    slug: 'b-x-x-everywhere',
    source: 'https://imgflip.com/memetemplate/176716401/x-x-everywhere',
    reason: 'A fuzzer finding bugs: bugs, bugs everywhere.',
  },
  'github-issues-under-budget': {
    src: new URL('../assets/memes/b-honest-work/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-honest-work/still.png', import.meta.url).href,
    template: "It Ain't Much, But It's Honest Work",
    slug: 'b-honest-work',
    source: 'https://imgflip.com/memetemplate/165198998/It-aint-much-but-its-honest-work',
    reason: "Real issues fixed for $2 each: it ain't much, but it's honest work.",
  },
  'heads-up-poker-bb100': {
    src: new URL('../assets/memes/b-hangover-math/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-hangover-math/still.png', import.meta.url).href,
    template: 'Hangover Math',
    slug: 'b-hangover-math',
    source: 'https://tenor.com/view/the-hangover-zach-galifianakis-math-card-counting-gambling-gif-3938292',
    reason: 'Beating the card table with math: Alan counting cards in The Hangover.',
  },
  'invoice-extraction-accuracy': {
    src: new URL('../assets/memes/b-charlie-conspiracy/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/b-charlie-conspiracy/still.png', import.meta.url).href,
    template: 'Charlie Conspiracy (Pepe Silvia)',
    slug: 'b-charlie-conspiracy',
    source: 'https://imgflip.com/memetemplate/561779441/Charlie-Conspiracy',
    reason: '5,000 messy invoices: Charlie in front of the paper wall.',
  },
};

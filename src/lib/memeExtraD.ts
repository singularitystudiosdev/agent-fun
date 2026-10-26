import type { MemeIcon } from './memeIcons';

/**
 * Task-matched memes for the fourth quarter (by slug, alphabetical) of the board's listings. Filled by meme unit D.
 * Each template is claimed board-wide (no meme repeats across quarters); assets live in src/assets/memes/d-<template>/.
 */
export const MEME_EXTRA_D: Record<string, MemeIcon> = {
  // "Most exploit points against 30 seeded vulnerable Solana programs": the hacker who hacks everything.
  'smart-contract-exploit-ctf': {
    src: new URL('../assets/memes/d-hackerman/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-hackerman/still.png', import.meta.url).href,
    template: 'Hackerman',
  },
  // "Lowest CRPS forecasting the daily SOL close": CRPS scores the whole distribution of futures.
  'sol-close-crps-21d': {
    src: new URL('../assets/memes/d-doctor-strange-14-million-futures/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-doctor-strange-14-million-futures/still.png', import.meta.url).href,
    template: 'Doctor Strange 14,000,605 futures',
  },
  // "Highest Sharpe ratio ... paper-trading agent on SOL perps": the trading-floor chest thump.
  'sol-perps-sharpe-14d': {
    src: new URL('../assets/memes/d-wolf-of-wall-street-chest-thump/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-wolf-of-wall-street-chest-thump/still.png', import.meta.url).href,
    template: 'Wolf of Wall Street chest thump',
  },
  // "Lowest median slot-to-confirmation landing 1,000 Solana transactions": gotta go fast.
  'solana-tx-landing-latency': {
    src: new URL('../assets/memes/d-sonic-gotta-go-fast/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-sonic-gotta-go-fast/still.png', import.meta.url).href,
    template: 'Sonic gotta go fast',
  },
  // "Highest resolved-without-human rate on 2,000 live support tickets": "Hello, IT..."
  'support-autoresolve-rate': {
    src: new URL('../assets/memes/d-it-crowd-turn-it-off-and-on/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-it-crowd-turn-it-off-and-on/still.png', import.meta.url).href,
    template: 'IT Crowd: turn it off and on again',
  },
  // "Fastest web agent on a 100-task travel booking benchmark": I am speed.
  'web-agent-booking-100': {
    src: new URL('../assets/memes/d-lightning-mcqueen-i-am-speed/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/d-lightning-mcqueen-i-am-speed/still.png', import.meta.url).href,
    template: 'Lightning McQueen I am speed',
  },
};

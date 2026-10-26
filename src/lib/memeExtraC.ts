import type { MemeIcon } from './memeIcons';

/**
 * Task-matched memes for the third quarter (by slug, alphabetical) of the board's listings. Filled by meme unit C.
 * Every template here is claimed board-wide (no meme repeats across quarters A-D).
 */
export const MEME_EXTRA_C: Record<string, MemeIcon> = {
  // "Lowest realised slippage routing a $1M USDC to SOL swap": the swap is literally one million dollars.
  'lowest-slippage-1m-usdc-route': {
    src: new URL('../assets/memes/c-dr-evil-one-million-dollars/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-dr-evil-one-million-dollars/still.png', import.meta.url).href,
    template: "Dr. Evil 'One Million Dollars'",
  },
  // "Fewest in-game seconds to obtain a diamond in Minecraft from a fresh seed".
  'minecraft-diamond-speedrun': {
    src: new URL('../assets/memes/c-jack-black-i-am-steve/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-jack-black-i-am-steve/still.png', import.meta.url).href,
    template: "Jack Black 'I... am Steve'",
  },
  // "Highest median score across 50 seeded NetHack runs": waiting out 50 permadeath dungeon runs.
  'nethack-median-score': {
    src: new URL('../assets/memes/c-waiting-skeleton/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-waiting-skeleton/still.png', import.meta.url).href,
    template: 'Waiting Skeleton',
  },
  // "Lowest cost per verified newsletter subscriber on a $2,000 ad budget": once again asking you to subscribe.
  'newsletter-cost-per-subscriber': {
    src: new URL('../assets/memes/c-bernie-once-again-asking/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-bernie-once-again-asking/still.png', import.meta.url).href,
    template: "Bernie 'I Am Once Again Asking'",
  },
  // "Most demos booked per 1,000 outreach emails": Bruce Almighty answering every email at once. (Not the Wolf of Wall
  // Street pen scene: the chest thump already uses that film, and no film appears twice on the board.)
  'outbound-demos-per-1000': {
    src: new URL('../assets/memes/keyboard-typing/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/keyboard-typing/still.png', import.meta.url).href,
    template: 'Keyboard Typing (Bruce Almighty)',
  },
  // "Highest F1 flagging phishing in a sealed 10,000-message inbox": is this phishing? (misclassification joke).
  'phishing-inbox-f1': {
    src: new URL('../assets/memes/c-is-this-a-pigeon/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-is-this-a-pigeon/still.png', import.meta.url).href,
    template: 'Is This A Pigeon',
  },
  // "Lowest log loss forecasting 200 prediction-market questions resolving in November".
  'prediction-market-log-loss': {
    src: new URL('../assets/memes/galaxy-brain/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/galaxy-brain/still.png', import.meta.url).href,
    template: 'Galaxy Brain',
  },
  // "Best Brier score forecasting Premier League matchweeks 11 to 15".
  'premier-league-brier-mw11-15': {
    src: new URL('../assets/memes/c-ronaldo-siuuu/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/c-ronaldo-siuuu/still.png', import.meta.url).href,
    template: "Ronaldo 'Siuuu'",
  },
};

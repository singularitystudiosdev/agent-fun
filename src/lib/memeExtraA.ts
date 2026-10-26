import type { MemeIcon } from './memeIcons';

/**
 * Task-matched memes for QUARTER 1 (alphabetical by slug) of the competitive listings. Filled by meme unit A.
 * Every template here is claimed in .tmp/meme-claims so no meme repeats across the board. `a-*` dirs were pulled by
 * unit A; the rest reuse the existing worker's dirs (never edited here).
 */
export const MEME_EXTRA_A: Record<string, MemeIcon> = {
  // A/B-testing App Store listing variants: reject one version, approve the other.
  'app-store-listing-conversion': {
    src: new URL('../assets/memes/drake/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/drake/meme.webp', import.meta.url).href,
    template: 'Drake Hotline Bling',
  },
  // Prompt injection against a browsing agent: "these aren't the droids you're looking for".
  'browsing-agent-injection-ladder': {
    src: new URL('../assets/memes/a-obi-wan-jedi-mind-trick/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/a-obi-wan-jedi-mind-trick/still.png', import.meta.url).href,
    template: 'Jedi Mind Trick (Obi-Wan)',
  },
  // Chess960 with no engine: Beth Harmon, the board in her head.
  'chess960-llm-elo': {
    src: new URL('../assets/memes/a-queens-gambit-beth-harmon/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/a-queens-gambit-beth-harmon/still.png', import.meta.url).href,
    template: "The Queen's Gambit (Beth Harmon)",
  },
  // Forecasting daily high temperatures: Brick Tamland doing the weather.
  'city-temperature-mae-14d': {
    src: new URL('../assets/memes/a-anchorman-brick-tamland-weatherman/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/a-anchorman-brick-tamland-weatherman/still.png', import.meta.url).href,
    template: 'Brick Tamland Weather Report (Anchorman)',
  },
  // Recovering cloud outages: the room is on fire.
  'cloud-outage-mttr': {
    src: new URL('../assets/memes/this-is-fine/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/this-is-fine/still.png', import.meta.url).href,
    template: 'This Is Fine',
  },
  // Fastest CVE patches: slap on some Flex Tape and the leak stops.
  'cve-patch-time-to-green': {
    src: new URL('../assets/memes/a-flex-tape/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/a-flex-tape/still.png', import.meta.url).href,
    template: 'Flex Tape (Phil Swift)',
  },
  // Most developer signups: "Developers! Developers! Developers!"
  'dev-signups-21d': {
    src: new URL('../assets/memes/steve-ballmer-developers/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/steve-ballmer-developers/still.png', import.meta.url).href,
    template: 'Steve Ballmer "Developers"',
  },
  // Market making: quoting both sides is one endless trade offer.
  'devnet-market-making-pnl': {
    src: new URL('../assets/memes/trade-offer/meme.webp', import.meta.url).href,
    still: new URL('../assets/memes/trade-offer/meme.webp', import.meta.url).href,
    template: 'Trade Offer',
  },
};

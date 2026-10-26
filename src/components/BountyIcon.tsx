import type { Bounty } from '../lib/bounty';
import { memeFor } from '../lib/memeIcons';

/**
 * A bounty's icon: the popular no-text meme template that matches its task (src/lib/memeIcons.ts), the "empty wallet"
 * clip when none does. Its still frame replaces it under prefers-reduced-motion. Fills its positioned parent (like
 * MarketCard's icon <img>); the parent sets the size and clips the corners.
 */
export function BountyIcon({ bounty, size = 38 }: { bounty?: Bounty; size?: number }) {
  const meme = memeFor(bounty);
  return (
    <picture key={meme.src}>
      {meme.still ? <source media="(prefers-reduced-motion: reduce)" srcSet={meme.still} /> : null}
      <img
        src={meme.src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-cover rounded-sm"
      />
    </picture>
  );
}

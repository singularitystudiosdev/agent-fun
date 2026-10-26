import { useEffect, useState } from 'react';
import { BountyCard } from './components/BountyCard';
import { MarketCard, MarketCardSkeleton } from './components/MarketCard';
import { sampleBounty } from './lib/bounty';
import { fetchEvent, type GammaEvent } from './lib/gamma';
import { useLiveOdds } from './lib/liveOdds';
import { SERBIA_PM_SNAPSHOT } from './snapshot';

// The 1:1 market-card replica and the bounty card side by side, off the main screen at `?view=replica`.
// scripts/verify.mjs pixel-diffs this view (`?view=replica&snapshot=1`) against the live polymarket.com card.
const EVENT_ID = '655483';
const params = new URLSearchParams(window.location.search);
const frozen = params.has('snapshot');
// Opt-in: stream the CLOB order book over Polymarket's public market websocket (the homepage card itself is static).
const live = params.has('live') && !frozen;
// Sample bounty; its deadline is relative to page load (?state=day|hour|minute|seconds|expired, ?expired=1).
const bounty = sampleBounty();

export function ReplicaView() {
  const [event, setEvent] = useState<GammaEvent | null>(frozen ? SERBIA_PM_SNAPSHOT : null);
  const shownEvent = useLiveOdds(event, live);

  // Like polymarket.com's homepage, the card renders the event as loaded and does not refetch.
  useEffect(() => {
    if (frozen) return;
    const controller = new AbortController();
    fetchEvent(EVENT_ID, controller.signal)
      .then(setEvent)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Live Gamma fetch failed, showing the 2026-10-25 snapshot.', err);
        setEvent(SERBIA_PM_SNAPSHOT);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <h1 className="sr-only">Polymarket-style cards: a market and a bounty</h1>
      {/* The cards keep polymarket.com's own <h3> titles; this keeps the outline h1 > h2 > h3. */}
      <h2 className="sr-only">Cards</h2>
      {/* polymarket.com's homepage grid gap (gap-3) between 316.5px columns. */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        <div className="w-[316.5px] h-[180px]">{shownEvent ? <MarketCard event={shownEvent} /> : <MarketCardSkeleton />}</div>
        <div className="w-[316.5px] h-[180px]">
          <BountyCard bounty={bounty} />
        </div>
      </div>
    </main>
  );
}

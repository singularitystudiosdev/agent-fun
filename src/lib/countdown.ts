import { useEffect, useState } from 'react';

const DAY_S = 86_400;

/** Whole seconds left, rounded UP: the last second shows 1s and 0s is never shown while the bounty is open. */
export const secondsLeft = (msRemaining: number): number => Math.max(0, Math.ceil(msRemaining / 1000));

/** Open means at least one millisecond left. At 0 or below the card switches to its expired state. */
export const isExpired = (msRemaining: number): boolean => msRemaining <= 0;

/** Red below 24 h, decided on the same rounded seconds that are printed, so text and colour flip on the same tick. */
export const isUrgent = (msRemaining: number): boolean => !isExpired(msRemaining) && secondsLeft(msRemaining) < DAY_S;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Every field labelled with its unit (d h m s), leading zero fields dropped. The leading field is unpadded and every
 * field after it is two digits, so the width holds steady while the seconds tick (no jump at 10s -> 9s).
 *   >= 1 day : "2d 03h 14m 07s"   >= 1 h : "4h 12m 09s"   >= 1 min : "12m 09s" / "1m 54s"   < 1 min : "9s"   <= 0 : "0s"
 */
export function formatCountdown(msRemaining: number): string {
  const total = secondsLeft(msRemaining);
  const d = Math.floor(total / DAY_S);
  const h = Math.floor((total % DAY_S) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(s)}s`;
  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(s)}s`;
  if (m > 0) return `${m}m ${pad2(s)}s`;
  return `${s}s`;
}

/** Delay until the printed text can next change: exactly when the remaining time crosses the next whole-second boundary. */
export const msToNextTick = (msRemaining: number): number => ((msRemaining - 1) % 1000) + 1;

/**
 * Remaining ms, rounded up to a whole second, for an ISO deadline. Never counts down a stored number: every tick
 * recomputes `deadline - now()`, so a throttled or late timer cannot drift. The timeout is aligned to the next second
 * boundary of the deadline, paused while the tab is hidden, recomputed the moment it is visible again, and not
 * re-armed once the deadline has passed. `now` is injectable for tests (and for a server-calibrated clock).
 */
export function useCountdown(deadlineIso: string, now: () => number = Date.now): number {
  const deadline = Date.parse(deadlineIso);
  const read = () => (Number.isNaN(deadline) ? 0 : Math.max(0, Math.ceil((deadline - now()) / 1000) * 1000));
  const [remaining, setRemaining] = useState(read);

  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      const left = deadline - now();
      setRemaining(Math.max(0, Math.ceil(left / 1000) * 1000)); // same value as last tick => React bails out
      if (left > 0 && document.visibilityState !== 'hidden') timer = setTimeout(tick, msToNextTick(left));
    };
    tick();
    document.addEventListener('visibilitychange', tick); // hidden: tick() re-arms nothing; visible: recompute + re-arm
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline, now]);

  return remaining;
}

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type RefObject, type TouchEvent } from 'react';
import { formatBountyAmount, type BoardBounty } from '../../lib/bounty';
import type { BoardStatus } from '../../lib/boardTabs';
import { formatCountdown, isUrgent, useCountdown } from '../../lib/countdown';
import { formatScore, leaderboard, scoreDecimals, useMyEntries, useProfile, useWinners } from '../../lib/profile';
import { isEnded } from '../../lib/wonBounties';
import { RollingTime } from '../BountyCard';
import { BountyIcon } from '../BountyIcon';
import { parseDescription } from './BountyDescription';

/**
 * The board's featured feed: the top trending bounties, one slide at a time, the strip sliding left to the next one.
 * Anatomy after polymarket.com's "Featured markets" carousel (one wide card); each slide is the won bounty page's head
 * (GIF, title, description, bounty) beside its top-3 leaderboard and submission count. No visible pager or prev / next:
 * it turns on its own, and by swipe on touch screens.
 * Behaviour is the WAI-ARIA APG auto-rotating carousel: a rotation control first in the tab order (shown only while it
 * has keyboard focus), rotation pauses while the pointer is over it and stops for good when keyboard focus enters,
 * off-screen slides are inert, and the slide group is a polite live region only while rotation is stopped. Under reduced
 * motion it never rotates and never slides.
 *
 * Timing: a hidden element runs the dwell as a CSS animation (`pk-dwell`, index.css) and its `animationend` advances
 * the slide, so pausing the animation pauses the clock where it stands. The loop is seamless: a clone of slide 1 sits
 * after the last slide, the strip slides onto it, then snaps back to the real slide 1 unseen.
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';
const LABEL = 'text-body-sm font-semibold text-pk-content-secondary whitespace-nowrap';
const TOP = 3;
/** Rank, competitor, score, then the money column from sm up (a phone keeps the three that say who leads). */
const GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_5.5rem]';
/** A horizontal swipe longer than this (px) turns the slide; shorter ones are taps or vertical scrolls. */
const SWIPE = 40;

const REDUCED = '(prefers-reduced-motion: reduce)';
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED).matches,
  );
}

/** True while at least a third of `ref` is on screen: off screen, the clock stops so the slide you left is the one you find. */
function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { threshold: 0.34 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

const PauseGlyph = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
  </svg>
);

const PlayGlyph = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4.5 2.8v10.4c0 .6.66.97 1.17.65l8.2-5.2a.77.77 0 0 0 0-1.3l-8.2-5.2A.77.77 0 0 0 4.5 2.8Z" fill="currentColor" />
  </svg>
);

/** The brief's opening paragraph: what the bounty is, before its subheadings. */
const leadOf = (text: string): string => parseDescription(text).find((b) => b.kind === 'p')?.text ?? '';

/** The slide's right half: the top 3 by verified score, #1 set apart. Live bounties show what each place pays; won ones what it won. */
function SlideLeaderboard({ bounty, won }: { bounty: BoardBounty; won: boolean }) {
  const profile = useProfile();
  const mine = useMyEntries(bounty.slug);
  const rows = useMemo(() => leaderboard(bounty, mine), [bounty, mine]);
  const metric = bounty.resolution?.metric;
  const dp = scoreDecimals(bounty);
  const submissions = bounty.submissionCount ?? bounty.submissions.length;

  return (
    // A column of the slide, not a card in a card: divided off by a hairline (left at lg, above when stacked).
    <section
      aria-label={`Leaderboard for ${bounty.title}`}
      data-testid="carousel-leaderboard"
      className="flex flex-col border-t border-pk-border pt-4 lg:w-[440px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 xl:w-[500px]"
    >
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h3 className="text-body-base font-semibold text-pk-content-primary">Leaderboard</h3>
        <span className="text-body-sm text-pk-content-secondary tabular-nums" data-testid="carousel-submissions">
          {submissions.toLocaleString('en-US')} {submissions === 1 ? 'submission' : 'submissions'}
        </span>
      </div>
      {!metric || rows.length === 0 ? (
        <p className="py-6 text-body-base text-pk-content-secondary">No verified scores yet. Be the first.</p>
      ) : (
        <>
          <div className={`${GRID} border-b border-pk-border px-3 pb-2 text-body-sm text-pk-content-secondary`} aria-hidden="true">
            <span>Rank</span>
            <span>Competitor</span>
            <span className="text-right">{metric.name}</span>
            <span className="hidden text-right sm:block">{won ? 'Won' : 'Prize'}</span>
          </div>
          <ol className="flex flex-col">
            {rows.slice(0, TOP).map((r) => {
              const payout = bounty.rewards?.[String(r.rank)] ?? 0;
              const first = r.rank === 1;
              const size = first ? 'text-body-base sm:text-heading-xl' : 'text-body-base';
              return (
                <li key={r.hunter} data-testid="carousel-leaderboard-row" data-rank={r.rank} className={`${GRID} border-b border-pk-border px-3 last:border-b-0 ${first ? 'bg-pk-gray-100 py-3' : 'py-2.5'}`}>
                  <span className={`font-semibold tabular-nums text-pk-content-primary ${size}`}>#{r.rank}</span>
                  <span title={`@${r.hunter}`} className={`min-w-0 truncate font-semibold text-pk-content-primary ${size}`}>
                    @{r.hunter}
                    {r.hunter === profile.handle && <span className="font-normal text-pk-content-secondary"> (you)</span>}
                  </span>
                  <span className={`text-right tabular-nums text-pk-content-primary ${size} ${first ? 'font-semibold' : ''}`}>{formatScore(r.score, metric, dp)}</span>
                  <span className={`hidden text-right font-semibold tabular-nums sm:block ${size} ${payout === 0 ? 'text-pk-content-secondary' : won ? 'text-pk-green-600' : 'text-pk-content-primary'}`}>
                    {formatBountyAmount(payout)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

/** The live countdown, or who won once it is over. */
function SlideClock({ bounty, labelId, won }: { bounty: BoardBounty; labelId: string; won: boolean }) {
  const remaining = useCountdown(bounty.deadline);
  const winner = useWinners(bounty)[0];
  if (won) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <dt id={labelId} className={LABEL}>
          Won by
        </dt>
        <dd className="truncate text-heading-xl text-pk-content-primary">{winner ? `@${winner.hunter}` : 'Not announced'}</dd>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt id={labelId} className={LABEL}>
        Ends in
      </dt>
      <dd>
        <RollingTime text={formatCountdown(remaining)} deadline={bounty.deadline} labelId={labelId} urgent={isUrgent(remaining)} />
      </dd>
    </div>
  );
}

function Slide({ bounty, index, count, active, clone }: { bounty: BoardBounty; index: number; count: number; active: boolean; clone?: boolean }) {
  const id = useId();
  const won = isEnded(bounty);
  const lead = leadOf(bounty.description ?? '');
  return (
    <div
      role={clone ? undefined : 'group'}
      aria-roledescription={clone ? undefined : 'slide'}
      aria-labelledby={clone ? undefined : `${id}-title`}
      aria-hidden={clone || !active || undefined}
      inert={clone || !active}
      data-testid={clone ? 'carousel-clone' : 'carousel-slide'}
      data-index={clone ? undefined : index}
      data-active={!clone && active ? 'true' : undefined}
      className="relative flex w-full shrink-0 flex-col gap-6 p-5 lg:flex-row lg:p-6"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-md" data-testid="carousel-icon">
            <BountyIcon bounty={bounty} size={64} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-body-base text-pk-content-secondary">
              {bounty.category}
              <span className="sr-only">
                , {index + 1} of {count}
              </span>
            </p>
            <h2 id={`${id}-title`} className="line-clamp-2 text-heading-xl text-pretty text-pk-content-primary sm:text-2xl sm:font-semibold">
              {/* Stretched over the slide: the whole card opens the bounty; the CTA sits above it. */}
              <a
                href={bounty.url}
                tabIndex={clone ? -1 : undefined}
                className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pk-gray-400"
              >
                {bounty.title}
              </a>
            </h2>
          </div>
        </header>

        {lead && <p className="line-clamp-2 max-w-[80ch] text-body-base text-pk-content-secondary sm:line-clamp-3">{lead}</p>}

        {/* The bounty is the slide's largest figure; the submission count lives in the leaderboard's header. */}
        <dl className="mt-auto flex flex-wrap items-end gap-x-12 gap-y-3">
          <div className="flex flex-col gap-1">
            <dt className={LABEL}>Bounty</dt>
            <dd className={`text-heading-4xl tabular-nums ${won ? 'text-pk-content-secondary' : 'text-pk-content-primary'}`} data-testid="carousel-amount">
              {formatBountyAmount(bounty.rewardAmount)}
            </dd>
          </div>
          <SlideClock bounty={bounty} labelId={`${id}-clock`} won={won} />
        </dl>

        <div>
          <a
            href={won ? bounty.url : `${bounty.url}#submit`}
            tabIndex={clone ? -1 : undefined}
            data-testid="carousel-cta"
            className={`relative z-20 inline-flex h-9 items-center rounded-full bg-pk-brand-500 px-4 text-body-base font-semibold whitespace-nowrap text-pk-elevated transition-opacity hover:opacity-90 motion-reduce:transition-none ${FOCUS_RING}`}
          >
            {won ? 'Use winning entry' : 'Submit an entry'}
          </a>
        </div>
      </div>

      <SlideLeaderboard bounty={bounty} won={won} />
    </div>
  );
}

export function TrendingCarousel({ bounties, status = 'live' }: { bounties: BoardBounty[]; status?: BoardStatus }) {
  const n = bounties.length;
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(rootRef);
  /** Strip position: 0..n-1 are the slides, n is the clone of slide 0 the loop slides onto before snapping back. */
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const posRef = useRef(0);
  const frame = useRef(0);
  /** The user's rotation control (APG): off once they stop it or tab into the carousel, back on only when they start it. */
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const touchX = useRef<number | null>(null);
  const canRotate = n > 1 && !reduced;
  const running = canRotate && playing && !hovered && onScreen;
  const index = pos % Math.max(n, 1);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const move = useCallback((p: number, withTransition: boolean) => {
    posRef.current = p;
    setAnimate(withTransition);
    setPos(p);
  }, []);

  /** Jump to `p` with no transition, let that position paint, then slide to `then`. */
  const jumpThen = useCallback(
    (p: number, then: number) => {
      move(p, false);
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => move(then, true));
      });
    },
    [move],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (n < 2) return;
      const from = posRef.current;
      if (reduced) return move((((from % n) + dir) % n + n) % n, false);
      if (dir === 1 && from >= n) return jumpThen(0, 1);
      if (dir === -1 && from <= 0) return jumpThen(n, n - 1);
      move(from + dir, true);
    },
    [n, reduced, move, jumpThen],
  );

  const ordered = n > 1 ? [...bounties, bounties[0]] : bounties;
  const label = status === 'won' ? 'Top won bounties' : 'Trending bounties';

  if (n === 0) return null;

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null || Math.abs(end - start) < SWIPE) return;
    step(end < start ? 1 : -1);
  };

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={label}
      data-testid="trending-carousel"
      data-state={running ? 'running' : 'paused'}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        // APG: keyboard focus anywhere in the carousel stops rotation until the user starts it again. A mouse click
        // focuses without :focus-visible and leaves it alone (the hover pause already covers the pointer).
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setPlaying(false);
      }}
    >
      {/*
        The rotation control: first in the tab order (APG: it precedes the rotating content) and invisible until it has
        keyboard focus, like a skip link, so the card shows no controls to a pointer user but a keyboard or screen reader
        user can still stop and start the slide show.
      */}
      {canRotate && (
        <button
          type="button"
          data-testid="carousel-rotation"
          aria-label={playing ? 'Stop automatic slide show' : 'Start automatic slide show'}
          onClick={() => setPlaying((v) => !v)}
          className={`pointer-events-none absolute top-3 left-3 z-30 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-pk-surface text-pk-content-primary opacity-0 shadow-pk-middle focus-visible:pointer-events-auto focus-visible:opacity-100 ${FOCUS_RING}`}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>
      )}
      {/* The dwell clock: nothing to see; keyed by slide so every slide gets the full dwell, paused with the carousel. */}
      {canRotate && playing && (
        <span
          key={index}
          aria-hidden="true"
          data-testid="carousel-progress"
          className="pk-dwell pointer-events-none absolute top-0 left-0 size-px opacity-0"
          style={{ animationPlayState: running ? 'running' : 'paused' }}
          onAnimationEnd={() => step(1)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-pk-border bg-pk-elevated shadow-pk-minimal-soft" style={{ touchAction: 'pan-y' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          data-testid="carousel-track"
          aria-live={running ? 'off' : 'polite'}
          aria-atomic="false"
          className={`flex ${animate && !reduced ? 'pk-slide' : ''}`}
          style={{ translate: `${-pos * 100}% 0` }}
          onTransitionEnd={(e) => {
            // Only the strip's own slide (cards inside run their own transitions): landing on the clone snaps to slide 0 unseen.
            if (e.target !== e.currentTarget || e.propertyName !== 'translate') return;
            if (posRef.current >= n) move(0, false);
          }}
        >
          {ordered.map((b, i) => (
            <Slide key={i === n ? 'clone' : b.id} bounty={b} index={i % n} count={n} active={i === pos} clone={i === n} />
          ))}
        </div>
      </div>
    </section>
  );
}

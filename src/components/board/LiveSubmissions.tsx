import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardBounty, Submission } from '../../lib/bounty';
import { formatScore, scoreDecimals } from '../../lib/profile';

/**
 * LIVE SUBMISSIONS: a bounty page's right column. A header (title, running total) over one list of who submitted,
 * newest first: "@handle" on the left, the relative time on the right. While the bounty is open and the tab is
 * visible, a client-side stream (deterministic from slug + tick) lands the first arrival 1.5 to 3 s after the page
 * opens, then one every 2.5 to 6 s. The viewer's own entries (`injected`: seeds plus what the form recorded, persisted)
 * sit in the list at their real times, marked with a muted "(you)"; a new one is the newest, so it lands on top like any
 * arrival. Each arrival opens its row (grid-rows 0fr -> 1fr, so the rows below glide
 * down), slides down and fades in over 300 ms, and holds a pk-blue-100 highlight that fades out by about 2 s. Under
 * reduced motion rows just appear. Once the deadline passes the panel is the final field: "Submissions", no stream and no
 * entrance, every row newest first with its verified score in the bounty's metric (or "Not scored").
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';
const MAX_ROWS = 80;
/** The highlight holds this long, then fades over the 300 ms colour transition (about 2 s in all). */
const HIGHLIGHT_MS = 1_700;
const BUMP_MS = 700;
const ANNOUNCE_GAP_MS = 8_000;
const CLOCK_MS = 15_000;

// ---------- tiny seeded PRNG (no Math.random) ----------
type Rand = () => number;
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const pick = <T,>(xs: readonly T[], rand: Rand): T => xs[Math.floor(rand() * xs.length) % xs.length];

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);

/** Delay before stream tick `n` fires: 1.5 to 3 s for the first, then 2.5 to 6 s; deterministic from slug + tick. */
export const streamDelay = (slug: string, n: number): number => {
  const r = mulberry32(fnv1a(`${slug}#delay#${n}`))();
  return n === 0 ? 1_500 + Math.floor(r * 1_501) : 2_500 + Math.floor(r * 3_501);
};

const NEW_HUMANS = ['nova', 'kai.sol', 'rhea', 'milo_dev', 'juno', 'ezra.eth', 'lark', 'pia_codes', 'theo.k', 'amara', 'vik', 'cleo_ux', 'sana.b', 'otto_q'] as const;
const NEW_AGENTS = ['relay.agent', 'scout-7', 'forgebot', 'kite.agent', 'patchwork.ai', 'lumen.agent', 'tessera-bot', 'quill.ai', 'gridrunner', 'atlas.agent', 'vector-9', 'nimbus.agent'] as const;

interface Row {
  key: string;
  hunter: string;
  agent: boolean;
  createdAt: string;
  /** Appended by the client stream: gets the entrance and the highlight. */
  live?: boolean;
  /** The viewer's own entry (from `injected`): gets a muted "(you)". */
  you?: boolean;
  /** The verified score (passed submissions only): shown once the bounty has ended. */
  score?: number;
}

/** A passed submission's verified score, else undefined. */
const scoreOf = (s: Submission): number | undefined => (s.status === 'passed' && typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : undefined);

/**
 * One arrival for stream tick `n`: about half agents; an existing hunter about 45% of the time, else a new name. Never
 * the viewer: their handle (and any handle on their own rows) is skipped, in the known hunters and in the name pools.
 */
function makeArrival(slug: string, n: number, existing: readonly Row[], at: number, viewerHandle?: string): Row {
  const rand = mulberry32(fnv1a(`${slug}#arrival#${n}`));
  const agent = rand() < 0.5;
  const prev = existing[0]?.hunter;
  const mine = new Set(existing.filter((r) => r.you).map((r) => r.hunter));
  if (viewerHandle) mine.add(viewerHandle);
  const known = [...new Set(existing.filter((r) => r.agent === agent && r.hunter !== prev && !mine.has(r.hunter)).map((r) => r.hunter))];
  const pool: readonly string[] = agent ? NEW_AGENTS : NEW_HUMANS;
  let hunter = known.length > 0 && rand() < 0.45 ? pick(known, rand) : pick(pool, rand);
  // Step through the pool past the previous arrival and the viewer (the pool always has a free name).
  for (let i = 0; (hunter === prev || mine.has(hunter)) && i < pool.length; i++) hunter = pool[(pool.indexOf(hunter) + 1) % pool.length];
  return { key: `${slug}-live-${n}`, hunter, agent, createdAt: new Date(at).toISOString(), live: true };
}

const toRows = (subs: readonly Submission[], slug: string): Row[] =>
  subs
    .map((s, i) => ({ key: s.id ?? `${slug}-${i}`, hunter: s.hunter, agent: Boolean(s.agent), createdAt: s.createdAt, score: scoreOf(s), i }))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.i - a.i)
    .slice(0, MAX_ROWS)
    .map(({ i: _i, ...r }) => r);

/**
 * The viewer's entries in `injected` (newest last) that the panel has not shown yet, as rows newest first, plus the new
 * seen count. Items at index >= `seen` are new; a shorter list (reset) yields nothing and re-baselines the count.
 */
export function takeInjected(
  injected: readonly Submission[] | undefined,
  seen: number,
  slug: string,
  live: boolean,
): { rows: Row[]; seen: number } {
  const list = injected ?? [];
  if (list.length <= seen) return { rows: [], seen: list.length };
  const rows = list
    .slice(seen)
    .map((s, j) => ({
      key: `${slug}-you-${s.id ?? seen + j}`,
      hunter: s.hunter,
      agent: Boolean(s.agent),
      createdAt: s.createdAt,
      score: scoreOf(s),
      you: true,
      ...(live ? { live: true } : {}),
    }))
    .reverse();
  return { rows, seen: list.length };
}

// ---------- formatting ----------
const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return DATE_FMT.format(t);
}

/** False on mount, true two frames later: the start and end states of an entrance transition. */
function useEntered(animate: boolean): boolean {
  const [entered, setEntered] = useState(!animate);
  useEffect(() => {
    if (entered) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [entered]);
  return entered;
}

// ---------- components ----------
interface LiveSubmissionsProps {
  bounty: BoardBounty;
  /** Reports the running total (the data's count plus live arrivals plus the viewer's own) so the page can show it too. */
  onTotal?: (n: number) => void;
  /** The viewer's own submissions (seeds plus form entries), newest last. Shown at their times; each new item lands on top. */
  injected?: Submission[];
  /** The viewer's current handle: labels their rows and is never used for a stream arrival. */
  viewerHandle?: string;
}

export function LiveSubmissions({ bounty, onTotal, injected, viewerHandle }: LiveSubmissionsProps) {
  // Remount (fresh state, every timer cleared) when the bounty changes or its data hot-reloads. `injected` and
  // `viewerHandle` are watched inside, never part of the key.
  return (
    <LiveSubmissionsPanel key={`${bounty.slug}:${bounty.submissions?.length ?? 0}`} bounty={bounty} onTotal={onTotal} injected={injected} viewerHandle={viewerHandle} />
  );
}

function LiveSubmissionsPanel({ bounty, onTotal, injected, viewerHandle }: LiveSubmissionsProps) {
  const slug = bounty.slug || bounty.id;
  const deadlineMs = Date.parse(bounty.deadline);
  const [now, setNow] = useState(() => Date.now());
  // Entries already in `injected` at mount (persisted ones after a reload, the seeds) show at once, without the entrance,
  // each at its own time among everyone else's (a stable sort keeps equal times in their given order).
  const [initialMine] = useState(() => takeInjected(injected, 0, slug, false));
  const [rows, setRows] = useState<Row[]>(() => [...initialMine.rows, ...toRows(bounty.submissions ?? [], slug)].sort(byNewest).slice(0, MAX_ROWS));
  const viewerRef = useRef(viewerHandle);
  useEffect(() => {
    viewerRef.current = viewerHandle;
  }, [viewerHandle]);
  const [added, setAdded] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
  const drop = useCallback((id: ReturnType<typeof setTimeout>) => {
    clearTimeout(id);
    timers.current.delete(id);
  }, []);

  const lastAnnounce = useRef(-Infinity);
  const announce = useCallback((text: string) => {
    const at = Date.now();
    if (at - lastAnnounce.current < ANNOUNCE_GAP_MS) return;
    lastAnnounce.current = at;
    setAnnouncement(text);
  }, []);

  /** One arrival: on top, counted, highlighted for about 2 s, announced. */
  const land = useCallback(
    (row: Row, at: number, text: string) => {
      rowsRef.current = [row, ...rowsRef.current].slice(0, MAX_ROWS);
      setRows(rowsRef.current);
      setAdded((a) => a + 1);
      setNow(at);
      setFresh((prev) => new Set(prev).add(row.key));
      later(() => {
        setFresh((prev) => {
          const s = new Set(prev);
          s.delete(row.key);
          return s;
        });
      }, HIGHLIGHT_MS);
      announce(text);
    },
    [later, announce],
  );

  // The viewer's own entries: each new item in `injected` (a fresh submit, so the newest) lands on top like any arrival.
  const seenMine = useRef(initialMine.seen);
  // Your new entries only land with the entrance while the bounty is open.
  const openRef = useRef(Number.isNaN(deadlineMs) || Date.now() < deadlineMs);
  useEffect(() => {
    const { rows: mine, seen } = takeInjected(injected, seenMine.current, slug, openRef.current);
    seenMine.current = seen;
    const at = Date.now();
    // Oldest first, so the newest ends on top.
    for (let k = mine.length - 1; k >= 0; k--) land(mine[k], at, 'Your submission was added');
  }, [injected, slug, land]);

  const open = Number.isNaN(deadlineMs) || now < deadlineMs;
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  // Ended: each row carries its final score in the bounty's metric.
  const metric = bounty.resolution?.metric;
  const dp = scoreDecimals(bounty);
  const scoreText = (r: Row): string | null => (open ? null : r.score === undefined ? 'Not scored' : formatScore(r.score, metric ?? { unit: '' }, dp));

  // Relative times refresh every 15 s; flip to closed exactly at the deadline.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    const left = deadlineMs - Date.now();
    const end = left > 0 && left < 2 ** 31 - 1 ? setTimeout(() => setNow(Date.now()), left + 50) : undefined;
    return () => {
      clearInterval(id);
      if (end) clearTimeout(end);
    };
  }, [deadlineMs]);

  // The stream: one arrival per tick while open and visible.
  const tick = useRef(0);
  useEffect(() => {
    if (!open) return;
    let next: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (next !== undefined || document.visibilityState === 'hidden') return;
      next = later(fire, streamDelay(slug, tick.current));
    };
    const fire = () => {
      next = undefined;
      const at = Date.now();
      if (!Number.isNaN(deadlineMs) && at >= deadlineMs) {
        setNow(at);
        return;
      }
      const row = makeArrival(slug, tick.current++, rowsRef.current, at, viewerRef.current);
      land(row, at, `@${row.hunter} submitted`);
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (next !== undefined) drop(next);
        next = undefined;
      } else schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (next !== undefined) drop(next);
    };
  }, [open, slug, deadlineMs, later, drop, land]);

  // Every timer dies with the panel.
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  const total = Math.max(bounty.submissionCount ?? 0, bounty.submissions?.length ?? 0) + initialMine.seen + added;
  // Braced: whatever the callback returns must never be taken for an effect cleanup.
  useEffect(() => {
    onTotal?.(total);
  }, [onTotal, total]);

  return (
    <section
      data-testid="live-submissions"
      aria-labelledby="live-submissions-title"
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-pk-border bg-pk-elevated"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 id="live-submissions-title" className="text-body-base font-semibold text-pk-content-primary">
          {open ? 'Live submissions' : 'Submissions'}
        </h2>
        <p className="text-body-sm text-pk-content-secondary">
          <TotalCount value={total} animate={added > 0} /> total
        </p>
      </header>
      <p className="sr-only" aria-live="polite" data-testid="live-announcer">
        {announcement}
      </p>

      {rows.length === 0 ? (
        <div className="mx-4 mb-4 flex flex-col items-center gap-3 rounded-xl bg-pk-gray-100 px-6 py-6 text-center" data-testid="live-empty">
          <p className="text-body-base text-pk-content-secondary">{open ? 'No submissions yet.' : 'No entries were submitted.'}</p>
          <button
            type="button"
            onClick={() => focusChatComposer()}
            className={`inline-flex h-9 items-center rounded-md bg-pk-brand-500 px-4 text-body-base font-semibold text-pk-elevated transition-opacity hover:opacity-90 motion-reduce:transition-none ${FOCUS_RING}`}
          >
            {open ? 'Submit an entry' : 'Go to the discussion'}
          </button>
        </div>
      ) : (
        <ol
          className={`max-h-[420px] overflow-y-auto overscroll-contain border-t border-pk-border [scrollbar-width:thin] [scrollbar-color:var(--color-pk-gray-300)_transparent] lg:max-h-[calc(100dvh-200px)] ${FOCUS_RING} focus-visible:ring-inset focus-visible:ring-offset-0`}
          aria-label="Submissions, newest first"
          data-testid="live-feed"
          tabIndex={0}
        >
          {rows.map((r) => (
            <FeedRow key={r.key} row={r} now={now} fresh={fresh.has(r.key)} viewerHandle={viewerHandle} score={scoreText(r)} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** The running total; each increase rolls the new number up into place and flashes it brand blue. */
function TotalCount({ value, animate }: { value: number; animate: boolean }) {
  return (
    <span className="inline-flex overflow-hidden align-bottom" data-testid="live-total">
      <TotalDigits key={value} value={value} animate={animate} />
    </span>
  );
}
function TotalDigits({ value, animate }: { value: number; animate: boolean }) {
  const entered = useEntered(animate);
  const [bump, setBump] = useState(animate);
  useEffect(() => {
    if (!bump) return;
    const id = setTimeout(() => setBump(false), BUMP_MS);
    return () => clearTimeout(id);
  }, [bump]);
  return (
    <span
      className={[
        'inline-block font-semibold tabular-nums transition-[color,opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
        bump ? 'text-pk-brand-500' : 'text-pk-content-primary',
      ].join(' ')}
    >
      {value.toLocaleString('en-US')}
    </span>
  );
}

function FeedRow({ row, now, fresh, viewerHandle, score }: { row: Row; now: number; fresh: boolean; viewerHandle?: string; score?: string | null }) {
  // Stream rows mount collapsed and above, then open and slide down on the next frame (instant under reduced motion).
  const entered = useEntered(Boolean(row.live));
  const when = relativeTime(row.createdAt, now);
  // Your rows follow your current handle, so a rename on the profile relabels them without a remount.
  const hunter = row.you && viewerHandle ? viewerHandle : row.hunter;

  return (
    <li
      data-testid="live-row"
      data-live={row.live ? 'true' : undefined}
      className={[
        'group grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        entered ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] motion-reduce:grid-rows-[1fr]',
      ].join(' ')}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={[
            'flex min-h-11 items-center gap-1.5 border-b border-pk-border px-4 py-2 group-last:border-b-0',
            'transition-[opacity,transform,background-color] duration-300 ease-out motion-reduce:transition-none',
            entered ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
            fresh ? 'bg-pk-blue-100 motion-reduce:bg-transparent' : 'bg-transparent',
          ].join(' ')}
        >
          <span className="min-w-0 truncate text-body-sm font-semibold text-pk-content-primary">@{hunter}</span>
          {row.you && (
            <span className="shrink-0 text-body-sm text-pk-content-tertiary" data-testid="live-row-you">
              (you)
            </span>
          )}
          {score ? (
            // Ended: the final score, with when it was submitted under it.
            <span className="ml-auto flex shrink-0 flex-col items-end pl-2" data-testid="live-row-final">
              <span className={`text-body-sm tabular-nums ${row.score === undefined ? 'text-pk-content-tertiary' : 'font-semibold text-pk-content-primary'}`} data-testid="live-row-score">
                {score}
              </span>
              {when && (
                <time dateTime={row.createdAt} className="text-body-xs text-pk-content-tertiary tabular-nums">
                  {when}
                </time>
              )}
            </span>
          ) : (
            when && (
              <time dateTime={row.createdAt} className="ml-auto shrink-0 pl-2 text-body-xs text-pk-content-tertiary tabular-nums">
                {when}
              </time>
            )
          )}
        </div>
      </div>
    </li>
  );
}

/** The empty state's action: take the hunter to the bounty's discussion composer, where entries are posted. */
function focusChatComposer() {
  const chat = document.querySelector<HTMLElement>('[data-testid="bounty-chat"]');
  const field = chat?.querySelector<HTMLElement>('textarea, input:not([type="hidden"]), button');
  (chat ?? field)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  field?.focus({ preventScroll: true });
}

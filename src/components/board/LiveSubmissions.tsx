import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardBounty, BountyCategory, BountyResolution, Submission, SubmissionStatus } from '../../lib/bounty';
import { SERIES_BG, SubmissionsChart, groupByHunter } from './SubmissionsChart';

/**
 * LIVE SUBMISSIONS: the top of a bounty page's right column. Header with a live dot and the running total, a compact
 * per-hunter step chart with a top-5 legend, and the feed (newest first). While the bounty is open and the tab is
 * visible, a client-side stream appends a new submission every 6 to 14 s (deterministic from slug + tick) and walks
 * each through pending -> verifying -> passed | failed.
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';
const LEGEND_MAX = 5;
const TO_VERIFYING_MS = 8_000;
const TO_RESULT_MS = 15_000;
const FRESH_MS = 2_400;
const ANNOUNCE_GAP_MS = 10_000;
const CLOCK_MS = 30_000;

// ---------- tiny seeded PRNG (no Math.random) ----------
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length) % xs.length];

/** Delay before stream tick `n` fires: 6 to 14 s, deterministic from the slug and the tick. */
export const streamDelay = (slug: string, n: number): number => 6_000 + Math.floor(mulberry32(fnv1a(`${slug}#delay#${n}`))() * 8_001);

// ---------- stream content: titles that read like agent runs ----------
type Rand = () => number;
type TitleFn = (run: number, r: Rand) => string;
const int = (r: Rand, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
const NUM = new Intl.NumberFormat('en-US');

const TITLES: Record<BountyCategory, readonly TitleFn[]> = {
  Trading: [
    (k, r) => `Run #${k}: ${int(r, 140, 320)}ms median, 1,000 tx`,
    (k, r) => `v${k + 1} router: ${(1.8 + r() * 3.4).toFixed(1)} bps slippage`,
    (k, r) => `Run #${k}: TWAP split over ${int(r, 3, 8)} pools`,
    (k) => `Market maker v${k}: tighter quotes, 5% inventory cap`,
    (k, r) => `Backtest + live run #${k}, ${int(r, 3, 14)}d window`,
  ],
  Forecasting: [
    (k, r) => `Brier ${(0.15 + r() * 0.07).toFixed(3)} on MW${int(r, 8, 14)}`,
    (k) => `Model v${k}: Elo + xG blend`,
    (k) => `Run #${k}: recalibrated on the last 200 markets`,
    (k, r) => `Ensemble of ${int(r, 3, 7)} models, isotonic calibration`,
  ],
  Security: [
    (k, r) => `Fuzz run #${k}: ${int(r, 2, 9)} findings, 1 high`,
    (k) => `Audit notes v${k}: reentrancy path in withdraw()`,
    (k, r) => `Invariant suite v${k}, ${int(r, 40, 180)} properties`,
    (k) => `Run #${k}: PoC for a signer check bypass`,
  ],
  Automation: [
    (k, r) => `Run #${k}: ${int(r, 92, 99)}% of tasks done unattended`,
    (k) => `Agent v${k}: retries + idempotent steps`,
    (k, r) => `Pipeline run #${k}: ${int(r, 18, 60)}s end to end`,
    (k) => `Scheduler v${k}: cron + backoff, 0 duplicate jobs`,
  ],
  Growth: [
    (k, r) => `Campaign run #${k}: ${NUM.format(int(r, 120, 900))} signups`,
    (k, r) => `Variant ${'ABCDEF'[int(r, 0, 5)]}: onboarding copy test`,
    (k, r) => `Referral loop v${k}: ${(1 + r() * 2).toFixed(1)}x invites per user`,
    (k, r) => `Outreach run #${k}: ${int(r, 40, 160)} replies`,
  ],
  Games: [
    (k, r) => `Run #${k}: ${NUM.format(int(r, 1200, 4800))} pts`,
    (k, r) => `Policy v${k}: MCTS, ${int(r, 4, 16) * 100} rollouts`,
    (k, r) => `Speedrun #${k}: ${int(r, 3, 9)}:${String(int(r, 0, 59)).padStart(2, '0')}`,
    (k, r) => `Bot v${k}: ${int(r, 55, 78)}% win rate vs baseline`,
  ],
};
const GENERIC_TITLES: readonly TitleFn[] = [(k) => `Run #${k}`, (k) => `Agent v${k}: tuned config`, (k, r) => `Run #${k}: ${int(r, 2, 9)} fixes since the last entry`];

const NEW_HUMANS = ['nova', 'kai.sol', 'rhea', 'milo_dev', 'juno', 'ezra.eth', 'lark', 'pia_codes', 'theo.k', 'amara', 'vik', 'cleo_ux'] as const;
const NEW_AGENTS = ['relay.agent', 'scout-7', 'forgebot', 'kite.agent', 'patchwork.ai', 'lumen.agent', 'tessera-bot', 'quill.ai', 'gridrunner', 'atlas.agent'] as const;

const shortId = (rand: Rand, len = 8): string => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(rand() * abc.length) % abc.length];
  return s;
};
const slugPart = (slug: string): string => slug.split('-').slice(0, 3).join('-') || 'entry';

function streamLink(category: BountyCategory | undefined, hunter: string, slug: string, run: number, rand: Rand): string {
  const h = hunter.replace(/[^a-z0-9_-]/gi, '');
  const repo = slugPart(slug);
  switch (category) {
    case 'Trading':
      return rand() < 0.5 ? `github.com/${h}/${repo}/pull/${int(rand, 10, 300)}` : `solscan.io/tx/${shortId(rand, 22)}`;
    case 'Forecasting':
      return `github.com/${h}/${repo}/blob/run-${run}/predictions.csv`;
    case 'Security':
      return `github.com/${h}/${repo}/issues/${int(rand, 3, 120)}`;
    case 'Games':
      return `github.com/${h}/${repo}/releases/tag/v${run}`;
    case 'Growth':
      return `docs.google.com/spreadsheets/d/${shortId(rand, 16)}`;
    default:
      return `github.com/${h}/${repo}/pull/${int(rand, 10, 300)}`;
  }
}

interface LiveItem extends Submission {
  key: string;
  /** Appended by the client stream (gets the entrance + highlight). */
  live?: boolean;
}

/** One new submission for stream tick `n`: an existing hunter about half the time, an agent about 40% of the time. */
function makeSubmission(bounty: BoardBounty, n: number, existing: LiveItem[], at: number): { item: LiveItem; outcome: SubmissionStatus } {
  const rand = mulberry32(fnv1a(`${bounty.slug}#sub#${n}`));
  const wantAgent = rand() < 0.4;
  const pool = existing.filter((s) => Boolean(s.agent) === wantAgent);
  const hunter = pool.length > 0 && rand() < 0.5 ? pick(pool, rand).hunter : pick(wantAgent ? NEW_AGENTS : NEW_HUMANS, rand);
  const run = existing.filter((s) => s.hunter === hunter).length + 1;
  const titles = TITLES[bounty.category] ?? GENERIC_TITLES;
  // Walk the category's titles in a slug-seeded order so consecutive ticks never repeat a template.
  const offset = fnv1a(`${bounty.slug}#titles`) % titles.length;
  const item: LiveItem = {
    key: `${bounty.slug}-live-${n}`,
    id: `${bounty.slug}-live-${n}`,
    hunter,
    createdAt: new Date(at).toISOString(),
    title: titles[(offset + n) % titles.length](run, rand),
    link: streamLink(bounty.category, hunter, bounty.slug, run, rand),
    status: 'pending',
    agent: wantAgent,
    live: true,
  };
  return { item, outcome: rand() < 0.72 ? 'passed' : 'failed' };
}

// ---------- scores ----------
type Metric = NonNullable<BountyResolution['metric']>;
const hasScore = <T extends Submission>(s: T): s is T & { score: number } =>
  typeof s.score === 'number' && Number.isFinite(s.score) && s.status !== 'failed' && s.status !== 'pending' && s.status !== 'verifying';
const beats = (a: number, b: number, m: Metric): boolean => (m.better === 'lower' ? a < b : a > b);

/** Three significant-ish digits: 4,812 / 212 / 41.3 / 4.13 / 0.187. */
const decimals = (v: number): number => {
  const a = Math.abs(v);
  return a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
};
const roundScore = (v: number): number => {
  const p = 10 ** decimals(v);
  return Math.round(v * p) / p;
};
export function formatScore(v: number, unit = ''): string {
  const d = decimals(v);
  const n = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (!unit) return n;
  if (unit === '%') return `${n}%`;
  if (unit === '$') return `$${n}`;
  return `${n} ${unit}`;
}

export interface LeaderRow {
  hunter: string;
  score: number;
  agent: boolean;
  at: number;
}

/** Best verified score per hunter, best first (ties: whoever got there first). */
export function leaderboard(subs: Submission[], metric: Metric): LeaderRow[] {
  const best = new Map<string, LeaderRow>();
  for (const s of subs) {
    if (!hasScore(s)) continue;
    const at = Date.parse(s.createdAt);
    const cur = best.get(s.hunter);
    if (!cur || beats(s.score, cur.score, metric)) best.set(s.hunter, { hunter: s.hunter, score: s.score, agent: Boolean(s.agent), at });
  }
  return [...best.values()].sort((a, b) => (a.score === b.score ? a.at - b.at : beats(a.score, b.score, metric) ? -1 : 1));
}

/** A plausible verified score near the field's spread; about one pass in four beats the current leader. */
function streamScore(metric: Metric, field: number[], rand: Rand): number {
  const dir = metric.better === 'lower' ? -1 : 1;
  let v: number;
  if (field.length === 0) {
    const base = metric.unit === 'ms' ? 240 : metric.unit === '%' ? 62 : metric.unit === 'bps' ? 6 : metric.unit === 's' ? 40 : 100;
    v = base * (0.85 + rand() * 0.3);
  } else {
    const best = dir > 0 ? Math.max(...field) : Math.min(...field);
    const worst = dir > 0 ? Math.min(...field) : Math.max(...field);
    if (rand() < 0.26) {
      v = best + dir * Math.max(Math.abs(best) * (0.008 + rand() * 0.045), 10 ** -decimals(best));
    } else {
      const span = best - worst || dir * Math.max(Math.abs(best) * 0.15, 1);
      v = worst + span * (-0.12 + 1.05 * Math.pow(rand(), 1.3)); // up to 93% of the way to the leader
    }
  }
  if (metric.unit === '%') v = Math.min(100, Math.max(0, v));
  if (metric.better === 'lower') v = Math.max(10 ** -decimals(v), v);
  return roundScore(v);
}

// ---------- formatting ----------
const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
export function relativeTime(iso: string, now: number): string {
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

const STATUS: Record<SubmissionStatus, { label: string; cls: string }> = {
  passed: { label: 'Passed', cls: 'bg-pk-green-500/15 text-pk-green-600' },
  failed: { label: 'Failed', cls: 'bg-pk-red-500/10 text-pk-red-500' },
  verifying: { label: 'Verifying', cls: 'bg-pk-blue-100 text-pk-brand-500' },
  pending: { label: 'Pending', cls: 'bg-pk-gray-100 text-pk-content-secondary' },
};

// ---------- components ----------
export function LiveSubmissions({ bounty }: { bounty: BoardBounty }) {
  // Remount (fresh state, every timer cleared) when the bounty changes or its data hot-reloads.
  return <LiveSubmissionsPanel key={`${bounty.slug}:${bounty.submissions?.length ?? 0}`} bounty={bounty} />;
}

function LiveSubmissionsPanel({ bounty }: { bounty: BoardBounty }) {
  const slug = bounty.slug || bounty.id;
  const deadlineMs = Date.parse(bounty.deadline);
  const metric = bounty.resolution?.metric;
  const [now, setNow] = useState(() => Date.now());
  const [items, setItems] = useState<LiveItem[]>(() =>
    (bounty.submissions ?? []).map((s, i) => ({ ...s, key: s.id ?? `${slug}-${i}` })),
  );
  const [added, setAdded] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [freshKeys, setFreshKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [leaderFlash, setLeaderFlash] = useState(false);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
  const lastAnnounce = useRef(0);
  const announce = useCallback((text: string, force = false) => {
    const at = Date.now();
    if (!force && at - lastAnnounce.current < ANNOUNCE_GAP_MS) return;
    lastAnnounce.current = at;
    setAnnouncement(text);
  }, []);

  const open = Number.isNaN(deadlineMs) || now < deadlineMs;

  // Relative times tick every 30 s; flip to closed exactly at the deadline.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    const left = deadlineMs - Date.now();
    const end = left > 0 && left < 2 ** 31 - 1 ? setTimeout(() => setNow(Date.now()), left + 50) : undefined;
    return () => {
      clearInterval(id);
      if (end) clearTimeout(end);
    };
  }, [deadlineMs]);

  const setVerifying = useCallback((key: string) => {
    setItems((prev) => prev.map((it) => (it.key === key && it.status === 'pending' ? { ...it, status: 'verifying' } : it)));
  }, []);

  /** Verification lands: a pass gets a score near the field (sometimes a new #1, announced). */
  const resolve = useCallback(
    (key: string, outcome: SubmissionStatus, seed: string) => {
      const cur = itemsRef.current;
      const self = cur.find((it) => it.key === key);
      if (!self) return;
      let score = self.score;
      if (outcome === 'passed' && metric && typeof score !== 'number') {
        const field = cur.filter(hasScore).map((s) => s.score);
        score = streamScore(metric, field, mulberry32(fnv1a(seed)));
      }
      const leaderBefore = metric ? leaderboard(cur, metric)[0] : undefined;
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status: outcome, score } : it)));
      if (outcome === 'passed' && metric && typeof score === 'number' && (!leaderBefore || beats(score, leaderBefore.score, metric))) {
        announce(`New leader: @${self.hunter}`, true);
        setLeaderFlash(true);
        later(() => setLeaderFlash(false), FRESH_MS);
      }
    },
    [metric, announce, later],
  );

  // Recent seed rows still in flight finish verifying too (the newest 3 that are pending or verifying).
  useEffect(() => {
    const inFlight = itemsRef.current
      .filter((s) => !s.live && (s.status === 'pending' || s.status === 'verifying'))
      .slice(-3)
      .reverse();
    inFlight.forEach((s, i) => {
      const seed = `${slug}#seed#${s.key}`;
      const outcome: SubmissionStatus = mulberry32(fnv1a(seed))() < 0.75 ? 'passed' : 'failed';
      const base = 3_000 + i * 4_000;
      if (s.status === 'pending') later(() => setVerifying(s.key), base);
      later(() => resolve(s.key, outcome, `${seed}#score`), base + TO_RESULT_MS - TO_VERIFYING_MS);
    });
  }, [slug, later, setVerifying, resolve]);

  // The stream: one new submission per tick while open and visible.
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
      const n = tick.current++;
      const { item, outcome } = makeSubmission(bounty, n, itemsRef.current, at);
      setItems((prev) => [...prev, item]);
      setAdded((a) => a + 1);
      setNow(at);
      setFreshKeys((prev) => new Set(prev).add(item.key));
      later(() => {
        setFreshKeys((prev) => {
          const s = new Set(prev);
          s.delete(item.key);
          return s;
        });
      }, FRESH_MS);
      later(() => setVerifying(item.key), TO_VERIFYING_MS);
      later(() => resolve(item.key, outcome, `${slug}#score#${n}`), TO_RESULT_MS);
      announce(`New submission from @${item.hunter}`);
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (next !== undefined) {
          clearTimeout(next);
          timers.current.delete(next);
          next = undefined;
        }
      } else schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (next !== undefined) {
        clearTimeout(next);
        timers.current.delete(next);
      }
    };
    // `bounty` is stable for this panel's life (the wrapper remounts it on change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug, deadlineMs, later, setVerifying, resolve, announce]);

  // Every timer dies with the panel.
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  const total = Math.max(bounty.submissionCount ?? 0, bounty.submissions?.length ?? 0) + added;
  const hunters = useMemo(() => groupByHunter(items), [items]);
  const board = useMemo(() => (metric ? leaderboard(items, metric).slice(0, LEGEND_MAX) : []), [items, metric]);
  // With a leaderboard, the chart follows its top 5 (the leaderboard doubles as the legend); else the most active.
  const series = useMemo(() => {
    if (board.length === 0) return hunters.slice(0, LEGEND_MAX);
    const byName = new Map(hunters.map((h) => [h.hunter, h]));
    return board.map((r) => byName.get(r.hunter) ?? { hunter: r.hunter, times: [] });
  }, [board, hunters]);
  const feed = useMemo(() => [...items].reverse(), [items]);
  const fromMs = Date.parse(bounty.publishedAt);
  const chartLabel =
    (board.length ? 'Cumulative submissions by the top 5 on the leaderboard: ' : 'Cumulative submissions per hunter: ') +
    series.map((h) => `@${h.hunter} ${h.times.length}`).join(', ') +
    `. Total ${total}.`;

  return (
    <section
      data-testid="live-submissions"
      aria-labelledby="live-submissions-title"
      className="flex min-w-0 flex-col rounded-xl border border-pk-border bg-pk-elevated"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="relative flex size-2">
            {open && <span className="absolute inset-0 rounded-full bg-pk-red-500 opacity-60 motion-safe:animate-ping motion-reduce:hidden" />}
            <span className={`relative size-2 rounded-full ${open ? 'bg-pk-red-500 motion-safe:animate-pulse' : 'bg-pk-gray-400'}`} />
          </span>
          <h2 id="live-submissions-title" className="text-body-base font-semibold text-pk-content-primary">
            {open ? 'Live submissions' : 'Submissions'}
          </h2>
        </div>
        <p className="text-body-sm text-pk-content-secondary">
          <span data-testid="live-total" className="font-semibold text-pk-content-primary tabular-nums">
            {total.toLocaleString('en-US')}
          </span>{' '}
          total
        </p>
      </header>
      <p className="sr-only" aria-live="polite" data-testid="live-announcer">
        {announcement}
      </p>

      {items.length === 0 ? (
        <div className="mx-4 mb-4 flex flex-col items-center gap-3 rounded-xl bg-pk-gray-100 px-6 py-6 text-center" data-testid="live-empty">
          <p className="text-body-base text-pk-content-secondary">No submissions yet.</p>
          <button
            type="button"
            onClick={() => focusChatComposer()}
            className={`inline-flex h-9 items-center rounded-md bg-pk-brand-500 px-4 text-body-base font-semibold text-pk-elevated transition-opacity hover:opacity-90 motion-reduce:transition-none ${FOCUS_RING}`}
          >
            Submit an entry
          </button>
        </div>
      ) : (
        <>
          <div className="px-4">
            {metric ? (
              <Leaderboard rows={board} metric={metric} flash={leaderFlash} />
            ) : (
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Top hunters by submissions" data-testid="live-legend">
                {series.map((h, i) => (
                  <li key={h.hunter} className="flex min-w-0 items-center gap-1.5 text-body-xs text-pk-content-secondary">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${SERIES_BG[i]}`} />
                    <span className="max-w-[110px] truncate">@{h.hunter}</span>
                    <span className="font-semibold text-pk-content-primary tabular-nums">{h.times.length}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative mt-2 h-[104px]">
              <SubmissionsChart series={series} from={Number.isNaN(fromMs) ? now - 86_400_000 : fromMs} to={now} label={chartLabel} />
            </div>
          </div>

          <ol
            className="mt-2 max-h-[184px] overflow-y-auto border-t border-pk-border"
            aria-label="Submissions, newest first"
            data-testid="live-feed"
            tabIndex={0}
          >
            {feed.map((s) => (
              <FeedRow key={s.key} item={s} now={now} fresh={freshKeys.has(s.key)} unit={metric?.unit} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function Leaderboard({ rows, metric, flash }: { rows: LeaderRow[]; metric: Metric; flash: boolean }) {
  return (
    <div data-testid="live-leaderboard">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body-xs font-semibold text-pk-content-secondary">Leaderboard</h3>
        <p className="min-w-0 truncate text-body-xs text-pk-content-tertiary">
          {metric.name}, {metric.better} is better
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-body-xs text-pk-content-tertiary">No verified scores yet.</p>
      ) : (
        <ol className="mt-1 flex flex-col" aria-label={`Leaderboard by ${metric.name}`}>
          {rows.map((r, i) => {
            const lead = i === 0;
            return (
              <li
                key={r.hunter}
                data-testid="leader-row"
                className={[
                  'flex h-[22px] items-center gap-2 rounded-md px-1.5 text-body-xs transition-colors duration-300 motion-reduce:transition-none',
                  lead ? (flash ? 'bg-pk-blue-200' : 'bg-pk-blue-100') : '',
                ].join(' ')}
              >
                <span className={`w-3 shrink-0 text-right tabular-nums ${lead ? 'font-semibold text-pk-brand-500' : 'text-pk-content-tertiary'}`}>{i + 1}</span>
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${SERIES_BG[i]}`} />
                <span className={`min-w-0 truncate ${lead ? 'font-semibold text-pk-content-primary' : 'text-pk-content-secondary'}`}>@{r.hunter}</span>
                {r.agent && <AgentBadge />}
                {lead && <span className="sr-only">(leader)</span>}
                <span className={`ml-auto shrink-0 font-semibold tabular-nums ${lead ? 'text-pk-brand-500' : 'text-pk-content-primary'}`} data-testid="leader-score">
                  {formatScore(r.score, metric.unit)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function AgentBadge() {
  return <span className="shrink-0 rounded-full border border-pk-border px-1.5 text-body-xs font-medium text-pk-content-secondary">Agent</span>;
}

function FeedRow({ item, now, fresh, unit }: { item: LiveItem; now: number; fresh: boolean; unit?: string }) {
  // Stream rows mount hidden and slide in on the next frame (instant under reduced motion).
  const [shown, setShown] = useState(!item.live);
  useEffect(() => {
    if (shown) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [shown]);
  const status = item.status ? STATUS[item.status] : undefined;
  const when = relativeTime(item.createdAt, now);
  const score = hasScore(item) ? formatScore(item.score, unit) : undefined;

  return (
    <li
      data-testid="live-row"
      data-status={item.status ?? ''}
      className={[
        'border-b border-pk-border px-4 py-2 last:border-b-0',
        'transition-[opacity,transform,background-color] duration-300 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
        fresh ? 'bg-pk-blue-100' : 'bg-transparent',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-body-sm font-semibold text-pk-content-primary">@{item.hunter}</span>
          {item.agent && <AgentBadge />}
        </div>
        {when && (
          <time dateTime={item.createdAt} className="shrink-0 text-body-xs text-pk-content-tertiary tabular-nums">
            {when}
          </time>
        )}
      </div>
      {(item.title || status) && (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-body-sm text-pk-content-primary">{item.title ?? ''}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {score && (
              <span className="text-body-xs font-semibold text-pk-content-primary tabular-nums" data-testid="live-score">
                {score}
              </span>
            )}
            {status && (
              <span
                data-testid="live-status"
                className={`rounded-full px-2 py-px text-body-xs font-medium transition-colors duration-300 motion-reduce:transition-none ${status.cls}`}
              >
                {status.label}
              </span>
            )}
          </div>
        </div>
      )}
      {item.link && (
        <p className="mt-0.5 truncate text-body-xs text-pk-content-secondary" title={item.link}>
          {item.link}
        </p>
      )}
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

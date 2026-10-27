import { useMemo, useRef, useState, type ReactNode } from 'react';
import { BountyIcon } from '../BountyIcon';
import { SelectMenu, type SelectMenuOption } from '../board/SelectMenu';
import { bountyPath, formatBountyAmount, type BoardBounty } from '../../lib/bounty';
import { BOARD_BOUNTIES } from '../../lib/bountyData';
import { appHref } from '../../lib/paths';
import { findBounty } from '../../lib/wonBounties';
import {
  endedBoardResults,
  formatScore,
  formatTimeLeft,
  mergeEnded,
  ordinal,
  rankOf,
  scoreDecimals,
  standingCopy,
  toSubmissions,
  type Entry,
  type PastResult,
  type Standing,
  type StandingCopy,
} from '../../lib/profile';
import {
  CheckCircleFilledGlyph,
  CheckCircleGlyph,
  ClearGlyph,
  EMPTY_ACTION,
  EmptyState,
  FlagGlyph,
  FOCUS_RING,
  ListHeader,
  MedalGlyph,
  Meta,
  MinusCircleGlyph,
  PAGE_SIZE,
  Pill,
  SearchGlyph,
  ShowMore,
} from './glyphs';

/**
 * The Live bounties and Won bounties tabs: polymarket's Positions panel for bounties, a search and a sort over one list.
 * Live: one row per board bounty still open, ranked by the shared standings engine. Won: every finish in the prizes
 * (the seeded past results, medal tiles, plus your board bounties that closed with you in a paid place, their own meme
 * linking to the bounty), all shown at once. Unplaced finishes live in Activity. A board bounty is in one list at most.
 */

export type EntriesView = 'live' | 'won';
type ActiveSort = 'rank' | 'ending' | 'prize';
type EndedSort = 'recent' | 'payout' | 'rank';

const ACTIVE_SORTS: readonly SelectMenuOption<ActiveSort>[] = [
  { value: 'rank', label: 'Rank' },
  { value: 'ending', label: 'Ending soon' },
  { value: 'prize', label: 'Prize now' },
];
const ENDED_SORTS: readonly SelectMenuOption<EndedSort>[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'payout', label: 'Payout' },
  { value: 'rank', label: 'Final rank' },
];

const DAY_MS = 86_400_000;
const ACTIVE_GRID = 'md:grid-cols-[minmax(0,1fr)_104px_148px_88px_96px]';
const ENDED_GRID = 'md:grid-cols-[96px_minmax(0,1fr)_104px_112px_96px]';
const ENDED_ON = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export interface ActiveRow {
  bounty: BoardBounty;
  standing: Standing;
  copy: StandingCopy;
  deadline: number;
  /** Paid places, e.g. 3 for rewards {1,2,3}. */
  places: number;
}

/** One row per bounty you entered that the board still lists and whose deadline is after `now`. */
export function activeRows(entries: Entry[], handle: string, bounties: BoardBounty[] = BOARD_BOUNTIES, now: number = Date.now()): ActiveRow[] {
  const bySlug = new Map(bounties.map((b) => [b.slug, b]));
  const slugs = [...new Set(entries.map((e) => e.bountySlug))].filter((s) => {
    const b = bySlug.get(s);
    return b !== undefined && Date.parse(b.deadline) > now;
  });
  return slugs.map((slug) => {
    const bounty = bySlug.get(slug)!;
    const standing = rankOf(bounty, handle, toSubmissions(entries, slug, handle));
    return { bounty, standing, copy: standingCopy(standing, bounty), deadline: Date.parse(bounty.deadline), places: Object.keys(bounty.rewards ?? {}).length };
  });
}

/** Rank order: ranked ascending, then in flight, then unranked. */
const stateOrder = (s: Standing): number => (s.kind === 'ranked' ? s.rank : s.kind === 'inflight' ? 10_000 : 20_000);
const prizeOf = (s: Standing): number => (s.kind === 'ranked' ? s.prize : 0);

export function sortActive(rows: ActiveRow[], sort: ActiveSort): ActiveRow[] {
  const byRank = (a: ActiveRow, b: ActiveRow) => stateOrder(a.standing) - stateOrder(b.standing) || a.deadline - b.deadline;
  const cmp =
    sort === 'ending' ? (a: ActiveRow, b: ActiveRow) => a.deadline - b.deadline || byRank(a, b) : sort === 'prize' ? (a: ActiveRow, b: ActiveRow) => prizeOf(b.standing) - prizeOf(a.standing) || byRank(a, b) : byRank;
  return [...rows].sort(cmp);
}

/** Unscored results (no final rank) sort after every ranked one. */
const finalRankOf = (p: PastResult) => (p.unscored ? Number.POSITIVE_INFINITY : p.finalRank);

export function sortEnded(rows: PastResult[], sort: EndedSort): PastResult[] {
  const recent = (a: PastResult, b: PastResult) => Date.parse(b.endedAt) - Date.parse(a.endedAt);
  const byRank = (a: PastResult, b: PastResult) => finalRankOf(a) - finalRankOf(b) || b.fieldSize - a.fieldSize || recent(a, b);
  const cmp = sort === 'payout' ? (a: PastResult, b: PastResult) => b.payout - a.payout || recent(a, b) : sort === 'rank' ? byRank : recent;
  return [...rows].sort(cmp);
}

const matches = (title: string, q: string) => title.toLowerCase().includes(q.trim().toLowerCase());

/** Every finish in the prizes: a final rank that paid out (1st to 3rd on every bounty here). Unplaced and unscored finishes are not wins. */
export const wonResults = (ended: PastResult[]): PastResult[] => ended.filter((p) => !p.unscored && p.payout > 0);

/** Every won bounty, from the seeded past results and your board bounties that have closed. */
export function allWon(entries: Entry[], past: PastResult[], handle: string, now: number): PastResult[] {
  return wonResults(mergeEnded(past, endedBoardResults(entries, handle, now)));
}

export function EntriesPanel({ view, entries, past, handle, now }: { view: EntriesView; entries: Entry[]; past: PastResult[]; handle: string; now: number }) {
  const [query, setQuery] = useState('');
  const [activeSort, setActiveSort] = useState<ActiveSort>('rank');
  const [endedSort, setEndedSort] = useState<EndedSort>('recent');
  const [shown, setShown] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => activeRows(entries, handle, BOARD_BOUNTIES, now), [entries, handle, now]);
  const won = useMemo(() => allWon(entries, past, handle, now), [past, entries, handle, now]);
  const activeShown = useMemo(() => sortActive(active.filter((r) => matches(r.bounty.title, query)), activeSort), [active, query, activeSort]);
  const wonShown = useMemo(() => sortEnded(won.filter((p) => matches(p.title, query)), endedSort), [won, query, endedSort]);

  const search = (q: string) => {
    setQuery(q);
    setShown(PAGE_SIZE);
  };
  const clearSearch = () => {
    search('');
    searchRef.current?.focus();
  };

  const live = view === 'live';
  const total = live ? active.length : won.length;
  const list = live ? activeShown : wonShown;

  let body: ReactNode;
  if (total === 0) {
    body = (
      <EmptyState
        sentence={live ? 'No live entries yet.' : 'No won bounties yet.'}
        action={
          <a href={appHref('/')} className={EMPTY_ACTION}>
            Browse bounties
          </a>
        }
      />
    );
  } else if (list.length === 0) {
    body = (
      <EmptyState
        sentence={`No entries match "${query.trim()}".`}
        action={
          <button type="button" onClick={clearSearch} className={EMPTY_ACTION}>
            Clear search
          </button>
        }
      />
    );
  } else if (live) {
    body = (
      <>
        <ListHeader
          grid={ACTIVE_GRID}
          columns={[{ label: 'Bounty' }, { label: 'Your best', end: true }, { label: 'Rank', end: true }, { label: 'Ends in', end: true }, { label: 'Prize now', end: true }]}
        />
        <ul aria-label="Live entries" className="flex flex-col">
          {activeShown.slice(0, shown).map((r) => (
            <ActiveItem key={r.bounty.slug} row={r} now={now} />
          ))}
        </ul>
      </>
    );
  } else {
    body = (
      <>
        <ListHeader
          grid={ENDED_GRID}
          columns={[{ label: 'Result' }, { label: 'Bounty' }, { label: 'Final rank', end: true }, { label: 'Your score', end: true }, { label: 'Payout', end: true }]}
        />
        {/* Every won bounty, all at once: no Show more. */}
        <ul aria-label="Won bounties" className="flex flex-col">
          {wonShown.map((p) => (
            <EndedItem key={p.id} result={p} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="flex min-w-0 flex-1 gap-2">
          <label className="flex h-10 min-w-0 flex-1 cursor-text items-center gap-1 rounded-md border border-pk-gray-200 bg-pk-surface px-2.5 transition-colors motion-reduce:transition-none hover:border-pk-gray-300 focus-within:border-pk-gray-300 focus-within:ring-2 focus-within:ring-pk-content-secondary/40">
            <span className="shrink-0 text-pk-content-secondary">
              <SearchGlyph />
            </span>
            <input
              ref={searchRef}
              type="search"
              autoComplete="off"
              aria-label={live ? 'Search live bounties' : 'Search won bounties'}
              placeholder={live ? 'Search live bounties' : 'Search won bounties'}
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  search('');
                }
              }}
              data-testid="profile-search"
              className="min-w-0 flex-1 bg-transparent px-1 text-body-base text-pk-content-primary outline-none focus-visible:outline-none placeholder:text-pk-content-tertiary max-md:text-[16px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-pk-content-secondary outline-none transition-colors motion-reduce:transition-none hover:bg-pk-hover-overlay-darker hover:text-pk-content-primary focus-visible:ring-2 focus-visible:ring-pk-content-secondary"
              >
                <ClearGlyph />
              </button>
            )}
          </label>
          {live ? (
            <SelectMenu label="Sort by" testId="profile-sort" value={activeSort} options={ACTIVE_SORTS} onChange={setActiveSort} />
          ) : (
            <SelectMenu label="Sort by" testId="profile-sort" value={endedSort} options={ENDED_SORTS} onChange={setEndedSort} />
          )}
        </div>
      </div>

      <div data-testid={live ? 'profile-live-list' : 'profile-won-list'} data-view={view}>
        {/* The seeded past finishes stay so the page has something to show; they are labelled as samples, not passed off as real. */}
        {!live && past.length > 0 && (
          <p data-testid="profile-sample-note" className="pb-2 text-body-sm text-pk-content-secondary">
            Sample results: these past finishes are example data for this preview.
          </p>
        )}
        {body}
        {live && list.length > shown && <ShowMore remaining={list.length - shown} onClick={() => setShown((n) => n + PAGE_SIZE)} />}
      </div>
    </div>
  );
}

/** A cell's caption: visible above the value on phones, read-only to assistive tech on desktop (where the header row shows it). */
function CellLabel({ children }: { children: ReactNode }) {
  return <span className="text-body-xs text-pk-content-secondary md:sr-only">{children}</span>;
}

const CELL = 'flex min-w-0 flex-col gap-0.5 md:items-end md:text-right';
const VALUE = 'text-body-base font-semibold text-pk-content-primary tabular-nums';
const SUB = 'text-body-sm text-pk-content-secondary';

function ActiveItem({ row, now }: { row: ActiveRow; now: number }) {
  const { bounty, standing, copy } = row;
  const metric = bounty.resolution.metric;
  const dp = scoreDecimals(bounty);
  const fmt = (x: number) => (metric ? formatScore(x, metric, dp) : String(x));
  const left = row.deadline - now;
  const urgent = left > 0 && left < DAY_MS;
  const endsIn = formatTimeLeft(left);
  const prize = prizeOf(standing);
  const rank = standing.kind === 'ranked' ? standing.rank : undefined;

  let best: ReactNode;
  let bestSub: string | null = null;
  if (standing.kind === 'ranked') {
    best = fmt(standing.score);
    if (standing.entries > 1) bestSub = `Best of ${standing.entries}`;
  } else if (standing.kind === 'inflight' && standing.selfScore !== undefined) {
    best = fmt(standing.selfScore);
    bestSub = 'Self-reported';
  } else {
    best = <span className="text-pk-content-secondary">No score yet</span>;
  }

  return (
    <li>
      <a
        href={bountyPath(bounty.slug)}
        data-testid="profile-active-row"
        data-slug={bounty.slug}
        data-state={standing.kind}
        data-rank={rank}
        className={`grid min-h-16 grid-cols-3 gap-x-3 gap-y-3 rounded-md px-3 py-3 transition-colors hover:bg-pk-gray-100 motion-reduce:transition-none md:items-center ${ACTIVE_GRID} ${FOCUS_RING}`}
      >
        <span className="col-span-3 flex min-w-0 items-center gap-3 md:col-span-1">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-pk-gray-100">
            <BountyIcon bounty={bounty} size={40} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="line-clamp-2 text-body-base font-semibold text-pk-content-primary">{bounty.title}</span>
            <span className={SUB}>
              <span className="hidden md:block">
                <Meta parts={[metric?.name ?? 'Verified entry', metric ? `${metric.better} wins` : null]} />
              </span>
              <span className="md:hidden">
                <Meta parts={[metric?.name ?? 'Verified entry', <span className={urgent ? 'text-pk-red-500' : ''}>{left > 0 ? `Ends in ${endsIn}` : 'Ended'}</span>]} />
              </span>
            </span>
          </span>
        </span>

        <span className={CELL}>
          <CellLabel>Your best</CellLabel>
          <span data-testid="profile-active-best" className={VALUE}>
            {best}
          </span>
          {bestSub && <span className={SUB}>{bestSub}</span>}
        </span>

        <span className={CELL}>
          <CellLabel>Rank</CellLabel>
          <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
            {standing.kind === 'inflight' && copy.pill ? (
              // In flight, the status is the rank: one pill, not the word twice.
              <span data-testid="profile-active-rank" className="inline-flex">
                <Pill tone={copy.pill} />
              </span>
            ) : (
              <>
                <span data-testid="profile-active-rank" className={`${VALUE} ${standing.kind === 'unranked' ? 'text-pk-content-secondary' : ''}`}>
                  {copy.rank}
                </span>
                {copy.pill && <Pill tone={copy.pill} />}
              </>
            )}
          </span>
          <span data-testid="profile-active-gap" className={`${SUB} text-pretty`}>
            {copy.detail}
          </span>
        </span>

        <span className={`${CELL} hidden md:flex`}>
          <CellLabel>Ends in</CellLabel>
          <span className={`${VALUE} ${urgent ? 'text-pk-red-500' : ''}`}>{endsIn}</span>
        </span>

        <span className={CELL}>
          <CellLabel>Prize now</CellLabel>
          <span data-testid="profile-active-prize" className={`${VALUE} ${prize > 0 ? '' : 'text-pk-content-secondary'}`}>
            {formatBountyAmount(prize)}
          </span>
          <span className={SUB}>{prize > 0 && rank ? `${ordinal(rank)} place` : row.places > 1 ? `Top ${row.places} paid` : row.places === 1 ? 'Winner paid' : 'No prize'}</span>
        </span>
      </a>
    </li>
  );
}

function ResultMark({ rank, unscored }: { rank: number; unscored?: boolean }) {
  if (unscored)
    return (
      <span className="flex items-center gap-1.5 text-body-base font-semibold text-pk-content-secondary">
        <MinusCircleGlyph />
        Not ranked
      </span>
    );
  if (rank === 1)
    return (
      <span className="flex items-center gap-1.5 text-body-base font-semibold text-pk-green-600">
        <CheckCircleFilledGlyph />
        Won
      </span>
    );
  if (rank <= 3)
    return (
      <span className="flex items-center gap-1.5 text-body-base font-semibold text-pk-content-primary">
        <CheckCircleGlyph className="size-4 text-pk-gray-500" />
        {ordinal(rank)} place
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-body-base font-semibold text-pk-content-secondary">
      <MinusCircleGlyph />
      Unplaced
    </span>
  );
}

const MEDAL = ['text-pk-chart-3', 'text-pk-gray-400', 'text-pk-chart-4'];
const BOARD_BY_SLUG = new Map(BOARD_BOUNTIES.map((b) => [b.slug, b]));
const ENDED_ROW = `grid min-h-16 grid-cols-3 gap-x-3 gap-y-3 rounded-md px-3 py-3 md:items-center ${ENDED_GRID}`;

function EndedItem({ result: p }: { result: PastResult }) {
  const result = p.unscored ? 'unscored' : p.finalRank === 1 ? 'won' : p.finalRank <= 3 ? 'placed' : 'unplaced';
  const score = p.unscored ? 'No score' : formatScore(p.score, p.metric, p.dp);
  const ended = `Ended ${ENDED_ON.format(new Date(p.endedAt))}`;
  const entrants = `${p.fieldSize.toLocaleString('en-US')} ${p.fieldSize === 1 ? 'entrant' : 'entrants'}`;
  // A board bounty that ended keeps its own meme; a seeded past result keeps its medal (or flag) tile, never a meme. Either
  // links to its bounty page when the slug resolves (board bounties and the won bounties alike).
  const bounty = p.slug ? BOARD_BY_SLUG.get(p.slug) : undefined;
  const target = p.slug ? (bounty ?? findBounty(p.slug)) : undefined;
  const cells = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <CellLabel>Result</CellLabel>
        <ResultMark rank={p.finalRank} unscored={p.unscored} />
      </span>

      <span className="order-first col-span-3 flex min-w-0 items-center gap-3 md:order-none md:col-span-1">
        {bounty ? (
          <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-pk-gray-100">
            <BountyIcon bounty={bounty} size={40} />
          </span>
        ) : (
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-pk-gray-100">
            {p.finalRank <= 3 && !p.unscored ? <MedalGlyph className={`size-6 ${MEDAL[p.finalRank - 1]}`} /> : <FlagGlyph className="size-5 text-pk-gray-500" />}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-body-base font-semibold text-pk-content-primary">{p.title}</span>
          <span className={SUB}>
            <span className="hidden md:block">
              <Meta parts={[entrants, ended]} />
            </span>
            <span className="md:hidden">
              <Meta parts={[`Your score ${score}`, entrants, ended]} />
            </span>
          </span>
        </span>
      </span>

      <span className={CELL}>
        <CellLabel>Final rank</CellLabel>
        <span data-testid="profile-ended-rank" className={`${VALUE} ${p.unscored ? 'text-pk-content-secondary' : ''}`}>
          {p.unscored ? 'Not ranked' : `#${p.finalRank} of ${p.fieldSize.toLocaleString('en-US')}`}
        </span>
        {p.unscored && <span className={SUB}>Not scored by the deadline</span>}
      </span>

      <span className={`${CELL} hidden md:flex`}>
        <CellLabel>Your score</CellLabel>
        <span className={`${VALUE} ${p.unscored ? 'text-pk-content-secondary' : ''}`}>{score}</span>
        {p.finalRank > 1 && p.fieldSize > 0 && <span className={SUB}>1st: {formatScore(p.firstScore, p.metric, p.dp)}</span>}
      </span>

      <span className={CELL}>
        <CellLabel>Payout</CellLabel>
        <span data-testid="profile-ended-payout" className={`${VALUE} ${p.payout > 0 ? 'text-pk-green-600' : 'text-pk-content-secondary'}`}>
          {p.payout > 0 ? `+${formatBountyAmount(p.payout)}` : formatBountyAmount(0)}
        </span>
      </span>
    </>
  );
  return (
    <li
      data-testid="profile-won-row"
      data-id={p.id}
      data-slug={p.slug}
      data-tile={bounty ? 'meme' : 'medal'}
      data-result={result}
      data-rank={p.unscored ? undefined : p.finalRank}
      className="rounded-md odd:bg-pk-gray-100/60"
    >
      {target ? (
        <a href={bountyPath(target.slug)} data-testid="profile-won-link" className={`${ENDED_ROW} transition-colors hover:bg-pk-gray-100 motion-reduce:transition-none ${FOCUS_RING}`}>
          {cells}
        </a>
      ) : (
        <div className={ENDED_ROW}>{cells}</div>
      )}
    </li>
  );
}

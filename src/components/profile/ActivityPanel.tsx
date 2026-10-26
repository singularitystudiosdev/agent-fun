import { useState, type ReactNode } from 'react';
import { bountyPath } from '../../lib/bounty';
import { appHref } from '../../lib/paths';
import type { ActivityItem, ActivityKind } from '../../lib/profile';
import { CheckGlyph, DollarGlyph, EMPTY_ACTION, EmptyState, FlagGlyph, FOCUS_RING, ListHeader, Meta, PAGE_SIZE, ShowMore, TrayUpGlyph } from './glyphs';

/**
 * The Activity tab: polymarket's activity table (TYPE, MARKET, AMOUNT) as a bounty timeline. Each row is a kind glyph
 * tile (never a meme or any image), the bounty (a link while the board lists it), the value and a relative time.
 */

const GRID = 'md:grid-cols-[132px_minmax(0,1fr)_140px_80px]';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Past this, a time reads as a date ("Oct 7"). */
const RELATIVE_DAYS = 30;
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** "now", "12m ago", "3h ago", "16d ago", then "Oct 7". */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  const ago = now - t;
  if (ago < MINUTE) return 'now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)}h ago`;
  if (ago < RELATIVE_DAYS * DAY) return `${Math.floor(ago / DAY)}d ago`;
  return SHORT_DATE.format(new Date(t));
}

const KIND: Record<ActivityKind, { label: string; tile: string; glyph: ReactNode }> = {
  submitted: { label: 'Submitted', tile: 'bg-pk-gray-100 text-pk-content-secondary', glyph: <TrayUpGlyph /> },
  scored: { label: 'Scored', tile: 'bg-pk-gray-100 text-pk-content-secondary', glyph: <CheckGlyph className="size-4" /> },
  finished: { label: 'Finished', tile: 'bg-pk-gray-100 text-pk-content-secondary', glyph: <FlagGlyph className="size-4" /> },
  paid: { label: 'Paid', tile: 'bg-pk-green-500/10 text-pk-green-600', glyph: <DollarGlyph /> },
};

export function ActivityPanel({ items, now }: { items: ActivityItem[]; now: number }) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (items.length === 0) {
    return (
      <EmptyState
        sentence="No activity yet."
        action={
          <a href={appHref('/')} className={EMPTY_ACTION}>
            Browse bounties
          </a>
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <ListHeader grid={GRID} columns={[{ label: 'Type' }, { label: 'Bounty' }, { label: 'Detail', end: true }, { label: 'When', end: true }]} />
      <ul aria-label="Activity" className="flex flex-col">
        {items.slice(0, shown).map((item) => (
          <ActivityRow key={item.id} item={item} now={now} />
        ))}
      </ul>
      {items.length > shown && <ShowMore remaining={items.length - shown} onClick={() => setShown((n) => n + PAGE_SIZE)} />}
    </div>
  );
}

function Title({ item }: { item: ActivityItem }) {
  const cls = 'line-clamp-2 text-body-base font-semibold text-pk-content-primary';
  return item.slug ? (
    <a href={bountyPath(item.slug)} className={`${cls} w-fit rounded-md hover:underline ${FOCUS_RING}`}>
      {item.title}
    </a>
  ) : (
    <span className={cls}>{item.title}</span>
  );
}

function Value({ item }: { item: ActivityItem }) {
  if (item.kind === 'submitted') return <span className="font-mono text-body-sm font-semibold text-pk-content-primary">{item.value}</span>;
  return <span className={`text-body-base font-semibold tabular-nums ${item.positive ? 'text-pk-green-600' : 'text-pk-content-primary'}`}>{item.value}</span>;
}

function ActivityRow({ item, now }: { item: ActivityItem; now: number }) {
  const kind = KIND[item.kind];
  const when = relativeTime(item.at, now);
  const tile = (
    <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-md ${kind.tile}`}>
      {kind.glyph}
    </span>
  );
  return (
    <li data-testid="profile-activity-row" data-kind={item.kind} className="rounded-md px-3 py-3 odd:bg-pk-gray-100/60">
      {/* Phone: tile, "Label · time" over the title, value at the right. */}
      <div className="flex items-start gap-3 md:hidden">
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Meta className="text-body-sm text-pk-content-secondary" parts={[<span className="font-semibold text-pk-content-primary">{kind.label}</span>, when]} />
          <Title item={item} />
        </div>
        <span className="shrink-0 pt-px text-right">
          <Value item={item} />
        </span>
      </div>

      {/* Desktop: TYPE | BOUNTY | DETAIL | WHEN. */}
      <div className={`hidden min-h-10 items-center gap-x-3 md:grid ${GRID}`}>
        <span className="flex items-center gap-3">
          {tile}
          <span className="text-body-base font-semibold text-pk-content-primary">{kind.label}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="sr-only">Bounty: </span>
          <Title item={item} />
        </span>
        <span className="min-w-0 truncate text-right">
          <span className="sr-only">Detail: </span>
          <Value item={item} />
        </span>
        <span className="text-right text-body-sm text-pk-content-secondary">
          <span className="sr-only">When: </span>
          {when}
        </span>
      </div>
    </li>
  );
}

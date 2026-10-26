import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatBountyAmount, formatEndedOn, type BoardBounty } from '../../lib/bounty';
import { formatCountdown, isExpired, isUrgent, useCountdown } from '../../lib/countdown';
import { RollingTime } from '../BountyCard';
import { BountyIcon } from '../BountyIcon';
import { BookmarkButton } from '../MarketCard';
import { BountyChat } from './BountyChat';
import { BountyDescription } from './BountyDescription';
import { LiveSubmissions } from './LiveSubmissions';
import { appHref } from '../../lib/paths';
import { ResolutionPanel } from './ResolutionPanel';

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-gray-400 focus-visible:ring-offset-2';
const ICON_BUTTON = `inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`;
const LABEL = 'text-body-sm font-semibold text-pk-content-secondary whitespace-nowrap';
const CHIP = 'inline-flex items-center rounded-full bg-pk-gray-100 px-2.5 py-1 text-body-sm text-pk-content-secondary whitespace-nowrap';
const ROW = 'flex min-h-12 items-center justify-between gap-6 border-b border-pk-border px-5 py-2.5 last:border-b-0';

function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}
const LinkGlyph = () => (
  <Icon>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);
const CheckGlyph = () => (
  <Icon>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const ChevronLeft = () => (
  <Icon className="size-4 shrink-0">
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
const VerifiedGlyph = () => (
  <Icon className="size-3.5 shrink-0 text-pk-brand-500">
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
/** The breadcrumb's middle dot, drawn as an element so it centres on the text's x-height. */
const Dot = () => (
  <>
    <span aria-hidden="true" className="size-[3px] shrink-0 rounded-full bg-pk-content-tertiary" />
    <span className="sr-only">,</span>
  </>
);

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const SCORE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
/** "12.4%" for percent units, otherwise "1,240 ms". */
const formatScore = (n: number, unit?: string): string => (!unit ? SCORE.format(n) : unit === '%' ? `${SCORE.format(n)}%` : `${SCORE.format(n)} ${unit}`);

/** The best verified score on the bounty's leaderboard metric, per `metric.better`; null until one exists. */
function leader(bounty: BoardBounty): { hunter: string; score: number; agent?: boolean } | null {
  const metric = bounty.resolution?.metric;
  if (!metric) return null;
  const lower = metric.better === 'lower';
  let best: { hunter: string; score: number; agent?: boolean } | null = null;
  for (const s of bounty.submissions ?? []) {
    const verified = s.status === 'passed' || s.status === undefined;
    if (!verified || typeof s.score !== 'number' || !Number.isFinite(s.score)) continue;
    if (!best || (lower ? s.score < best.score : s.score > best.score)) best = { hunter: s.hunter, score: s.score, agent: s.agent };
  }
  return best;
}

const safeDate = (iso: string | undefined): string | null => (iso && !Number.isNaN(Date.parse(iso)) ? formatEndedOn(iso) : null);

function CopyLinkButton({ bounty }: { bounty: BoardBounty }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);
  const onCopy = () => {
    const url = new URL(bounty.url, window.location.href).href;
    const done = () => {
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    };
    try {
      navigator.clipboard?.writeText(url).then(done, done);
    } catch {
      done();
    }
  };
  return (
    <button type="button" onClick={onCopy} aria-label={copied ? 'Link copied' : 'Copy link to this bounty'} className={ICON_BUTTON} data-testid="bounty-copy-link">
      {copied ? <CheckGlyph /> : <LinkGlyph />}
    </button>
  );
}

/** Label / value rows: the reward, the live countdown, every placement, skills, submissions and when it opened. */
function Facts({ bounty }: { bounty: BoardBounty }) {
  const labelId = useId();
  const remaining = useCountdown(bounty.deadline);
  const expired = isExpired(remaining);
  const places = Object.entries(bounty.rewards ?? {})
    .map(([k, usd]) => [Number(k), usd] as const)
    .filter(([k, usd]) => Number.isFinite(k) && usd > 0)
    .sort((a, b) => a[0] - b[0]);
  const opened = safeDate(bounty.publishedAt);
  const count = bounty.submissionCount ?? bounty.submissions?.length ?? 0;
  const skills = bounty.skills ?? [];
  const lead = leader(bounty);
  const metric = bounty.resolution?.metric;

  return (
    <dl data-testid="bounty-facts" className="flex flex-col rounded-xl border border-pk-border bg-pk-elevated">
      <div className={ROW}>
        <dt className={LABEL}>Bounty</dt>
        <dd className={`text-heading-2xl tabular-nums ${expired ? 'text-pk-content-secondary' : 'text-pk-content-primary'}`} data-testid="bounty-amount">
          {formatBountyAmount(bounty.rewardAmount)}
        </dd>
      </div>
      <div className={ROW}>
        <dt id={labelId} className={LABEL}>
          {expired ? 'Ended' : 'Ends in'}
        </dt>
        <dd data-testid="bounty-countdown">
          {expired ? (
            <time dateTime={bounty.deadline} className="text-heading-xl tabular-nums text-pk-content-secondary">
              {safeDate(bounty.deadline) ?? 'Ended'}
            </time>
          ) : (
            <RollingTime text={formatCountdown(remaining)} deadline={bounty.deadline} labelId={labelId} urgent={isUrgent(remaining)} />
          )}
        </dd>
      </div>
      {lead && metric && (
        <div className={ROW}>
          <dt className={LABEL}>Leading</dt>
          <dd className="flex min-w-0 items-baseline gap-2 text-body-base" data-testid="bounty-leading">
            <span className="truncate font-semibold text-pk-content-primary">@{lead.hunter}</span>
            {lead.agent && <span className="shrink-0 rounded-full bg-pk-gray-100 px-2 py-0.5 text-body-xs font-semibold text-pk-content-secondary">Agent</span>}
            <span className="shrink-0 font-semibold text-pk-brand-500 tabular-nums">{formatScore(lead.score, metric.unit)}</span>
            <span className="shrink-0 text-pk-content-tertiary">{metric.name}</span>
          </dd>
        </div>
      )}
      {places.length > 0 && (
        <div className={ROW}>
          <dt className={LABEL}>Prizes</dt>
          <dd>
            <ul className="flex flex-wrap justify-end gap-1.5" data-testid="bounty-prizes">
              {places.map(([k, usd]) => (
                <li key={k} className={CHIP}>
                  <span className="font-semibold text-pk-content-primary">{ordinal(k)}</span>&nbsp;{formatBountyAmount(usd)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {skills.length > 0 && (
        <div className={ROW}>
          <dt className={LABEL}>Skills</dt>
          <dd>
            <ul className="flex flex-wrap justify-end gap-1.5">
              {skills.map((s) => (
                <li key={s} className={CHIP}>
                  {s}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      <div className={ROW}>
        <dt className={LABEL}>Submissions</dt>
        <dd className="text-body-base font-semibold text-pk-content-primary tabular-nums" data-testid="bounty-submission-count">
          {count}
        </dd>
      </div>
      {opened && (
        <div className={ROW}>
          <dt className={LABEL}>Opened</dt>
          <dd className="text-body-base text-pk-content-primary">
            <time dateTime={bounty.publishedAt}>{opened}</time>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Height of the sticky site header, so the right column can stick just below it whatever the header's size. */
function useHeaderHeight(fallback = 132): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="site-header"]');
    if (!el) return;
    const read = () => setH(Math.round(el.getBoundingClientRect().height));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/**
 * One bounty's page, after polymarket.com's event page. LEFT: everything about the bounty (header, facts, the full
 * brief) and how its winner is verified. RIGHT (sticky under the header at lg): live submissions, the chat below them.
 */
export function BountyPage({ bounty }: { bounty: BoardBounty }) {
  const headerH = useHeaderHeight();
  const top = headerH + 16;
  const aboutId = useId();

  return (
    <article data-testid="bounty-page" aria-labelledby={`${aboutId}-title`} className="mx-auto w-full max-w-[1350px] px-4 pt-6 pb-16 lg:px-6">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* LEFT: the bounty */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <a
            href={appHref('/')}
            data-testid="bounty-back"
            className={`-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-body-base font-semibold text-pk-content-secondary transition-colors hover:text-pk-content-primary motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <ChevronLeft />
            All bounties
          </a>

          <header className="flex items-start gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md" data-testid="bounty-icon">
              <BountyIcon bounty={bounty} size={64} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex min-w-0 items-center gap-1.5 text-body-base text-pk-content-secondary" data-testid="bounty-breadcrumb">
                <span className="truncate">{bounty.sponsor?.name}</span>
                {bounty.sponsor?.isVerified && (
                  <>
                    <VerifiedGlyph />
                    <span className="sr-only">(verified sponsor)</span>
                  </>
                )}
                <Dot />
                <span className="shrink-0">{bounty.category}</span>
              </p>
              <h1 id={`${aboutId}-title`} className="text-2xl font-semibold text-pretty text-pk-content-primary">
                {bounty.title}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <CopyLinkButton bounty={bounty} />
              <BookmarkButton eventId={`bounty:${bounty.id}`} />
            </div>
          </header>

          <Facts bounty={bounty} />

          <section aria-labelledby={aboutId} className="flex flex-col gap-3" data-testid="bounty-about">
            <h2 id={aboutId} className="text-heading-xl text-pk-content-primary">
              About this bounty
            </h2>
            <BountyDescription text={bounty.description ?? ''} />
          </section>

          <ResolutionPanel resolution={bounty.resolution} />
        </div>

        {/* RIGHT: live submissions, then the chat */}
        <aside
          aria-label="Submissions and discussion"
          data-testid="bounty-side"
          style={{ ['--side-top' as string]: `${top}px` }}
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-(--side-top) lg:max-h-[calc(100dvh-var(--side-top)-16px)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin] lg:[scrollbar-color:var(--color-pk-gray-300)_transparent]"
        >
          <LiveSubmissions bounty={bounty} />
          <BountyChat bounty={bounty} />
        </aside>
      </div>
    </article>
  );
}

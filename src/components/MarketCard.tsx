import { useEffect, useId, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { cardVolumeSource, formatCardVolume } from '../lib/format';
import { eventHref, marketHref, selectCardRows, tradeHref, type GammaEvent, type GammaMarket } from '../lib/gamma';
import { rowView } from '../lib/odds';
import { GiftRewardsButton } from './GiftRewards';

// Class strings below are copied verbatim from the live polymarket.com card DOM (2026-10-25),
// so every utility resolves to the same computed value the site renders.
const PILL_BASE =
  'inline-flex items-center cursor-pointer duration-150 justify-center gap-2 whitespace-nowrap rounded-sm text-body-base font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
const YES_PILL = `${PILL_BASE} bg-pk-green-500/15 dark:text-pk-green-800 text-pk-green-600 active:scale-100 transition relative h-[27px] !rounded-xs group px-3.5 w-10 dark:hover:bg-pk-green-400 hover:bg-pk-green-600 hover:!text-white`;
const NO_PILL = `${PILL_BASE} bg-pk-red-500/9 dark:bg-pk-red-100 text-pk-red-500 dark:text-pk-red-700 hover:bg-pk-red-500/13 dark:hover:bg-pk-red-200 active:scale-100 transition relative h-[27px] !rounded-xs group px-3.5 w-10 hover:!bg-pk-red-500 hover:!text-white`;
const GHOST_BUTTON =
  'inline-flex items-center cursor-pointer active:scale-[97%] transition duration-150 justify-center gap-2 whitespace-nowrap text-body-base font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-button-ghost-bg w-7 h-7 hover:bg-pk-hover-overlay-darker';
export const CARD_SHELL =
  'relative flex flex-col justify-between rounded-xl shadow-pk-minimal-soft min-h-[180px] h-full overflow-hidden pt-3 group/card transition hover:-translate-y-px hover:shadow-pk-middle bg-pk-elevated isolate [&_a]:relative [&_a]:z-30 [&_button]:relative [&_button]:z-30';

function Pill({ className, href, label, hover }: { className: string; href: string; label: string; hover: string | null }) {
  // With no price the site turns the label/price cross-fade off and keeps the label.
  return (
    <a className={className} href={href}>
      <span
        className={`transition opacity-100 truncate absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 max-w-[36px] text-body-sm${hover === null ? '' : ' group-hover:opacity-0'}`}
      >
        {label}
      </span>
      {hover === null ? null : (
        <span className="text-body-sm text-center absolute transition top-1/2 -translate-y-1/2 opacity-0 left-1/2 -translate-x-1/2 group-hover:opacity-100">
          {hover}
        </span>
      )}
    </a>
  );
}

function MarketRow({ eventSlug, market }: { eventSlug: string; market: GammaMarket }) {
  const row = rowView(market);
  return (
    <div className="flex justify-between items-center gap-4 w-full shrink-0 group/market-row relative min-h-10">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <div className="min-w-0 text-body-base font-[440] text-pk-content-primary">
          <a
            className="group/market-row-link !static block min-w-0 cursor-pointer outline-none after:absolute after:inset-0 after:z-40 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pk-gray-400"
            href={marketHref(eventSlug, market.slug)}
          >
            <p className="line-clamp-1 break-all group-hover/market-row-link:underline group-focus-visible/market-row-link:underline">
              {row.name}
            </p>
          </a>
        </div>
      </div>
      <div className="shrink-0">
        <div className="relative z-50">
          <div className="flex justify-end gap-1 items-center">
            <p className="text-[15px] font-semibold text-pk-content-primary mr-1">{row.pct}</p>
            <Pill
              className={YES_PILL}
              href={tradeHref(eventSlug, market.slug, 0)}
              label={row.yesLabel}
              hover={row.hoverEnabled ? row.yesHover : null}
            />
            <Pill
              className={NO_PILL}
              href={tradeHref(eventSlug, market.slug, 1)}
              label={row.noLabel}
              hover={row.hoverEnabled ? row.noHover : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type BookmarkFrame = 'rest' | 'active' | 'unrolled' | 'rolled';

export function BookmarkButton({ eventId }: { eventId: string }) {
  const storageKey = `pm-card:favorite:${eventId}`;
  const [frame, setFrame] = useState<BookmarkFrame>('rest');

  useEffect(() => {
    if (localStorage.getItem(storageKey) === '1') setFrame('active');
  }, [storageKey]);

  // polymarket.com gates this behind login; the replica keeps the favorite in localStorage instead.
  const saved = frame === 'active' || frame === 'unrolled';
  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    const next = !saved;
    localStorage.setItem(storageKey, next ? '1' : '0');
    // Same-tab listeners (the board's Saved filter); the 'storage' event only reaches other tabs.
    window.dispatchEvent(new CustomEvent('bounty-saved-change', { detail: { eventId, saved: next } }));
    setFrame(next ? 'unrolled' : 'rolled');
  };

  return (
    <button
      className={`${GHOST_BUTTON} text-button-ghost-text rounded-full`}
      aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={saved}
      onClick={toggle}
    >
      <div className={`bookmarkButton small${frame === 'rest' ? '' : ` ${frame}`}`} />
    </button>
  );
}

const LG_QUERY = '(min-width: 1024px)';

function useIsLarge() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(LG_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(LG_QUERY).matches,
  );
}

export function MarketCard({ event }: { event: GammaEvent }) {
  const smallId = useId();
  const largeId = useId();
  const isLarge = useIsLarge();
  const rows = selectCardRows(event).map((market) => <MarketRow key={market.slug} eventSlug={event.slug} market={market} />);
  return (
    <div className={CARD_SHELL} data-testid="market-card">
      <div className="flex w-full items-start gap-2 px-3 h-[42px] static">
        <div className="overflow-hidden rounded-sm relative w-[38px] min-w-[38px] h-[38px]">
          <img
            alt={`${event.title} card icon`}
            loading="lazy"
            decoding="async"
            className="object-cover rounded-sm"
            style={{ position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, color: 'transparent' }}
            width={38}
            height={38}
            src={event.icon}
          />
        </div>
        <div className="flex flex-1 min-w-0 gap-4 justify-between cursor-default">
          <div className="flex-1 min-w-0 w-full">
            <a
              className="group !static flex h-fit w-full cursor-pointer touch-manipulation outline-none after:absolute after:inset-0 after:z-20 after:rounded-xl active:opacity-70 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pk-gray-400"
              href={eventHref(event.slug)}
            >
              <div className="flex flex-col justify-center min-h-[36px]">
                <h3 className="text-body-base text-pk-content-primary font-[590] w-fit line-clamp-3 text-pretty decoration-2 min-w-0 group-hover/card:underline">
                  {event.title}
                </h3>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-end gap-1.5 px-3 pb-2">
        {/* The live site renders its rows through @artsy/fresnel breakpoint wrappers (display: contents);
            only the matching branch gets children. */}
        <div className={`fresnel-container fresnel-lessThan-lg fresnel-${smallId} contents`}>
          {isLarge ? null : <div className="relative h-20 w-full select-none">{rows}</div>}
        </div>
        <div className={`fresnel-container fresnel-greaterThanOrEqual-lg fresnel-${largeId} contents`}>
          {isLarge ? <div className="relative mt-0.5 h-20 w-full">{rows}</div> : null}
        </div>
        <div className="flex w-full text-body-sm text-pk-content-secondary relative items-center">
          <div className="flex gap-2 justify-between items-center w-full overflow-x-auto whitespace-nowrap overflow-visible no-scrollbar">
            <div className="flex flex-row gap-1 items-center">
              <p className="text-pk-content-secondary">
                <span className="uppercase">{formatCardVolume(cardVolumeSource(event))} </span>Vol.
              </p>
            </div>
            <div className="flex justify-center items-center">
              <div className="flex">
                <GiftRewardsButton event={event} />
                <BookmarkButton eventId={event.id} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Same shell and row geometry as the card, shown while the first Gamma fetch is in flight. */
export function MarketCardSkeleton() {
  const bar = 'rounded-xs bg-pk-border motion-safe:animate-pulse';
  return (
    <div className={CARD_SHELL} aria-busy="true" aria-label="Loading market">
      <div className="flex w-full items-start gap-2 px-3 h-[42px] static">
        <div className={`${bar} !rounded-sm w-[38px] min-w-[38px] h-[38px]`} />
        <div className="flex flex-1 flex-col justify-center min-h-[36px] mt-0.5">
          <div className={`${bar} h-3.5 w-3/4`} />
        </div>
      </div>
      <div className="flex flex-col justify-end gap-1.5 px-3 pb-2">
        <div className="relative mt-0.5 h-20 w-full">
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between items-center gap-4 w-full min-h-10">
              <div className={`${bar} h-3.5 w-28`} />
              <div className="flex gap-1 items-center">
                <div className={`${bar} h-4 w-8 mr-1`} />
                <div className={`${bar} h-[27px] w-10`} />
                <div className={`${bar} h-[27px] w-10`} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex w-full items-center h-7">
          <div className={`${bar} h-3 w-16`} />
        </div>
      </div>
    </div>
  );
}

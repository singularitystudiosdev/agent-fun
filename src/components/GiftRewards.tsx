import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { eventHref, parseList, type GammaEvent, type GammaMarket } from '../lib/gamma';

// Everything below is transcribed from polymarket.com's bundles (05uf0enmgod06.js RewardsTooltipContent / eN,
// 3fv49yikqgzr1.js Tooltip* parts, 3oomsnc11dci_.js card footer, 1g6nz-g0pvylz.js reward helpers) and from the live
// popup's DOM and computed styles, retrieved 2026-10-25. Class strings are the live ones, verbatim.

const HELP_CENTER = 'https://help.polymarket.com';
const LEARN_MORE_URL = `${HELP_CENTER}/en/articles/13364466-liquidity-rewards`;
const SPONSOR_LEARN_MORE_URL = `${HELP_CENTER}/en/articles/13755867-sponsor-market-rewards`;
const CLOB_URL = 'https://clob.polymarket.com';

/** Tooltip `sideOffset` on the live gift button. */
const SIDE_OFFSET = 4;
/** Base UI Tooltip.Trigger default `delay` (ms): the live gift tooltip opens after a 600 ms hover rest (SPEC-SHARP section 4). */
const HOVER_DELAY_MS = 600;
/** react-query `retry: 1, retryDelay: 1000` of the live reward fetch with `immediate: true`. */
const RETRY_DELAY_MS = 1000;

// Verbatim from MarketCard.tsx (the live ghost icon button) so rest, hover and active styles do not change.
const GHOST_BUTTON =
  'inline-flex items-center cursor-pointer active:scale-[97%] transition duration-150 justify-center gap-2 whitespace-nowrap text-body-base font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-button-ghost-bg w-7 h-7 hover:bg-pk-hover-overlay-darker';

const POPUP_CLASS =
  'font-inter-body polykit-elevated-surface bg-pk-elevated border border-pk-border flex w-[280px] max-w-[280px] flex-col gap-3 overflow-hidden rounded-[28px] p-5 text-left [&:has([data-slot=tooltip-table])]:rounded-[20px] origin-(--transform-origin) transition-[scale,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[instant]:duration-0 motion-reduce:transition-none';
const BODY_CLASS = 'w-full text-left text-body-base font-medium text-pk-content-secondary wrap-break-word';
const LINK_CLASS = 'inline text-pk-content-accent-brand underline underline-offset-2 hover:opacity-80';
const TABLE_CLASS = 'flex w-full flex-col gap-3';
const ROW_CLASS = 'flex w-full items-center gap-2';
const KEY_CLASS = 'min-w-0 flex-1 text-heading-base font-semibold text-pk-content-primary';
const VALUE_CLASS = 'shrink-0 text-right tabular-nums text-heading-base font-medium text-pk-content-secondary';
const DIVIDER_CLASS = '-mx-5 h-px w-[calc(100%+2.5rem)] bg-pk-border';
const FADE_IN = 'animate-in fade-in duration-200 motion-reduce:animate-none';
// The live skeleton has no reduced-motion twin; `motion-reduce:before:animate-none` is this replica's guard.
const SKELETON =
  'relative overflow-hidden bg-pk-grouped/50 before:absolute before:inset-0 before:-translate-x-full before:-skew-x-12 before:animate-[skeletonShimmer_2s_infinite] motion-reduce:before:animate-none before:bg-gradient-to-r before:from-transparent before:via-pk-grouped before:to-transparent';
// `Button variant="outline"` (legacy cva: border border-button-outline-border text-button-outline-text hover:bg-pk-hover-overlay-darker)
// at the h-10 / rounded-[12px] box the live sponsor skeleton reserves; `motion-reduce:active:scale-100` is this replica's press-scale guard.
const OUTLINE_BUTTON =
  'inline-flex items-center cursor-pointer active:scale-[97%] motion-reduce:active:scale-100 transition duration-150 justify-center gap-2 whitespace-nowrap text-body-base font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 border border-button-outline-border text-button-outline-text hover:bg-pk-hover-overlay-darker w-full h-10 rounded-[12px]';

// ---------------------------------------------------------------------------------------------
// Which market the tooltip is about (3oomsnc11dci_.js: events.markets.filter(es).sort(sortEventMarketsByThreshold)[0])
// ---------------------------------------------------------------------------------------------

type RewardsMarket = GammaMarket & { archived?: boolean; hasRewards?: boolean; groupItemThreshold?: number | string };

/** hasRewardsConfig (1g6nz-g0pvylz.js). */
function hasRewardsConfig(m: RewardsMarket): boolean {
  if (typeof m.hasRewards === 'boolean') return m.hasRewards;
  return (
    Array.isArray(m.clobRewards) &&
    m.clobRewards.length > 0 &&
    typeof m.rewardsMaxSpread === 'number' &&
    m.rewardsMaxSpread > 0 &&
    typeof m.rewardsMinSize === 'number' &&
    m.rewardsMinSize > 0
  );
}

/** `es`: active, not closed, not archived, has a rewards config. */
const isRewardsMarket = (m: RewardsMarket) => !!m?.active && !m.closed && !m.archived && hasRewardsConfig(m);

/** sortEventMarketsByThreshold (365696 in 3ypzyxnbr4o7x.js); outcomePrices arrive as arrays on the live card, as JSON strings from Gamma. */
function byThreshold(a: RewardsMarket, b: RewardsMarket, event: GammaEvent): number {
  if (event.sortBy === 'price') {
    const pa = parseList(a.outcomePrices);
    const pb = parseList(b.outcomePrices);
    return pa.length && pb.length ? Number.parseFloat(pb[0]) - Number.parseFloat(pa[0]) : pa.length ? 1 : -1;
  }
  const ta = Number(a.groupItemThreshold) || 0;
  const tb = Number(b.groupItemThreshold) || 0;
  if (!ta && !tb) return 0;
  return ta ? (tb ? ta - tb : 1) : -1;
}

export function pickRewardsMarket(event: GammaEvent): GammaMarket | undefined {
  if (event.closed || !event.markets?.length) return undefined;
  return [...event.markets].filter(isRewardsMarket).sort((a, b) => byThreshold(a, b, event))[0];
}

// ---------------------------------------------------------------------------------------------
// Reward data: GET clob.polymarket.com/rewards/markets/{conditionId}?sponsored=true (fromV4toRewardMarkets)
// ---------------------------------------------------------------------------------------------

interface RewardView {
  /** One entry per reward asset; the live tooltip renders the USDC glyph next to each. */
  supplies: string[];
  maxSpread: number;
  minSize: number;
}

interface ClobRewardsResponse {
  data?: Array<{
    rewards_config?: Array<{ asset_address: string; rate_per_day: number }>;
    rewards_max_spread: number;
    rewards_min_size: number;
  }>;
}

/** formatClobTokenSupply (1g6nz-g0pvylz.js). */
function formatClobTokenSupply(raw: string): number {
  const n = Number.parseFloat(raw || '0');
  if (!Number.isFinite(n)) return 0;
  return n < 1 ? Number.parseFloat(n.toFixed(2)) : Math.floor(n);
}

function toRewardView(res: ClobRewardsResponse): RewardView | null {
  const first = res.data?.[0];
  if (!first) return null;
  const byAsset = new Map<string, number>();
  for (const c of first.rewards_config ?? []) byAsset.set(c.asset_address, (byAsset.get(c.asset_address) ?? 0) + c.rate_per_day);
  return {
    supplies: [...byAsset.values()].map((rate) => String(formatClobTokenSupply(rate.toString()))),
    maxSpread: first.rewards_max_spread,
    minSize: first.rewards_min_size,
  };
}

/** What Gamma already carries on the market; used for ?snapshot=1 and when the CLOB call fails. */
function gammaRewardView(m: GammaMarket): RewardView {
  const rate = (m.clobRewards ?? []).reduce((sum, r) => sum + r.rewardsDailyRate, 0);
  return { supplies: [String(formatClobTokenSupply(rate.toString()))], maxSpread: m.rewardsMaxSpread ?? 0, minSize: m.rewardsMinSize ?? 0 };
}

const lastGood = new Map<string, RewardView | null>();
const inFlight = new Map<string, Promise<RewardView | null>>();

async function fetchRewards(conditionId: string): Promise<RewardView | null> {
  const url = `${CLOB_URL}/rewards/markets/${conditionId}?sponsored=true`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CLOB rewards answered ${res.status}`);
      return toRewardView((await res.json()) as ClobRewardsResponse);
    } catch (err) {
      if (attempt >= 1) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

type RewardState = { status: 'loading'; view?: RewardView | null } | { status: 'ready'; view: RewardView | null };

/** Fetches on open (staleTime 0, like the live `immediate` query); the previous answer shows while refetching. */
function useRewards(market: GammaMarket, active: boolean): RewardState {
  const conditionId = market.conditionId;
  const frozen = new URLSearchParams(window.location.search).has('snapshot');
  const [state, setState] = useState<RewardState>(() =>
    frozen || !conditionId
      ? { status: 'ready', view: gammaRewardView(market) }
      : lastGood.has(conditionId)
        ? { status: 'ready', view: lastGood.get(conditionId) ?? null }
        : { status: 'loading' },
  );

  useEffect(() => {
    if (!active || frozen || !conditionId) return;
    let cancelled = false;
    let request = inFlight.get(conditionId);
    if (!request) {
      request = fetchRewards(conditionId).finally(() => inFlight.delete(conditionId));
      inFlight.set(conditionId, request);
    }
    request.then(
      (view) => {
        lastGood.set(conditionId, view);
        if (!cancelled) setState({ status: 'ready', view });
      },
      (err: unknown) => {
        console.warn('CLOB rewards fetch failed, showing the Gamma values.', err);
        if (!cancelled) setState({ status: 'ready', view: gammaRewardView(market) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, frozen, conditionId, market]);

  return state;
}

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

function GiftIcon() {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.5,
  } as const;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <line x1="9" y1="5.25" x2="9" y2="16.25" {...stroke} />
      <path d="M3.75,3.5c0-.966,.784-1.75,1.75-1.75,2.589,0,3.5,3.5,3.5,3.5h-3.5c-.966,0-1.75-.784-1.75-1.75Z" {...stroke} />
      <path d="M12.5,5.25h-3.5s.911-3.5,3.5-3.5c.966,0,1.75,.784,1.75,1.75s-.784,1.75-1.75,1.75Z" {...stroke} />
      <path d="M14.25,8.25v6c0,1.105-.895,2-2,2H5.75c-1.105,0-2-.895-2-2v-6" {...stroke} />
      <rect x="1.75" y="5.25" width="14.5" height="3" rx="1" ry="1" {...stroke} />
    </svg>
  );
}

/** renderTokenIcon (05uf0enmgod06.js, module 476180), the USDC glyph at 12px. */
function UsdcIcon() {
  return (
    <svg data-name="86977684-12db-4850-8f30-233a7c267d11" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" className="[--usdc-accent:#2775ca]" height="12px" width="12px" aria-hidden="true">
      <path d="M1000 2000c554.17 0 1000-445.83 1000-1000S1554.17 0 1000 0 0 445.83 0 1000s445.83 1000 1000 1000z" fill="var(--usdc-accent)" />
      <path d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z" fill="#fff" />
      <path d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z" fill="#fff" />
    </svg>
  );
}

const Label = ({ children }: { children: string }) => <span className="relative inline-block whitespace-pre">{children}</span>;

function RewardsBody({ reward, eventSlug, state }: { reward: RewardView | null; eventSlug: string; state: RewardState['status'] }) {
  const loading = state === 'loading';
  return (
    <>
      {loading || reward ? (
        <>
          <p data-slot="tooltip-body" className={BODY_CLASS}>
            Earn rewards by placing limit orders near the midpoint.{' '}
            <a data-slot="tooltip-link" className={LINK_CLASS} href={LEARN_MORE_URL}>
              Learn more.
            </a>
          </p>
          <div data-slot="tooltip-table" className={TABLE_CLASS}>
            <div data-slot="tooltip-table-row" className={ROW_CLASS}>
              <span data-slot="tooltip-table-key" className={KEY_CLASS}>
                Rewards
              </span>
              <span data-slot="tooltip-table-value" className={`${VALUE_CLASS} flex items-center`}>
                {reward ? (
                  reward.supplies.map((supply, i) => (
                    <span key={i} className={`ml-2 flex items-center justify-center ${FADE_IN}`}>
                      <UsdcIcon />
                      <span className="ml-0.5">
                        <Label>{supply}</Label>
                      </span>
                    </span>
                  ))
                ) : (
                  <div className={`${SKELETON} h-3 w-12 rounded-sm`} />
                )}
              </span>
            </div>
            <div data-slot="tooltip-table-row" className={ROW_CLASS}>
              <span data-slot="tooltip-table-key" className={KEY_CLASS}>
                Max Spread
              </span>
              {reward ? (
                <span data-slot="tooltip-table-value" className={`${VALUE_CLASS} ${FADE_IN}`}>
                  <Label>{`±${Math.floor(reward.maxSpread)}¢`}</Label>
                </span>
              ) : (
                <div className={`${SKELETON} h-3 w-8 rounded-sm`} />
              )}
            </div>
            <div data-slot="tooltip-table-row" className={ROW_CLASS}>
              <span data-slot="tooltip-table-key" className={KEY_CLASS}>
                Min Shares
              </span>
              {reward ? (
                <span data-slot="tooltip-table-value" className={`${VALUE_CLASS} ${FADE_IN}`}>
                  <Label>{String(reward.minSize)}</Label>
                </span>
              ) : (
                <div className={`${SKELETON} h-3 w-8 rounded-sm`} />
              )}
            </div>
          </div>
          <div data-slot="tooltip-divider" className={DIVIDER_CLASS} />
        </>
      ) : null}
      <p data-slot="tooltip-body" className={`${BODY_CLASS} ${FADE_IN}`}>
        Attract more liquidity by sponsoring rewards for this market.{' '}
        <a data-slot="tooltip-link" className={LINK_CLASS} href={SPONSOR_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer">
          Learn more.
        </a>
      </p>
      {/* On polymarket.com this opens the sponsor flow (a login or geoblock modal when logged out), which a replica cannot
          reproduce; it opens the event page in a new tab instead. */}
      <button
        type="button"
        className={`${OUTLINE_BUTTON} ${FADE_IN}`}
        onClick={() => window.open(eventHref(eventSlug), '_blank', 'noopener,noreferrer')}
      >
        Add Rewards
      </button>
    </>
  );
}

/** Is point p inside triangle abc? (Base UI keeps a hoverable popup open along a "safe polygon" from the trigger to the popup.) */
function inTriangle(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean {
  const cross = (o: [number, number], u: [number, number], v: [number, number]) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const d1 = cross(p, a, b);
  const d2 = cross(p, b, c);
  const d3 = cross(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// ---------------------------------------------------------------------------------------------
// Button + tooltip (Base UI Tooltip semantics: hover rest delay, instant on keyboard focus, Escape, hoverable popup)
// ---------------------------------------------------------------------------------------------

interface Placement {
  left: number;
  top: number;
  side: 'top' | 'bottom';
  originX: number;
}

function RewardsTooltip({ market, eventSlug, anchor, popupId, open, instant, onHoverPopup, onLeavePopup }: {
  market: GammaMarket;
  eventSlug: string;
  anchor: HTMLElement;
  popupId: string;
  open: boolean;
  instant: boolean;
  onHoverPopup: () => void;
  onLeavePopup: (e: MouseEvent) => void;
}) {
  const reward = useRewards(market, open);
  const positionerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [entered, setEntered] = useState(false);

  const place = useCallback(() => {
    const popup = popupRef.current;
    if (!popup) return;
    const a = anchor.getBoundingClientRect();
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    const idealLeft = a.left + a.width / 2 - w / 2;
    const left = Math.max(0, Math.min(idealLeft, window.innerWidth - w));
    // side="top"; flips to the bottom when the popup does not fit above (Base UI collision avoidance).
    const side = a.top - SIDE_OFFSET - h < 0 ? 'bottom' : 'top';
    const top = side === 'top' ? a.top - SIDE_OFFSET - h : a.bottom;
    setPlacement((prev) =>
      prev && prev.left === left && prev.top === top && prev.side === side ? prev : { left, top, side, originX: a.left + a.width / 2 - left },
    );
  }, [anchor]);

  // Measure before paint so the popup never shows at 0,0; re-place when the data (and so the height) changes.
  useLayoutEffect(place, [place, reward.status, reward.view]);
  useEffect(() => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  // data-starting-style is present on the first painted frame, then removed so the 150 ms scale/opacity transition runs.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);

  const side = placement?.side ?? 'top';
  const view = reward.status === 'ready' ? reward.view : (reward.view ?? null);
  return createPortal(
    <div
      ref={positionerRef}
      role="presentation"
      data-side={side}
      className="fixed left-0 top-0 z-[225]"
      style={{
        transform: placement ? `translate(${placement.left}px, ${placement.top}px)` : undefined,
        visibility: placement ? undefined : 'hidden',
        // The hoverable bridge: the sideOffset gap belongs to the positioner so the pointer can travel button to popup.
        [side === 'top' ? 'paddingBottom' : 'paddingTop']: SIDE_OFFSET,
        '--transform-origin': placement ? `${placement.originX}px ${side === 'top' ? '100%' : `-${SIDE_OFFSET}px`}` : undefined,
      } as CSSProperties}
      onMouseEnter={onHoverPopup}
      onMouseLeave={onLeavePopup}
    >
      <div
        ref={popupRef}
        id={popupId}
        data-polykit=""
        data-slot="tooltip-content"
        data-side={side}
        data-open={open ? '' : undefined}
        data-instant={instant ? 'focus' : undefined}
        data-starting-style={open && !entered ? '' : undefined}
        data-ending-style={open ? undefined : ''}
        tabIndex={-1}
        className={POPUP_CLASS}
      >
        <RewardsBody reward={view} eventSlug={eventSlug} state={reward.status} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * The gift "Rewards" icon button and its hover tooltip. Renders nothing unless the event has an active, open market
 * with a rewards config (polymarket.com: `hasRewardsConfig`).
 */
export function GiftRewardsButton({ event }: { event: GammaEvent }) {
  const market = pickRewardsMarket(event);
  if (!market) return null;
  return <GiftRewards market={market} eventSlug={event.slug} />;
}

function GiftRewards({ market, eventSlug }: { market: GammaMarket; eventSlug: string }) {
  const popupId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [instant, setInstant] = useState(false);
  const hoverTimer = useRef(0);
  const unmountTimer = useRef(0);
  const trackRef = useRef<(() => void) | null>(null);

  const show = useCallback((isInstant: boolean) => {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(unmountTimer.current);
    setInstant(isInstant);
    setMounted(true);
    setOpen(true);
  }, []);
  const stopTracking = useCallback(() => {
    trackRef.current?.();
    trackRef.current = null;
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    stopTracking();
    setOpen(false);
  }, [stopTracking]);

  // After the close transition: unmount. With no transition (reduced motion, or the instant focus open) unmount at once.
  useEffect(() => {
    if (open || !mounted) return;
    const popup = document.getElementById(popupId);
    const style = popup ? getComputedStyle(popup) : null;
    const seconds = style ? Number.parseFloat(style.transitionDuration) : 0;
    if (!style || style.transitionProperty === 'none' || !(seconds > 0)) {
      setMounted(false);
      return;
    }
    unmountTimer.current = window.setTimeout(() => setMounted(false), seconds * 1000);
    return () => window.clearTimeout(unmountTimer.current);
  }, [open, mounted, popupId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current);
      window.clearTimeout(unmountTimer.current);
      trackRef.current?.();
    },
    [],
  );

  const insidePopup = (target: EventTarget | null) => target instanceof Node && !!document.getElementById(popupId)?.parentElement?.contains(target);

  // Leaving the button toward the popup: stay open while the pointer is inside the triangle from the exit point to the popup's near edge.
  const trackSafePolygon = (start: [number, number]) => {
    stopTracking();
    const positioner = document.getElementById(popupId)?.parentElement;
    const popup = document.getElementById(popupId);
    if (!positioner || !popup) return hide();
    const r = popup.getBoundingClientRect();
    // Only a pointer that left the button inside the box spanning button and popup can be on its way to the popup.
    const b = buttonRef.current?.getBoundingClientRect();
    if (!b) return hide();
    const [x, y] = start;
    if (x < Math.min(r.left, b.left) || x > Math.max(r.right, b.right) || y < Math.min(r.top, b.top) || y > Math.max(r.bottom, b.bottom)) return hide();
    const near: Array<[number, number]> = r.bottom <= start[1] ? [[r.left, r.bottom], [r.right, r.bottom]] : [[r.left, r.top], [r.right, r.top]];
    const onMove = (ev: globalThis.MouseEvent) => {
      const t = ev.target;
      if (t instanceof Node && (positioner.contains(t) || buttonRef.current?.contains(t))) return;
      if (!inTriangle([ev.clientX, ev.clientY], start, near[0], near[1])) hide();
    };
    document.addEventListener('mousemove', onMove);
    trackRef.current = () => document.removeEventListener('mousemove', onMove);
  };

  const onMouseEnter = () => {
    stopTracking();
    if (open) {
      window.clearTimeout(unmountTimer.current);
      return;
    }
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => show(false), HOVER_DELAY_MS);
  };
  const onMouseLeave = (e: MouseEvent) => {
    window.clearTimeout(hoverTimer.current);
    if (insidePopup(e.relatedTarget)) return;
    if (open) trackSafePolygon([e.clientX, e.clientY]);
    else hide();
  };
  const onFocus = (e: FocusEvent<HTMLButtonElement>) => {
    if (e.currentTarget.matches(':focus-visible')) show(true);
  };
  const onBlur = (e: FocusEvent<HTMLButtonElement>) => {
    if (!insidePopup(e.relatedTarget)) hide();
  };
  // Touch screens have no hover: a tap toggles (the live Tooltip's `mobileSupport`).
  const onClick = () => {
    if ('ontouchstart' in window) (open ? hide : () => show(false))();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-slot="tooltip-trigger"
        className={`${GHOST_BUTTON} rounded-sm text-pk-content-secondary`}
        aria-label="Rewards"
        aria-describedby={open ? popupId : undefined}
        data-popup-open={open ? '' : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
      >
        <GiftIcon />
      </button>
      {mounted && buttonRef.current ? (
        <RewardsTooltip
          market={market}
          eventSlug={eventSlug}
          anchor={buttonRef.current}
          popupId={popupId}
          open={open}
          instant={instant}
          onHoverPopup={() => {
            stopTracking();
            window.clearTimeout(unmountTimer.current);
          }}
          onLeavePopup={(e) => {
            if (e.relatedTarget !== buttonRef.current) hide();
          }}
        />
      ) : null}
    </>
  );
}

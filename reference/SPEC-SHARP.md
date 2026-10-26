# SPEC-SHARP — Polymarket multi-outcome card: closed gaps (retrieved 2026-10-25)

Companion to `SPEC.md` (read it first; everything it states and I do not contradict below stands).
Sources: Polymarket production JS/CSS chunks (downloaded to `bundles/chunks/`, homepage HTML in `bundles/home.html`), live Chromium (Playwright 1.64, 1440x900, light, US IP) and https://docs.polymarket.com/market-data/realtime-data. Scripts: `scripts/*.mjs`. Nothing is from memory.

**Verification of the code below** (`sharp-formatters.ts`, same folder, runnable with `node --experimental-strip-types`):
- 42/42 live rows (bold %, Yes-hover, No-hover) reproduced exactly from each row's own market object (read from the React fiber, same page load).
- 21/21 live "$… Vol." strings reproduced from `event.volume`.
- 21/21 cards: `selectCardRows(gammaEvent)` returns exactly the two rows the live card shows.

Chunk names (all under `https://polymarket.com/_next/static/immutable/chunks/`):
`3acalnqxpe8tj.js` formatters (module 161469) · `0o13m-aj3hdor.js` percent logic (module 102742) · `2k4syqiaja107.js` rows/pills (modules 321090, `MultipleRestingSection`) · `3oomsnc11dci_.js` card shell, footer, `sortMarketsByPriceDesc` · `1bk6wnzy1y12g.js` `bucketEventMarkets`/`useSortedMarkets` · `3ypzyxnbr4o7x.js` bookmark/favorite + `getTagVisibility` · `05uf0enmgod06.js` gift/rewards · `2i4eu02voxu9f.js` + `3fv49yikqgzr1.js` tooltip · `0lf5ays936261.js` WS live-odds hook · `3zlgjr5mlf4rt.css` CSS.

---
## 1. Volume formatter ("$3M Vol.")

Source: `3oomsnc11dci_.js` `BodyFooterSection` → `formatAbbreviated(volume,{decimals:0,currency:true})` (`3acalnqxpe8tj.js` module 161469). It is plain `Intl.NumberFormat` compact notation, then `.toUpperCase()`. **There is no hand-rolled K/M/B threshold table.**

```ts
const compactUsd = new Intl.NumberFormat("en-US", {
  notation: "compact", compactDisplay: "short",
  minimumFractionDigits: 0, maximumFractionDigits: 0,
  style: "currency", currency: "USD",
});
export function formatCardVolume(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (n == null || !Number.isFinite(n)) return "$0";
  return compactUsd.format(n).toUpperCase();
}
// markup: <p class="text-pk-content-secondary"><span class="uppercase">{formatCardVolume(vol)} </span>Vol.</p>   ("Vol." = i18n events.headerMeta.volume)
```
Output table, run in the live Chromium (and node ICU 78 gave the identical values):
`0→$0 · 0.4→$0 · 0.5→$1 · 500→$500 · 999→$999 · 999.5→$1K · 1000→$1K · 1499→$1K · 1500→$2K · 9999→$10K · 99999→$100K · 999499→$999K · 999500→$1M · 999999→$1M · 1e6→$1M · 1.5e6→$2M · 2.5e6→$3M · 999999999→$1B · 1e9→$1B · 2.5e9→$3B · 1e12→$1T · NaN/null→$0`.
So 999,500 → **"$1M"** (never "$1000K"); rounding is Intl half-expand at the compact unit.

Which number: `seriesVolume24hr` if truthy; else if the event has exactly 1 market and no series: `markets[0].volume_num || parseFloat(markets[0].volume) || event.volume || 0`; else `event.volume` (float or string). Multi-outcome card = `event.volume`.

Hidden-below-$10K rule (`getTagVisibility`, `3ypzyxnbr4o7x.js`), for an active, not-ended event: `volume < 10_000` → **no "Vol." text; a yellow "NEW" tag instead** (`cards.new` = "NEW", `IconSparkle4Fill12` size 10, `text-pk-yellow-600` = `lab(62.8122% 18.834 66.9853)`, dark `pk-yellow-500` = `lab(76.4539% 11.7478 77.3971)`, `mt-px text-body-sm`). `volume >= 10_000` and `startDate` within the last 2 days → NEW **and** Vol (a `MultiMarketCardFooterDot` between them; that component was not read). Otherwise Vol only. Transcribed as `volumeTagVisibility` in `sharp-formatters.ts`.

## 2. Percent formatter

**Source field is NOT `outcomePrices`.** Bundle `0o13m-aj3hdor.js` (module 102742) `getPercentChanceFromMarket(market, precision=2)`; the card calls `useFallbackPercentChance(market)` with the default precision 2 ⇒ 0 decimals. Price used = **midpoint of `bestBid`/`bestAsk`** of the Yes token (fields on the gamma market object: `bestBid`, `bestAsk`, `lastTradePrice`, `spread`), or `lastTradePrice` when `spread > 0.1` and the last trade lies within [bid, ask]. `outcomePrices[0]` is only used (a) as the display fallback when the market has no `lastTradePrice` and no bid/ask at all and (b) for the row sort. See `getPercentChanceFromMarket` in `sharp-formatters.ts` (full transcription, copy that file). Core:

```ts
// l = unrounded Yes percent
const l = hasAsks && hasBids ? (bid + (ask - bid) / 2) * 100 : hasBids ? 100 * bid : hasAsks ? 100 * ask : undefined;
const h = parseFloat(l.toFixed(0));            // JS toFixed: round-half-up on the binary value
const text = h < 1 ? "<1%" : `${h}%`;          // so "<1%" when rounded value is 0 (mid < 0.5%), and "100%" is possible; there is NO ">99%"
// bid default 0 / ask default 1 when missing (bestBid>0 / bestAsk>0 flags are hasBids/hasAsks)
// spread = market.spread (if truthy and !== 1) else ask-bid
// wide-spread branch: spread > 0.1 && lastTradePrice in [bid,ask] → x = 100*lastTradePrice, same toFixed(0)/"<1%" rule; showLastPrice = spread <= 0.5
// no price at all → card shows "-" and the pill hover swap is disabled (noPricesAvailable)
```
Other formatter in the bundle (`formatPercentChance`, `1>parseInt(t.toFixed())&&t>0?"<1%"`) is used by the carousel/list, not by this card.

Evidence it is mid-price, not outcomePrices (same page load, JS `Math.round`): Šoškić bid .344/ask .386 → 36.5 → "37%"; SPEC's own drift note (outcomePrices 0.3385 yet rendered 36%) fits mid(.338,.39)=36.4. 42/42 rows match the midpoint code. In practice gamma's `outcomePrices[0]` is that same midpoint rounded to tick, so results coincide except ties/wide spreads.

## 3. Pill hover label

Component `j` in `2k4syqiaja107.js`:
```ts
// p = useFallbackPercentChance(market).lastPrice  (unrounded Yes percent; 0 if undefined)
probabilities = [p, 100 - p];                       // NOT outcomePrices[1], NOT No best ask
label = (y) => `${y < 1 && y > 0 ? "<1" : Math.round(y)}%`;   // hover text = label(probabilities[idx])
```
- Yes hover = `label(p)`, No hover = `label(100 - p)` — computed from the **unrounded** Yes mid, then rounded independently. Hence "Yes 65% / No 36%" (mid 64.5 → No 35.5 → 36) and bold "1%" with Yes hover "<1%" (mid 0.5–0.99) both occur live.
- Non Yes/No outcomes: label = first 3 chars + "." (`o.slice(0,3)+"."`).
- If `noPricesAvailable` (no price): bold shows "-" and the spans get no `group-hover` classes (no swap).
- Spans (exact): label `transition opacity-100 truncate absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 max-w-[36px] text-body-sm group-hover:opacity-0`; price `text-body-sm text-center absolute transition top-1/2 -translate-y-1/2 opacity-0 left-1/2 -translate-x-1/2 group-hover:opacity-100`.
- Transitions measured with `getAnimations()` on hover: **pill: `background-color` + `color`, 150ms `cubic-bezier(.4,0,.2,1)`; both spans: `opacity` (+`color`), 150ms, same easing**. No delay. (`.transition` utility + `duration-150` on the pill.)
```css
.pill      { transition: background-color .15s cubic-bezier(.4,0,.2,1), color .15s cubic-bezier(.4,0,.2,1); }
.pill span { transition: opacity .15s cubic-bezier(.4,0,.2,1), color .15s cubic-bezier(.4,0,.2,1); }
@media (hover:hover){ .pill:hover .label{opacity:0} .pill:hover .price{opacity:1} }
```

## 4. Bookmark and gift

**Bookmark sprite** (`3zlgjr5mlf4rt.css`, verbatim):
```css
.bookmarkButton{background-image:url(bookmark-sprite-light.svg);background-position:0;background-repeat:no-repeat;background-size:1500%;width:18px;height:18px}
.bookmarkButton.small{background-image:url(bookmark-sprite-small.3h8279e2t-kl2.svg);background-size:1500%;width:16px;height:16px}
[data-theme=dark] .bookmarkButton.small{background-image:url(bookmark-sprite-small-dark.1472_4fp6c1ep.svg)}
.bookmarkButton.active{background-position:100%}
.bookmarkButton.rolled{background-position:0}
.bookmarkButton.unrolled{background-position:100%;animation:.5s steps(14,end) forwards bookmark-unroll}
@keyframes bookmark-unroll{0%{background-position:0}to{background-position:100%}}
```
Toggle logic (`3ypzyxnbr4o7x.js` module 599361): first render: `active ? "active" : ""`. Later renders: turned **on** → `unrolled` (0.5s, 14 steps, forwards, frame 0 → 14); turned **off** → `rolled` (instant jump to frame 0, **no reverse animation**); unchanged-on → `active`. Class string `bookmarkButton small` + one of those. Button: `Button variant=ghost size=icon`, `className="w-7 h-7 hover:bg-pk-hover-overlay-darker rounded-full"`, `aria-label` "Add to favorites" / "Remove from favorites".
Click (`e.preventDefault()` first, so the card link does not fire), handler order: if **not authenticated**: injected callback if any → else `useUsGeoblockPrompt("favorite")` (US IP: shows the geoblock modal "It looks like you're in the US…") → else opens the login modal (`markSignupPromptOpened("favorite")`, SIWX route `LOGIN`, `setOpen(true)`). If authenticated: `toggleFavoriteEvent(eventId)` (+ analytics). Live check (US IP, logged out): click showed the geoblock modal and left the class at `bookmarkButton small` (no state change). The non-US login modal and the logged-in toggle were read from code, not exercised.

**Gift button** (`05uf0enmgod06.js`): `Button variant=ghost size=iconSm`, class `text-pk-content-secondary w-7 h-7 hover:bg-pk-hover-overlay-darker`, `aria-label` = i18n `rewards.rewards` ("Rewards"), icon `IconGiftOutline18 size=16`. Rendered only if the event has an active, non-closed market with rewards config (`hasRewardsConfig`). Wrapped in `Tooltip` (`sideOffset 4`, `variant "content"`, opens after **600 ms** hover rest, mouse only; also on focus). **Hover opens a rich tooltip** (captured live, 280px wide): 
`"Earn rewards by placing limit orders near the midpoint. Learn more."` (link → `https://help.polymarket.com/en/articles/13364466-liquidity-rewards`) then a table `Rewards <USDC icon> 1137` / `Max Spread ±6¢` / `Min Shares 150`, divider, `"Attract more liquidity by sponsoring rewards for this market. Learn more."` (→ `…/articles/13755867-sponsor-market-rewards`) and an outline button "Add Rewards". Data: `GET https://clob.polymarket.com/rewards/markets/{conditionId}?sponsored=true` (react-query, staleTime 30s).
Tooltip popup classes: `font-inter-body polykit-elevated-surface bg-pk-elevated border border-pk-border flex w-[280px] max-w-[280px] flex-col gap-3 overflow-hidden rounded-[28px] p-5 text-left [&:has([data-slot=tooltip-table])]:rounded-[20px] origin-(--transform-origin) transition-[scale,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0` (computed: bg #fff, border 1px #e6e8ec, radius 20px, padding 20px, no shadow, `data-side="top"`). Body `text-body-base font-medium text-pk-content-secondary`; link `text-pk-content-accent-brand underline underline-offset-2`; key `text-heading-base font-semibold text-pk-content-primary`; value `text-heading-base font-medium text-pk-content-secondary tabular-nums`. Screenshot: `live-gift-tooltip.png`.
**Click**: if the market is sponsorable and viewport not narrow: needs-enable-trading flow, else (logged out / normal) opens the "Sponsor rewards" modal (`ew`; footer button "Log in to continue" when logged out); portfolio redirect if a sponsorship is pending; no-op otherwise. Live click as US/logged-out showed the geoblock modal; the sponsor modal itself was read from code only.
Separate optional third footer icon (not on the Serbia card): holding-rewards button `IconDollarValueUpOutline18 size 17`, tooltip "Earn 3.25%", shown when the event has holding rewards.

## 5. Live prices

**The card itself is NOT live.** Verified: 25 polls x 21 homepage cards over 75 s = 0 text changes; the market objects on the cards are the SSR/hydrated ones (no refetch of events; only carousel chart requests repeat). The page opens WebSockets for the carousel/sports only; the 2 market-WS subscribe frames carried 2 and 7 tokens; none of the 106 token ids of the Serbia event were subscribed (0 frames for them in 44,352 market frames). No flash/tick/animation exists for a changed % (the `<p>` has no transition classes, the text node just swaps).
If the clone wants it live, the site's own live-odds hook (`0lf5ays936261.js` `useLiveOdds`) does this:
- Site endpoint (captured): `wss://ws-subscriptions-frontend-clob.polymarket.com/ws/market`; first frame `{"type":"markets","assets_ids":["<yesTokenId>", ...]}`; text `PING` every 30 s (reply `PONG`).
- Public documented endpoint (docs.polymarket.com, tested from node with `Origin: http://localhost:5173`, opened and streamed): `wss://ws-subscriptions-clob.polymarket.com/ws/market`; frame `{"assets_ids":["<clobTokenIds[0]>", ...],"type":"market"}` (add `"custom_feature_enabled":true` for `best_bid_ask`, `new_market`, `market_resolved`); heartbeat text `PING` every 10 s; add/remove without reconnect: `{"assets_ids":[...],"operation":"subscribe"|"unsubscribe"}`. Frames are single objects or arrays, snake_case.
- Message → price (mirrors the site): `price_change`: for each `price_changes[i]` with `asset_id` = the Yes token → `bestBid=parseFloat(best_bid)`, `bestAsk=parseFloat(best_ask)`. `book`: `bestBid=max(bids[].price)` (0 if none), `bestAsk=min(asks[].price)` (0 if none), `lastTrade=last_trade_price`. `last_trade_price`: `lastTrade = price`. `best_bid_ask` (needs custom flag; not seen in a 30 s test): `best_bid`, `best_ask`. Then recompute the % with the SAME function (bid>0 → hasBids, ask>0 → hasAsks, defaults 0/1, `zeroSpread = ask - bid`) and update the DOM at most once per second (site debounces 1000 ms after the first change). Both Yes and No assets appear inside one `price_change`; filter by the Yes asset id. Observed volume: ~43k `price_change` frames / 75 s on the 9 subscribed tokens.

## 6. Card-level CSS and grid

Card shell is `MarketCardShell` (`3oomsnc11dci_.js`): `relative flex flex-col justify-between rounded-xl shadow-pk-minimal-soft min-h-[180px] h-full overflow-hidden pt-3 group/card transition hover:-translate-y-px hover:shadow-pk-middle bg-pk-elevated` (+ `isolate [&_a]:relative [&_a]:z-30 [&_button]:relative [&_button]:z-30` from the caller). Hover transition measured with `getAnimations()`: **two CSSTransitions: `box-shadow` and `translate`, each 150 ms `cubic-bezier(.4,0,.2,1)`, delay 0**. Computed hover: `translate: 0px -1px` (uses the individual `translate` property, not `transform`).
```css
.card{box-shadow:0 0 0 1px rgba(0,0,0,.06),0 2px 6px -.5px rgba(0,0,0,.025),0 2px 10px 0 rgba(0,0,0,.025);
  transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,translate,scale,rotate,filter;
  transition-duration:.15s;transition-timing-function:cubic-bezier(.4,0,.2,1)}
@media (hover:hover){.card:hover{translate:0 -1px;
  box-shadow:0 0 0 1px rgba(35,39,45,.06),0 1px 1px -.5px rgba(0,0,0,.06),0 3px 3px -1.5px rgba(0,0,0,.06),0 6px 6px -3px rgba(0,0,0,.06)}}   /* ring = oklch(0.2715 0.0129 256.761 / .06) */
.card:hover h3{text-decoration:underline;text-decoration-thickness:2px}   /* group-hover/card:underline decoration-2, instant */
```
Focus-visible (keyboard Tab, computed): title link `::after` (`absolute inset-0 z-20 rounded-xl`) gets `box-shadow: inset 0 0 0 2px #bfc3ca` (`lab(78.7165 -.528604 -3.76731)`), radius 15.2px, inset 0; row-name link `::after` (`z-40 rounded-sm`) same ring, radius 7.2px; pill/gift/bookmark: `focus-visible:outline-none focus-visible:ring-1 ring-ring` = `0 0 0 1px #6b727b` (`lab(47.7217% -1.37293 -5.88264)`), animated by the 150 ms box-shadow transition. Pressed title link `active:opacity-70`; gift/bookmark `active:scale-[97%]`; pills `active:scale-100`.

Grid (measured, `scripts/ui.mjs` → `grid-ancestors.json`): the card's parents are two plain `div`s, then
`div.grid.h-auto.gap-3.grid-cols-1.md:grid-cols-2.lg:grid-cols-3.xl:grid-cols-4` (computed `316.5px ×4`, gap 12px, width 1302px) inside `div.flex.flex-col.gap-3.w-full.shrink-0.h-auto.relative.pt-px.pb-10.px-4.lg:px-6` (1350px, padding 24px) inside `div.flex.flex-col.gap-3.pt-3.items-center.w-full.lg:max-w-[1350px].lg:mx-auto.lg:mb-4.lg:pt-2`.
Breakpoints are Tailwind defaults (CSS: `md` 48rem, `lg` 64rem, `xl` 80rem; `grid-template-columns:repeat(n,minmax(0,1fr))`). Rule: `cardW = (min(1350, mainW) − 2·padX − gap·(cols−1)) / cols`, `padX = 16px (<1024) | 24px (≥1024)`, `gap = 12px`, `cols = 1 | 2 (≥768) | 3 (≥1024) | 4 (≥1280)`. At 1440: (1350−48−36)/4 = **316.5**. At 1280 with a 15px classic scrollbar: (1265−84)/4 = 295.25 (matches SPEC). To host one card at native width: `width:316.5px` (or a 4-col grid inside a 1302px box) — height is always 180 (`min-h-[180px] h-full`).
`<1024px` rows box (`lessThan-lg` branch, Fresnel): same row component, wrapper `relative h-20 w-full select-none`; the `≥1024` wrapper is `relative mt-0.5 h-20 w-full` (SPEC's DOM is the desktop one).

---
## SPEC.md corrections
1. §6 "%: Math.round(outcomePrices[i]*100) … uses outcomePrices, NOT lastTradePrice" → wrong source. Real: bid/ask midpoint (lastTradePrice only when spread > 0.1 and inside [bid,ask]; outcomePrices only as no-book fallback and for sort). Evidence: bundle `0o13m-aj3hdor.js` + 42/42 live rows.
2. §6 "`<1%` if price < 0.01" → wrong threshold. Bold shows "<1%" only when the **rounded** value is 0 (mid < 0.5%); mid 0.5–0.99% shows "1%". The hover Yes label uses the unrounded value so it can read "<1%" while the bold reads "1%" (seen live: Flávio Bolsonaro 1% / hover "<1%").
3. §6 "No hover cannot be distinguished from 100 − yes%" → it is `100 − unrounded Yes mid`, rounded separately (live: Yes 65%, No hover 36%).
4. §6 volume rule (`Math.round(v/1e6)M`, `Math.round(v/1e3)K`) breaks at 999,500–999,999 ("$1000K" vs live "$1M") and lacks B/T/<1K; use the Intl formatter in §1. Also missing the hide-below-$10K → "NEW" tag rule.
5. §6 row rule "sorted by outcomePrices[0] desc" is incomplete: first `active && !closed`, negRisk events drop markets whose mid < 1% (unless `showAllOutcomes`), then stable sort by `outcomePrices[0]` desc, `slice(0,2)` (`selectCardRows`, 21/21).
6. §4/§5 "gift = rewards tooltip (not captured)" → now captured (§4 above). Gift is conditional on rewards config; a third "Earn 3.25%" holding-rewards icon can exist.
7. §4 bookmark: `.rolled` is an instant reset (no reverse animation), not a played animation.
8. §10 UNRETRIEVED `lessThan-lg` markup → same row/pill components, wrapper `relative h-20 w-full select-none` (no `mt-0.5`).
9. §1 "Hovering a pill also hovers the card…" fine. §9 sprite copy is correct.

## Still UNRETRIEVED
- Dark-theme computed values for the card (not requested; token hexes in SPEC §2).
- Logged-in bookmark toggle and the non-US login modal appearance (needs an account / non-US IP; code path read in `3ypzyxnbr4o7x.js`). Sponsor-rewards modal body (code only).
- `MultiMarketCardFooterDot` markup (module 992132) used between NEW and Vol.
- `best_bid_ask` frame was never received in a 30 s `custom_feature_enabled` test (shape taken from docs).
- Whether other pages (event detail) update this exact card live: not applicable; homepage card verified static.

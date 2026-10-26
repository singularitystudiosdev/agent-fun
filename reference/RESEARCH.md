# Bounty card — prior-art sweep (retrieved 2026-10-25 America/Denver; scraper clock 2026-10-26T00:48Z)

Frame: Polymarket multi-outcome card shell (polymarket-card/src/components/MarketCard.tsx `CARD_SHELL`, header 38px icon + `font-[590]` h3, 80px rows box, footer) carrying **title → expiry countdown → $ reward**.
Artifacts in this dir: `shots/` (screenshots), `pm-*.json|html` (Polymarket DOM dumps), `pm-countdown-source.txt` (minified bundle excerpts), `superteam-*.json|txt`, `galxe-card-dom.json`, `scripts/` (Playwright scripts, reusable).

## 0. Verdict in one paragraph
Polymarket has **no countdown on the market card** (re-checked: DOM of cards has none; footer is "$3M Vol." only). It has exactly two live countdown UIs, both retrieved: (a) the homepage hero **crypto "Up or Down" slide**: label `Ends in` over a big rolling-digit timer, red `#ef4444` once under 1 day; (b) the event-page header `DateDisplay` (clock icon + date, tooltip with "Estimated time remaining: 2d 4h" when end is ≤7 days away). Its big-money style is the same hero slide's `Price To Beat / Current Price` pair: 12px label over 20/24px 600 Inter number with full commas (`$80,080`). So the bounty card should reuse: **label-over-number (text-body-xs / text-heading-xl)**, **red `#ef4444` under 24h**, **`d h` short format for days and `H:MM:SS` / `M:SS` below**, **Inter (not Geist Mono/openSauce)**. Geist Mono and openSauce are NOT used by any countdown (section 2.4), so no font download is needed.

## 1. Field vocabulary (what it is called in the field)
| Concept | Names in the wild (source) |
|---|---|
| the card | "ListingCard" (Superteam Earn bundle, `ListingCard` component), "quest card" (Galxe `/quest`), "market card" (Polymarket), "bounty" (Algora `Algora.Bounties.Bounty`, Bountycaster) |
| the prize | `rewardAmount` + `token` (Superteam), `amount: Money` (Algora), "reward" chip (Galxe "500 USDT"), "$ of bounties posted" (Bountycaster) |
| the clock | `deadline` (Superteam JSON, Algora schema), "Due in 5d" (Superteam), "End in 10H:40M" (Galxe), "Ends in" (Polymarket `homepageV2.endsIn`), "Ending soon" tab (Bountycaster) |
| the poster | `sponsor` (Superteam), `owner`/`creator` (Algora), "space" (Galxe) |
| crowd signal | `_count.Submission` / `_count.Comments` (Superteam), "N participants" (Galxe) |
| states | `status: OPEN` (Superteam); `:open \| :cancelled \| :paid` (Algora); tabs Open/In progress/Completed/Expired (Bountycaster); `isWinnersAnnounced` |

## 2. Polymarket's own countdown + money (REFERENT)
### 2.1 Hero "Up or Down" slide `Ends in` (live, https://polymarket.com/, 2026-10-25, Chromium 1440x900 DPR2, light, US modal removed)
Screenshots: `shots/pm-updown-slide.png` (whole slide: Price To Beat / Current Price / Ends in 1:54), `shots/pm-updown-endsin-row.png`, `shots/pm-updown-endsin-zoom.png`, `shots/pm-home-full.png`. DOM: `pm-updown-endsin.html`, `pm-updown-samples.json`, `pm-updown-money.json`.
Note: the slide lives in `.homepage-carousel-slide` (absolute, translateX per slide); to screenshot I forced `transform:none; visibility:visible` on that one slide (display hack only; DOM/styles untouched).

Markup (verbatim classes):
```html
<div class="flex items-center justify-between py-0.5 pr-2">           <!-- row -->
  <div class="flex items-center gap-4"> …Price To Beat | divider | Current Price… </div>
  <div class="flex flex-col items-end">
    <span class="text-body-xs font-semibold" style="color:var(--color-pk-content-secondary);opacity:.8">Ends in</span>
    <div class="font-[620] text-heading-xl md:text-heading-2xl normal-nums!" style="color:#ef4444">  <!-- var(--color-pk-gray-500) when >= 1 day -->
      <span class="pk-animated-label"> <span class="pk-animated-label__text">1:54</span> <span class="pk-animated-label__overlay" aria-hidden="true">…rolling digit strips…</span></span>
    </div>
  </div>
</div>
```
Computed (1440 wide ⇒ md): label `Inter 12px/16px 600, ls -0.1px, color lab(47.7217 -1.37293 -5.88264) (=pk-content-secondary), opacity .8`. Value `Inter 24px/28px 600 (font-[620] is overridden: .text-heading-2xl sets 600 later in the CSS; computed fontWeight=600), ls -0.36px, font-variant-numeric: normal, color rgb(239,68,68)`. Below `md`: `.text-heading-xl` = 20px/24px 600 ls -.01em. CSS rules (from `bundles/chunks/3zlgjr5mlf4rt.css`): `.text-heading-xl{font-family:var(--font-inter,"Inter"),sans-serif;font-feature-settings:var(--inter-font-features);letter-spacing:-.01em;font-size:20px;font-weight:600;line-height:24px}`, `.text-heading-2xl{…letter-spacing:-.015em;font-size:24px;font-weight:600;line-height:28px}`, `.text-body-xs{…letter-spacing:-.1px;font-size:12px;font-weight:500;line-height:16px}`, `.normal-nums\!{font-variant-numeric:normal!important}`.
(NOTE: index.css in the app currently defines only `text-body-base` and `text-body-sm`; `text-body-xs`, `text-heading-xl` must be added as `@utility` with the values above.)

Format rule (code, `pm-countdown-source.txt`, chunk `2rxxpq-rqjpdd.js`): with `{d,h,m,s}=getTimeBreakdown(ms)` = `{d:floor(ms/864e5), h:floor(ms%864e5/36e5), m:floor(ms%36e5/6e4), s:floor(ms%6e4/1e3)}` the string is  
`(d>0 ? d+":" : "") + (d>0||h>0 ? pad(h, d>0?2:1)+":" : "") + pad(m, h>0||d>0 ? 2:1) + ":" + pad(s,2)`.  
So: `2:04:12:09` (≥1d) · `4:12:09` (≥1h) · `12:09` / `1:54` / `0:09` (<1h). Color: `d<1 ? "#ef4444" : "var(--color-pk-gray-500)"` (gray-500 = `lab(72.2836% -1.20929 -5.19736)`, light gray, ≈2.3:1 on white — Polymarket's choice, I'd not copy it for accessibility). Hidden entirely when `remaining<0` (`n(null)`, no expired state rendered). Ticker: `setInterval(t, 1000)` recomputing `new Date(endDate) - getServerNow()` every tick (drift-free by construction); `getServerNow()` = `Date.now() + offset`, offset calibrated once from `GET {CLOB_API_URL}/time` (round-trip midpoint: `offset = serverSec*1000 - (t0 + rtt/2)`), chunk `2-m08w_960s_z.js`.
Animation: yes — `AnimatedLabel mode="rolling-morph" animation="smooth"`: each digit is a vertical strip `9\n8\n…\n0` (`.pk-animated-label__strip`, `line-height:30px`, `transform:translateY(-240px)` etc.) inside `.pk-animated-label__char--rolling`; digits roll DOWN-counting on change. Accessibility trick to steal: real text lives in `.pk-animated-label__text`, the decorative overlay is `aria-hidden="true"`. Sampled live: 14 samples at 450 ms, text advanced `1:54→1:48`; during the roll textContent temporarily contains the strips (so a naive `textContent` read is wrong mid-roll).
Not found: `role="timer"`, `aria-live`, `<time datetime>` on the hero timer (null in sampled DOM).

### 2.2 Other Polymarket time/clock UI (retrieved)
- `formatShortCountdown(seconds, i18n.time.short, {includeSeconds})` (chunk `1k0yn8ltz39zt.js`): `<=0 → "0s"`; `d>0 → "{d}d {h}h"`; `h>0 → "{h}h {m}m"` (or `"{h}h {m}m {s}s"` with includeSeconds); else `"{m}m {s}s"`. `time.short = {s:"s",m:"m",h:"h",d:"d",mo:"mo",y:"y"}` (from `bundles/home.html` i18n).
- `getRelativeTime(ms, nowMs, withIn, i18n)` (same chunk): `<60s → N second(s)`, `<1h → N minute(s)`, `<24h → N hour(s)`, `<30d (2592e6 ms) → N day(s)`, `<365d (31536e6) → N month(s)` else years, using `Math.round`, prefixed "In "; `null → "Until cancelled"`, past → "Date is in the past!".
- Event header `DateDisplay` (chunk `0rn0xxhumafbj.js`): `<div class="w-[1.5px] h-[10px] bg-pk-gray-200 rounded-full shrink-0">` + Tooltip around `<div class="text-[13px] tracking-[-0.09px] font-medium text-pk-content-secondary gap-1.5 whitespace-nowrap flex items-center md:mr-1"><IconClockOutline12/><span>{PP date}</span></div>`; tooltip body `text-heading-base font-semibold text-pk-gray-900` = "Estimated time remaining: {formatShortCountdown}" when `differenceInCalendarDays<=7 && !past && !closed`, else "In {N} day(s)" / "Resolved {N} day(s) ago" (i18n keys `events.dateDisplay.*`, `home.html`). Its per-second ticker: `setInterval(…,1000)` with `Math.max(0, differenceInSeconds(end, new Date))`, cleared at 0.
- i18n also ships `time.timeLeft:"Time left"`, `time.countdown:{days:"days",hrs:"hrs",min:"min",sec:"sec"}` (a segmented days/hrs/min/sec layout exists in the strings; its component was NOT located in the downloaded chunks — UNRETRIEVED).
- Homepage esports scorebug has phase `"countdown"` (match starts within 1h, chunk `3pre5kfuqsc7c.js`) — game-start, not a text timer; not extracted.

### 2.3 Polymarket money formats
- Card footer volume: `$3M Vol.` / `$982K` (SPEC.md §rows: ≥1e6 → `$`+round(v/1e6)+`M`; <1e6 → `$`+round(v/1e3)+`K`; implemented in app `formatCardVolume`). Rounding is lossy: $2,500 would render `$3K`. Sub-1K and ≥1B UNRETRIEVED (SPEC.md).
- Hero big numbers (`TitlePrice`): `$80,080` full digits with thousands comma, `text-heading-xl md:text-heading-2xl`, `mt-1 tracking-wide font-[620] text-pk-content-secondary` (target) vs asset color (current, e.g. orange `#FF9900` for BTC), label `text-body-xs font-semibold` opacity .8; divider `w-[2px] h-6 lg:h-8 bg-pk-grouped rounded-full` (pk-grouped = `lab(96.5213% -.0690222 -.946689)`). The current price uses an odometer `AnimatedNumber` (per-digit `absolute inset-0` spans, `tabular-nums`, `normal-nums!`).
- Sidebar "Hot topics" rows: `$105M today`, `$58.0K today`; hero card `$243M Vol`; carousel "BTC Up or Down 5m" card sits in the All-markets grid (`shots/pm-home-full.png`).
- Up/Down tile multiplier: `UP 200x` via `AnimatedNumber suffix="x"`, `text-heading-lg font-semibold … tabular-nums`.

### 2.4 Fonts: `openSauce 600` and `Geist Mono 600`
- `Geist Mono` @font-face (`3zlgjr5mlf4rt.css`, TTF 400/500/600): Tailwind `--font-mono:"Geist Mono", monospace`. Users found by bundle grep: `font-mono` on market-id chips (`05uf0enmgod06.js`), a 13px/16px 600 chip (`3dokwi3h578v0.js`), esports scoreboard column labels `text-center font-mono text-[10px] font-semibold` (`3pre5kfuqsc7c.js`), a canvas chart label `600 Npx var(--font-geist-mono)` (`0lf5ays936261.js`). **None is a countdown.**
- `openSauce` (`20m9e-0rsuoda.css`: OpenSauceOne Regular/Medium/SemiBold woff2; class `.opensauce_a2e97fbb-module__Okd3_a__className`, var `--font-sauce`): no use found in the chunks grepped (no `font-sauce` consumer string found). It loads for one specific surface I did not isolate — UNRETRIEVED which element.
- Therefore the hero timer, labels and money all render in Inter (computed `fontFamily: inter, "inter Fallback", sans-serif`). Fonts not downloaded (not needed); `.tmp/bounty-ref/fonts/` left empty.

## 3. Prior-art table (live pages opened 2026-10-25)
| Product / URL | Retrieved | Card field order | Time-left format | Reward format | Steal |
|---|---|---|---|---|---|
| **Superteam Earn** https://earn.superteam.fun/ (`shots/superteam.png`, `shots/superteam-row.png`, `superteam-card-dom.json`) | 2026-10-25 | list row: sponsor logo 56/64px · **title** (`text-sm/base font-semibold text-slate-700`, line-clamp-1) · sponsor name + verified badge · meta line `Bounty │ Due in 5d │ 💬 12 │ ★FEATURED │ ● green dot` · right-aligned reward | `Due in {timeAgoShort}` ; expired: `Expired {x} ago`; winners out: `Completed {x} ago`. `timeAgoShort` = `<60min→"Nm"`, `<24h→"Nh"`, `<=30d→"Nd"`, `<12mo→"Nmo"`, else `"Ny"` (floor via dayjs diff). Observed `5d`, `10d`, `17d`, `19d`, `29d`, `1mo`. Time text `text-[10px] sm:text-xs text-gray-500` (12px/16px 400). Server-time synced (`useServerTimeSync`). No colour change under 24h in the code of the card. | token icon + number + token symbol: `40k USDC`, `2,500 USDC`, `500 USDG`; amount `16px/24px 600` (font stack ui-sans); compact `k` lowercase only for large (threshold between 5,000 (shown "5,000") and 40,000 — exact rule UNRETRIEVED); featured row `bg-purple-50` | the **meta line** (type · due · comments); reward on the far right; `Expired {x} ago` / `Completed` wording; field names (§4) |
| **Galxe quests** https://app.galxe.com/quest (`shots/galxe.png`, `shots/galxe-card-endin.png`, `galxe-card-dom.json`) | 2026-10-25 | card 413×224 `p-5 rounded-12`: reward chips on top (`💎 500 USDT`, `30` points/OAT) · **title** · `End in 10H:40M` (orange) + `139 participants` · sponsor row w/ verified tick | `End in 10H:40M`, `End in 42H:10M` (hours stay hours: no day roll-up, `H:M` uppercase units) ; only shown when ending soon (cards without deadline show only `N participants`) ; 12px | chips: `500 USDT`, `1,080 USDT`, `10,000 USDT`, `OAT`, `50 USDC` — full commas, token symbol suffix | **urgency treatment: time text coloured orange only for the "End in" line**; participants count beside it; reward as pill chip |
| **Bountycaster** https://www.bountycaster.xyz/ (`shots/bountycaster.png`) | 2026-10-25 | header stats `$ of bounties posted: $1.5 million`, `# of bounties posted: 2,967`; tabs Open/In progress/Completed/Expired; sorts "Trending / Beginner friendly / Highest value / Ending soon". Feed itself rendered "No posts found" in headless Chromium after 16 s — **card anatomy UNRETRIEVED**. FAQ (https://www.bountycaster.xyz/faq) retrieved: any token via `$token`, "negotiable amount" bounties, USDC/ETH/degen… | n/a (unretrieved) | tokens, `$1.5 million` prose | status vocabulary (Open / In progress / Completed / Expired) and "Ending soon" sort |
| **Algora** https://algora.io/ | 2026-10-25 | `/bounties` list is login-gated (live route in `router.ex` sits inside `:authenticated`); `https://algora.io/bounties` → HTTP 404 anonymously; `console.algora.io/bounties` 404; public `GET /api/trpc/bounty.list` returns `{"items":[],"next_cursor":null}` (controller is a stub: source `bounty_controller.ex`). **Card UNRETRIEVED.** Schema retrieved (§4). Algora's public site is now a recruiting product (llms.txt). | n/a | `Money` type; USD via Stripe | the **schema** only |
| **Replit Bounties** https://replit.com/bounties | 2026-10-25 | HTTP 403 Cloudflare "Sorry, you have been blocked" — **UNRETRIEVED** (not defeated) | – | – | – |
| **Layer3** https://app.layer3.xyz/quests | 2026-10-25 | HTTP 403 Cloudflare block — **UNRETRIEVED** | – | – | – |
| **Gitcoin** bounties.gitcoin.co | 2026-10-25 | `ERR_NAME_NOT_RESOLVED` — **UNRETRIEVED** | – | – | – |
| **Polymarket hero** (referent, §2) | 2026-10-25 | icon+title top-left · `Price To Beat` · `Current Price` · `Ends in` right | `1:54` red <1d | `$80,080` | label-over-number, red <1d |

Superteam eyes-on (Read `shots/superteam.png`): rows `Vaultline … 40k USDC` / `Inside the Block … Due in 10d … 2,500 USDC`; sidebar `16,127,210 USD Total Value Earned · 3254 Opportunities Listed`.

## 4. `Bounty` type — stolen schema, field by field
Sources: S = Superteam public JSON `GET https://earn.superteam.fun/api/listings?context=all&take=5` (HTTP 200, redirects to superteam.fun; 7 records; sample at `superteam-listings-sample.json`) and Prisma model `Bounties` (https://raw.githubusercontent.com/SuperteamDAO/earn/main/prisma/schema.prisma, retrieved 2026-10-25, MySQL: `id String @id @default(uuid())`, `title`, `slug @unique`, `deadline DateTime?`, `status @default(OPEN)`, `token String?`, `rewardAmount Float?`, `usdValue Float?`, `sponsorId`, `isFeatured Boolean`, …); A = Algora `Algora.Bounties.Bounty` Ecto schema (https://raw.githubusercontent.com/algora-io/algora/main/lib/algora/bounties/schemas/bounty.ex, 2026-10-25: `field :amount, Money`, `:status, Ecto.Enum [:open,:cancelled,:paid]`, `:deadline, :utc_datetime_usec`, `:visibility`, `:contract_type`, `belongs_to :owner, :creator, :ticket`, `url/1`); P = Polymarket card/hero code.
```ts
/** Field names are Superteam's JSON names where they exist; status values are Algora's (superset of Superteam OPEN). */
export type BountyStatus = 'open' | 'paid' | 'cancelled';          // A: :open|:cancelled|:paid; S: status "OPEN" + isWinnersAnnounced
export interface BountySponsor {                                    // S: sponsor {name, slug, logo, isVerified}
  name: string; slug?: string; logo?: string; isVerified?: boolean;
}
export interface Bounty {
  id: string;                  // S id (uuid), A id
  slug: string;                // S slug (listing URL /earn/listing/{slug})
  title: string;               // S title, A ticket.title
  url: string;                 // A Bounty.url/1 ; S derived /earn/listing/{slug}
  rewardAmount: number;        // S rewardAmount (float, e.g. 40000), A amount (Money)
  token: string;               // S token ("USDC","USDG"); A Money currency (USD) — internals of A's Money type UNRETRIEVED
  deadline: string;            // ISO-8601 UTC, S deadline "2026-10-31T21:59:59.000Z"; A deadline (utc_datetime_usec). THE absolute expiry. (Polymarket calls its equivalent endDate)
  status: BountyStatus;        // S status, A status
  sponsor: BountySponsor;      // S sponsor (logo = the 38px header icon)
  submissionCount?: number;    // S _count.Submission
  commentCount?: number;       // S _count.Comments
  isFeatured?: boolean;        // S isFeatured
  winnersAnnouncedAt?: string | null; // S winnersAnnouncedAt (drives "Completed {x} ago")
  compensationType?: 'fixed' | 'variable'; // S compensationType ("fixed" observed in all 7 records; Superteam's ListingCard code also branches on "variable" — other values UNRETRIEVED)
}
```
Observed S values (2026-10-25): `rewardAmount` 40000/5000/2500/500, `token` USDC|USDG, `type:"bounty"`, `agentAccess:"HUMAN_ONLY"`. Not copied: `isPro`, `agentAccess`, `minRewardAsk/maxRewardAsk` (variable-comp only).

## 5. Countdown algorithm + format + a11y (recommendation, each cited)
**Compute**: `remainingMs = Date.parse(deadline) - now()` on every tick; never decrement a counter. (P: `differenceInSeconds(end, new Date)` / `new Date(endDate)-getServerNow()` each tick; S: `useServerTimeSync`.) Optional server offset à la P (`Date.now()+offset`, midpoint calibration) — skip in the demo unless the manager has a time endpoint.
**Tick**: schedule with `setTimeout`, not `setInterval`, aligned to the next display boundary: `delay = (remainingMs % 1000) || 1000` (+ ~20 ms), floor-based seconds exactly like P's `getTimeBreakdown`. MDN (https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout, retrieved 2026-10-25): timeouts can fire late if the thread is busy ("Late timeouts") and browsers clamp timers in inactive tabs (Firefox Desktop 1 s min; Chrome intensive throttling levels) — which is harmless because the value is recomputed from `deadline`, never counted. **Pause when hidden**: clear the timeout on `document.visibilityState==='hidden'` and recompute immediately on `visibilitychange` (MDN https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState, Baseline Widely available, retrieved 2026-10-25). Stop the timer when `remainingMs<=0`.
**Share one clock**: in the existing app `useSyncExternalStore` is already used (MarketCard.tsx `useIsLarge`); a single module-level 1 s store avoids N timers for N cards (my recommendation, React docs page for it UNRETRIEVED).
**Format** (hand formatter; i18n units like P's `time.short`):
| remaining | text | colour |
|---|---|---|
| ≥ 1 d | `2d 4h` (P `formatShortCountdown`; S shows `Due in 5d`) | `text-pk-content-primary` |
| ≥ 1 h and < 1 d | `4:12:09` (P hero colon format, hours unpadded) | `#ef4444` (P: `d<1`) |
| < 1 h | `12:09` / `0:09` (P: minutes unpadded when no hours) | `#ef4444` |
| ≤ 0 | `Expired` (S: `Expired {x} ago`; P hides) | `text-pk-content-secondary`, label changes `Ends in`→`Ended`, timer stopped |
Urgency rule retrieved from P: `d<1` ⇒ `#ef4444`. Galxe also colours its sub-2-day "End in" line orange (observed 10H and 42H both listed; exact threshold UNRETRIEVED). Do not use P's gray-500 (`lab(72.28…)`, ≈2.3:1) for the non-urgent state; use `pk-content-primary`/`secondary`.
`status!=='open'` overrides: `paid` → value `Paid`, `cancelled` → `Cancelled`, no timer (A statuses; S `Completed {x} ago`).
**Digit animation**: P rolls digits (strips, 30px line-height). Recommended v1: no roll, `font-variant-numeric: tabular-nums` (P uses `tabular-nums` on odometer digits and `normal-nums!` on the rolled timer), because the hero's roll needs ~100 lines of overlay code and breaks textContent mid-roll (observed). Add `motion-safe:` only if the manager wants it.
**`Intl.DurationFormat`**: MDN (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat, retrieved 2026-10-25, page modified 2025-10-10): "Baseline 2025 – Newly available, since March 2025"; web-features explorer (https://web-platform-dx.github.io/web-features-explorer/features/intl-duration-format/, 2026-10-25): Newly available since 2025-03-04, **expected Widely available 2027-09-04**; Chrome 129, Firefox 136, Safari 16.4 (as listed there), ~0.021% of page loads use it. Verdict: not Widely Available on 2026-10-25 and its `style:"digital"` output (`4:12:09`) is not P's unpadded-hour format → **hand formatter** for visible text; DurationFormat only optionally for the sr-only long form (`{style:'long'}` → "2 days, 4 hours", MDN example "1 heure, 46 minutes et 40 secondes"), with a hand fallback. TypeScript typing availability of `Intl.DurationFormat` UNRETRIEVED.
**A11y markup** (MDN timer role https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/timer_role, retrieved 2026-10-25: "role=timer … implicit aria-live=off", `aria-label`/`aria-labelledby` name is read before the content, use `aria-atomic`; MDN `<time>` https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time, Baseline Widely available since Oct 2017, valid `datetime` = global date-time with offset e.g. `2013-12-25T11:12-08:00`, or duration `PT7H12M13S`):
```tsx
<div role="timer" aria-labelledby={labelId} aria-atomic="true">   {/* implicit aria-live=off: not announced per second */}
  <span id={labelId} className="text-body-xs font-semibold …">Ends in</span>
  <time dateTime={deadlineISO} className="… tabular-nums" style={{color}}>
    <span aria-hidden="true">{visible /* 2d 4h */}</span>
    <span className="sr-only">{`${spoken}`}</span>   {/* "2 days 4 hours"; update at minute granularity */}
  </time>
</div>
```
(P's own pattern: real text node + `aria-hidden` visual overlay.) Reduced motion: no roll ⇒ nothing to disable. WCAG 2.2.1 Timing Adjustable (https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html, retrieved 2026-10-25) targets time limits imposed on the user's interaction; a bounty deadline is a business date, so I judge no extend/turn-off control is needed (interpretation, not a W3C statement about bounties).

## 6. ONE recommended anatomy on the Polymarket shell
Keep `CARD_SHELL` verbatim (316.5×180, rounded-xl, `shadow-pk-minimal-soft`, `pt-3`, hover lift). Reuse regions 1:1:
1. **Header** (`flex w-full items-start gap-2 px-3 h-[42px] static`): 38px icon = `sponsor.logo` (alt `{sponsor.name} logo`), `h3` class unchanged `text-body-base text-pk-content-primary font-[590] w-fit line-clamp-3 text-pretty … group-hover/card:underline` = **bounty `title`**; whole-card link `after:absolute after:inset-0 after:z-20` to `bounty.url`.
2. **Body** (`flex flex-col justify-end gap-1.5 px-3 pb-2`; `relative mt-0.5 h-20 w-full` rows box) — two `min-h-10` rows with the existing row geometry `flex justify-between items-center gap-4 w-full shrink-0 min-h-10`:
   - Row 1 (**countdown**): left = label `text-body-base font-[440] text-pk-content-secondary` "Ends in" (→ "Ended"); right = `<time>` `text-[15px] font-semibold tabular-nums` (the exact class of the market row's `%`), colour per §5 table. (If the manager prefers P's hero look instead: label `text-body-xs font-semibold` opacity .8 stacked over `text-heading-xl`.)
   - Row 2 (**$**): left = label `text-body-base font-[440] text-pk-content-secondary` "Reward"; right = amount `text-heading-xl font-semibold text-pk-content-primary tabular-nums` (20/24 -.01em; P's money style) + optional token symbol `text-body-sm text-pk-content-secondary ml-1` ("USDC", S). This puts the largest type on the number a scanner wants.
   Row geometry sums to exactly the 80px box, so card height and header/footer pixel positions are unchanged.
3. **Footer** (`text-body-sm text-pk-content-secondary`, `flex w-full items-center h-7`): left = `{submissionCount} submissions · {sponsor.name}` (S `_count.Submission`, `sponsor.name`; Superteam shows comments, Galxe shows participants) replacing "$3M Vol."; right = existing 28px ghost **bookmark** button (keep; `GHOST_BUTTON` + sprite). Gift button: drop (sibling worker owns rewards tooltip; not meaningful for a bounty) or keep for pixel parity — manager's call.
4. **Amount formatting** (decision, not retrieved as a rule): `< $10,000` → full with comma `$2,500` (P hero `$80,080` style; avoids the card-volume `round(K)` that turns 2,500 into `$3K`); `≥ $10,000` → P compact integer `$40K` / `$1M` (`formatCardVolume`, SPEC.md). Non-USD tokens: `2,500` + token suffix; USD value only when `token` is a stablecoin (S: USDC, USDG).
5. Tokens to add to `index.css` `@theme`/utilities: `text-body-xs`, `text-heading-xl` (§2.1 values), `--color-pk-red-urgent: #ef4444` (P uses literal `#ef4444`). Existing `pk-content-primary/secondary`, `pk-border` suffice.
6. Skeleton: reuse `MarketCardSkeleton`, two bars per row.

## 7. Market (traction numbers, retrieved 2026-10-25)
- **Superteam Earn**: `16,127,210 USD Total Value Earned`, `3254 Opportunities Listed` (sidebar, `shots/superteam.png`); `Join 245,600+ others` (hero), `2,780+` sponsors CTA ("Join 2,780+ others").
- **Bountycaster**: `$1.5 million` of bounties posted, `2,967` bounties (https://www.bountycaster.xyz/); supports Farcaster and Twitter/X (FAQ).
- **Galxe**: no platform total retrieved; per-quest `4.54K participants`, `2.84K participants` (https://app.galxe.com/quest). Platform totals UNRETRIEVED.
- **Algora**: bounty volume undisclosed; its `llms.txt` (https://algora.io/llms.txt, 2026-10-25) says "placed 30+ full-time engineers at 100+ customers"; repo https://github.com/algora-io/algora 1,536 stars, AGPL-3.0, pushed 2026-07-18 (GitHub API, 2026-10-25). Third-party (gigs.sh, verified 2026-05-18, secondary): "Ziverge reports $143K distributed through Algora". Public Algora bounty API (`api.docs.algora.io`) failed TLS handshake from here — UNRETRIEVED.
- **Polymarket** (referent for scale): hero "$243M Vol" and `$105M today` hot-topic on 2026-10-25 homepage.
- Replit Bounties, Layer3, Gitcoin: blocked/NXDOMAIN, no number.

## 8. UNRETRIEVED (explicit)
- Algora anonymous bounty-card DOM, `api.docs.algora.io` pages (TLS reset on 4 identities + browser), `Algora.Types.Money` internals.
- Replit Bounties (`replit.com/bounties`, Cloudflare 403), Layer3 quests (Cloudflare 403), Gitcoin bounties (NXDOMAIN).
- Bountycaster bounty card DOM (feed empty headless after 16 s); Galxe platform-wide traction; Galxe exact urgency-colour threshold (orange seen in screenshot on "End in 10H:40M"; computed colour of the text node not isolated).
- Polymarket: (a) the segmented `time.countdown {days,hrs,min,sec}` component (strings present, component not found in chunks); (b) which element uses `openSauce`; (c) the `pk-animated-label` CSS rules and the `AnimatedLabel` easing timings (`ANIMATED_LABEL_TIMINGS.smooth`) — only the DOM and chunk head were read; (d) how the timer looks at ≥1d live (only `m:ss` observed live; the `D:HH:MM:SS` branch is from code); (e) the "BTC Up or Down 5m" grid card's own DOM (a gauge, no `Ends in` text found in it); (f) countdown on mobile/dark theme.
- Superteam: exact `k` compaction threshold (CompensationAmount component not opened); whether any urgency colour exists below 24h (card source shows none; live rows all ≥5d).
- React docs for `useSyncExternalStore` (recommendation rests on the app's own existing use); TypeScript lib typing for `Intl.DurationFormat`.
- Superteam `compensationType` / `status` enum members other than the observed `fixed` / `OPEN` (Prisma file truncated at 1000 chars when fetched).

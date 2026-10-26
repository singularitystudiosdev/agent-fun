# BountyCard: final build spec (Polymarket card language)

Retrieved/verified 2026-10-25 (America/Denver). Everything below was built and run as a prototype in `.tmp/bounty-ref/scripts/proto/` (Vite on :5191, a copy of the app `src/` plus these files; nothing under `polymarket-card/` or port 5173/5180 was touched). **The code blocks in this file are inlined from the prototype files by `scripts/build-spec.py`, so they are the code that was run.** Prototype checks: `tsc` clean, `node --test` 5/5, Playwright (`scripts/proto-check.mjs`, `scripts/proto-behavior.mjs`) screenshots in `shots/proto-*.png`.

Source tags: **[CSS]** `.tmp/polymarket-ref/bundles/chunks/3zlgjr5mlf4rt.css`; **[JS]** chunk named; **[DOM]** `pm-updown-*.html/json`; **[APP]** `polymarket-card/src/*`; **[MEASURED]** prototype run.

## 0. What changed vs RESEARCH.md (one line each)
1. **Format `2d 4h` at >=1 day replaced** by `2d 03:14:07`. A ticking seconds field at every horizon is what "countdown" asks for; `2d 4h` is frozen for up to an hour (the card would look dead for the first two days of its life). It keeps Polymarket's hero `HH:MM:SS` tail and the `d` unit letter from Polymarket's own `formatShortCountdown` [JS 1k0yn8ltz39zt.js], dropping only the bare `2:03:14:07` form, which reads as a clock.
2. **Digit roll is now specified, not skipped.** RESEARCH.md called the roll "~100 lines of overlay code" and recommended none. The engine was in the bundles all along (`3f2bjaa7rl1g2.js`, `3zlgjr5mlf4rt.css`; RESEARCH listed its CSS and timings as UNRETRIEVED). Retrieved now: spring {mass 1, stiffness 170, damping 26} = 702 ms, strip 9..0, overlay/char/strip CSS. A measurement-free tabular-digit version is 25 lines of TSX plus one CSS utility (section 4).
3. **Seconds are rounded UP, not floored.** Polymarket floors [JS 672922 `getTimeBreakdown`], which prints `0:00` for the final second while the bounty is still open. Ceil prints `0:01` until the instant of expiry and flips to Expired exactly at the deadline; the timeout delay is the exact boundary `((ms-1) % 1000)+1`, with no +20 ms fudge.
4. **Urgency colour is decided on the rounded seconds that are printed** (`secondsLeft < 86400`), not on raw ms, so text and colour flip on the same tick (Polymarket tests `d<1` on a separate floor).
5. **Non-urgent colour is `text-pk-content-secondary` (#6b727b, 4.86:1), not `content-primary`.** Polymarket's non-urgent timer is muted gray (`--color-pk-gray-500` = #abb2bb, **2.14:1** on white, [CSS]); the card keeps the muted-until-urgent behaviour but at a passing contrast, which also leaves the $ as the only full-contrast (#23272d, 15:1) element. One-token change back to primary if wanted (`text-pk-content-secondary` -> `text-pk-content-primary` in `RollingTime`).
6. **"Ends in" label drops Polymarket's `opacity:.8`.** #6b727b at .8 on white blends to #898e95 = 3.3:1 (fails AA for 12px). Full secondary = 4.86:1.
7. **Layout is label-left / value-right rows (the market row geometry), not a stacked hero pair.** $ row needs 28px line-height; stacked label+value would exceed the 40px row. Same two `min-h-10` rows as `MarketRow`.
8. **$ sized 24/28 (`text-heading-2xl`), not 20/24.** Hero money is `text-heading-xl md:text-heading-2xl` [DOM]; the card is a desktop surface (md+), where computed is 24px/28px/600/-0.36px [DOM, RESEARCH 2.1] and [MEASURED] in the prototype. The timer stays at the hero's 20/24 so there is a real size step (20 -> 24).
9. **Amount: always full digits** (manager decision). The RESEARCH `$10K` split and token suffix are gone; `token`, `slug`, `status`, `commentCount`, `isFeatured`, `winnersAnnouncedAt`, `compensationType`, `sponsor.slug/isVerified` are trimmed from the type (not rendered).
10. **Footer separator is Polymarket's own 1.5x10px pill divider** (`w-[1.5px] h-[10px] bg-pk-gray-200 rounded-full shrink-0`, event-header `DateDisplay` [JS 0rn0xxhumafbj.js]) instead of a middle dot. `bg-pk-border` is used because the app already defines it and its value equals pk-gray-200 (`lab(91.9748% -.136733 -1.92862)` in both, [CSS]).
11. **Hover swaps "Ends in" for the absolute end time** (`Oct 28, 3:14 PM`) with the same label cross-fade the market card's Yes/No pills use (`transition ... group-hover:opacity-0` / `opacity-0 group-hover:opacity-100`, [APP] `Pill`). D:HH:MM:SS says how long, not when; this answers "when" at zero layout cost.
12. **Expired state defined**: label `Ended`, value = end date (`Oct 25, 2026`, secondary), $ muted to secondary, no timer, no roll. (Polymarket renders nothing when expired: `t<0 ? n(null)`; Superteam says `Expired {x} ago`.)
13. **a11y markup changed**: RESEARCH's triple (aria-hidden visible + sr-only duplicate) becomes Polymarket's pair: the real text node stays in flow (transparent), the overlay is `aria-hidden`; `<time dateTime>` + `role="timer"` + `aria-labelledby` wrap them (Polymarket has none of the three: `role`/`aria` null in [DOM] samples).
14. **Direction correction**: RESEARCH says digits "roll DOWN-counting". From the code: strip text is `9\n8..\n0` top to bottom and `Y(d) = -(9-d)*stride`; counting down moves the strip **up** (the lower digit rises from below, the old one exits through the top). [DOM] matches: digit 1 at `translateY(-240px)`, 5 at `-120px`, 4 at `-150px` with a 30px stride.
15. **Mid-roll `textContent` caveat confirmed** in the prototype: `time.textContent` includes the overlay's digits. Read the real node (`time.firstElementChild.textContent`) in tests.

## 1. Polymarket countdown, transcribed (retrieved facts the spec rests on)
| Fact | Value | Source |
|---|---|---|
| format | `{d>0?d+":":""}{(d>0||h>0)?pad(h, d>0?2:1)+":":""}{pad(m, (h>0||d>0)?2:1)}:{pad(s,2)}` | [JS 2rxxpq-rqjpdd.js], pm-countdown-source.txt |
| recompute | every 1000 ms from `new Date(end) - getServerNow()`; hidden when `<0` | same |
| colour | `d<1 ? "#ef4444" : var(--color-pk-gray-500)` (literal hex, no token) | same |
| label | `text-body-xs font-semibold`, secondary, opacity .8, "Ends in" | same |
| value | `font-[620] text-heading-xl md:text-heading-2xl normal-nums!` (computed 600 at md+, 620 below md by CSS source order: `.font-[620]` @197965 comes after `.text-heading-xl` @189651, and `.md:text-heading-2xl` @396359 after both) | [CSS] |
| roll engine | `AnimatedLabel mode="rolling-morph" animation="smooth"`; `smooth = {spring:{mass:1,stiffness:170,damping:26}, staggerMs:50, fadeMs:200}` | [JS 3f2bjaa7rl1g2.js tail] |
| spring duration | damping ratio 0.997, **702 ms** (first sample with |x|<0.001), 50% at 129 ms, 95% at 363 ms; reproduced in `scripts/spring-easing.mjs` | [JS 581622 `springTiming`] |
| roll mechanics | digit cell = `.pk-animated-label__char--rolling` with a 10-line strip `9..0`, `line-height: stride` (= line height + 2px), `top:-1px`; on change `rollCell` sets the new `translateY(Y(d))` and plays a spring from the old offset; `.pk-animated-label__gesture` is `clip-path: inset(0 -50%)` | [JS 3f2bjaa7rl1g2.js rollCell/Y/N=2], [CSS] |
| stagger | **none for rolling digits** (stagger applies to cross-fading/entering glyph cells only); all changed digits roll together | [JS] `rollCell` has no delay |
| real text + overlay | `.pk-animated-label{white-space:pre;display:inline-block;position:relative}`, `[data-pk-al-engine]>.__text{color:#0000}`, `.__overlay{pointer-events:none;position:absolute;inset:0}` with `aria-hidden="true"` | [CSS], [DOM] |
| reduced motion | `prefersReducedMotion()` (`matchMedia('(prefers-reduced-motion: reduce)')`) -> no animation, `commitSnap` | [JS 1k0yn8ltz39zt.js module 358884; 3f2bjaa7rl1g2.js buildCommit] |
| second odometer | `AnimatedNumber` (current price): ten `absolute inset-0` spans per digit at `translateY(k*11px)` in a ring, `w-[1ch] tabular-nums` cell, `overflow-hidden` | [DOM] pm-updown-endsin.html |

The card uses the **ring** layout of the second component (no measuring, wraps 0->9 without a rewind) with the **direction, easing, duration, clip and real-text/overlay contract of the timer**. It differs from the hero timer in one deliberate way: tabular-nums cells instead of proportional digits (`normal-nums!`) re-measured with Range rects each tick. The hero's proportional timer shifts horizontally every tick; the card's does not.

## 2. Horizon rules (ONE rule set)
`secs = ceil(msRemaining/1000)` (min 0); `d = floor(secs/86400)`; `h`, `m`, `s` from the remainder.

| remaining | text | value colour | label | rule |
|---|---|---|---|---|
| 3 days+ (`274_329_000` ms) | `3d 04:12:09` | `text-pk-content-secondary` | `Ends in` | `d>0` -> `{d}d HH:MM:SS`, hours and minutes padded |
| exactly 1 day (`86_400_000`) | `1d 00:00:00` | secondary | `Ends in` | |
| just under 1 day (`86_399_001`) | `1d 00:00:00` (rounded up) | secondary | `Ends in` | colour tracks the printed seconds |
| 23:59:59 (`86_399_000`) | `23:59:59` | **`text-countdown-urgent` #ef4444** | `Ends in` | `d=0,h>0` -> `H:MM:SS`, hours unpadded (Polymarket `pad(h,1)`) |
| 59:59 (`3_599_000`) | `59:59` | #ef4444 | `Ends in` | `h=0` -> `M:SS`, minutes unpadded (Polymarket `pad(m,1)`) |
| 0:09 (`9_000`) | `0:09` | #ef4444 | `Ends in` | |
| last second (`1`..`1000`) | `0:01` | #ef4444 | `Ends in` | |
| expired (`<=0`) | value = end date, e.g. `Oct 25, 2026` (not a timer) | secondary | **`Ended`** | `$` also turns secondary; timer, roll and timeout stop |

Why this against the referent: Polymarket's `HH:MM:SS`/`M:SS` below 1 day, unpadded leading unit and red `#ef4444` under a day are copied exactly; at >=1 day the referent's own string would be `3:04:12:09` (code-derived, never observed live: UNRETRIEVED), which is read as a clock; the `d` suffix is the one departure, using the unit string Polymarket ships (`time.short.d = "d"`). Seconds tick at every horizon, as the user's "countdown" and the "live 1-second countdown" acceptance ask. Width changes only at 10->9 hours, 1->0 hours, 10->9 minutes and day roll-off, never per tick (tabular figures).
Colour contrast: #ef4444 on white = **3.76:1**, passes AA only as large text (>=18.66px bold); the timer is 20px/600, so it qualifies. Do not shrink the timer below 18.66px or switch to a lighter weight without changing to `pk-red-500` (#df0c10, 5.0:1, `--color-pk-red-500` in [CSS] light theme).

## 3. Anatomy (180px shell, [MEASURED] against the live MarketCard at 1100px wide: shell 316.5x180, header 316.5x42 at y+12, body 316.5x124, rows 40+40, footer 28)
`BountyCard` imports `CARD_SHELL` and `BookmarkButton` from `MarketCard.tsx`: **add `export` to both** (`export const CARD_SHELL`, `export function BookmarkButton`; the prototype does exactly that with sed). The wrapper in `App.tsx` is the same `w-[316.5px] h-[180px]` box, two of them in a `flex flex-wrap items-start justify-center gap-6`.

| Region | px | Classes (verbatim from `MarketCard.tsx` unless marked NEW) |
|---|---|---|
| Shell | 316.5x180 | `CARD_SHELL` + `data-testid="bounty-card"` |
| Header | `h-[42px]`, `pt-3` from shell | `flex w-full items-start gap-2 px-3 h-[42px] static` |
| Sponsor logo | 38x38 | `overflow-hidden rounded-sm relative w-[38px] min-w-[38px] h-[38px]` + the same `<img>` (alt `{sponsor.name} logo`) |
| Title `h3` | 14/20, 590 | `text-body-base text-pk-content-primary font-[590] w-fit line-clamp-3 text-pretty decoration-2 min-w-0 group-hover/card:underline` inside the same link (`href={bounty.url}`, `after:inset-0 after:z-20` whole-card target). Verbatim `line-clamp-3` overflows the 42px header at 3 lines exactly as the market card does: keep titles to 2 lines (sample is 2). |
| Body wrapper | `px-3 pb-2` | `flex flex-col justify-end gap-1.5 px-3 pb-2` |
| Rows box | 80px | `relative h-20 w-full lg:mt-0.5` (NEW: the market card renders `mt-0.5` only in its `>=lg` fresnel branch; `lg:` is the same 1024px query, so both cards keep identical y at every width) |
| Row 1 and 2 | 40px each | `flex justify-between items-center gap-4 w-full shrink-0 min-h-10` |
| Label | 12/16, 600 | `text-body-xs font-semibold! text-pk-content-secondary whitespace-nowrap` (NEW utility; `font-semibold!` is needed because `text-body-xs` carries weight 500: [MEASURED] computed 600). Hover label shares the same class with `absolute left-0 top-0 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100`; the resting label gets `transition-opacity duration-150 group-hover/card:opacity-0`. |
| Timer | 20/24, 600, -0.2px | `relative inline-block whitespace-pre text-heading-xl tabular-nums` + `text-pk-content-secondary` or `text-countdown-urgent` (NEW) |
| **$ amount (the one bold element)** | **24/28, 600, -0.36px, #23272d** | `text-heading-2xl text-pk-content-primary` (`text-pk-content-secondary` when expired) |
| Footer | `h-7` (28px bookmark) | `flex w-full text-body-sm text-pk-content-secondary relative items-center` > `flex gap-2 justify-between items-center w-full overflow-x-auto whitespace-nowrap overflow-visible no-scrollbar`; 13/16/490 |
| Footer left | | `flex flex-row gap-2 items-center min-w-0`: `<p className="truncate">{sponsor.name}</p>`, divider `w-[1.5px] h-[10px] bg-pk-border rounded-full shrink-0`, `<p className="shrink-0">12 submissions</p>` (singular at 1; both omitted when `submissionCount` is undefined). **No middle dot.** |
| Footer right | 28x28 | `<BookmarkButton eventId={`bounty:${id}`} />` (same sprite, localStorage key `pm-card:favorite:bounty:{id}`). No gift button. |

[MEASURED] computed values in the prototype: timer `20px/24px/600/-0.2px tabular-nums` colour `lab(47.7217 -1.37293 -5.88264)`; label `12px/16px/600/-0.1px`; $ `24px/28px/600/-0.36px` `lab(15.4544 -0.764295 -4.69404)`; overlay rect == real-text rect (x, y, w, h identical at 116.6x24).

### Tokens added to `src/index.css` (append; every value retrieved)
| Token | Value | Source |
|---|---|---|
| `text-body-xs` | Inter, features var, -0.1px, 12px, 500, 16px | [CSS] `.text-body-xs` |
| `text-heading-xl` | -0.01em, 20px, 600, 24px | [CSS] |
| `text-heading-2xl` | -0.015em, 24px, 600, 28px | [CSS] |
| `--color-countdown-urgent` | `#ef4444` | [JS 2rxxpq-rqjpdd.js] literal |
| `--ease-pk-roll` | 31-point `linear()` of the 702 ms spring (max error 0.0086 of travel = 0.21px on a 24px stride) | computed from [JS 581622]; Polymarket ships `--ease-pk-expand` / `--ease-pk-spring` as `linear()` lists in the same way |
| `pk-roll` utility | `transition-property:transform; transition-duration:702ms; timing:var(--ease-pk-roll)` | check-ui permits `duration-over-300ms` only in `index.css` (`check-ui.config.json`), hence a utility, not `duration-[702ms]` in the component |
Existing tokens reused: `pk-content-primary/secondary`, `pk-border`, `pk-gray-400`, `pk-elevated`, `shadow-pk-*`, `text-body-base`, `text-body-sm`.

```css
/* ---- Bounty card additions. Values are polymarket.com's own (CSS bundle chunks/3zlgjr5mlf4rt.css, 2026-10-25) unless a comment says otherwise. ---- */
@theme {
  /* The hero "Ends in" timer paints a literal #ef4444 when fewer than 1 day is left (chunk 2rxxpq-rqjpdd.js). Not a Polymarket token, so no pk- prefix. */
  --color-countdown-urgent: #ef4444;
  /* AnimatedLabel animation="smooth" = spring {mass 1, stiffness 170, damping 26} (chunk 3f2bjaa7rl1g2.js). Settles in 702 ms (50% at 129 ms, 95% at 363 ms).
     Sampled by .tmp/bounty-ref/scripts/spring-easing.mjs into 31 linear() points (max error 0.0086 of travel = 0.21 px on a 24 px stride).
     polymarket.com ships its own easings as linear() lists the same way (--ease-pk-expand, --ease-pk-spring). */
  --ease-pk-roll: linear(0, 0.0381, 0.1254, 0.2334, 0.3453, 0.4514, 0.5472, 0.6306, 0.7016, 0.7609, 0.8097, 0.8494, 0.8814, 0.9071, 0.9275, 0.9436, 0.9563, 0.9662, 0.9739, 0.9799, 0.9846, 0.9882, 0.991, 0.9931, 0.9948, 0.996, 0.997, 0.9977, 0.9983, 0.9987, 1);
}

/* .text-body-xs / .text-heading-xl / .text-heading-2xl (live CSS bundle, verbatim). */
@utility text-body-xs {
  font-family: var(--font-inter, 'Inter'), sans-serif;
  font-feature-settings: var(--inter-font-features);
  letter-spacing: -0.1px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}
@utility text-heading-xl {
  font-family: var(--font-inter, 'Inter'), sans-serif;
  font-feature-settings: var(--inter-font-features);
  letter-spacing: -0.01em;
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
}
@utility text-heading-2xl {
  font-family: var(--font-inter, 'Inter'), sans-serif;
  font-feature-settings: var(--inter-font-features);
  letter-spacing: -0.015em;
  font-size: 24px;
  font-weight: 600;
  line-height: 28px;
}

/* One rolling digit glyph: transform-only transition on the 702 ms spring above. check-ui allows duration-over-300ms only in index.css, hence a utility instead of duration-[702ms] in the component. */
@utility pk-roll {
  transition-property: transform;
  transition-duration: 702ms;
  transition-timing-function: var(--ease-pk-roll);
}
```

## 4. Rolling-digit implementation spec
**DOM** (per countdown):
```
<time datetime="{deadline ISO}" role="timer" aria-labelledby="{labelId}"
      class="relative inline-block whitespace-pre text-heading-xl tabular-nums {text-pk-content-secondary | text-countdown-urgent}">
  <span class="text-transparent motion-reduce:text-inherit forced-colors:text-inherit">2d 03:14:07</span>   <!-- REAL text node, in flow, sizes the box, selectable -->
  <span aria-hidden="true" class="pointer-events-none absolute inset-0 flex select-none motion-reduce:hidden forced-colors:hidden">  <!-- overlay -->
    <span class="relative block shrink-0 overflow-hidden">            <!-- one digit cell: 1 line high, clips the ring -->
      <span class="invisible">0</span>                                <!-- in-flow zero = exact tabular advance + 24px line -->
      <span class="absolute inset-0 text-center pk-roll motion-reduce:transition-none" style="transform:translateY(-100%);opacity:1">9</span> ... x10 glyphs
    </span>
    <span class="whitespace-pre">:</span>                              <!-- non-digit chars are plain spans, never animated -->
  </span>
</time>
```
- **Per-digit roll**: glyph `g` sits at line `((digit - g + 14) % 10) - 4` (range -4..5, 0 = shown), `translateY(line*100%)`. Counting down moves every glyph **up** one line: the next lower digit enters from below, the old one leaves through the top; 0->9 wraps with the same one-line move (no 9-line rewind, which the hero's strip does on 0->9). Glyphs at |line|>1 are `opacity:0` (set instantly, no opacity transition) so the glyph that jumps from the top of the ring to the bottom is never seen crossing the cell.
- **Motion**: `transition-property: transform`, **702 ms**, `ease-pk-roll` (spring 170/26 sampled), no stagger (Polymarket rolls digits together), no scale/fade (the `scale(.82)` + fade belong to cross-fading glyph cells, not rolling digits). Real tick is 1000 ms, so the roll always finishes before the next tick. [MEASURED] frame 130 ms into the 0:09->0:08 tick shows the old 9 leaving through the top and the 8 rising in.
- **Clip**: the digit cell is `overflow-hidden` at exactly one line (24px); Polymarket clips the same way (`clip-path: inset(0 -50%)` on `__gesture`).
- **Keys**: each overlay child is keyed from the **right** (`r${text.length - i}`) so seconds/minute cells keep identity when a leading field appears or disappears (`10:00` -> `9:59`, `1d 00:00:00` -> `23:59:59`). Index keys would re-map digits and roll nonsense.
- **Real text vs overlay**: both are in the same font, tabular figures, `whitespace-pre`, same letter-spacing, so each overlay cell is the same width as the real glyph under it; [MEASURED] overlay and real-text rects are identical. The real text is transparent only when the overlay is active.
- **Reduced motion, per element**: real text `motion-reduce:text-inherit` (becomes the visible, static string); overlay `motion-reduce:hidden`; each glyph `motion-reduce:transition-none` (belt and braces); no animated colour. [MEASURED] with `reducedMotion: 'reduce'`: overlay `display:none`, real-text colour == parent colour. `forced-colors:` twins are an untested precaution (my addition, not in Polymarket's CSS).
- **a11y**: `role="timer"` has implicit `aria-live=off` (MDN, in RESEARCH 5), so nothing is announced per second; `aria-labelledby` names it by the "Ends in" label; the real text is the accessible name-less content ("2d 03:14:07"); `dateTime` carries the machine-readable instant. Expired renders a plain `<time dateTime>` (no timer role). The hover label is `aria-hidden` (the `dateTime` already carries it).
- **Dependency-free**: no framer-motion, no Web Animations, no Range measuring; CSS transitions only.

## 5. Code, ready to paste
Files: `src/lib/countdown.ts`, `src/lib/bounty.ts`, `src/components/BountyCard.tsx`. In `App.tsx` render `<BountyCard bounty={sampleBounty()} />` (module-level `const bounty = sampleBounty()`; the sample deadline is computed from page load).

### src/lib/countdown.ts
```ts
import { useEffect, useState } from 'react';

const DAY_S = 86_400;

/** Whole seconds left, rounded UP: the last second shows 0:01 and 0:00 is never shown while the bounty is open. */
export const secondsLeft = (msRemaining: number): number => Math.max(0, Math.ceil(msRemaining / 1000));

/** Open means at least one millisecond left. At 0 or below the card switches to its expired state. */
export const isExpired = (msRemaining: number): boolean => msRemaining <= 0;

/** Red below 24 h, decided on the same rounded seconds that are printed, so text and colour flip on the same tick. */
export const isUrgent = (msRemaining: number): boolean => !isExpired(msRemaining) && secondsLeft(msRemaining) < DAY_S;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * D:HH:MM:SS of polymarket.com's hero timer with the leading field left unpadded, plus a `d` suffix on the day
 * count (polymarket.com's own formatShortCountdown uses that unit letter; the bare "2:03:14:07" reads as a clock).
 *   >= 1 day : "2d 03:14:07"   >= 1 h : "4:12:09"   < 1 h : "12:09" / "1:54" / "0:09"   <= 0 : "0:00"
 */
export function formatCountdown(msRemaining: number): string {
  const total = secondsLeft(msRemaining);
  const d = Math.floor(total / DAY_S);
  const h = Math.floor((total % DAY_S) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

/** Delay until the printed text can next change: exactly when the remaining time crosses the next whole-second boundary. */
export const msToNextTick = (msRemaining: number): number => ((msRemaining - 1) % 1000) + 1;

/**
 * Remaining ms, rounded up to a whole second, for an ISO deadline. Never counts down a stored number: every tick
 * recomputes `deadline - now()`, so a throttled or late timer cannot drift. The timeout is aligned to the next second
 * boundary of the deadline, paused while the tab is hidden, recomputed the moment it is visible again, and not
 * re-armed once the deadline has passed. `now` is injectable for tests (and for a server-calibrated clock).
 */
export function useCountdown(deadlineIso: string, now: () => number = Date.now): number {
  const deadline = Date.parse(deadlineIso);
  const read = () => (Number.isNaN(deadline) ? 0 : Math.max(0, Math.ceil((deadline - now()) / 1000) * 1000));
  const [remaining, setRemaining] = useState(read);

  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      const left = deadline - now();
      setRemaining(Math.max(0, Math.ceil(left / 1000) * 1000)); // same value as last tick => React bails out
      if (left > 0 && document.visibilityState !== 'hidden') timer = setTimeout(tick, msToNextTick(left));
    };
    tick();
    document.addEventListener('visibilitychange', tick); // hidden: tick() re-arms nothing; visible: recompute + re-arm
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline, now]);

  return remaining;
}
```

### src/lib/bounty.ts  (Bounty type, formatBountyAmount, sample, `?state=` / `?expired=1`)
```ts
/** Field names are Superteam Earn's public JSON names (earn.superteam.fun/api/listings); only fields the card renders. */
export interface BountySponsor {
  name: string;
  /** 38px header icon, same slot as the market card's event icon. */
  logo: string;
}

export interface Bounty {
  id: string;
  title: string;
  /** Whole-card link target (Superteam: /earn/listing/{slug}). */
  url: string;
  /** USD. Superteam: rewardAmount (float). */
  rewardAmount: number;
  /** ISO-8601 UTC instant the bounty closes. Superteam: deadline. */
  deadline: string;
  sponsor: BountySponsor;
  /** Superteam: _count.Submission. Omit to hide the count. */
  submissionCount?: number;
}

const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const USD_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Full digits with commas like polymarket.com's hero "$80,080"; cents only when the amount has them. Never compact ("$3K"). */
export const formatBountyAmount = (usd: number): string => (Number.isInteger(usd) ? USD_WHOLE : USD_CENTS).format(usd);

const ENDED_ON = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
/** Expired state value, e.g. "Oct 25, 2026". */
export const formatEndedOn = (deadlineIso: string): string => ENDED_ON.format(new Date(deadlineIso));

/** Hover label that replaces "Ends in": "Oct 28, 3:14 PM", with the year only when it is not the current one. */
export function formatEndsAt(deadlineIso: string, nowMs: number = Date.now()): string {
  const end = new Date(deadlineIso);
  const sameYear = end.getFullYear() === new Date(nowMs).getFullYear();
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' }).format(end);
}

const ms = (d: number, h: number, m: number, s: number) => (((d * 24 + h) * 60 + m) * 60 + s) * 1000;

/** `?state=` presets: where the deadline sits relative to page load. `day` is the default. */
export const SAMPLE_OFFSETS_MS = {
  day: ms(2, 3, 14, 7), // "2d 03:14:07"
  hour: ms(0, 4, 12, 9), // "4:12:09" (red)
  minute: ms(0, 0, 1, 54), // "1:54"  (red; the hero slide's own sample)
  seconds: ms(0, 0, 0, 12), // "0:12"  -> flips to Expired live
  expired: -ms(0, 0, 1, 0),
} as const;

const PAGE_LOAD = Date.now();

function sponsorMark(letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38"><rect width="38" height="38" fill="#2e5cff"/><text x="19" y="26" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="600" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Sample bounty; the deadline is computed from page load so the countdown is visibly live. */
export function sampleBounty(search: string = window.location.search, loadedAt: number = PAGE_LOAD): Bounty {
  const params = new URLSearchParams(search);
  const key = params.get('expired') === '1' ? 'expired' : (params.get('state') ?? 'day');
  const offset = SAMPLE_OFFSETS_MS[key as keyof typeof SAMPLE_OFFSETS_MS] ?? SAMPLE_OFFSETS_MS.day;
  return {
    id: 'sample-wallet-onboarding',
    title: 'Redesign the onboarding flow for our mobile wallet',
    url: '#sample-wallet-onboarding',
    rewardAmount: 2500,
    deadline: new Date(loadedAt + offset).toISOString(),
    sponsor: { name: 'Northwind Labs', logo: sponsorMark('N') },
    submissionCount: 12,
  };
}
```
Sample states: `?state=day` (default, `2d 03:14:07`), `?state=hour` (`4:12:09`, red), `?state=minute` (`1:54`, red), `?state=seconds` (`0:12`, flips to Ended live after 12 s), `?state=expired` or `?expired=1`. Sample is invented (sponsor "Northwind Labs", $2,500, 12 submissions); the logo is an inline SVG data URI in `#2e5cff` (= `--color-pk-brand-500` light hex [CSS]) so no new asset or network.
Trimmed from RESEARCH's type: `slug`, `token`, `status`, `sponsor.slug`, `sponsor.isVerified`, `commentCount`, `isFeatured`, `winnersAnnouncedAt`, `compensationType` (none rendered). Kept (Superteam names): `id`, `title`, `url`, `rewardAmount`, `deadline`, `sponsor{name,logo}`, `submissionCount`.

### src/components/BountyCard.tsx
```tsx
import { useId } from 'react';
import { formatBountyAmount, formatEndedOn, formatEndsAt, type Bounty } from '../lib/bounty';
import { formatCountdown, isExpired, isUrgent, useCountdown } from '../lib/countdown';
import { BookmarkButton, CARD_SHELL } from './MarketCard';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * One rolling digit. Ten stacked glyphs share one cell that is one line high and clips overflow; each glyph sits at a
 * line offset that depends only on the digit shown. Counting down moves every glyph up one line, so the next (lower)
 * digit rises in from below and the old one leaves through the top, the same direction as the hero timer's
 * 9..0 strip. The glyph that wraps from the top of the ring to the bottom is invisible (opacity 0) at both ends.
 */
function RollDigit({ digit }: { digit: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden">
      {/* In-flow zero: gives the cell the exact advance width and line height of a tabular digit. */}
      <span className="invisible">0</span>
      {DIGITS.map((glyph) => {
        const line = ((digit - glyph + 14) % 10) - 4; // -4..5, 0 = the glyph on show
        return (
          <span
            key={glyph}
            className="absolute inset-0 text-center pk-roll motion-reduce:transition-none"
            style={{ transform: `translateY(${line * 100}%)`, opacity: line >= -1 && line <= 1 ? 1 : 0 }}
          >
            {glyph}
          </span>
        );
      })}
    </span>
  );
}

/** The real text node stays in flow (transparent while the overlay is active, like .pk-animated-label__text); the overlay is aria-hidden. */
function RollingTime({ text, deadline, labelId, urgent }: { text: string; deadline: string; labelId: string; urgent: boolean }) {
  return (
    <time
      dateTime={deadline}
      role="timer"
      aria-labelledby={labelId}
      className={`relative inline-block whitespace-pre text-heading-xl tabular-nums ${urgent ? 'text-countdown-urgent' : 'text-pk-content-secondary'}`}
    >
      <span className="text-transparent motion-reduce:text-inherit forced-colors:text-inherit">{text}</span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex select-none motion-reduce:hidden forced-colors:hidden">
        {Array.from(text, (ch, i) => {
          const key = `r${text.length - i}`; // keyed from the right so seconds/minutes keep their cell when a leading field appears or vanishes
          return /\d/.test(ch) ? <RollDigit key={key} digit={Number(ch)} /> : <span key={key} className="whitespace-pre">{ch}</span>;
        })}
      </span>
    </time>
  );
}

const LABEL = 'text-body-xs font-semibold! text-pk-content-secondary whitespace-nowrap';

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const labelId = useId();
  const remaining = useCountdown(bounty.deadline);
  const expired = isExpired(remaining);
  const count = bounty.submissionCount;
  return (
    <div className={CARD_SHELL} data-testid="bounty-card">
      <div className="flex w-full items-start gap-2 px-3 h-[42px] static">
        <div className="overflow-hidden rounded-sm relative w-[38px] min-w-[38px] h-[38px]">
          <img
            alt={`${bounty.sponsor.name} logo`}
            loading="lazy"
            decoding="async"
            className="object-cover rounded-sm"
            style={{ position: 'absolute', height: '100%', width: '100%', left: 0, top: 0, right: 0, bottom: 0, color: 'transparent' }}
            width={38}
            height={38}
            src={bounty.sponsor.logo}
          />
        </div>
        <div className="flex flex-1 min-w-0 gap-4 justify-between cursor-default">
          <div className="flex-1 min-w-0 w-full">
            <a
              className="group !static flex h-fit w-full cursor-pointer touch-manipulation outline-none after:absolute after:inset-0 after:z-20 after:rounded-xl active:opacity-70 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pk-gray-400"
              href={bounty.url}
            >
              <div className="flex flex-col justify-center min-h-[36px]">
                <h3 className="text-body-base text-pk-content-primary font-[590] w-fit line-clamp-3 text-pretty decoration-2 min-w-0 group-hover/card:underline">
                  {bounty.title}
                </h3>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-end gap-1.5 px-3 pb-2">
        <div className="relative h-20 w-full lg:mt-0.5">
          <div className="flex justify-between items-center gap-4 w-full shrink-0 min-h-10">
            <div className="relative min-w-0">
              <span id={labelId} className={`${LABEL} block transition-opacity duration-150 ${expired ? '' : 'group-hover/card:opacity-0'}`}>
                {expired ? 'Ended' : 'Ends in'}
              </span>
              {expired ? null : (
                <span aria-hidden="true" className={`${LABEL} absolute left-0 top-0 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100`}>
                  {formatEndsAt(bounty.deadline)}
                </span>
              )}
            </div>
            {expired ? (
              <time dateTime={bounty.deadline} className="text-heading-xl tabular-nums text-pk-content-secondary whitespace-pre">
                {formatEndedOn(bounty.deadline)}
              </time>
            ) : (
              <RollingTime text={formatCountdown(remaining)} deadline={bounty.deadline} labelId={labelId} urgent={isUrgent(remaining)} />
            )}
          </div>
          <div className="flex justify-between items-center gap-4 w-full shrink-0 min-h-10">
            <span className={LABEL}>Reward</span>
            <p className={`text-heading-2xl ${expired ? 'text-pk-content-secondary' : 'text-pk-content-primary'}`}>{formatBountyAmount(bounty.rewardAmount)}</p>
          </div>
        </div>
        <div className="flex w-full text-body-sm text-pk-content-secondary relative items-center">
          <div className="flex gap-2 justify-between items-center w-full overflow-x-auto whitespace-nowrap overflow-visible no-scrollbar">
            <div className="flex flex-row gap-2 items-center min-w-0">
              <p className="truncate">{bounty.sponsor.name}</p>
              {count === undefined ? null : (
                <>
                  <div className="w-[1.5px] h-[10px] bg-pk-border rounded-full shrink-0" />
                  <p className="shrink-0">{`${count} ${count === 1 ? 'submission' : 'submissions'}`}</p>
                </>
              )}
            </div>
            <div className="flex justify-center items-center">
              <div className="flex">
                <BookmarkButton eventId={`bounty:${bounty.id}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 6. Test vectors (generated from the code; `node --test` 5/5 in the prototype)
`formatCountdown(ms)`; `urgent` = `isUrgent(ms)`; `expired` = `isExpired(ms)`.

| input ms | expected | urgent | notes |
|---|---|---|---|
| 274_329_000 | `3d 04:12:09` | no | 3 days+ |
| 259_200_000 | `3d 00:00:00` | no | |
| 90_061_000 | `1d 01:01:01` | no | |
| 86_400_000 | `1d 00:00:00` | no | exactly 1 day |
| 86_399_001 | `1d 00:00:00` | no | ceil: colour follows the text |
| 86_399_000 | `23:59:59` | **yes** | day boundary |
| 86_398_001 | `23:59:59` | yes | |
| 86_398_000 | `23:59:58` | yes | |
| 43_200_000 | `12:00:00` | yes | |
| 36_000_000 | `10:00:00` | yes | |
| 35_999_000 | `9:59:59` | yes | hours unpadded |
| 3_600_000 | `1:00:00` | yes | |
| 3_599_001 | `1:00:00` | yes | |
| 3_599_000 | `59:59` | yes | hour boundary |
| 600_000 | `10:00` | yes | |
| 599_000 | `9:59` | yes | minutes unpadded |
| 114_000 | `1:54` | yes | the hero slide's own sample |
| 60_000 | `1:00` | yes | |
| 59_001 | `1:00` | yes | |
| 59_000 | `0:59` | yes | minute boundary |
| 9_000 | `0:09` | yes | |
| 8_001 | `0:09` | yes | |
| 1_000 | `0:01` | yes | |
| 1 | `0:01` | yes | last millisecond is still open |
| 0 | `0:00` | no | **expired** (`isExpired` true; card shows `Ended` + date) |
| -1 | `0:00` | no | expired |
| -86_400_000 | `0:00` | no | expired |

`msToNextTick` (delay to the next printed change): 3000->1000, 2500->500, 2001->1, 2000->1000, 1001->1, 1000->1000, 1->1. Property: following `left -= msToNextTick(left)` from `5_432_100` prints `1:30:33, 1:30:32, 1:30:31, ...` ending `0:00` with no skipped or repeated value.
`formatBountyAmount`: 2500->`$2,500`, 80080->`$80,080`, 1_500_000->`$1,500,000`, 0->`$0`, 2500.5->`$2,500.50`, 0.99->`$0.99`.
`sampleBounty(search, loadedAt)`: default = loadedAt + 2d3h14m7s; `?state=hour` = +15_129_000; `?state=minute` = +114_000; `?expired=1` = -60_000; unknown state falls back to day.
The test file is `scripts/proto/src/lib/countdown.test.ts` (runner-agnostic `node:test`; the app has no test runner or `@types/node`: port the file to the manager's runner by deleting the `.ts` import suffixes and swapping the first two imports). **Hook behaviour** (not unit-tested; there is no React renderer in the app) was verified in a real browser by `scripts/proto-behavior.mjs`: ticks arrive 1.00 s apart (`0:12`..`0:01` at 19, 1033, 2003 ... 11038 ms), flip to `Ended` at 12.0 s, then **no further timeouts are armed**; with `visibilityState` forced to `hidden`, the text froze and 0 timeouts were armed, and on `visible` it recomputed immediately (`2d 03:14:05` -> `2d 03:14:01` after 3.8 s hidden).
For a hook test with fake timers: `useCountdown(deadline, () => fakeNow)` takes an injectable clock.

## 7. Acceptance checklist for the manager's build
1. `export` on `CARD_SHELL` and `BookmarkButton`; append the CSS block; add the three files; render beside `MarketCard`.
2. check-ui: no `duration-over-300ms` in components (the duration lives in `pk-roll`); arbitrary values only in `src/components/**` (allowed by config). NOT RUN: the repo's check-ui was not executed on the prototype (the prototype lives outside the app); only tsc, node:test and Playwright were.
3. Screenshot at 1100px: bounty card header/body/footer rects equal the market card's (316.5x180, 42, 124, 28).
4. In tests read `time.firstElementChild.textContent`, never `time.textContent`.
5. Computed styles to assert: label `12/16/600`, timer `20/24/600` tabular, $ `24/28/600` `lab(15.4544 -0.764295 -4.69404)`.

## 8. UNRETRIEVED / unverified (explicit)
- The hero timer's live rendering at >=1 day (the `D:HH:MM:SS` branch is code-derived only; the card's `Nd HH:MM:SS` is a documented departure, not a retrieved string).
- Polymarket's computed font weight below `md` for the timer/money (620 by CSS source order, not read live; the card uses 600 at 20px and 24px).
- `playSpringTransform`'s body (only its call sites and the head of its implementation were read): the card assumes the per-roll duration equals `springTiming` (702 ms) because the settle threshold scales with travel; not compared frame-by-frame against the live site.
- Visual side-by-side of the card's roll against Polymarket's live roll (no capture of the live mid-roll frame beyond the DOM samples).
- The segmented `time.countdown {days,hrs,min,sec}` component (strings only), dark theme and mobile rendering of the hero timer.
- `forced-colors:` guards and Intl.DateTimeFormat output in non-en-US locales are my additions, untested; hover-label text uses the browser's time zone and ICU spacing (not asserted in tests).
- Everything in RESEARCH section 8 that concerns competitors (Algora/Replit/Layer3/Gitcoin/Bountycaster card DOM, Superteam `k` threshold) is unchanged and still unretrieved.

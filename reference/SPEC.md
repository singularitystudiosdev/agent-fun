# Polymarket multi-outcome market card — live reference spec

Retrieved 2026-10-25 from the live site. Nothing below is recalled from memory.

- Method: real Chrome-for-Testing (Playwright) at 1440x900, DPR 2, `colorScheme: light`, plus the scraper's Camoufox browser at 1280x720.
- Card used: event 655483 (`next-prime-minister-of-serbia-20260629223938642`) on https://polymarket.com/ — present on the homepage grid. Every other 2-row card on the page has identical anatomy (21 cards cross-checked).
- Light theme is the default: `<html data-theme="light">`, `localStorage.theme` is null. Nothing was forced.
- A geoblock modal ("It looks like you're in the US – Trading is blocked…", `[data-slot=modal-overlay]`, z-250) dims the page for US IPs. It was removed in the DOM only to take clean screenshots. It does not touch the card.
- The card HAS NO CSS `border`. The "1px light border" is the first layer of `shadow-pk-minimal-soft`: `0 0 0 1px rgba(0,0,0,.06)`.

Artifacts in `/Users/adrianagne/Documents/cosmos/projects/quick-chats/.tmp/polymarket-ref/`:

| file | what |
|---|---|
| `card.html` | exact outerHTML of the card (Chromium, 11,060 B) |
| `card-dom.json` | 54 nodes: class, rect relative to the card, and ~55 computed props each (Chromium, DPR 2, 1440 viewport) |
| `card-states.json` | computed styles at rest / hover / active for Yes, No, gift, bookmark, title, row name, card |
| `live-card.png` | element screenshot, **634x360 px** = 317x180 CSS at DPR 2 (card CSS width 316.5) |
| `live-card-padded.png` | same, 8px margin, **664x376 px**, shows the shadow ring (page dimmed by the geoblock modal, so ignore its colors) |
| `live-card-hover-yes.png`, `-hover-no.png`, `-hover-card.png` | hover states, 634x360 |
| `fonts/*.woff2` | Inter Variable |
| `icons/*` | gift.svg, bookmark sprites and frames, event icon jpg |
| `gamma-event-655483.json` | gamma API response, 53 markets |
| `prior-art.md` | in-house reuse notes and GitHub clones |
| `target.png` | the user's screenshot |

---

## 1. Annotated DOM (class strings verbatim from live; px from computed style at 1440 wide, card = 316.5 x 180)

Tailwind is v4 (`--tw-*`, `@property`). The card's CSS comes from Polymarket's compiled bundle. Utilities such as `shadow-pk-*`, `bg-pk-*`, `text-body-*` are custom, not stock Tailwind.

```
CARD SHELL  div.relative.flex.flex-col.justify-between.rounded-xl.shadow-pk-minimal-soft.min-h-[180px].h-full.overflow-hidden.pt-3.group/card.transition.hover:-translate-y-px.hover:shadow-pk-middle.bg-pk-elevated.isolate.[&_a]:relative.[&_a]:z-30.[&_button]:relative.[&_button]:z-30
   316.5x180 · pt 12px · radius 15.2px (--radius-xl) · bg #fff · overflow hidden · NO border
   shadow = 0 0 0 1px rgba(0,0,0,.06), 0 2px 6px -.5px rgba(0,0,0,.025), 0 2px 10px 0 rgba(0,0,0,.025)
   transition: 0.15s cubic-bezier(.4,0,.2,1) on color,bg,border,opacity,box-shadow,transform,translate,scale…
   Grid: grid h-auto gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 (gap 12px). Card is 180px tall at every width.

├─ HEADER  div.flex.w-full.items-start.gap-2.px-3.h-[42px].static        316.5x42 @ y12 · px 12 · gap 8
│   ├─ ICON BOX  div.overflow-hidden.rounded-sm.relative.w-[38px].min-w-[38px].h-[38px]    38x38 @ (12,12) · radius 7.2px (--radius-sm)
│   │   └─ img.object-cover.rounded-sm  alt="<title> card icon" loading=lazy decoding=async data-nimg=fill
│   │        style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent"
│   │        sizes="38px" · srcset=/_next/image?url=<enc S3 url>&w=96|256|600|1024&q=75 (96w 256w 600w 1024w) · src = same, w=1024&q=75
│   │        object-fit: cover · radius 7.2px. Source jpg is 1600x1067 landscape (cropped by cover). Saved: icons/serbia-event-icon.jpg
│   └─ div.flex.flex-1.min-w-0.gap-4.justify-between.cursor-default       (229 @1280; 246.5 @1440 is the <a> width)
│       └─ div.flex-1.min-w-0.w-full
│           └─ a.group.!static.flex.h-fit.w-full.cursor-pointer.touch-manipulation.outline-none.after:absolute.after:inset-0.after:z-20.after:rounded-xl.active:opacity-70.focus-visible:after:ring-2.focus-visible:after:ring-inset.focus-visible:after:ring-pk-gray-400
│               href="/event/<eventSlug>" · z-index 30 · the ::after covers the WHOLE card (inset-0, z20, rounded-xl) => whole card clickable
│               └─ div.flex.flex-col.justify-center.min-h-[36px]            36px tall, title vertically centered
│                   └─ h3.text-body-base.text-pk-content-primary.font-[590].w-fit.line-clamp-3.text-pretty.decoration-2.min-w-0.group-hover/card:underline
│                        14px / 20px · weight 590 · letter-spacing -0.09px · color #23272d · title x=58,y=20 · max 3 lines
│
└─ BODY  div.flex.flex-col.justify-end.gap-1.5.px-3.pb-2        316.5x124 @ y56 · px 12 · pb 8 · gap 6
    ├─ div.fresnel-container.fresnel-lessThan-lg.contents                 (mobile/tablet branch: empty in the DOM at >=1024 — see UNRETRIEVED)
    ├─ div.fresnel-container.fresnel-greaterThanOrEqual-lg.contents       (desktop branch; display:contents)
    │   └─ ROWS BOX  div.relative.mt-0.5.h-20.w-full                      292.5x80 @ (12,58) · mt 2 · FIXED 80px = exactly 2 rows · overflow visible · no scroll
    │       ├─ ROW  div.flex.justify-between.items-center.gap-4.w-full.shrink-0.group/market-row.relative.min-h-10      292.5x40 · gap 16
    │       │   ├─ div.flex.flex-1.items-center.gap-2.min-w-0
    │       │   │   └─ div.min-w-0.text-body-base.font-[440].text-pk-content-primary      14/20 · weight 440 · ls -0.09px · #23272d
    │       │   │       └─ a.group/market-row-link.!static.block.min-w-0.cursor-pointer.outline-none.after:absolute.after:inset-0.after:z-40.after:rounded-sm.focus-visible:after:ring-2.focus-visible:after:ring-inset.focus-visible:after:ring-pk-gray-400
│   │   │   │              href="/event/<eventSlug>/<marketSlug>" · z 30 · ::after z40 covers the row
│   │       │   │           └─ p.line-clamp-1.break-all.group-hover/market-row-link:underline.group-focus-visible/market-row-link:underline     NAME (groupItemTitle), 1 line clamp, break-all
│   │       └─ div.shrink-0
│   │           └─ div.relative.z-50
│   │               └─ div.flex.justify-end.gap-1.items-center            27px tall · gap 4
│   │                   ├─ p.text-[15px].font-semibold.text-pk-content-primary.mr-1     PERCENT: 15px / 22.5px (inherits lh 1.5) · weight 600 · ls normal · #23272d · mr 4 (so 8px to the Yes pill) · font-family inherits body `inter, "inter Fallback"`
│   │                   ├─ a.[PILL_BASE].bg-pk-green-500/15.dark:text-pk-green-800.text-pk-green-600.active:scale-100.transition.relative.h-[27px].!rounded-xs.group.px-3.5.w-10.dark:hover:bg-pk-green-400.hover:bg-pk-green-600.hover:!text-white     YES PILL
│   │                   │     40x27 · radius 5.2px (--radius-xs) · bg rgba(0,156,57,.15) · text #007e26 · px 14
│   │                   │     href="/event/<eventSlug>?marketSlug=<marketSlug>&outcomeIndex=0"
│   │                   │     ├─ span.transition.opacity-100.truncate.absolute.top-1/2.-translate-y-1/2.left-1/2.-translate-x-1/2.max-w-[36px].text-body-sm.group-hover:opacity-0      "Yes"  13/16 · weight 490 · ls -0.1px · overflow hidden
│   │                   │     └─ span.text-body-sm.text-center.absolute.transition.top-1/2.-translate-y-1/2.opacity-0.left-1/2.-translate-x-1/2.group-hover:opacity-100      "<yes price %>" (cross-fade on hover)
│   │                   └─ a.[PILL_BASE].bg-pk-red-500/9.dark:bg-pk-red-100.text-pk-red-500.dark:text-pk-red-700.hover:bg-pk-red-500/13.dark:hover:bg-pk-red-200.active:scale-100.transition.relative.h-[27px].!rounded-xs.group.px-3.5.w-10.hover:!bg-pk-red-500.hover:!text-white     NO PILL
│   │                         40x27 · radius 5.2px · bg rgba(223,12,16,.09) · text #df0c10 · href=...&outcomeIndex=1 · same two spans, "No" / "<no price %>"
│   │       └─ (2nd ROW identical, y=98)
│   └─ FOOTER  div.flex.w-full.text-body-sm.text-pk-content-secondary.relative.items-center     292.5x28 @ y144 · 13/16 · weight 490 · ls -0.1px · #6b727b
│       └─ div.flex.gap-2.justify-between.items-center.w-full.overflow-x-auto.whitespace-nowrap.overflow-visible.no-scrollbar
│           ├─ div.flex.flex-row.gap-1.items-center
│           │   └─ p.text-pk-content-secondary > span.uppercase "$3M " + "Vol."          text "$3M Vol." (the trailing space is inside the span)
│           └─ div.flex.justify-center.items-center > div.flex     56x28 · NO gap between the two buttons
│               ├─ GIFT  button.[PILL_BASE minus rounded-sm kept].active:scale-[97%].transition.duration-150.bg-button-ghost-bg.text-pk-content-secondary.w-7.h-7.hover:bg-pk-hover-overlay-darker   aria-label="Rewards" data-slot="tooltip-trigger" id=base-ui-_R_…_
│               │     28x28 @ (248.5,144) · radius 7.2px (rounded-sm) · color #6b727b · svg 16x16 (viewBox 0 0 18 18), stroke currentColor 1.5
│               └─ BOOKMARK  button.…active:scale-[97%].transition.duration-150.bg-button-ghost-bg.text-button-ghost-text.w-7.h-7.hover:bg-pk-hover-overlay-darker.rounded-full   aria-label="Add to favorites"
│                     28x28 @ (276.5,144) · radius 9999px · inner div.bookmarkButton.small = 16x16 CSS sprite (see §4)
```

`PILL_BASE` = `inline-flex items-center cursor-pointer duration-150 justify-center gap-2 whitespace-nowrap rounded-sm text-body-base font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0`

Vertical layout, all CSS px (card 180 tall): `0–12` pt · `12–54` header (icon 12–50) · `56–180` body (flex-col justify-end) · rows `58–98`, `98–138` · gap 6 · footer `144–172` · pb 8. Header (12+42=54) + body (124) = 178; `justify-between` puts the extra 2px between them.
Horizontal (1440, inner width 292.5): name left at x=12; `%` right edge at 212.5; Yes `220.5–260.5`; No `264.5–304.5`.
Card width: 343 @390 vw (1 col) · 370.5 @800 · 312.3 @1024 · 295.25 @1280 · 316.5 @1440 and @1920. Height is always 180.

Computed style table for the key nodes (Chromium, light):

| node | font | size / lh | weight | ls | color | bg |
|---|---|---|---|---|---|---|
| h3 title | inter | 14 / 20 | 590 | -0.09px | #23272d | – |
| row name `p` | inter | 14 / 20 | 440 | -0.09px | #23272d | – |
| `%` `p` | inter | 15 / 22.5 | 600 | normal | #23272d | – |
| pill label spans | inter | 13 / 16 | 490 | -0.1px | green #007e26 / red #df0c10 | – |
| footer `p` | inter | 13 / 16 | 490 | -0.1px | #6b727b | – |
| Yes pill `a` | inter | 14 / 20 (label overridden by span) | 600 | -0.09px | #007e26 | rgba(0,156,57,.15) |
| No pill `a` | same | same | 600 | -0.09px | #df0c10 | rgba(223,12,16,.09) |

Everywhere: `font-feature-settings: "calt","cv01","cv02","cv03","cv04","cv09" 0,"cv11","cv15","liga"` (from `--inter-font-features`), `font-variation-settings: normal`, `text-decoration: none`, `text-transform: none` (volume number is `uppercase`, which is a no-op on "$3M").
Body font stack: `inter, "inter Fallback"`; `.text-body-*` use `var(--font-inter,"Inter"), sans-serif`. No `font-variant-numeric` is set.

---

## 2. Design tokens (light theme, resolved from `:root`)

| token | value (hex) | used by |
|---|---|---|
| `--color-pk-content-primary` | `lab(15.4544% -.764295 -4.69404)` = **#23272d** | title, names, % |
| `--color-pk-content-secondary` | `lab(47.7217% -1.37293 -5.88264)` = **#6b727b** | footer, gift icon |
| `--color-pk-elevated` | `lab(100% 0 0)` = **#ffffff** | card bg |
| `--color-pk-border` | `lab(91.9748% -.136733 -1.92862)` = **#e6e8ec** | only inherited as border-color; no border is drawn |
| `--color-pk-gray-400` | `lab(78.7165% -.528604 -3.76731)` = **#bfc3ca** | focus ring (`focus-visible:after:ring-2`) |
| `--color-pk-green-400` | **#04af52** | dark-mode Yes hover |
| `--color-pk-green-500` | `lab(56.1642% -52.1702 40.2684)` = **#009c39** | Yes bg = 15% of this |
| `--color-pk-green-600` | `lab(45.7361% -45.2267 37.3056)` = **#007e26** | Yes text, Yes hover bg |
| `--color-pk-green-800` | **#00450a** | dark-mode Yes text |
| `--color-pk-red-100` / `-200` | #ffcfc6 / #ffa597 | dark-mode No bg / hover |
| `--color-pk-red-500` | `lab(47.8918% 72.1772 58.3835)` = **#df0c10** | No text, No hover bg; No bg = 9% |
| `--color-pk-red-700` | **#930000** | dark-mode No text |
| `--color-pk-hover-overlay-darker` | `lab(0% 0 0/.05)` = rgba(0,0,0,.051) | gift/bookmark hover bg |
| `--color-button-ghost-bg` | transparent | gift/bookmark rest bg |
| `--color-button-ghost-text` | = content-primary (#23272d) | bookmark button color |
| `--radius` | `.7rem` (11.2px) | |
| `--radius-xs` / `-sm` / `-md` / `-xl` | `calc(.7rem - 6px)` = **5.2px** / `-4px` = **7.2px** / `-2px` = 9.2px / `+4px` = **15.2px** | pill / icon+gift / – / card |
| `--shadow-pk-minimal-soft` | `inset 0 0 0 0 rgba(0,0,0,0), 0 0 0 1px lab(0% 0 0/.06), 0 2px 6px -.5px lab(0% 0 0/.025), 0 2px 10px 0 lab(0% 0 0/.025), 0 0 0 0 transparent ×3` | card rest |
| `--shadow-pk-middle` | `inset 0 0 0 0 transparent, 0 0 0 1px oklch(from #23272d l c h/.06), 0 1px 1px -.5px rgba(0,0,0,.06), 0 3px 3px -1.5px rgba(0,0,0,.06), 0 6px 6px -3px rgba(0,0,0,.06), 0 0 0 0 transparent ×2` | card hover |
| `--default-transition-duration` / `-timing-function` | `.15s` / `cubic-bezier(.4,0,.2,1)` | all `transition` |
| `--inter-font-features` | `"liga" 1,"calt" 1,"cv01" 1,"cv02" 1,"cv03" 1,"cv04" 1,"cv09" 0,"cv11" 1,"cv15" 1` | |
| `--font-inter` | `"Inter", sans-serif` | |

Bundle rgba fallbacks (the CSS has `rgba()` first, then a `color-mix` override): `bg-pk-green-500/15 = rgba(0,156,57,.15)`, `bg-pk-red-500/9 = rgba(223,12,16,.09)`, `hover:bg-pk-red-500/13 = rgba(223,12,16,.13)` (overridden by `hover:!bg-pk-red-500`).
Utility definitions: `text-body-base { letter-spacing:-.09px; font-size:14px; line-height:20px }` (no weight), `text-body-sm { letter-spacing:-.1px; font-size:13px; font-weight:490; line-height:16px }`, `.font-[590]{font-weight:590}`, `.font-[440]{font-weight:440}`, `.font-semibold{font-weight:600}`, `.text-[15px]{font-size:15px}`.

---

## 3. Fonts

Only Inter Variable is used by the card. The three @font-face files are byte-identical (md5 `90ea661028e8a2231425120f05923615`, 356,824 B, WOFF2 v4.131, full glyph set, weight axis 100–900, no `unicode-range`, so Latin-ext `Š š ć đ č` work). Local copies are in `.tmp/polymarket-ref/fonts/`.

Base URL: `https://polymarket.com/_next/static/immutable/media/`

```css
/* in effect for the card: body font-family is "inter" (lowercase), loaded from the "-s.p" file */
@font-face { font-family: inter; src: url("InterVariable-s.p.1aygxr7adi9hb.woff2") format("woff2");
             font-style: normal; font-weight: 100 900; font-display: swap; }
@font-face { font-family: Inter; src: url("InterVariable.1aygxr7adi9hb.woff2") format("woff2");
             font-style: normal; font-weight: 100 900; font-display: swap; }          /* used via --font-inter by .text-body-* */
@font-face { font-family: interMedium; src: url("InterVariable-s.1aygxr7adi9hb.woff2") format("woff2");
             font-style: normal; font-weight: 500; font-display: swap; }               /* not used by the card */
@font-face { font-family: "inter Fallback"; src: local(Arial); ascent-override: 89.79%;
             descent-override: 22.36%; line-gap-override: 0%; size-adjust: 107.89%; }
```
Because the file is a variable font, the non-standard weights 440 / 490 / 590 render exactly (do not round to 400/500/600).
Loaded in the browser (`document.fonts`): `Inter 100 900`, `inter 100 900`, plus `openSauce 600` and `Geist Mono 600` (not used by the card).
License: the woff2 name table was NOT read (no fontTools here). It is Inter 4.x; upstream https://github.com/rsms/inter/blob/master/LICENSE.txt (fetched) says "SIL Open Font License, Version 1.1" (free for commercial use, embedding and redistribution; must keep the notice and not sell the font alone). Treat the license as upstream-verified, not file-verified.

---

## 4. Icons

- **Event icon:** `<img>` as above. S3 source `https://polymarket-upload.s3.us-east-2.amazonaws.com/next-prime-minister-of-serbia-20260629223938642-1arHDSHMNTZz.jpg` (copy: `icons/serbia-event-icon.jpg`, 1600x1067). The site serves it through `/_next/image?url=…&w=96|256|600|1024&q=75`. 38x38 box, `object-fit: cover`, radius 7.2px, no border.
- **Gift ("Rewards")** inline SVG, saved as `icons/gift.svg` (`data-color` attributes stripped): `width=16 height=16 viewBox="0 0 18 18"`, all shapes `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`. Color comes from the button's `text-pk-content-secondary` (#6b727b). Elements: `<line x1=9 y1=5.25 x2=9 y2=16.25>`, `<path d="M3.75,3.5c0-.966,.784-1.75,1.75-1.75,2.589,0,3.5,3.5,3.5,3.5h-3.5c-.966,0-1.75-.784-1.75-1.75Z">`, `<path d="M12.5,5.25h-3.5s.911-3.5,3.5-3.5c.966,0,1.75,.784,1.75,1.75s-.784,1.75-1.75,1.75Z">`, `<path d="M14.25,8.25v6c0,1.105-.895,2-2,2H5.75c-1.105,0-2-.895-2-2v-6">`, `<rect x=1.75 y=5.25 width=14.5 height=3 rx=1 ry=1>`. Full markup is in `card.html`.
- **Bookmark** is NOT inline SVG. It is a CSS sprite. `div.bookmarkButton.small { background-image:url(/_next/static/immutable/media/bookmark-sprite-small.3h8279e2t-kl2.svg); background-size:1500% auto; background-repeat:no-repeat; width:16px; height:16px }`. Resting background-position is `0px center` (frame 0). `.active` sets `background-position:100% center` (frame 14). `.unrolled` plays `0.5s steps(14) forwards bookmark-unroll`, and `.rolled` goes back to frame 0. Dark theme uses `bookmark-sprite-small-dark.1472_4fp6c1ep.svg`. The sprite is 240x17, 15 frames of 16px: frames 0–4 are the gray outline (stroke **#77808d**, 1.33333), frames 5–14 are the filled brand blue (**#1452f0**, fill-opacity .75 on one frame). Files: `icons/bookmark-sprite-small.3h8279e2t-kl2.svg` (original), `bookmark-small-outline.svg` (frame 0, `viewBox="0 0 16 16"`), `bookmark-small-filled.svg` (frame 14, `viewBox="224 0 16 16"` window into the sprite), `bookmark-sprite-light.3m_2wgf0txoof.svg` (18px variant, unused here). Note: the bookmark outline is hard-coded **#77808d**, not `currentColor`.
- Tooltip on the gift (`data-slot="tooltip-trigger"`, Base UI tooltip, id `base-ui-_R_…`): tooltip content was not captured (see UNRETRIEVED).

---

## 5. States and transitions (computed values captured by hovering in Chromium)

All transitions use `0.15s cubic-bezier(.4,0,.2,1)` on the Tailwind default property list, except plain text-decoration which is instant (`transition: all 0s`).
All `hover:` rules are wrapped in `@media (hover: hover)`.

| element | rest | hover | active (pressed) | focus-visible |
|---|---|---|---|---|
| card shell | bg #fff, `shadow-pk-minimal-soft` | `translate: 0 -1px` + `shadow-pk-middle` (ring rgba(35,39,45,.06) + 3 layered rgba(0,0,0,.06) shadows). It also underlines the title (`group-hover/card:underline`, `decoration-2` = 2px) | – | – |
| title link (whole-card overlay) | – | – | `opacity .7` (`active:opacity-70`) | `::after` ring 2px inset, color #bfc3ca (`--color-pk-gray-400`), radius 15.2px |
| row name | no underline | `underline` (instant), only when the pointer is over that row's link | – | same underline + 2px inset ring #bfc3ca, radius 7.2px |
| **Yes pill** | bg rgba(0,156,57,.15), text #007e26; label opacity 1, price span opacity 0 | **bg #007e26, text #ffffff**; label fades to opacity 0 and the price % fades to 1 (cross-fade, 150ms) | `active:scale-100` (no shrink) | `ring-1` `--color-ring` (#6b727b) |
| **No pill** | bg rgba(223,12,16,.09), text #df0c10 | **bg #df0c10, text #ffffff**; same cross-fade | `active:scale-100` | same |
| gift button | transparent, svg #6b727b | bg rgba(0,0,0,.051) (`--color-pk-hover-overlay-darker`), radius 7.2px | `scale .97` (`active:scale-[97%]`) | `ring-1` #6b727b |
| bookmark button | transparent | bg rgba(0,0,0,.051), `rounded-full` | `scale .97` | `ring-1` |
| bookmark when saved | – | – | – | `.bookmarkButton.active` → sprite frame 14 (blue #1452f0 fill) |
| disabled pills | – | – | – | `disabled:opacity-50 pointer-events-none` (class present; not exercised) |

Hovering a pill also hovers the card, so the title underlines and the card lifts by 1px at the same time (see `live-card-hover-yes.png`).
Pill label text swap: the second span text equals the displayed price for that outcome (Yes → yes %, No → no %).
Dark-theme classes present on the pills: `dark:text-pk-green-800 dark:hover:bg-pk-green-400 dark:bg-pk-red-100 dark:text-pk-red-700 dark:hover:bg-pk-red-200`. Dark values were not captured beyond the token hexes above.

---

## 6. Data rules (verified against gamma-api for 21 homepage cards)

- **Rows:** exactly **2** rows in a fixed 80px box, no scroll, no "more". They are the 2 highest-priced active markets of the event, sorted by `outcomePrices[0]` descending. Verified on every card, including date-ladder events (Anthropic IPO by…: shown "December 31 83%" then "December 15 82%", even though the event lists dates ascending). Inactive placeholders (`active:false`, "Person E…", "Other", 0.5/0.5) are excluded. Serbia PM: Šoškić 0.3385, Srdanović 0.21 (live later drifted to 0.3385/0.215 and rendered 36%/22%), the third is Saičić 0.106. Row label = `market.groupItemTitle`.
- **%:** `Math.round(parseFloat(outcomePrices[i]) * 100) + "%"` (half-up: 0.645 → 65, 0.355 → 36, 0.275 → 28, 0.0155 → 2, 0.9965 → 100). If the price is below 0.01 it renders **"<1%"** (0.0025 → "<1%", 0.007 on the No side → "<1%"). It uses `outcomePrices`, NOT `lastTradePrice` (Srdanović: last trade 0.19, bid .20, ask .22, outcomePrices .21 → shown 21%).
- **Hover price on pills:** Yes shows the same % as the bold number. No shows the No outcome's %: 0.6615 → 66%, 0.79 → 79%, 0.007 → "<1%". It cannot be distinguished from `100 - yes%` with the data I had (Serbia: 100-34=66 and round(66.15)=66 agree).
- **Volume:** `event.volume` (a float, 2923146.72 → "$3M Vol."). `≥1e6 → "$" + Math.round(v/1e6) + "M"` (integer, no decimals: 2.92M→$3M, 2.38M→$2M, 1.88M→$2M, 2.56M→$3M, 22.59M→$23M, 10.62M→$11M, 1.011M→$1M, 3.57M→$4M). `<1e6 → "$" + Math.round(v/1e3) + "K"` (981,933→$982K, 968,932→$969K). The format is `<span class="uppercase">$3M </span>Vol.`. ≥1B and sub-1K are UNRETRIEVED.
- **Links:** title → `/event/<slug>`; row name → `/event/<slug>/<market.slug>`; Yes → `/event/<slug>?marketSlug=<market.slug>&outcomeIndex=0`; No → `...&outcomeIndex=1`. The whole card is clickable (title link's `::after` overlay). Rows, pills, gift and bookmark sit above it (`[&_a]:z-30 [&_button]:z-30`, row link ::after z-40, pill wrapper z-50). Links are same-origin `<a>` (Next router). Gift = rewards tooltip. Bookmark = "Add to favorites" (login-gated on the real site).
- **Which branch renders:** `fresnel-greaterThanOrEqual-lg` holds the 2-row desktop block. The `lessThan-lg` container is empty in the SSR DOM at 1024+; at 390 and 800 px the card still showed 2 `.group/market-row` rows with the same text, so the markup is probably shared (not diffed, see UNRETRIEVED).
- **Gamma fields used:** `event.slug|title|icon|volume|negRisk|sortBy:"price"`, `markets[].groupItemTitle|slug|active|closed|outcomes|outcomePrices` (JSON-encoded strings).
- **Single-market (binary) cards are a different anatomy (not extracted).**

### CORS verdict
`gamma-api.polymarket.com` sends `access-control-allow-origin: *` on GET (checked with `Origin: http://localhost:5173`, HTTP 200 on `/events/655483`) and on preflight OPTIONS (`allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`, `allow-headers: Accept, Authorization, Content-Type, X-CSRF-Token, Token, traceparent, tracestate, baggage`, `max-age: 2592000`). **No dev proxy is needed** for `fetch('https://gamma-api.polymarket.com/events?slug=…')` from localhost. (HEAD returns 405 but carries the same ACAO header.) The event icon on `polymarket-upload.s3…amazonaws.com` is a plain `<img>` (no CORS needed). The `/_next/image` resizer is only reachable from polymarket.com itself, so hotlink the S3 jpg directly or proxy it.

---

## 7. Live screenshot
- `live-card.png`: **634 x 360 px** (DPR 2), card CSS width **316.5 px** (viewport 1440x900, 4-column grid, `xl:grid-cols-4`), CSS height 180.
- The prices in the screenshot are 34%/21%, same as the target. At retrieval time later in the run the live values drifted to 36%/22%.
- Also `live-card-padded.png` (664x376, with the 8px shadow margin).
- The target.png (686x404) is the same card at DPR 2 with a ~11 CSS-px margin and the exact same layout, text, and colors.

---

## 8. In-house prior art (read-only; from `prior-art.md`)
`/Users/adrianagne/Documents/cosmos/projects/polymarket-clone` already links Polymarket's own compiled stylesheet (`index.html:18` → `public/styles/pm.css`), and its `MarketCard.tsx`/`marketCardShared.tsx` use the identical class strings extracted here. **Reusable verbatim:** `CARD_SHELL`, `PILL_BASE`, `SMALL_GREEN`, `SMALL_RED`, `FooterActions` (gift + bookmark buttons), the header (38px icon + `font-[590]` h3), the row markup (`min-h-10`, `text-[15px] font-semibold mr-1` %, two small pills with the cross-fade spans), rows box `relative mt-0.5 h-20 w-full`, body `flex flex-col justify-end gap-1.5 px-3 pb-2`, footer markup and the token names/values (they match §2 exactly: #23272d, #6b727b, #009c39/#007e26, #df0c10, radii 5.2/7.2/15.2). `MultiOutcomeCard` already does `markets.slice(0,2)`. **Stale or wrong vs live:** (a) `lib/format.ts` `formatVolume` uses one-decimal trimming (`trim()`), so 2,923,146 gives "$2.9M" but live shows **"$3M"** (integer rounding for M and K); (b) `formatPercent` never returns "<1%" (live: price < 0.01 → "<1%"); (c) rows are taken by `slice(0,2)` of the market list, but live sorts by Yes price descending and drops inactive markets; (d) `YesNoPills` is not exported and the older `OutcomeRow` (`MarketCard.tsx:178-195`, "audit-matched") derives No as `1 - yes` and, for 3+ outcome single markets, shows a bare % with no pills, which the live multi-outcome card never does; (e) links go `target=_blank` to polymarket.com rather than local routes; (f) the card footer has an extra "· N days left" suffix that this card does not have.

## 9. GitHub clones (GitHub API, fetched 2026-10-25)
- https://github.com/adisingh396/poly-paper — pushed_at 2026-10-10T14:41:57Z, 0★. Hand-written Tailwind card (`rounded-lg border p-4`, 44px chips, "Ends in Nd"). Less faithful than the live DOM.
- https://github.com/saiisback/polymarket-clone — pushed_at 2026-07-29T09:54:10Z, 0★. Stylized card (28px chance number, `h-10` buttons). No multi-outcome rows, no gift/bookmark. Less faithful.
- https://github.com/zeryswin168/polymarket-clone — pushed_at 2026-08-24T06:32:15Z, 141★, Vue 3 + Solidity. Card component UNRETRIEVED. It is a functional clone, not pixel-faithful.
None beats the live DOM.

---

## 10. UNRETRIEVED / caveats
- **Dark-theme computed values** for the card (only token hexes for dark pill colors were read). Not requested.
- **Tooltip content/styling** for the gift button (Base UI tooltip, only rendered on hover after delay; not captured). The aria-label is "Rewards".
- **`fresnel-lessThan-lg` (<1024px) markup**: the container is empty at ≥1024; below 1024 I confirmed only text/row count (2 rows) and card widths, not a class-by-class diff.
- **Volume ≥ $1B and < $1K formats**; whether 999.5K rounds to "$1000K" or "$1M".
- **No-side hover price rounding source** (`outcomePrices[1]` vs `100 - yes`): indistinguishable in the data seen.
- **Font file license** read from upstream repo (Inter's LICENSE.txt, OFL 1.1), not from the woff2 name table (no fontTools in this environment).
- **Pressed state** of the card (`active:opacity-70`) was read from the CSS rule; my computed-opacity probe returned 1 (the probe pressed over a row link, not the title link, so it did not exercise this rule). The rule itself is retrieved verbatim (`.active\:opacity-70:active { opacity: 0.7 }`).
- Screenshots were taken in Chromium (not the scraper's Camoufox, which has no screenshot verb). Style values (font, color, radius, paddings) were identical in both browsers; only widths differ because the viewports differ (1280 → 295.25px card, 1440 → 316.5px).
- Geoblock modal (US IP) was removed from the DOM for the screenshots only.

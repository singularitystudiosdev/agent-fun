import { Fragment, type ReactNode } from 'react';

/**
 * The profile page's glyph set and the few class strings and primitives its files share. Glyphs are 24px-grid
 * strokes drawn in currentColor (the SubmissionForm set's weight), so a tile or a text colour token sets their
 * colour. No glyph carries text, and none is a meme: past and activity rows use these and render no image.
 */

/* ---- Shared class strings ---- */

/** The header's focus ring (SiteHeader CONTROL, SelectMenu): content-secondary, 2px, offset on the surface. */
export const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-content-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';

/* polymarket.com's .text-heading-lg and .text-heading-3xl (live CSS bundle chunk 3zlgjr5mlf4rt.css). index.css does not
   define them, so the values are copied verbatim here; 15px is the measured Positions / Activity tab label. */
export const HEADING_LG = 'text-[16px] leading-5 tracking-[-0.18px]';
export const HEADING_3XL = 'text-[32px] leading-9 tracking-[-0.01em] font-semibold';
export const TAB_LABEL = 'text-[15px] leading-5 font-semibold';

/** SubmissionForm's controls, verbatim, so the edit dialog reads as the same product. */
export const INPUT =
  'w-full rounded-md border border-pk-border bg-pk-elevated px-3 text-body-base text-pk-content-primary placeholder:text-pk-content-tertiary transition-colors outline-none hover:border-pk-gray-300 focus-visible:border-pk-brand-500 focus-visible:ring-2 focus-visible:ring-pk-blue-200 aria-[invalid=true]:border-pk-red-500 aria-[invalid=true]:focus-visible:ring-pk-red-100 disabled:cursor-not-allowed disabled:bg-pk-gray-100 disabled:text-pk-content-tertiary motion-reduce:transition-none';
export const LABEL = 'text-body-sm font-semibold text-pk-content-primary';
export const HELP = 'text-body-xs text-pk-content-secondary text-pretty';
export const PRIMARY_BUTTON = `inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-pk-brand-500 px-5 text-body-base font-semibold text-pk-elevated transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-pk-gray-200 disabled:text-pk-content-tertiary disabled:hover:opacity-100 motion-reduce:transition-none ${FOCUS_RING}`;
export const SECONDARY_BUTTON = `inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-pk-gray-200 bg-pk-elevated px-4 text-body-base font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`;
/** Polymarket's outline icon button (the profile card's copy and share): 32px, no border, hover wash. */
export const ICON_BUTTON = `inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`;

/* ---- Primitives ---- */

/**
 * Meta parts on one line, split by a small round dot (an element, never a "·" character): polymarket's
 * "Joined Jan 2025 · 37.7K views" anatomy. Screen readers hear a comma between parts.
 */
export function Meta({ parts, className = '', nowrap = false }: { parts: ReactNode[]; className?: string; nowrap?: boolean }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '');
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-x-1.5 ${nowrap ? 'flex-nowrap' : 'flex-wrap'} ${className}`}>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <span aria-hidden="true" className="size-0.5 shrink-0 rounded-full bg-current opacity-70" />
              <span className="sr-only">, </span>
            </>
          )}
          {/* On one line, the first part gives way (truncates) and the rest keep their width. */}
          <span className={nowrap ? (i === 0 ? 'min-w-0 truncate' : 'shrink-0 whitespace-nowrap') : 'min-w-0'}>{p}</span>
        </Fragment>
      ))}
    </span>
  );
}

export type PillTone = 'Leading' | 'Verifying' | 'Pending';
const PILL_TONE: Record<PillTone, string> = {
  Leading: 'bg-pk-green-500/10 text-pk-green-600',
  Verifying: 'bg-pk-blue-100 text-pk-brand-500',
  Pending: 'bg-pk-gray-100 text-pk-content-secondary',
};
/** The standing pill next to a rank. */
export function Pill({ tone }: { tone: PillTone }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-body-xs font-semibold ${PILL_TONE[tone]}`}>{tone}</span>;
}

/** Rows a list shows before "Show more", and how many each click adds. */
export const PAGE_SIZE = 10;

/** A list's table header (md and up): polymarket's uppercase column captions, hidden from assistive tech (each cell carries its own sr-only label). */
export function ListHeader({ grid, columns }: { grid: string; columns: { label: string; end?: boolean }[] }) {
  return (
    <div aria-hidden="true" className={`hidden px-3 pb-2 text-body-xs text-pk-content-secondary uppercase md:grid md:items-end md:gap-x-3 ${grid}`}>
      {columns.map((c) => (
        <span key={c.label} className={c.end ? 'text-right' : ''}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** One sentence and one action: what every empty list renders. */
export function EmptyState({ sentence, action }: { sentence: string; action: ReactNode }) {
  return (
    <div data-testid="profile-empty" className="flex flex-col items-center gap-3 rounded-xl border border-pk-border px-4 py-12 text-center">
      <p className="text-body-base text-pk-content-secondary text-pretty">{sentence}</p>
      {action}
    </div>
  );
}

/** The empty state's action, as a link or a button, in the small outline style. */
export const EMPTY_ACTION = `inline-flex h-8 cursor-pointer items-center rounded-md border border-pk-gray-200 bg-pk-elevated px-3 text-body-sm font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`;

/** Full-width "Show more" under a list longer than a page. */
export function ShowMore({ onClick, remaining }: { onClick: () => void; remaining: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="profile-show-more"
      aria-label={`Show more, ${remaining} more`}
      className={`mt-2 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-pk-gray-200 bg-pk-elevated text-body-base font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`}
    >
      Show more
    </button>
  );
}

/* ---- Glyphs ---- */

function Stroke({ children, className = 'size-4 shrink-0', strokeWidth = 2 }: { children: ReactNode; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

type G = { className?: string };

export const CopyGlyph = ({ className = 'size-5' }: G) => (
  <Stroke className={className} strokeWidth={1.75}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
  </Stroke>
);

export const CheckGlyph = ({ className = 'size-5' }: G) => (
  <Stroke className={className}>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);

/** The X (Twitter) mark, filled. */
export const XGlyph = ({ className = 'size-4' }: G) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.34l4.37 5.78zm-1.08 16.18h1.7L7.4 4.73H5.58z" />
  </svg>
);

export const SearchGlyph = ({ className = 'size-5' }: G) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M8.75 2.875a5.875 5.875 0 0 1 4.727 9.363l3.392 3.394a.875.875 0 0 1-1.237 1.237l-3.394-3.392A5.875 5.875 0 1 1 8.75 2.875m0 1.75a4.125 4.125 0 1 0 0 8.25 4.125 4.125 0 0 0 0-8.25" />
  </svg>
);

export const ClearGlyph = ({ className = 'size-4' }: G) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** The earnings card's direction mark: polymarket's small filled triangle beside "Profit/Loss". */
export const TriangleUpGlyph = ({ className = 'size-2.5' }: G) => (
  <svg viewBox="0 0 10 10" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M5 1.5 9.2 8.5H.8z" />
  </svg>
);

/** Filled check-circle: polymarket's "Won" mark. */
export const CheckCircleFilledGlyph = ({ className = 'size-4' }: G) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="m7.5 12.2 3 3 6-6.4" fill="none" stroke="var(--color-pk-surface, #fff)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckCircleGlyph = ({ className = 'size-4' }: G) => (
  <Stroke className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.2 2.8 2.8L16 9.6" />
  </Stroke>
);

export const MinusCircleGlyph = ({ className = 'size-4' }: G) => (
  <Stroke className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </Stroke>
);

/** A medal: a disc hung from a two-strap ribbon, no text. Filled in currentColor (gold, silver or bronze via a text token). */
export const MedalGlyph = ({ className = 'size-6' }: G) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path d="M7 2.5h3.2l2.3 5.2-2.6 1.6zM17 2.5h-3.2l-2.3 5.2 2.6 1.6z" fill="currentColor" opacity={0.55} />
    <circle cx="12" cy="15" r="6.5" fill="currentColor" />
    <circle cx="12" cy="15" r="4.2" fill="none" stroke="var(--color-pk-surface, #fff)" strokeWidth={1.2} opacity={0.6} />
  </svg>
);

export const FlagGlyph = ({ className = 'size-5' }: G) => (
  <Stroke className={className}>
    <path d="M5 21V4" />
    <path d="M5 4h11.5l-2 4 2 4H5" />
  </Stroke>
);

/** Submitted: an arrow rising out of a tray. */
export const TrayUpGlyph = ({ className = 'size-4' }: G) => (
  <Stroke className={className}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Stroke>
);

export const DollarGlyph = ({ className = 'size-4' }: G) => (
  <Stroke className={className}>
    <path d="M12 3v18" />
    <path d="M16.5 7.5c-.6-1.4-2.3-2.3-4.5-2.3-2.6 0-4.3 1.3-4.3 3.2 0 4.4 9 2.4 9 6.9 0 1.9-1.9 3.4-4.7 3.4-2.4 0-4.2-1-4.8-2.6" />
  </Stroke>
);

export const AlertGlyph = ({ className = 'mt-px size-3.5 shrink-0' }: G) => (
  <Stroke className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Stroke>
);

export const UploadGlyph = ({ className = 'size-4 shrink-0' }: G) => (
  <Stroke className={className}>
    <path d="M12 15V4M7 8l5-5 5 5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Stroke>
);

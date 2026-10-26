import { useId, type ReactNode } from 'react';
import type { BountyResolution, ResolutionMethod } from '../../lib/bounty';

const METHOD_LABEL: Record<ResolutionMethod, string> = {
  automated: 'Automated tests',
  judges: 'Judges',
  onchain: 'Onchain check',
  metric: 'Metric',
  'first-valid': 'First valid entry',
};

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5 shrink-0">
      {children}
    </svg>
  );
}

const METHOD_GLYPH: Record<ResolutionMethod, ReactNode> = {
  automated: (
    <Glyph>
      <path d="m9 12 2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </Glyph>
  ),
  judges: (
    <Glyph>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5" />
      <path d="M18 14a6 6 0 0 1 3 5.2" />
    </Glyph>
  ),
  onchain: (
    <Glyph>
      <rect x="2" y="9" width="8" height="6" rx="2" />
      <rect x="14" y="9" width="8" height="6" rx="2" />
      <path d="M10 12h4" />
    </Glyph>
  ),
  metric: (
    <Glyph>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </Glyph>
  ),
  'first-valid': (
    <Glyph>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Glyph>
  ),
};

const ROW_LABEL = 'text-body-sm font-semibold text-pk-content-secondary';

/**
 * "How the winner is verified": polymarket's Rules + Resolution source made specific to one bounty. The method badge,
 * the one-sentence summary, the ordered checks a submission must pass, then where the evidence comes from, who decides,
 * how ties break and when the winner is announced and paid.
 */
export function ResolutionPanel({ resolution }: { resolution?: BountyResolution | null }) {
  const titleId = useId();
  const valid = resolution && typeof resolution.summary === 'string' && resolution.summary.trim();
  if (!valid) {
    return (
      <section data-testid="bounty-resolution" aria-labelledby={titleId} className="rounded-xl border border-pk-border p-5">
        <h2 id={titleId} className="text-heading-xl text-pk-content-primary">
          Resolution
        </h2>
        <p className="mt-2 text-body-base text-pk-content-secondary">The sponsor has not published how the winner is verified yet.</p>
      </section>
    );
  }

  const criteria = (resolution.criteria ?? []).filter((c) => typeof c === 'string' && c.trim());
  const rows: [string, string | undefined][] = [
    ['Evidence source', resolution.source],
    ['Verifier', resolution.verifier],
    ['Tie-break', resolution.tieBreak],
    ['Announcement and payout', resolution.announce],
  ];
  const label = METHOD_LABEL[resolution.method] ?? 'Custom';
  const metric = resolution.metric && typeof resolution.metric.name === 'string' && resolution.metric.name.trim() ? resolution.metric : undefined;

  return (
    <section
      data-testid="bounty-resolution"
      aria-labelledby={titleId}
      className="flex flex-col gap-5 rounded-xl border border-pk-border bg-pk-elevated p-5 shadow-pk-minimal-soft"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={titleId} className="text-heading-xl text-pk-content-primary">
            Resolution
          </h2>
          <p
            data-testid="resolution-method"
            className="inline-flex items-center gap-1.5 rounded-full bg-pk-blue-100 px-2.5 py-1 text-body-sm font-semibold text-pk-brand-500"
          >
            {METHOD_GLYPH[resolution.method]}
            <span className="sr-only">Method: </span>
            {label}
          </p>
        </div>
        {metric && (
          <p
            data-testid="resolution-metric"
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border border-pk-blue-200 bg-pk-blue-100 px-3 py-2.5 text-body-base text-pk-content-primary"
          >
            <span className="font-semibold text-pk-brand-500">Ranked by:</span>
            <span className="font-semibold">
              {metric.name}
              {metric.unit ? ` (${metric.unit})` : ''}, {metric.better === 'lower' ? 'lower' : 'higher'} is better
            </span>
          </p>
        )}
        <p className="text-body-base text-pretty text-pk-content-primary">{resolution.summary}</p>
      </div>

      {criteria.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-body-base font-semibold text-pk-content-primary">How a winner is verified</h3>
          <ol data-testid="resolution-criteria" className="flex flex-col gap-2.5">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-body-base text-pk-content-secondary">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pk-gray-100 text-body-xs font-semibold text-pk-content-primary tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5 text-pretty">{c}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <dl className="flex flex-col border-t border-pk-border">
        {rows
          .filter(([, v]) => typeof v === 'string' && v.trim())
          .map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 border-b border-pk-border py-3 last:border-b-0 last:pb-0 sm:flex-row sm:gap-6">
              <dt className={`${ROW_LABEL} sm:w-48 sm:shrink-0`}>{k}</dt>
              <dd className="min-w-0 text-body-base text-pretty text-pk-content-primary">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

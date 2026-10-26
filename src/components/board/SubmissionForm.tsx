import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react';
import { formatEndedOn, type BoardBounty, type Submission } from '../../lib/bounty';
import {
  buildSubmission,
  emptyValues,
  ENTRANT_TYPES,
  fieldOrder,
  involvesAgent,
  LOG_EXTENSIONS,
  submissionSpec,
  SUMMARY_MAX,
  SUMMARY_MIN,
  validateSubmission,
  type ArtifactField,
  type EntrantType,
  type SubmissionValues,
} from '../../lib/submissionSpec';

/**
 * "Submit an entry": one form for every bounty. Entrant (who, and which agent and model did the work), Artifact (the
 * fields `submissionSpec` picks for the bounty's resolution method: a pinned commit, a wallet and its transactions, a
 * registered run, deliverable links or a proof link), Result (an optional self-reported score in the metric's unit,
 * run logs, the approach) and Rules (attest to the criteria and to sharing the artifacts). Validates on blur and on
 * submit, focuses the first invalid field, and on success swaps itself for a receipt and reports the entry upward so
 * the live feed can show it. Nothing leaves the browser.
 */

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-pk-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-surface';
const INPUT =
  'w-full rounded-md border border-pk-border bg-pk-elevated px-3 text-body-base text-pk-content-primary placeholder:text-pk-content-tertiary transition-colors outline-none hover:border-pk-gray-300 focus-visible:border-pk-brand-500 focus-visible:ring-2 focus-visible:ring-pk-blue-200 aria-[invalid=true]:border-pk-red-500 aria-[invalid=true]:focus-visible:ring-pk-red-100 disabled:cursor-not-allowed disabled:bg-pk-gray-100 disabled:text-pk-content-tertiary motion-reduce:transition-none';
const LABEL = 'text-body-sm font-semibold text-pk-content-primary';
const HELP = 'text-body-xs text-pk-content-secondary text-pretty';
const SECTION = 'flex min-w-0 flex-col gap-4 border-t border-pk-border px-5 py-5';
const PRIMARY_BUTTON = `inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-pk-brand-500 px-5 text-body-base font-semibold text-pk-elevated transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-pk-gray-200 disabled:text-pk-content-tertiary disabled:hover:opacity-100 motion-reduce:transition-none ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-pk-border bg-pk-elevated px-4 text-body-base font-semibold text-pk-content-primary transition-colors hover:bg-pk-hover-overlay-darker motion-reduce:transition-none ${FOCUS_RING}`;

function Glyph({ children, className = 'size-4 shrink-0' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}
const AlertGlyph = () => (
  <Glyph className="mt-px size-3.5 shrink-0">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Glyph>
);
const UploadGlyph = () => (
  <Glyph>
    <path d="M12 15V4M7 8l5-5 5 5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Glyph>
);
const CheckGlyph = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <path d="M20 6 9 17l-5-5" />
  </Glyph>
);

/** True once the deadline passes, without re-rendering every second. */
function useEnded(deadlineIso: string): boolean {
  const deadline = Date.parse(deadlineIso);
  const [ended, setEnded] = useState(() => !Number.isNaN(deadline) && Date.now() >= deadline);
  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const left = deadline - Date.now();
      if (left <= 0) return setEnded(true);
      setEnded(false);
      timer = setTimeout(arm, Math.min(left, 2 ** 31 - 1));
    };
    arm();
    return () => clearTimeout(timer);
  }, [deadline]);
  return ended;
}

interface FieldShellProps {
  id: string;
  label: string;
  optional?: boolean;
  help?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
  /** Right of the label, e.g. a character counter. */
  aside?: ReactNode;
}

/** Label, control, help and error, wired by id: help is `${id}-help`, the error `${id}-error`. */
function FieldShell({ id, label, optional, help, error, className = '', children, aside }: FieldShellProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
          {optional && <span className="font-normal text-pk-content-secondary"> (optional)</span>}
        </label>
        {aside}
      </div>
      {children}
      {help && (
        <p id={`${id}-help`} className={HELP}>
          {help}
        </p>
      )}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1 text-body-xs text-pk-red-500" data-testid="field-error">
      <AlertGlyph />
      <span>{children}</span>
    </p>
  );
}

const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/** One form section: a role="group" labelled by its numbered heading (a div, so the heading lays out like any child). */
function Section({ id, n, title, intro, children, ...rest }: { id: string; n: number; title: string; intro?: ReactNode; children: ReactNode; [data: `data-${string}`]: string }) {
  return (
    <div role="group" aria-labelledby={`${id}-h`} aria-describedby={intro ? `${id}-intro` : undefined} className={SECTION} {...rest}>
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-h`} className="flex items-center gap-2 text-body-base font-semibold text-pk-content-primary">
          <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-pk-gray-100 text-body-xs font-semibold text-pk-content-secondary tabular-nums">
            {n}
          </span>
          {title}
        </h3>
        {intro && (
          <p id={`${id}-intro`} className="text-body-sm text-pk-content-secondary text-pretty">
            {intro}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export interface SubmissionFormProps {
  bounty: BoardBounty;
  onSubmitted?: (submission: Submission) => void;
  /** Keeps `#submit` clear of the sticky site header. */
  scrollMargin?: number;
}

export function SubmissionForm({ bounty, onSubmitted, scrollMargin }: SubmissionFormProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const spec = useMemo(() => submissionSpec(bounty), [bounty]);
  const ended = useEnded(bounty.deadline);
  const [values, setValues] = useState<SubmissionValues>(() => emptyValues(spec));
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<Submission | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLHeadingElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const focusAfter = useRef<'receipt' | 'form' | null>(null);

  // A different bounty (or its spec hot-reloading) starts clean.
  useEffect(() => {
    setValues((v) => ({ ...emptyValues(spec, v.handle), entrant: v.entrant, agentName: v.agentName, agentModel: v.agentModel }));
    setShown(new Set());
    setSubmitted(false);
    setReceipt(null);
  }, [spec]);

  useEffect(() => {
    if (focusAfter.current === 'receipt') receiptRef.current?.focus();
    if (focusAfter.current === 'form') firstFieldRef.current?.focus();
    focusAfter.current = null;
  }, [receipt]);

  const errors = useMemo(() => validateSubmission(spec, values), [spec, values]);
  const dom = (id: string) => `${uid}-${id}`;
  const err = (id: string) => (submitted || shown.has(id) ? errors[id] : undefined);
  const touch = (id: string) => setShown((s) => (s.has(id) ? s : new Set(s).add(id)));
  const set = <K extends keyof SubmissionValues>(k: K, v: SubmissionValues[K]) => setValues((p) => ({ ...p, [k]: v }));
  const setArtifact = (id: string, v: string) => setValues((p) => ({ ...p, artifact: { ...p.artifact, [id]: v } }));
  const agent = involvesAgent(values.entrant);
  const order = fieldOrder(spec, values.entrant);
  const errorCount = submitted ? order.filter((id) => errors[id]).length : 0;

  /** aria-invalid / aria-describedby for one control. */
  const a11y = (id: string, opts: { help?: boolean; extra?: string } = {}) => {
    const e = err(id);
    return {
      id: dom(id),
      'aria-invalid': e ? (true as const) : undefined,
      'aria-describedby': describedBy(opts.help && `${dom(id)}-help`, opts.extra, e && `${dom(id)}-error`),
      onBlur: () => touch(id),
    };
  };

  const onSubmit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (ended) return;
    setSubmitted(true);
    const first = order.find((id) => errors[id]);
    if (first) {
      document.getElementById(dom(first))?.focus();
      return;
    }
    const s = buildSubmission(spec, bounty.slug, values);
    focusAfter.current = 'receipt';
    setReceipt(s);
    onSubmitted?.(s);
  };

  const submitAnother = () => {
    setValues((v) => ({ ...emptyValues(spec, v.handle), entrant: v.entrant, agentName: v.agentName, agentModel: v.agentModel }));
    if (fileRef.current) fileRef.current.value = '';
    setShown(new Set());
    setSubmitted(false);
    focusAfter.current = 'form';
    setReceipt(null);
  };

  const onFiles = (ev: ChangeEvent<HTMLInputElement>) => {
    set('logs', Array.from(ev.target.files ?? [], (f) => f.name));
    touch('logs');
  };
  const clearFiles = () => {
    if (fileRef.current) fileRef.current.value = '';
    set('logs', []);
  };

  const summaryLen = values.summary.trim().length;
  const metric = spec.metric;

  return (
    <section
      id="submit"
      data-testid="submission-form"
      aria-labelledby={titleId}
      style={scrollMargin ? { scrollMarginTop: scrollMargin } : undefined}
      className="flex flex-col rounded-xl border border-pk-border bg-pk-elevated shadow-pk-minimal-soft"
    >
      <header className="flex flex-col gap-1 px-5 pt-5 pb-4">
        <h2 id={titleId} className="text-heading-xl text-pk-content-primary">
          Submit an entry
        </h2>
        {!receipt && (
          <p className="text-body-base text-pk-content-secondary text-pretty">
            {ended ? (
              <span data-testid="submission-closed">Submissions closed on {formatEndedOn(bounty.deadline)}.</span>
            ) : (
              'Your entry joins Live submissions as pending until the verifier scores it.'
            )}
          </p>
        )}
      </header>

      {receipt ? (
        <Receipt receipt={receipt} bounty={bounty} headingRef={receiptRef} onAnother={submitAnother} />
      ) : (
        <form noValidate onSubmit={onSubmit} aria-labelledby={titleId} data-testid="submission-form-fields">
          <fieldset disabled={ended} className="min-w-0 disabled:opacity-60">
            {/* 1. Entrant */}
            <Section id={dom('s1')} n={1} title="Entrant">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell id={dom('handle')} label="Your handle" error={err('handle')}>
                  <div className="relative">
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body-base text-pk-content-tertiary">
                      @
                    </span>
                    <input
                      ref={firstFieldRef}
                      {...a11y('handle')}
                      name="handle"
                      autoComplete="username"
                      spellCheck={false}
                      value={values.handle}
                      onChange={(e) => set('handle', e.target.value)}
                      className={`${INPUT} h-10 pl-7`}
                    />
                  </div>
                </FieldShell>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span id={dom('entrant-label')} className={LABEL}>
                    Entrant type
                  </span>
                  <div role="radiogroup" aria-labelledby={dom('entrant-label')} className="flex h-10 gap-0.5 rounded-md bg-pk-gray-100 p-0.5" data-testid="entrant-type">
                    {ENTRANT_TYPES.map((t) => (
                      <label
                        key={t}
                        className="flex min-w-0 flex-auto cursor-pointer items-center justify-center rounded-sm px-2.5 text-center text-body-sm text-pk-content-secondary transition-colors hover:text-pk-content-primary has-checked:bg-pk-elevated has-checked:font-semibold has-checked:text-pk-content-primary has-checked:shadow-pk-minimal-soft has-focus-visible:ring-2 has-focus-visible:ring-pk-brand-500 motion-reduce:transition-none"
                      >
                        <input
                          type="radio"
                          name={dom('entrant')}
                          value={t}
                          checked={values.entrant === t}
                          onChange={() => set('entrant', t as EntrantType)}
                          className="sr-only"
                        />
                        <span className="truncate">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {agent && (
                <div className="grid gap-4 sm:grid-cols-2" data-testid="agent-fields">
                  <FieldShell id={dom('agentName')} label="Agent name" error={err('agentName')}>
                    <input
                      {...a11y('agentName')}
                      name="agentName"
                      autoComplete="off"
                      placeholder="e.g. kite.agent"
                      value={values.agentName}
                      onChange={(e) => set('agentName', e.target.value)}
                      className={`${INPUT} h-10`}
                    />
                  </FieldShell>
                  <FieldShell id={dom('agentModel')} label="Model or framework" error={err('agentModel')} help="The model(s) and scaffold that ran it.">
                    <input
                      {...a11y('agentModel', { help: true })}
                      name="agentModel"
                      autoComplete="off"
                      placeholder="e.g. Claude, custom scaffold"
                      value={values.agentModel}
                      onChange={(e) => set('agentModel', e.target.value)}
                      className={`${INPUT} h-10`}
                    />
                  </FieldShell>
                </div>
              )}
            </Section>

            {/* 2. Artifact: chosen by the resolution method */}
            <Section id={dom('s2')} n={2} title={`Artifact: ${spec.title.toLowerCase()}`} intro={spec.intro} data-testid="artifact-fields" data-method={spec.method}>
              <div className="grid gap-4 sm:grid-cols-2">
                {spec.fields.map((f) => (
                  <ArtifactInput key={f.id} field={f} domId={dom(f.id)} value={values.artifact[f.id] ?? ''} error={err(f.id)} onChange={(v) => setArtifact(f.id, v)} a11y={a11y(f.id, { help: true })} />
                ))}
              </div>
            </Section>

            {/* 3. Result */}
            <Section id={dom('s3')} n={3} title="Result">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell
                  id={dom('score')}
                  label={metric ? metric.name : 'Score'}
                  optional
                  error={err('score')}
                  help={`Self-reported${metric ? `, ${metric.better} is better` : ''}. The verified score replaces this.`}
                >
                  <div className="relative">
                    <input
                      {...a11y('score', { help: true })}
                      name="score"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="e.g. 2.41"
                      value={values.score}
                      onChange={(e) => set('score', e.target.value)}
                      className={`${INPUT} h-10 tabular-nums ${metric?.unit ? 'pr-20' : ''}`}
                    />
                    {metric?.unit && (
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex max-w-16 items-center truncate text-body-sm text-pk-content-secondary">
                        {metric.unit}
                      </span>
                    )}
                  </div>
                </FieldShell>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor={dom('logs')} className={LABEL}>
                    Run logs or traces<span className="font-normal text-pk-content-secondary"> (optional)</span>
                  </label>
                  <div
                    className={`relative flex h-10 items-center gap-2 rounded-md border border-dashed px-3 text-body-sm transition-colors has-focus-visible:border-pk-brand-500 has-focus-visible:ring-2 has-focus-visible:ring-pk-blue-200 motion-reduce:transition-none ${
                      err('logs') ? 'border-pk-red-500' : 'border-pk-gray-300 hover:border-pk-gray-500 hover:bg-pk-gray-100'
                    }`}
                  >
                    <UploadGlyph />
                    <span className="min-w-0 truncate text-pk-content-secondary">
                      <span className="font-semibold text-pk-content-primary">Choose files</span> or drop them here
                    </span>
                    <input
                      ref={fileRef}
                      {...a11y('logs', { help: true })}
                      type="file"
                      multiple
                      name="logs"
                      accept={LOG_EXTENSIONS.join(',')}
                      onChange={onFiles}
                      data-testid="logs-input"
                      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                  </div>
                  <p id={`${dom('logs')}-help`} className={HELP}>
                    {LOG_EXTENSIONS.join(', ')}. Stays in your browser; the verifier asks for them if needed.
                  </p>
                  {values.logs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5" data-testid="logs-chosen">
                      <ul className="contents">
                        {values.logs.map((n, i) => (
                          <li key={`${n}-${i}`} className="inline-flex max-w-full items-center rounded-full bg-pk-gray-100 px-2.5 py-1 text-body-xs text-pk-content-primary">
                            <span className="truncate">{n}</span>
                          </li>
                        ))}
                      </ul>
                      <button type="button" onClick={clearFiles} className={`rounded-md px-1.5 py-0.5 text-body-xs font-semibold text-pk-content-secondary hover:text-pk-content-primary ${FOCUS_RING}`}>
                        Clear
                      </button>
                    </div>
                  )}
                  {err('logs') && <ErrorText id={`${dom('logs')}-error`}>{err('logs')}</ErrorText>}
                </div>
              </div>
              <FieldShell
                id={dom('summary')}
                label="Approach"
                error={err('summary')}
                help="How it works and anything the verifier should know. The first line becomes your entry's title."
                aside={
                  <span
                    id={`${dom('summary')}-count`}
                    data-testid="summary-count"
                    className={`text-body-xs tabular-nums ${summaryLen > SUMMARY_MAX ? 'text-pk-red-500' : 'text-pk-content-secondary'}`}
                  >
                    {summaryLen.toLocaleString('en-US')} / {SUMMARY_MAX.toLocaleString('en-US')}
                    {summaryLen < SUMMARY_MIN && <span className="sr-only">, at least {SUMMARY_MIN}</span>}
                  </span>
                }
              >
                <textarea
                  {...a11y('summary', { help: true, extra: `${dom('summary')}-count` })}
                  name="summary"
                  rows={4}
                  placeholder="e.g. Mean-reversion on the 1h basis with volatility-scaled sizing. Kill switch at 20% drawdown."
                  value={values.summary}
                  onChange={(e) => set('summary', e.target.value)}
                  className={`${INPUT} min-h-24 resize-y py-2.5`}
                />
              </FieldShell>
            </Section>

            {/* 4. Rules */}
            <Section id={dom('s4')} n={4} title="Rules">
              <div className="flex flex-col gap-1.5">
                <Check id={dom('followsRules')} checked={values.followsRules} onChange={(c) => set('followsRules', c)} a11y={a11y('followsRules', { extra: `${dom('followsRules')}-rules` })}>
                  My run follows every rule below
                </Check>
                {spec.criteria.length > 0 && (
                  <ol id={`${dom('followsRules')}-rules`} className="ml-7 flex list-decimal flex-col gap-1 pl-4 text-body-sm text-pk-content-secondary marker:text-pk-content-tertiary" data-testid="submission-rules">
                    {spec.criteria.map((c, i) => (
                      <li key={i} className="pl-1 text-pretty">
                        {c}
                      </li>
                    ))}
                  </ol>
                )}
                {err('followsRules') && <ErrorText id={`${dom('followsRules')}-error`}>{err('followsRules')}</ErrorText>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Check id={dom('canShare')} checked={values.canShare} onChange={(c) => set('canShare', c)} a11y={a11y('canShare')}>
                  I can share these artifacts with the verifier
                </Check>
                {err('canShare') && <ErrorText id={`${dom('canShare')}-error`}>{err('canShare')}</ErrorText>}
              </div>
            </Section>

            <div className="flex flex-col-reverse gap-3 border-t border-pk-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body-sm text-pk-content-secondary text-pretty" role="status" data-testid="submission-status">
                {ended ? (
                  'This bounty is no longer taking entries.'
                ) : errorCount > 0 ? (
                  <span className="font-semibold text-pk-red-500">{errorCount === 1 ? '1 field needs attention.' : `${errorCount} fields need attention.`}</span>
                ) : metric ? (
                  `Ranked by ${metric.name}, ${metric.better} is better.`
                ) : (
                  'Checked against the rules above.'
                )}
              </p>
              <button type="submit" className={`${PRIMARY_BUTTON} shrink-0`} data-testid="submission-submit">
                Submit entry
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}

function ArtifactInput({
  field: f,
  domId,
  value,
  error,
  onChange,
  a11y,
}: {
  field: ArtifactField;
  domId: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  a11y: Record<string, unknown>;
}) {
  const wide = !(f.id === 'commitSha' || f.id === 'entrypoint' || f.id === 'runId' || f.id === 'trackingUrl');
  const mono = f.mono ? 'text-body-sm font-mono!' : '';
  return (
    <FieldShell id={domId} label={f.label} optional={!f.required} help={f.help} error={error} className={wide ? 'sm:col-span-2' : ''}>
      {f.kind === 'lines' ? (
        <textarea
          {...a11y}
          name={f.id}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder={f.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} min-h-20 resize-y py-2.5 ${mono}`}
        />
      ) : (
        <input
          {...a11y}
          name={f.id}
          type={f.kind === 'url' ? 'url' : 'text'}
          inputMode={f.kind === 'url' ? 'url' : undefined}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          placeholder={f.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} h-10 ${mono}`}
        />
      )}
    </FieldShell>
  );
}

function Check({ id, checked, onChange, a11y, children }: { id: string; checked: boolean; onChange: (c: boolean) => void; a11y: Record<string, unknown>; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex w-fit cursor-pointer items-start gap-3 text-body-base font-semibold text-pk-content-primary">
      <input
        {...a11y}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-pk-brand-500 aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-offset-1 aria-[invalid=true]:outline-pk-red-500 ${FOCUS_RING}`}
      />
      <span>{children}</span>
    </label>
  );
}

function Receipt({
  receipt,
  bounty,
  headingRef,
  onAnother,
}: {
  receipt: Submission;
  bounty: BoardBounty;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnother: () => void;
}) {
  const r = bounty.resolution;
  const next = [r.verifier && `${r.verifier.replace(/\.$/, '')}.`, r.announce && `${r.announce.replace(/\.$/, '')}.`, 'Your entry shows in Live submissions as pending until then.'].filter(Boolean) as string[];
  const time = new Date(receipt.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="flex flex-col gap-5 border-t border-pk-border px-5 py-5" data-testid="submission-receipt">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pk-green-500 text-pk-elevated">
          <CheckGlyph className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 ref={headingRef} tabIndex={-1} className={`rounded-sm text-body-base font-semibold text-pk-content-primary ${FOCUS_RING}`}>
            Entry received
          </h3>
          <p className="text-body-sm text-pk-content-secondary text-pretty">
            Submitted as @{receipt.hunter} at {time}. Keep the ID to reference this entry in the discussion.
          </p>
        </div>
      </div>

      <dl className="flex flex-col rounded-md border border-pk-border">
        <div className="flex items-center justify-between gap-4 border-b border-pk-border px-4 py-3">
          <dt className="text-body-sm font-semibold text-pk-content-secondary">Submission ID</dt>
          <dd className="font-mono text-body-base font-semibold text-pk-content-primary" data-testid="submission-id">
            {receipt.id}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-pk-border px-4 py-3">
          <dt className="text-body-sm font-semibold text-pk-content-secondary">Status</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pk-blue-100 px-2.5 py-1 text-body-sm font-semibold text-pk-brand-500" data-testid="submission-status-pill">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-pk-brand-500" />
              Queued for verification
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="shrink-0 text-body-sm font-semibold text-pk-content-secondary">Artifact</dt>
          <dd className="min-w-0 truncate font-mono text-body-sm text-pk-content-primary">{receipt.link}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <h4 className="text-body-sm font-semibold text-pk-content-primary">What happens next</h4>
        <ol className="flex flex-col gap-2">
          {next.map((t, i) => (
            <li key={i} className="flex items-start gap-3 text-body-base text-pk-content-secondary">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-pk-gray-100 text-body-xs font-semibold text-pk-content-primary tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 text-pretty">{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <button type="button" onClick={onAnother} className={SECONDARY_BUTTON} data-testid="submission-another">
          Submit another
        </button>
      </div>
    </div>
  );
}

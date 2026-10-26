import type { BoardBounty, BountyCategory, ResolutionMethod, Submission } from './bounty';

/**
 * The bounty submission form, as data. One form fits every listing: the Entrant, Result and Rules sections are common,
 * and the Artifact section is chosen by how the bounty resolves (`resolution.method`), after the prior art:
 * - Superteam Earn entries: a link to the work plus answers to the sponsor's questions;
 * - Kaggle / SWE-bench leaderboard entries: the artifact pinned to a commit, a model and scaffold disclosure, run logs;
 * - Code4rena findings: proof the verifier can replay.
 * Pure: no React, no DOM, so node:test covers every listing.
 */

/** One method-specific artifact field. */
export interface ArtifactField {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  /** Rendered under the field; cites where the verifier reads the evidence. */
  help: string;
  /** `lines`: a textarea, one value per line. */
  kind: 'url' | 'text' | 'lines';
  /** Hashes, addresses, commands: monospace and no spellcheck. */
  mono?: boolean;
  /** A shape check on the trimmed value (each line for `lines`); `message` explains a miss. */
  pattern?: RegExp;
  message?: string;
  /** A further check on the trimmed value; returns the error or undefined. */
  validate?: (value: string) => string | undefined;
}

export interface SubmissionSpec {
  method: ResolutionMethod;
  /** Section heading, e.g. "Repository and run command". */
  title: string;
  /** One line under the heading: what the verifier does with these fields. */
  intro: string;
  fields: ArtifactField[];
  /** The field whose value becomes the live feed's link. */
  primary: string;
  /** The metric a self-reported score is in, when the bounty has one. */
  metric?: { name: string; unit: string; better: 'higher' | 'lower' };
  /** The rules the entrant attests to (resolution.criteria). */
  criteria: string[];
  /** Where the verifying evidence comes from (resolution.source). */
  source: string;
}

export const ENTRANT_TYPES = ['Autonomous agent', 'Human with agent', 'Human'] as const;
export type EntrantType = (typeof ENTRANT_TYPES)[number];
export const involvesAgent = (t: EntrantType): boolean => t !== 'Human';

/** Accepted run-log uploads (checked by extension; nothing is uploaded anywhere). */
export const LOG_EXTENSIONS = ['.json', '.jsonl', '.log', '.csv', '.zip'] as const;
export const SUMMARY_MIN = 40;
export const SUMMARY_MAX = 1000;

/** Everything the form holds. Artifact values are keyed by `ArtifactField.id`. */
export interface SubmissionValues {
  handle: string;
  entrant: EntrantType;
  agentName: string;
  agentModel: string;
  artifact: Record<string, string>;
  score: string;
  /** Chosen log file names. */
  logs: string[];
  summary: string;
  followsRules: boolean;
  canShare: boolean;
}

/** Field id -> error message. Common ids are the `SubmissionValues` keys; artifact ids are the spec's. */
export type SubmissionErrors = Partial<Record<string, string>>;

export const emptyValues = (spec: SubmissionSpec, handle = 'you'): SubmissionValues => ({
  handle,
  entrant: 'Autonomous agent',
  agentName: '',
  agentModel: '',
  artifact: Object.fromEntries(spec.fields.map((f) => [f.id, ''])),
  score: '',
  logs: [],
  summary: '',
  followsRules: false,
  canShare: false,
});

// ---------- shapes ----------
export const GIT_REPO = /^https:\/\/(?:www\.)?(?:github\.com|gitlab\.com)\/[\w.-]+(?:\/[\w.-]+)+?(?:\.git)?\/?$/i;
export const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;
/** Solana base58 (no 0, O, I, l). */
const B58 = '[1-9A-HJ-NP-Za-km-z]';
export const SOLANA_ADDRESS = new RegExp(`^${B58}{32,44}$`);
export const SOLANA_SIGNATURE = new RegExp(`^${B58}{64,88}$`);
/** registry/namespace/name[:tag][@sha256:digest], e.g. ghcr.io/acme/agent:v3 */
export const IMAGE_REF = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::\d+)?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)+(?::[\w][\w.-]{0,127})?(?:@sha256:[0-9a-f]{64})?$/;
export const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/;
export const HANDLE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;

export function isHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

const url = (v: string) => (isHttpsUrl(v) ? undefined : 'Enter a full https:// link.');

/** Non-empty trimmed lines. */
export const lines = (v: string): string[] =>
  v
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

// ---------- the artifact section, per method ----------
const RUN_ID_HINT: Record<BountyCategory, string> = {
  Trading: 'e.g. meridian-acct-7f3a2c',
  Forecasting: 'e.g. forecaster-0x41d9',
  Security: 'e.g. run-2026-11-04-a1',
  Automation: 'e.g. run-8c21f0e7',
  Growth: 'e.g. referral code ref-kite-07',
  Games: 'e.g. agent-kite-v3',
};

/** The method-specific artifact fields, intro and primary link for one bounty. */
export function submissionSpec(bounty: Pick<BoardBounty, 'category' | 'resolution'>): SubmissionSpec {
  const r = bounty.resolution;
  const source = r.source?.trim() || 'the sponsor';
  const base = { method: r.method, metric: r.metric, criteria: (r.criteria ?? []).filter((c) => c.trim()), source };

  switch (r.method) {
    case 'automated':
      return {
        ...base,
        title: 'Repository and run command',
        intro: `The verifier checks out this exact commit and runs it in the sponsor's harness. Scored from: ${source}.`,
        primary: 'repoUrl',
        fields: [
          {
            id: 'repoUrl',
            label: 'Git repository',
            placeholder: 'https://github.com/you/agent',
            required: true,
            kind: 'url',
            mono: true,
            help: 'Public, or shared with the verifier. GitHub or GitLab.',
            pattern: GIT_REPO,
            message: 'Use a https://github.com/... or https://gitlab.com/... repository link.',
          },
          {
            id: 'commitSha',
            label: 'Commit SHA',
            placeholder: 'e.g. 3f9c2a1',
            required: true,
            kind: 'text',
            mono: true,
            help: 'The commit to score. Pushing later does not change this entry.',
            pattern: COMMIT_SHA,
            message: 'A commit SHA is 7 to 40 hex characters (0-9, a-f).',
          },
          {
            id: 'entrypoint',
            label: 'Entrypoint or run command',
            placeholder: 'python -m agent.run --config harness.yaml',
            required: true,
            kind: 'text',
            mono: true,
            help: 'What the harness invokes, from the repository root.',
            validate: (v) => (v.length < 3 ? 'Enter the command the harness runs.' : v.length > 200 ? 'Keep the command under 200 characters.' : undefined),
          },
          {
            id: 'image',
            label: 'Container image',
            placeholder: 'ghcr.io/you/agent:v1',
            required: false,
            kind: 'text',
            mono: true,
            help: 'Optional. Pin a prebuilt image instead of building from the repository.',
            pattern: IMAGE_REF,
            message: 'Use an image reference like ghcr.io/you/agent:v1.',
          },
        ],
      };
    case 'onchain':
      return {
        ...base,
        title: 'Wallet and transactions',
        intro: `The verifier reads these straight from the chain. Scored from: ${source}.`,
        primary: 'wallet',
        fields: [
          {
            id: 'wallet',
            label: 'Entrant wallet address',
            placeholder: 'e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            required: true,
            kind: 'text',
            mono: true,
            help: 'The one wallet your entry runs from. Every transaction it signs in the window counts.',
            pattern: SOLANA_ADDRESS,
            message: 'A Solana address is 32 to 44 base58 characters.',
          },
          {
            id: 'signatures',
            label: 'Transaction signatures or program ID',
            placeholder: 'One per line',
            required: true,
            kind: 'lines',
            mono: true,
            help: 'A sample is enough: the verifier reads every transaction from the wallet above.',
            validate: (v) => {
              const bad = lines(v).findIndex((l) => !SOLANA_SIGNATURE.test(l) && !SOLANA_ADDRESS.test(l));
              return bad >= 0 ? `Line ${bad + 1} is not a signature (64 to 88 base58 characters) or program ID.` : undefined;
            },
          },
          {
            id: 'writeup',
            label: 'Write-up or code',
            placeholder: 'https://',
            required: false,
            kind: 'url',
            help: 'Optional. How it works, for the reviewers.',
            validate: url,
          },
        ],
      };
    case 'metric':
      return {
        ...base,
        title: 'Registered run',
        intro: `The sponsor's platform measures the live run; you point the verifier at it. Scored from: ${source}.`,
        primary: 'trackingUrl',
        fields: [
          {
            id: 'runId',
            label: 'Harness run or registered agent ID',
            placeholder: RUN_ID_HINT[bounty.category] ?? 'e.g. run-8c21f0e7',
            required: true,
            kind: 'text',
            mono: true,
            help: 'The ID the sponsor issued when you registered: account, run, forecaster or referral code.',
            pattern: RUN_ID,
            message: 'Use the ID as issued: 3 to 64 letters, digits, dots, dashes or colons.',
          },
          {
            id: 'trackingUrl',
            label: 'Tracking or dashboard link',
            placeholder: 'https://',
            required: true,
            kind: 'url',
            help: 'Where anyone can watch the run: the leaderboard row, dashboard or public log.',
            validate: url,
          },
        ],
      };
    case 'judges':
      return {
        ...base,
        title: 'Deliverables',
        intro: `Judges review what you link here. Evidence: ${source}.`,
        primary: 'deliverables',
        fields: [
          {
            id: 'deliverables',
            label: 'Deliverable links',
            placeholder: 'One link per line: repository, demo, write-up',
            required: true,
            kind: 'lines',
            help: 'Everything the judges should open, in the order they should open it.',
            validate: (v) => {
              const bad = lines(v).findIndex((l) => !isHttpsUrl(l));
              return bad >= 0 ? `Line ${bad + 1} is not a full https:// link.` : undefined;
            },
          },
        ],
      };
    case 'first-valid':
    default:
      return {
        ...base,
        title: 'Proof',
        intro: `The first entry whose proof checks out wins. Verified against: ${source}.`,
        primary: 'proofUrl',
        fields: [
          {
            id: 'proofUrl',
            label: 'Proof link',
            placeholder: 'https://',
            required: true,
            kind: 'url',
            help: 'A link the verifier can check without asking you: transaction, run, recording or report.',
            validate: url,
          },
        ],
      };
  }
}

/** Field ids in on-screen order; the first one with an error takes focus. */
export function fieldOrder(spec: SubmissionSpec, entrant: EntrantType): string[] {
  return [
    'handle',
    ...(involvesAgent(entrant) ? ['agentName', 'agentModel'] : []),
    ...spec.fields.map((f) => f.id),
    'score',
    'logs',
    'summary',
    'followsRules',
    'canShare',
  ];
}

/** Every field's problem, or none. Pure: the form calls it on blur (one field shown) and on submit (all shown). */
export function validateSubmission(spec: SubmissionSpec, v: SubmissionValues): SubmissionErrors {
  const e: SubmissionErrors = {};
  const handle = v.handle.trim().replace(/^@/, '');
  if (!handle) e.handle = 'Enter your handle.';
  else if (!HANDLE.test(handle)) e.handle = 'Handles are 2 to 32 letters, digits, dots, dashes or underscores.';

  if (involvesAgent(v.entrant)) {
    if (!v.agentName.trim()) e.agentName = 'Name the agent that did the work.';
    if (!v.agentModel.trim()) e.agentModel = 'Disclose the model or framework, e.g. "Claude, custom scaffold".';
  }

  for (const f of spec.fields) {
    const raw = (v.artifact[f.id] ?? '').trim();
    if (!raw) {
      if (f.required) e[f.id] = `${f.label} is required.`;
      continue;
    }
    const values = f.kind === 'lines' ? lines(raw) : [raw];
    if (f.pattern) {
      const miss = values.findIndex((x) => !f.pattern!.test(x));
      if (miss >= 0) {
        e[f.id] = f.kind === 'lines' && values.length > 1 ? `Line ${miss + 1}: ${f.message ?? 'not valid.'}` : (f.message ?? 'Not valid.');
        continue;
      }
    }
    const err = f.validate?.(raw);
    if (err) e[f.id] = err;
  }

  const score = v.score.trim();
  if (score && !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(score.replace(/,/g, ''))) e.score = 'Enter a number, or leave it blank.';

  const badLog = v.logs.find((n) => !LOG_EXTENSIONS.some((x) => n.toLowerCase().endsWith(x)));
  if (badLog) e.logs = `${badLog} is not a ${LOG_EXTENSIONS.join(', ')} file.`;

  const summary = v.summary.trim();
  if (!summary) e.summary = 'Describe your approach.';
  else if (summary.length < SUMMARY_MIN) e.summary = `At least ${SUMMARY_MIN} characters (${summary.length} so far).`;
  else if (summary.length > SUMMARY_MAX) e.summary = `At most ${SUMMARY_MAX.toLocaleString('en-US')} characters (${summary.length.toLocaleString('en-US')} now).`;

  if (!v.followsRules) e.followsRules = 'Confirm your run follows the rules.';
  if (!v.canShare) e.canShare = 'Confirm the verifier can see your artifacts.';
  return e;
}

/** FNV-1a, 32-bit. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "AF-" + 6 base36 characters, the same for the same bounty and values. */
export function submissionId(slug: string, v: SubmissionValues): string {
  const key = JSON.stringify([slug, v.handle.trim(), v.entrant, v.agentName.trim(), v.agentModel.trim(), v.artifact, v.score.trim(), v.summary.trim()]);
  return `AF-${fnv1a(key).toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
}

const bare = (u: string) => u.replace(/^https?:\/\//i, '').replace(/\/$/, '');

/** The live feed's link for an entry: the primary artifact, shown as text like the rest of the feed. */
export function primaryLink(spec: SubmissionSpec, v: SubmissionValues): string {
  const a = v.artifact;
  const val = (a[spec.primary] ?? '').trim();
  switch (spec.method) {
    case 'automated': {
      const repo = bare(val).replace(/\.git$/i, '');
      const sha = (a.commitSha ?? '').trim().toLowerCase().slice(0, 7);
      return sha ? `${repo}@${sha}` : repo;
    }
    case 'onchain':
      return `solscan.io/account/${val}`;
    case 'judges':
      return bare(lines(val)[0] ?? '');
    default:
      return bare(val);
  }
}

/** The entry as the live feed models it. */
export function buildSubmission(spec: SubmissionSpec, slug: string, v: SubmissionValues, now: Date = new Date()): Submission {
  const first = v.summary.trim().split(/\r?\n/)[0].trim();
  return {
    hunter: v.handle.trim().replace(/^@/, ''),
    createdAt: now.toISOString(),
    id: submissionId(slug, v),
    title: first.length > 120 ? `${first.slice(0, 119).trimEnd()}…` : first,
    link: primaryLink(spec, v),
    status: 'pending',
    agent: involvesAgent(v.entrant),
  };
}

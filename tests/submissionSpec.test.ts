import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// src/ uses bundler-style extensionless imports ("./paths"); let Node resolve them to the .ts file the way Vite does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});

const { BOARD_BOUNTIES } = await import('../src/lib/bountyData.ts');
const S = await import('../src/lib/submissionSpec.ts');
const { submissionSpec, validateSubmission, emptyValues, buildSubmission, submissionId, fieldOrder } = S;
type Values = ReturnType<typeof emptyValues>;
type Spec = ReturnType<typeof submissionSpec>;

const SHA = '3f9c2a1b7d';
const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SIG = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
const GOOD: Record<string, string> = {
  repoUrl: 'https://github.com/kite/agent',
  commitSha: SHA,
  entrypoint: 'python -m agent.run',
  image: '',
  wallet: WALLET,
  signatures: `${SIG}\n${SIG}`,
  writeup: '',
  runId: 'meridian-acct-7f3a2c',
  trackingUrl: 'https://agent.fun/runs/7f3a2c',
  deliverables: 'https://github.com/kite/agent\nhttps://kite.vercel.app',
  proofUrl: 'https://solscan.io/tx/abc',
};
const filled = (spec: Spec, over: Partial<Values> = {}): Values => ({
  ...emptyValues(spec),
  agentName: 'kite.agent',
  agentModel: 'Claude, custom scaffold',
  artifact: Object.fromEntries(spec.fields.map((f) => [f.id, GOOD[f.id] ?? ''])),
  summary: 'Mean-reversion on the 1h basis with volatility-scaled sizing and a hard drawdown stop.',
  followsRules: true,
  canShare: true,
  ...over,
});
const withArtifact = (spec: Spec, id: string, value: string): Values => {
  const v = filled(spec);
  return { ...v, artifact: { ...v.artifact, [id]: value } };
};
const fakeBounty = (method: Spec['method']) => ({ ...BOARD_BOUNTIES[0], resolution: { ...BOARD_BOUNTIES[0].resolution, method } });
const ALL = [...BOARD_BOUNTIES, ...(['judges', 'first-valid'] as const).map(fakeBounty)];

test('every bounty gets a spec with at least one required artifact field, a primary and its own source', () => {
  for (const b of ALL) {
    const spec = submissionSpec(b);
    assert.equal(spec.method, b.resolution.method, b.slug);
    assert.ok(spec.fields.some((f) => f.required), `${b.slug}: no required artifact field`);
    assert.ok(spec.fields.some((f) => f.id === spec.primary), `${b.slug}: primary ${spec.primary}`);
    assert.equal(new Set(spec.fields.map((f) => f.id)).size, spec.fields.length, `${b.slug}: unique ids`);
    assert.ok(spec.intro.includes(b.resolution.source), `${b.slug}: intro cites the source`);
    for (const f of spec.fields) assert.ok(f.label && f.placeholder && f.help, `${b.slug}.${f.id}`);
    assert.deepEqual(spec.metric, b.resolution.metric);
  }
});

test('the artifact fields differ by method', () => {
  const ids = (m: Spec['method']) => submissionSpec(fakeBounty(m)).fields.map((f) => f.id).join(',');
  assert.equal(ids('automated'), 'repoUrl,commitSha,entrypoint,image');
  assert.equal(ids('onchain'), 'wallet,signatures,writeup');
  assert.equal(ids('metric'), 'runId,trackingUrl');
  assert.equal(ids('judges'), 'deliverables');
  assert.equal(ids('first-valid'), 'proofUrl');
});

test('a complete entry passes on every bounty; an empty one fails every required field', () => {
  for (const b of ALL) {
    const spec = submissionSpec(b);
    assert.deepEqual(validateSubmission(spec, filled(spec)), {}, b.slug);
    const errs = validateSubmission(spec, { ...emptyValues(spec), handle: '' });
    for (const f of spec.fields) assert.equal(Boolean(errs[f.id]), f.required, `${b.slug}.${f.id}`);
    for (const k of ['handle', 'agentName', 'agentModel', 'summary', 'followsRules', 'canShare']) assert.ok(errs[k], `${b.slug}.${k}`);
    assert.equal(errs.score, undefined);
    // the first error in on-screen order is the handle
    assert.equal(fieldOrder(spec, 'Autonomous agent').find((id) => errs[id]), 'handle');
  }
});

test('bad commit SHAs and repository links are caught on every automated bounty', () => {
  const auto = BOARD_BOUNTIES.filter((b) => b.resolution.method === 'automated');
  assert.ok(auto.length > 0);
  for (const b of auto) {
    const spec = submissionSpec(b);
    for (const bad of ['abc12', 'xyz1234', '3f9c2a1-', 'g'.repeat(40), 'a'.repeat(41), '3f9c 2a1']) assert.ok(validateSubmission(spec, withArtifact(spec, 'commitSha', bad)).commitSha, `${b.slug} ${bad}`);
    for (const ok of ['3f9c2a1', 'A'.repeat(40), '0123456789abcdef0123456789abcdef01234567']) assert.equal(validateSubmission(spec, withArtifact(spec, 'commitSha', ok)).commitSha, undefined, ok);
    for (const bad of ['github.com/kite/agent', 'http://github.com/kite/agent', 'https://bitbucket.org/kite/agent', 'https://github.com/kite']) assert.ok(validateSubmission(spec, withArtifact(spec, 'repoUrl', bad)).repoUrl, bad);
    assert.equal(validateSubmission(spec, withArtifact(spec, 'repoUrl', 'https://gitlab.com/group/sub/agent.git')).repoUrl, undefined);
    assert.ok(validateSubmission(spec, withArtifact(spec, 'image', 'Not An Image')).image);
    assert.equal(validateSubmission(spec, withArtifact(spec, 'image', 'ghcr.io/kite/agent:v3')).image, undefined);
  }
});

test('bad wallet addresses and signatures are caught on every onchain bounty', () => {
  const chain = BOARD_BOUNTIES.filter((b) => b.resolution.method === 'onchain');
  assert.ok(chain.length > 0);
  for (const b of chain) {
    const spec = submissionSpec(b);
    // 0, O, I and l are not base58; 31 and 45 chars are out of range; an Ethereum address is not a Solana one
    for (const bad of ['0xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'OxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', WALLET.slice(0, 31), `${WALLET}2`, '0x52908400098527886E0F7030069857D2E4169EE7'])
      assert.ok(validateSubmission(spec, withArtifact(spec, 'wallet', bad)).wallet, `${b.slug} ${bad}`);
    assert.match(validateSubmission(spec, withArtifact(spec, 'signatures', `${SIG}\nnot-a-signature`)).signatures ?? '', /Line 2/);
    assert.ok(validateSubmission(spec, withArtifact(spec, 'signatures', SIG.slice(0, 50))).signatures);
    assert.equal(validateSubmission(spec, withArtifact(spec, 'signatures', `${SIG}\n\n${WALLET}\n`)).signatures, undefined);
  }
});

test('metric, judges and first-valid links and IDs', () => {
  const metric = submissionSpec(BOARD_BOUNTIES.find((b) => b.resolution.method === 'metric')!);
  assert.ok(validateSubmission(metric, withArtifact(metric, 'runId', 'a b')).runId);
  assert.ok(validateSubmission(metric, withArtifact(metric, 'trackingUrl', 'agent.fun/runs/1')).trackingUrl);
  const judges = submissionSpec(fakeBounty('judges'));
  assert.match(validateSubmission(judges, withArtifact(judges, 'deliverables', 'https://a.dev\nnope')).deliverables ?? '', /Line 2/);
  const fv = submissionSpec(fakeBounty('first-valid'));
  assert.ok(validateSubmission(fv, withArtifact(fv, 'proofUrl', 'ftp://x.y')).proofUrl);
});

test('common fields: agent disclosure, score, logs, summary length', () => {
  const spec = submissionSpec(BOARD_BOUNTIES[0]);
  const human = validateSubmission(spec, filled(spec, { entrant: 'Human', agentName: '', agentModel: '' }));
  assert.deepEqual(human, {});
  assert.ok(validateSubmission(spec, filled(spec, { entrant: 'Human with agent', agentModel: '' })).agentModel);
  assert.ok(validateSubmission(spec, filled(spec, { score: '1.2.3' })).score);
  for (const ok of ['2.41', '-0.5', '1,250', '.5']) assert.equal(validateSubmission(spec, filled(spec, { score: ok })).score, undefined, ok);
  assert.ok(validateSubmission(spec, filled(spec, { logs: ['run.jsonl', 'screen.png'] })).logs);
  assert.equal(validateSubmission(spec, filled(spec, { logs: ['run.jsonl', 'trace.ZIP'] })).logs, undefined);
  assert.ok(validateSubmission(spec, filled(spec, { summary: 'x'.repeat(39) })).summary);
  assert.ok(validateSubmission(spec, filled(spec, { summary: 'x'.repeat(1001) })).summary);
  assert.equal(validateSubmission(spec, filled(spec, { summary: 'x'.repeat(1000) })).summary, undefined);
  assert.ok(validateSubmission(spec, filled(spec, { handle: 'a b' })).handle);
  assert.equal(validateSubmission(spec, filled(spec, { handle: '@kite.agent' })).handle, undefined);
});

test('the submission: deterministic AF id, summary first line, primary link, pending', () => {
  const now = new Date(Date.UTC(2026, 9, 26, 12));
  for (const b of ALL) {
    const spec = submissionSpec(b);
    const v = filled(spec, { summary: `First line of the approach, long enough.\nSecond line with details that are not the title.` });
    const s = buildSubmission(spec, b.slug, v, now);
    assert.match(s.id ?? '', /^AF-[0-9A-Z]{6}$/);
    assert.equal(s.id, submissionId(b.slug, structuredClone(v)), 'same values, same id');
    assert.notEqual(s.id, submissionId(b.slug, { ...v, summary: `${v.summary}!` }), 'different values, different id');
    assert.deepEqual({ ...s, id: undefined, link: undefined }, { hunter: 'you', createdAt: now.toISOString(), id: undefined, title: 'First line of the approach, long enough.', link: undefined, status: 'pending', agent: true });
    assert.ok(s.link && !/^https?:/.test(s.link), `${b.slug}: ${s.link}`);
    assert.equal(buildSubmission(spec, b.slug, filled(spec, { entrant: 'Human' }), now).agent, false);
  }
  const auto = submissionSpec(fakeBounty('automated'));
  assert.equal(buildSubmission(auto, 'x', filled(auto), now).link, 'github.com/kite/agent@3f9c2a1');
});

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

const { formatBountyAmount, SAMPLE_OFFSETS_MS, sampleBounty } = await import('../src/lib/bounty.ts');
const { formatCountdown, isExpired, isUrgent, msToNextTick } = await import('../src/lib/countdown.ts');

const FORMAT: Array<[number, string]> = [
  [274_329_000, '3d 04h 12m 09s'], [259_200_000, '3d 00h 00m 00s'], [90_061_000, '1d 01h 01m 01s'],
  [86_400_000, '1d 00h 00m 00s'], [86_399_001, '1d 00h 00m 00s'], [86_399_000, '23h 59m 59s'], [86_398_001, '23h 59m 59s'], [86_398_000, '23h 59m 58s'],
  [43_200_000, '12h 00m 00s'], [36_000_000, '10h 00m 00s'], [35_999_000, '9h 59m 59s'], [3_600_000, '1h 00m 00s'], [3_599_001, '1h 00m 00s'], [3_599_000, '59m 59s'],
  [600_000, '10m 00s'], [599_000, '9m 59s'], [114_000, '1m 54s'], [60_000, '1m 00s'], [59_001, '1m 00s'], [59_000, '59s'],
  [10_000, '10s'], [9_000, '9s'], [8_001, '9s'], [1_000, '1s'], [1, '1s'], [0, '0s'], [-1, '0s'], [-86_400_000, '0s'],
];
test('formatCountdown', () => { for (const [ms, text] of FORMAT) assert.equal(formatCountdown(ms), text, `${ms} ms`); });

test('isExpired / isUrgent flip on the same boundary as the text', () => {
  assert.equal(isExpired(1), false); assert.equal(isExpired(0), true); assert.equal(isExpired(-1), true);
  assert.equal(isUrgent(86_400_000), false); assert.equal(isUrgent(86_399_001), false); // both print "1d 00h 00m 00s"
  assert.equal(isUrgent(86_399_000), true); assert.equal(isUrgent(1), true); assert.equal(isUrgent(0), false);
});

test('msToNextTick lands on the next whole-second boundary', () => {
  for (const [ms, delay] of [[3000, 1000], [2500, 500], [2001, 1], [2000, 1000], [1001, 1], [1000, 1000], [1, 1]] as const) assert.equal(msToNextTick(ms), delay, `${ms} ms`);
  // following the schedule from an arbitrary phase never skips or repeats a printed value
  let left = 5_432_100; const seen: string[] = [formatCountdown(left)];
  while (left > 0) { left -= msToNextTick(left); seen.push(formatCountdown(left)); }
  assert.deepEqual(seen.slice(0, 3), ['1h 30m 33s', '1h 30m 32s', '1h 30m 31s']);
  for (let i = 1; i < seen.length - 1; i++) assert.notEqual(seen[i], seen[i - 1]);
  assert.equal(seen.at(-1), '0s');
});

test('formatBountyAmount', () => {
  for (const [n, s] of [[2500, '$2,500'], [80080, '$80,080'], [1_500_000, '$1,500,000'], [0, '$0'], [2500.5, '$2,500.50'], [0.99, '$0.99']] as const) assert.equal(formatBountyAmount(n), s);
});

test('sampleBounty deadlines are relative to page load', () => {
  const t0 = Date.UTC(2026, 9, 25, 12, 0, 0);
  assert.equal(Date.parse(sampleBounty('', t0).deadline) - t0, SAMPLE_OFFSETS_MS.day);
  assert.equal(Date.parse(sampleBounty('?state=hour', t0).deadline) - t0, 15_129_000);
  assert.equal(Date.parse(sampleBounty('?state=minute', t0).deadline) - t0, 114_000);
  assert.equal(Date.parse(sampleBounty('?expired=1', t0).deadline) - t0, -60_000);
  assert.equal(Date.parse(sampleBounty('?state=bogus', t0).deadline) - t0, SAMPLE_OFFSETS_MS.day);
});

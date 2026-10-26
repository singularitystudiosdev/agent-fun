// Runs every agent.fun end-to-end suite in sequence against one base url.
// Usage: npm run e2e                     (local dev server, http://localhost:5180/)
//        npm run e2e -- <base url>       (e.g. https://singularitystudiosdev.github.io/agent-fun/)
// Each suite writes its screenshots under .tmp/e2e/<suite>/ (gitignored).
// Exits non-zero if any suite failed.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:5180/';
const SUITES = ['board', 'toolbar', 'profile'];

const runSuite = (name) =>
  new Promise((resolve) => {
    const file = fileURLToPath(new URL(`./${name}.mjs`, import.meta.url));
    const child = spawn(process.execPath, [file, BASE], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
    child.on('close', (code) => {
      const tally = out.match(/(\d+)\/(\d+) passed/g)?.at(-1) ?? 'no result (suite crashed)';
      resolve({ name, code, tally });
    });
  });

console.log(`agent.fun e2e against ${BASE}\n`);
const summary = [];
for (const name of SUITES) {
  console.log(`=== ${name} ===`);
  summary.push(await runSuite(name));
  console.log('');
}

console.log('=== summary ===');
for (const { name, code, tally } of summary) console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${tally}`);
process.exit(summary.some((s) => s.code !== 0) ? 1 : 0);

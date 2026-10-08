import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  'smoke.js',
  'path-resolution.js',
  'api/failure-recovery.js',
  'cli/commands.js',
  'cli/init-portability.js',
  'cli/show.js',
  'cli/output.js',
  'cli/overrides.js',
  'cli/errors.js',
  'cli/exit-contract.js',
  'api/failure-recovery.js',
  'api/pursuit-stack.js',
  'api/independent-pursuits.js',
  'api/result-output-isolation.js'
];
const timeoutMs = 30000;
for (const suite of suites) {
  const start = Date.now();
  console.log(`\n[TEST] START ${suite}`);
  const result = spawnSync(process.execPath, [path.join(testDir, suite)], {
    cwd: path.resolve(testDir, '..'),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    console.error(`[TEST] FAIL ${suite} (${Date.now() - start}ms)`);
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  console.log(`[TEST] PASS ${suite} (${Date.now() - start}ms)`);
}
console.log('\nAll test suites passed.');

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  'smoke.js',
  'path-resolution.js',
  'cli/commands.js',
  'cli/init-portability.js',
  'cli/show.js',
  'cli/output.js',
  'cli/recovery-summary.js',
  'cli/overrides.js',
  'cli/errors.js',
  'cli/exit-contract.js',
  'cli/trace-export.js',
  'api/failure-recovery.js',
  'api/world-root-portability.js',
  'api/run-grail-world.js',
  'api/pursuit-stack.js',
  'api/independent-pursuits.js',
  'api/node-context.js',
  'api/http-context.js',
  'api/stdio-context.js',
  'api/recovery-schema.js',
  'api/recovery-option.js',
  'api/recovery-stack.js',
  'api/recovery-trigger.js',
  'api/recovery-node.js',
  'api/recovery-http.js',
  'api/recovery-stdio.js',
  'api/recovery-observations.js',
  'api/recovery-progress.js',
  'api/recovery-timing.js',
  'api/result-output-isolation.js',
  'api/interactive-stdio.js',
  'api/capability-timing.js',
  'api/progress-reporting.js',
  'api/pursuit-duration.js',
  'api/stack-events.js',
  'api/selection-events.js',
  'api/pursuit-trace.js',
  'api/cyclic-dependency.js',
  'api/cyclic-alternative.js',
  'api/cyclic-initial-state.js',
  'api/cyclic-multiple-preconditions.js',
  'api/cyclic-nested-backtracking.js'
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

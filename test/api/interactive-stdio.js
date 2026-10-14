import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { executeStdioBinding } from '../../bindings/stdioBinding.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'stdio-probe.mjs');
const driver = path.join(here, 'fixtures', 'interactive-driver.mjs');
const baseDir = path.resolve(here, '../..');
const inputs = { ticketId: 'T-1042' };

// Existing stdin JSON contract.
const conventional = await executeStdioBinding({
  protocol: 'stdio', command: process.execPath, args: [fixture, 'conventional']
}, inputs, baseDir);
assert.equal(conventional.error, null);
assert.equal(conventional.exitCode, 0);
assert.deepEqual(conventional.stdout, { ticketId: 'T-1042', mode: 'conventional' });

// An unattended run must return promptly rather than wait for input.
const noTerminal = await executeStdioBinding({
  protocol: 'stdio', command: process.execPath, args: [fixture, 'interactive'], interactive: true
}, inputs, baseDir);
assert.match(noTerminal.error, /requires a terminal/);
assert.equal(noTerminal.exitCode, null);

// Exercise interactive transport using a controlled stdin stream. The driver
// simulates the parent's TTY detection; this is NOT a real pseudo-terminal.
for (const [amount, reason, exitCode] of [
  [25, 'HUMAN_REVIEW', 0],
  [0, 'NOT_APPLICABLE', 0],
  [25, 'HUMAN_REVIEW', 7]
]) {
  const run = spawnSync(process.execPath, [driver, fixture, String(exitCode)], {
    cwd: baseDir, encoding: 'utf8', input: `${amount}\n`, timeout: 10000
  });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout.refundAmount, amount);
  assert.equal(result.stdout.refundReason, reason);
  assert.match(result.stderr, /Refund amount/);
  assert.equal(result.stdout.ticketId, 'T-1042');
  assert.equal(result.stdout.inputFileGone, false); // File exists while capability runs.
  assert.ok(result.stdout.inputFilePath);
  // Driver independently checks file cleanup after binding completion.
  assert.equal(result.cleanedUp, true);
  if (exitCode === 0) assert.equal(result.error, null);
  else assert.ok(result.error);
}
console.log('Interactive STDIO regression tests passed.');

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/cyclic-scenario.js');
const run = spawnSync(process.execPath, [fixture, 'nested-backtracking'], {
  encoding: 'utf8', timeout: 1500, maxBuffer: 1024 * 1024
});
assert.equal(run.error, undefined, `Nested backtracking did not terminate: ${run.error?.message}`);
assert.equal(run.status, 0, run.stderr);
const result = JSON.parse(run.stdout);
assert.equal(result.reached, true, 'Goal A should be reached via the alternative producer');
assert.equal(result.unresolvable, false);
assert.equal(result.worldstate.conditionA, true);
assert.deepEqual(result.observations, [], 'Disabled bindings should not generate observations');
const events = result.stackEvents;
for (const action of ['establishD', 'establishC', 'establishB', 'establishA']) {
  assert.ok(events.some(e => e.type === 'stack.pop' && e.affordance === action && e.result === 'BLOCKED'),
    `Expected blocked backtracking through ${action}`);
}
const lastBlocked = events.findLastIndex(e => e.type === 'stack.pop' && e.affordance === 'establishA' && e.result === 'BLOCKED');
assert.ok(events.slice(lastBlocked + 1).some(e => e.type === 'stack.push' && e.affordance === 'seedA'),
  'Expected alternative seedA to be selected after unwinding');
console.log('Cyclic nested-backtracking regression passed.');

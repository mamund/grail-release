import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/cyclic-scenario.js');
const run = spawnSync(process.execPath, [fixture, 'missing-producer-alternative'], {
  encoding: 'utf8', timeout: 1500, maxBuffer: 1024 * 1024
});

assert.equal(run.error, undefined, `Pursuit did not terminate: ${run.error?.message}`);
assert.equal(run.status, 0, run.stderr);
const result = JSON.parse(run.stdout);
assert.equal(result.reached, true, 'Goal A should be reached via seedB');
assert.equal(result.unresolvable, false);
assert.equal(result.worldstate.conditionA, true);
assert.equal(result.worldstate.conditionB, true);
assert.equal(result.worldstate.conditionC, false, 'Unproducible C should remain false');
assert.deepEqual(result.observations, [], 'Disabled bindings should not generate observations');

const events = result.stackEvents;
assert.ok(events.some(e => e.type === 'stack.push' && e.affordance === 'establishB'),
  'Expected initial attempt through establishB');
assert.ok(events.some(e => e.type === 'stack.pop' && e.affordance === 'establishB' && e.result === 'BLOCKED'),
  'Expected backtracking from establishB');
assert.ok(events.some(e => e.type === 'stack.push' && e.affordance === 'seedB'),
  'Expected alternative producer seedB');
console.log('Missing-producer alternative regression passed.');

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/cyclic-scenario.js');
const run = spawnSync(process.execPath, [fixture, 'unavoidable'], {
  encoding: 'utf8', timeout: 1500, maxBuffer: 1024 * 1024
});
assert.equal(run.error, undefined, `Cyclic pursuit did not terminate within 1.5s: ${run.error?.message}`);
assert.equal(run.status, 0, run.stderr);
const result = JSON.parse(run.stdout);
assert.equal(result.reached, false);
assert.equal(result.unresolvable, true);
assert.equal(result.worldstate.conditionA, false);
assert.equal(result.worldstate.conditionB, false);
assert.deepEqual(result.observations, []);
console.log('Unavoidable cyclic dependency regression passed.');

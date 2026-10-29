import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/cyclic-scenario.js');
const run = spawnSync(process.execPath, [fixture, 'initial-state'], {
  encoding: 'utf8', timeout: 1500, maxBuffer: 1024 * 1024
});
assert.equal(run.error, undefined, run.error?.message);
assert.equal(run.status, 0, run.stderr);
const result = JSON.parse(run.stdout);
assert.equal(result.reached, true);
assert.equal(result.worldstate.conditionA, true);
assert.equal(result.worldstate.conditionB, true);
assert.deepEqual(result.observations, []);
console.log('Cyclic initial-state regression passed.');

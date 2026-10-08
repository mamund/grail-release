import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grail } from '../../grail.js';

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = {
  greet: {
    action: 'greet', preconditions: [], effects: ['greetingCreated'],
    inputs: { name: '$inputs.name' },
    binding: {
      protocol: 'stdio', command: 'python3', args: ['./capabilities/greet.py'],
      outputs: { message: { from: 'stdout', path: 'message' } }
    }
  },
  fail: {
    action: 'fail', preconditions: [], effects: ['failedGoal'], inputs: {},
    binding: { protocol: 'node', module: './capabilities/nonexistent-d3a.js', function: 'run' }
  }
};
const grail = new Grail({ registry, worldstate: {}, inputs: { name: 'World' }, baseDir });

const first = await grail.pursue('greetingCreated');
assert.equal(first.reached, true);
assert.equal(first.observations.length, 1);
assert.equal(first.observations[0].invocation.id, 'inv-001');

const second = await grail.pursue('greetingCreated');
assert.equal(second.reached, true);
assert.equal(second.observations.length, 1, 'Observations must not accumulate');
assert.equal(second.observations[0].invocation.id, 'inv-001', 'Invocation counter resets');

const failed = await grail.pursue('failedGoal');
assert.equal(failed.reached, false);
assert.equal(failed.worldstate.greetingCreated, false, 'Earlier effects must not persist');
assert.equal(failed.observations.length, 1);
assert.equal(failed.observations[0].result, 'FAIL');

const retry = await grail.pursue('failedGoal');
assert.equal(retry.reached, false);
assert.equal(retry.observations.length, 1, 'Prior failures must not exclude next pursuit');
assert.equal(retry.observations[0].invocation.id, 'inv-001');

const afterFailure = await grail.pursue('greetingCreated');
assert.equal(afterFailure.reached, true);
assert.equal(afterFailure.observations.length, 1);
console.log('Independent pursuits regression passed.');

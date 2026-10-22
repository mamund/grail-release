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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const seenInvocationIds = new Set();
const seenPursuitIds = new Set();
function assertUniquePursuitId(result) {
  assert.match(result.pursuitId, uuidPattern, 'Pursuit ID must be a UUID');
  assert.equal(seenPursuitIds.has(result.pursuitId), false, 'Pursuit IDs must be globally unique');
  seenPursuitIds.add(result.pursuitId);
}

function assertUniqueInvocationId(observation) {
  const id = observation.invocation.id;
  assert.match(observation.pursuitId, uuidPattern, 'Observation pursuit ID must be a UUID');
  assert.match(id, uuidPattern, 'Invocation ID must be a UUID');
  assert.equal(seenInvocationIds.has(id), false, 'Invocation IDs must be globally unique');
  seenInvocationIds.add(id);
}

const first = await grail.pursue('greetingCreated');
assertUniquePursuitId(first);
assert.equal(first.reached, true);
assert.equal(first.observations.length, 1);
assertUniqueInvocationId(first.observations[0]);
assert.equal(first.observations[0].pursuitId, first.pursuitId, 'Observation must match pursuit result ID');

const second = await grail.pursue('greetingCreated');
assertUniquePursuitId(second);
assert.equal(second.reached, true);
assert.equal(second.observations.length, 1, 'Observations must not accumulate');
assertUniqueInvocationId(second.observations[0]);
assert.equal(second.observations[0].pursuitId, second.pursuitId, 'Observation must match pursuit result ID');

const failed = await grail.pursue('failedGoal');
assertUniquePursuitId(failed);
assert.equal(failed.reached, false);
assert.equal(failed.worldstate.greetingCreated, false, 'Earlier effects must not persist');
assert.equal(failed.observations.length, 1);
assert.equal(failed.observations[0].result, 'FAIL');
assertUniqueInvocationId(failed.observations[0]);
assert.equal(failed.observations[0].pursuitId, failed.pursuitId, 'Observation must match pursuit result ID');

const retry = await grail.pursue('failedGoal');
assertUniquePursuitId(retry);
assert.equal(retry.reached, false);
assert.equal(retry.observations.length, 1, 'Prior failures must not exclude next pursuit');
assertUniqueInvocationId(retry.observations[0]);
assert.equal(retry.observations[0].pursuitId, retry.pursuitId, 'Observation must match pursuit result ID');

const afterFailure = await grail.pursue('greetingCreated');
assertUniquePursuitId(afterFailure);
assert.equal(afterFailure.reached, true);
assert.equal(afterFailure.observations.length, 1);
assertUniqueInvocationId(afterFailure.observations[0]);
assert.equal(afterFailure.observations[0].pursuitId, afterFailure.pursuitId, 'Observation must match pursuit result ID');
console.log('Independent pursuits regression passed.');

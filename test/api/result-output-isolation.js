import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grail } from '../../grail.js';

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const greetBinding = {
  protocol: 'stdio', command: 'python3', args: ['./capabilities/greet.py'],
  outputs: { message: { from: 'stdout', path: 'message' } }
};
const registry = {
  produce: {
    action: 'produce', preconditions: [], effects: ['messageProduced'],
    inputs: { name: '$inputs.name' }, binding: greetBinding
  },
  useSpecific: {
    action: 'useSpecific', preconditions: ['messageProduced'],
    effects: ['specificUsed'],
    inputs: { name: '$outputs.produce.latest.message' }, binding: greetBinding
  },
  useScenario: {
    action: 'useScenario', preconditions: ['messageProduced'],
    effects: ['scenarioUsed'],
    inputs: { name: '$outputs.latest.message' }, binding: greetBinding
  },
  isolatedSpecific: {
    action: 'isolatedSpecific', preconditions: [], effects: ['isolatedSpecificUsed'],
    inputs: { name: '$outputs.produce.latest.message' }, binding: greetBinding
  },
  isolatedScenario: {
    action: 'isolatedScenario', preconditions: [], effects: ['isolatedScenarioUsed'],
    inputs: { name: '$outputs.latest.message' }, binding: greetBinding
  }
};
const grail = new Grail({ registry, worldstate: {}, inputs: { name: 'World' }, baseDir });

// Pursuit A creates an output and returns a result that must remain stable.
const first = await grail.pursue('messageProduced');
assert.equal(first.reached, true);
assert.equal(first.observations.length, 1);
assert.equal(first.observations[0].outputs.message, 'Hello, World!');
const firstSnapshot = structuredClone(first);

// Neither output reference may consume an observation from pursuit A.
for (const goal of ['isolatedSpecificUsed', 'isolatedScenarioUsed']) {
  const result = await grail.pursue(goal);
  assert.equal(result.reached, false, `${goal} must not use a previous pursuit's output`);
  assert.equal(result.observations.length, 0, `${goal} must not execute a binding`);
  assert.deepEqual(first, firstSnapshot, 'Later pursuits must not mutate earlier results');
}

// Both forms must still work when their producer executes in the SAME pursuit.
for (const [goal, action] of [
  ['specificUsed', 'useSpecific'],
  ['scenarioUsed', 'useScenario']
]) {
  const result = await grail.pursue(goal);
  assert.equal(result.reached, true, `${action} should resolve current-pursuit output`);
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].invocation.affordance, 'produce');
  assert.equal(result.observations[1].invocation.affordance, action);
  assert.equal(result.observations[1].invocation.inputs.name, 'Hello, World!');
  assert.equal(result.observations[1].outputs.message, 'Hello, Hello, World!!');
  assert.deepEqual(first, firstSnapshot, 'Nested observations and worldstate must remain stable');
}

console.log('Result snapshots and output isolation regression passed.');

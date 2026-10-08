import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Grail } from '../../index.js';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'grail-failure-recovery-'));
const originalLog = console.log;

function producer(action, module) {
  return {
    id: `aff-${action}`,
    action,
    type: 'task',
    preconditions: [],
    inputs: {},
    effects: ['done'],
    binding: { protocol: 'node', module, function: 'execute' }
  };
}

async function run(registry, expectedReached) {
  const grail = new Grail({
    registry,
    worldstate: { done: false },
    baseDir: temporary
  });
  const result = await grail.pursue('done');
  assert.equal(result.reached, expectedReached);
  return { grail, result };
}

try {
  fs.writeFileSync(path.join(temporary, 'fail.mjs'),
    'export function execute() { throw new Error("intentional test failure"); }\n');
  fs.writeFileSync(path.join(temporary, 'succeed.mjs'),
    'export function execute() { return { message: "recovered" }; }\n');

  // Keep the test output focused while preserving all assertions.
  console.log = () => {};

  // One failing producer: one attempt, one failure, no retry.
  const single = await run({ bad: producer('bad', './fail.mjs') }, false);
  assert.equal(single.result.observations.length, 1);
  assert.equal(single.result.observations[0].result, 'FAIL');
  assert.match(single.result.observations[0].response.error, /intentional test failure/);

  // Force the failure first, then confirm a real bound alternative succeeds.
  // Math.random = 0 chooses the first eligible producer in registry order.
  const originalRandom = Math.random;
  let recovered;
  try {
    Math.random = () => 0;
    recovered = await run({
      bad: producer('bad', './fail.mjs'),
      good: producer('good', './succeed.mjs')
    }, true);
  } finally {
    Math.random = originalRandom;
  }
  assert.deepEqual(recovered.result.observations.map(o => o.result), ['FAIL', 'SUCCESS']);
  assert.deepEqual(recovered.result.observations.map(o => o.invocation.affordance), ['bad', 'good']);
  assert.equal(recovered.result.worldstate.done, true);
  assert.equal(recovered.result.observations[1].response.result.message, 'recovered');

  // All producers fail: each is attempted only once and pursuit terminates.
  const allFailed = await run({
    first: producer('first', './fail.mjs'),
    second: producer('second', './fail.mjs')
  }, false);
  assert.equal(allFailed.result.observations.length, 2);
  assert.deepEqual(allFailed.result.observations.map(o => o.result), ['FAIL', 'FAIL']);
  assert.deepEqual(new Set(allFailed.result.observations.map(o => o.invocation.affordance)),
    new Set(['first', 'second']));
  assert.equal(allFailed.result.worldstate.done, false);
} finally {
  console.log = originalLog;
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('API failure recovery regression passed.');

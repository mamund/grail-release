import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Grail, loadEnvironment } from '@mamund/grail';

const configDir = resolve('config');
const environment = loadEnvironment(configDir);
const create = () => new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs,
  baseDir: environment.baseDir
});

// The existing runtime may emit diagnostic console.log messages. Suppress them
// in this test so that the consumer's JSON result is unambiguous.
async function run(grail, goal, options) {
  const previous = console.log;
  console.log = () => {};
  try { return await grail.pursue(goal, options); }
  finally { console.log = previous; }
}

const events = [];
const result = await run(create(), environment.goal, {
  onProgress: event => events.push(event)
});
assert.equal(result.reached, true);
assert.equal(result.goal, 'greetingCreated');
assert.equal(result.worldstate.greetingCreated, true);
assert.ok(Number.isFinite(result.timing?.durationMs));
assert.ok(result.timing.durationMs >= 0);
assert.equal(result.observations.length, 1);
const observation = result.observations[0];
assert.equal(observation.result, 'SUCCESS');
assert.equal(observation.outputs.greeting, 'Hello, GRAIL API consumer!');
assert.ok(Number.isFinite(observation.timing?.durationMs));
assert.ok(observation.timing.durationMs >= 0);
assert.ok(events.some(e => e.type === 'pursuit.started'));
assert.ok(events.some(e => e.type === 'capability.started'));
const completion = events.find(e => e.type === 'capability.completed');
assert.equal(completion?.result, 'SUCCESS');
assert.ok(Number.isFinite(completion?.durationMs));
const finished = events.find(e => e.type === 'pursuit.completed');
assert.equal(finished?.reached, true);
assert.ok(Number.isFinite(finished?.durationMs));

const quiet = await run(create(), environment.goal);
assert.equal(quiet.reached, true);
assert.ok(Number.isFinite(quiet.timing?.durationMs));

const missingEvents = [];
const missing = await run(create(), 'goalNotInWorld', {
  onProgress: event => missingEvents.push(event)
});
assert.equal(missing.reached, false);
assert.ok(Number.isFinite(missing.timing?.durationMs));
assert.ok(missingEvents.some(e => e.type === 'pursuit.unresolvable'));

process.stdout.write(JSON.stringify({
  status: 'PASS',
  greeting: observation.outputs.greeting,
  capabilityDurationMs: observation.timing.durationMs,
  pursuitDurationMs: result.timing.durationMs,
  progressEventTypes: events.map(e => e.type),
  noCallbackReached: quiet.reached,
  unreachableGoalReached: missing.reached
}, null, 2) + '\n');

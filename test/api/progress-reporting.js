import assert from 'node:assert/strict';
import { Client } from '../../client.js';

const events = [];
const originalLog = console.log;
console.log = () => {};
try {
  let attempted = false;
  const server = {
    resolveGoal: () => attempted
      ? { result: 'SUCCESS' }
      : { result: 'BLOCKED', offeredAffordances: [{ action: 'greet' }] },
    attempt: async function (affordance) {
      this.onProgress?.({ type: 'capability.started', goal: this.goal, affordance: affordance.action });
      attempted = true;
      this.onProgress?.({ type: 'capability.completed', goal: this.goal, affordance: affordance.action, result: 'SUCCESS', durationMs: 12.5 });
      return { result: 'SUCCESS' };
    }
  };
  const client = new Client(server, {}, event => events.push(event));
  await client.pursue('greetingCreated');
  assert.deepEqual(events, [
    { type: 'pursuit.started', goal: 'greetingCreated' },
    { type: 'capability.started', goal: 'greetingCreated', affordance: 'greet' },
    { type: 'capability.completed', goal: 'greetingCreated', affordance: 'greet', result: 'SUCCESS', durationMs: 12.5 },
    { type: 'pursuit.completed', goal: 'greetingCreated', reached: true }
  ]);

  const quiet = new Client(server, {});
  await quiet.pursue('greetingCreated');
  assert.equal(server.onProgress, null);

  const stuckEvents = [];
  const stuck = new Client({ resolveGoal: () => ({ result: 'BLOCKED', offeredAffordances: [] }) }, {}, event => stuckEvents.push(event));
  await stuck.pursue('unreachable');
  assert.deepEqual(stuckEvents, [
    { type: 'pursuit.started', goal: 'unreachable' },
    { type: 'pursuit.unresolvable', goal: 'unreachable' }
  ]);
} finally {
  console.log = originalLog;
}
console.log('Structured progress regression passed.');

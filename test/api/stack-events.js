import assert from 'node:assert/strict';
import { Client } from '../../client.js';

async function scenario(instrumented) {
  const calls = [];
  let resolved = false;
  let failed = false;
  const progress = [];
  const stackEvents = [];
  const server = {
    resolveGoal() {
      calls.push('resolve');
      return resolved
        ? { result: 'SUCCESS', offeredAffordances: [] }
        : { result: 'BLOCKED', offeredAffordances: [{ action: failed ? 'fallback' : 'primary' }] };
    },
    async attempt(item) {
      calls.push(`attempt:${item.action}`);
      if (item.action === 'primary') {
        failed = true;
        return { result: 'FAIL', offeredAffordances: [] };
      }
      resolved = true;
      return { result: 'SUCCESS', offeredAffordances: [] };
    }
  };
  const client = new Client(server, {}, event => progress.push(event.type));
  if (instrumented) client.onStackEvent = event => stackEvents.push(event);
  await client.pursue('done');
  return { calls, progress, stackEvents, stack: client.stack.map(item => item.action), resolved };
}

const baseline = await scenario(false);
const traced = await scenario(true);
assert.deepEqual(traced.calls, baseline.calls);
assert.deepEqual(traced.progress, baseline.progress);
assert.deepEqual(traced.stack, baseline.stack);
assert.equal(traced.resolved, baseline.resolved);
assert.deepEqual(traced.stackEvents, [
  { type: 'stack.push', affordance: 'primary', result: null, stack: ['primary'] },
  { type: 'stack.pop', affordance: 'primary', result: 'FAIL', stack: [] },
  { type: 'stack.push', affordance: 'fallback', result: null, stack: ['fallback'] },
  { type: 'stack.pop', affordance: 'fallback', result: 'SUCCESS', stack: [] }
]);

// A throwing observer must not change execution.
const throwingServer = {
  resolveGoal: () => ({ result: 'BLOCKED', offeredAffordances: [{ action: 'done' }] }),
  attempt: async () => ({ result: 'BLOCKED', condition: 'missing', offeredAffordances: [] })
};
const throwingClient = new Client(throwingServer, {});
throwingClient.onStackEvent = () => { throw new Error('diagnostic failure'); };
await throwingClient.pursue('unresolvable');
assert.deepEqual(throwingClient.stack.map(x => x.action), ['done']);
console.log('Stack event telemetry regression passed.');

import assert from 'node:assert/strict';
import { Client } from '../../client.js';

const calls = [];
let bDone = false;
const server = {
  resolveGoal(goal) {
    calls.push(`resolve:${goal}`);
    if (goal === 'B' && bDone) return { result: 'SUCCESS', offeredAffordances: [] };
    return { result: 'BLOCKED', offeredAffordances: [{ action: goal === 'A' ? 'blockedA' : 'achieveB' }] };
  },
  async attempt(item) {
    calls.push(`attempt:${item.action}`);
    if (item.action === 'blockedA') {
      return { result: 'BLOCKED', condition: 'missingDependency', offeredAffordances: [] };
    }
    bDone = true;
    return { result: 'SUCCESS', offeredAffordances: [] };
  }
};

const client = new Client(server, {});
await client.pursue('A');
assert.deepEqual(client.stack.map(x => x.action), ['blockedA'], 'Fixture must leave an unfinished stack after A');
await client.pursue('B');
assert.deepEqual(client.stack, [], 'Successful pursuit must leave no stack entries');
assert.deepEqual(calls, ['resolve:A', 'attempt:blockedA', 'resolve:B', 'attempt:achieveB', 'resolve:B']);
console.log('API pursuit stack isolation regression passed.');

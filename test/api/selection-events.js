import assert from 'node:assert/strict';
import { Server } from '../../server.js';

const observations = {
  getByAffordance(action) {
    return action === 'failed' ? [{ result: 'FAIL' }] : [];
  }
};
const server = new Server({}, {}, observations);
const events = [];
server.onSelectionEvent = event => events.push(event);
const originalRandom = Math.random;
let draws = 0;
try {
  Math.random = () => { draws++; return 0; };
  assert.equal(server.selectUnmetCondition(['first', 'second']), 'first');
  assert.equal(server.selectAffordance([
    { action: 'failed' }, { action: 'primary' }, { action: 'fallback' }
  ]).action, 'primary');
  assert.equal(draws, 2, 'Telemetry must not consume additional randomness');
  assert.deepEqual(events, [
    { type: 'condition.selected', condition: 'first', candidates: ['first', 'second'] },
    { type: 'affordance.selected', affordance: 'primary', candidates: ['primary', 'fallback'] }
  ]);

  server.onSelectionEvent = () => { throw new Error('diagnostic failure'); };
  assert.equal(server.selectUnmetCondition(['still-works']), 'still-works');
  assert.equal(server.selectAffordance([{ action: 'still-works' }]).action, 'still-works');
  server.onSelectionEvent = null;
  assert.equal(server.selectUnmetCondition(['disabled']), 'disabled');
  assert.equal(server.selectAffordance([{ action: 'disabled' }]).action, 'disabled');
  assert.equal(server.selectAffordance([{ action: 'failed' }]), null);
} finally {
  Math.random = originalRandom;
}
console.log('Selection event telemetry regression passed.');

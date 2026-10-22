import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-stack-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  await writeFile(path.join(root, 'capability.js'), `
export async function succeed() { return { ok: true }; }
export async function fail() { throw new Error('intentional failure'); }
`);
  const binding = fn => ({ protocol: 'node', module: './capability.js', function: fn });
  const registry = {
    first: { action: 'first', preconditions: [], effects: ['firstDone'], inputs: {}, binding: binding('succeed') },
    second: { action: 'second', preconditions: ['firstDone'], effects: ['secondDone'], inputs: {}, binding: binding('succeed') },
    failed: { action: 'failed', preconditions: ['secondDone'], effects: ['done'], inputs: {}, binding: binding('fail') }
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });

  const disabled = await grail.pursue('done');
  assert.equal(disabled.reached, false);
  assert.equal(grail.server.recoveryStack.length, 0, 'No recovery bookkeeping by default');

  const enabled = await grail.pursue('done', { recover: true });
  assert.equal(enabled.reached, false);
  assert.equal(enabled.recovery.attempted, true, 'Unresolvable pursuit triggers recovery, without compensation yet');
  assert.equal(Object.hasOwn(enabled, 'recoveryStack'), false, 'Stack stays internal');
  assert.equal(grail.server.recoveryStack.length, 2, 'Only successful invocations are stacked');
  const [first, second] = grail.server.recoveryStack;
  assert.deepEqual([first.affordance, second.affordance], ['first', 'second']);
  assert.equal(first.pursuitId, enabled.pursuitId);
  assert.equal(second.pursuitId, enabled.pursuitId);
  assert.equal(first.invocationId, enabled.observations[0].invocation.id);
  assert.equal(second.invocationId, enabled.observations[1].invocation.id);
  assert.equal(first.binding, grail.affordanceRegistry.first.binding);
  assert.equal(second.binding, grail.affordanceRegistry.second.binding);
  assert.equal(enabled.observations[2].result, 'FAIL');
  assert.equal(enabled.observations.filter(o => o.phase === 'forward').length, 3);

  const repeated = await grail.pursue('done', { recover: true });
  assert.equal(grail.server.recoveryStack.length, 2, 'Fresh stack per pursuit');
  assert.notEqual(repeated.pursuitId, enabled.pursuitId);
  assert.equal(grail.server.recoveryStack[0].pursuitId, repeated.pursuitId);
  assert.notEqual(grail.server.recoveryStack[0].invocationId, first.invocationId);
  console.log('Recovery stack regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

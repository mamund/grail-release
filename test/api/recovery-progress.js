import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-progress-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'caps.mjs'), `
export async function forward() { return { ok: true }; }
export async function fail() { throw new Error('failed'); }
export async function compensate() { return { result: 'SUCCESS' }; }
export async function badCompensation() { return { result: 'FAIL' }; }
`);
  const bind = (fn, recover) => ({ protocol: 'node', module: './caps.mjs', function: fn, ...(recover ? { recover } : {}) });
  const entry = (action, effect, binding, preconditions = []) => ({ action, effects: [effect], preconditions, inputs: {}, binding });
  const registry = {
    a: entry('a', 'a', bind('forward', 'compensate')),
    b: entry('b', 'b', bind('forward'), ['a']),
    c: entry('c', 'c', bind('forward', 'badCompensation'), ['b']),
    d: entry('d', 'done', bind('fail'), ['c'])
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });
  const events = [];
  const result = await grail.pursue('done', { recover: true, onProgress: event => events.push(event) });
  const recoveryEvents = events.filter(e => e.type.startsWith('recovery.'));
  assert.deepEqual(recoveryEvents.map(e => e.type), [
    'recovery.started',
    'recovery.invocation.started', 'recovery.invocation.completed',
    'recovery.invocation.completed',
    'recovery.invocation.started', 'recovery.invocation.completed',
    'recovery.completed'
  ]);
  assert.equal(recoveryEvents[0].total, 3);
  assert.ok(recoveryEvents.every(e => e.pursuitId === result.pursuitId));
  const completed = recoveryEvents.filter(e => e.type === 'recovery.invocation.completed');
  assert.deepEqual(completed.map(e => e.status), ['RECOVERY_FAILED', 'SKIPPED', 'RECOVERED']);
  assert.deepEqual(completed.map(e => e.affordance), ['c', 'b', 'a']);
  const forward = result.observations.filter(o => o.phase === 'forward');
  const recovery = result.observations.filter(o => o.phase === 'recovery');
  for (let i = 0; i < completed.length; i++) {
    assert.equal(completed[i].originalInvocationId, forward[2 - i].invocation.id);
    assert.equal(completed[i].invocationId, recovery[i].invocation.id);
    assert.ok(completed[i].durationMs >= 0);
  }
  assert.equal(Object.hasOwn(completed[1], 'invocationId'), false);
  assert.deepEqual(recoveryEvents.at(-1), { type: 'recovery.completed', pursuitId: result.pursuitId, recovered: 1, failed: 1, skipped: 1 });
  assert.deepEqual(result.recovery, { enabled: true, attempted: true, recovered: 1, failed: 1, skipped: 1 });

  for (const options of [{ recover: false }, { recover: true }]) {
    const success = new Grail({ registry: { a: registry.a }, worldstate: {}, baseDir: root });
    const progress = [];
    await success.pursue('a', { ...options, onProgress: e => progress.push(e) });
    assert.equal(progress.some(e => e.type.startsWith('recovery.')), false);
  }
  const disabledEvents = [];
  await grail.pursue('done', { onProgress: e => disabledEvents.push(e) });
  assert.equal(disabledEvents.some(e => e.type.startsWith('recovery.')), false);
  console.log('Recovery progress regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

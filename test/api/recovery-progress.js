import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';
import { createPursuitTrace } from '../../pursuitTrace.js';

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
  assert.ok(result.recovery.durationMs >= 0);
  assert.deepEqual((({ durationMs, ...counts }) => counts)(result.recovery), { enabled: true, attempted: true, recovered: 1, failed: 1, skipped: 1 });

  // An observer that throws at every recovery event cannot interrupt LIFO compensation.
  // Test each lifecycle event independently, including the final notification.
  const eventTypes = [
    'recovery.started',
    'recovery.invocation.started',
    'recovery.invocation.completed',
    'recovery.completed'
  ];
  for (const throwAt of eventTypes) {
    const observed = [];
    const isolated = await grail.pursue('done', {
      recover: true,
      onProgress(event) {
        if (!event.type.startsWith('recovery.')) return;
        observed.push(event.type);
        if (event.type === throwAt) throw new Error(`Observer failed at ${throwAt}`);
      }
    });
    assert.equal(isolated.reached, false);
    assert.deepEqual(observed, recoveryEvents.map(e => e.type));
    assert.deepEqual(
      (({ durationMs, ...counts }) => counts)(isolated.recovery),
      { enabled: true, attempted: true, recovered: 1, failed: 1, skipped: 1 }
    );
    const records = isolated.observations.filter(o => o.phase === 'recovery');
    assert.deepEqual(records.map(o => o.result), ['RECOVERY_FAILED', 'SKIPPED', 'RECOVERED']);
    assert.deepEqual(records.map(o => o.invocation.affordance), ['c', 'b', 'a']);
    assert.equal(records.every(o => !Object.hasOwn(o, 'error') || !String(o.error).includes('Observer failed')), true);
  }

  // The pursuit trace records recovery independently of the progress observer.
  const trace = createPursuitTrace();
  const traced = await grail.pursue('done', {
    recover: true,
    pursuitTrace: trace,
    onProgress(event) {
      if (event.type.startsWith('recovery.')) throw new Error('Broken observer');
    }
  });
  const tracedRecovery = trace.events.filter(e => e.type.startsWith('recovery.'));
  assert.deepEqual(tracedRecovery.map(e => e.type), recoveryEvents.map(e => e.type));
  assert.deepEqual(tracedRecovery.filter(e => e.type === 'recovery.invocation.completed').map(e => e.affordance), ['c', 'b', 'a']);
  assert.deepEqual(tracedRecovery.filter(e => e.type === 'recovery.invocation.completed').map(e => e.status), ['RECOVERY_FAILED', 'SKIPPED', 'RECOVERED']);
  assert.ok(tracedRecovery.every(e => e.pursuitId === traced.pursuitId));
  assert.deepEqual(trace.events.map(e => e.sequence), trace.events.map((_, i) => i + 1));
  assert.ok(trace.events.findIndex(e => e.type === 'recovery.started') > 0);
  const recoveredObservations = traced.observations.filter(o => o.phase === 'recovery');
  for (let i = 0; i < recoveredObservations.length; i++) {
    const completedEvent = tracedRecovery.filter(e => e.type === 'recovery.invocation.completed')[i];
    assert.equal(completedEvent.originalInvocationId, recoveredObservations[i].originalInvocationId);
    assert.equal(completedEvent.invocationId, recoveredObservations[i].invocation.id);
  }
  assert.equal(Object.hasOwn(tracedRecovery.find(e => e.type === 'recovery.invocation.completed' && e.status === 'SKIPPED'), 'invocationId'), false);
  assert.deepEqual((({ type, pursuitId, sequence, ...counts }) => counts)(tracedRecovery.at(-1)), { recovered: 1, failed: 1, skipped: 1 });

  // Tracing also works when no onProgress callback is registered.
  const traceOnly = createPursuitTrace();
  await grail.pursue('done', { recover: true, pursuitTrace: traceOnly });
  assert.deepEqual(traceOnly.events.filter(e => e.type.startsWith('recovery.')).map(e => e.type), recoveryEvents.map(e => e.type));

  // Disabled recovery and successful pursuits do not create recovery trace events.
  const disabledTrace = createPursuitTrace();
  await grail.pursue('done', { recover: false, pursuitTrace: disabledTrace });
  assert.equal(disabledTrace.events.some(e => e.type.startsWith('recovery.')), false);
  const successfulTrace = createPursuitTrace();
  const successfulGrail = new Grail({ registry: { a: registry.a }, worldstate: {}, baseDir: root });
  await successfulGrail.pursue('a', { recover: true, pursuitTrace: successfulTrace });
  assert.equal(successfulTrace.events.some(e => e.type.startsWith('recovery.')), false);

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

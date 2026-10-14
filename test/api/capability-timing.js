import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolated harness: replace the binding dispatcher with a deterministic fake,
// leaving the real server logic and ObservationStore implementation intact.
const temp = await mkdtemp(join(tmpdir(), 'grail-timing-test-'));
try {
  await mkdir(join(temp, 'bindings'));
  await writeFile(join(temp, 'package.json'), '{"type":"module"}');
  await copyFile(resolve('server.js'), join(temp, 'server.js'));
  await copyFile(resolve('observationStore.js'), join(temp, 'observationStore.js'));
  await writeFile(join(temp, 'bindings/binding.js'), `
    export async function executeBinding(binding, inputs) {
      await new Promise(resolve => setTimeout(resolve, 15));
      return {
        ok: binding.ok,
        description: 'test binding',
        summary: 'test result',
        invocation: { command: 'test', inputs },
        response: { status: binding.ok ? 200 : 500 },
        outputs: {}
      };
    }
  `);
  const { Server } = await import(pathToFileURL(join(temp, 'server.js')).href);
  const { ObservationStore } = await import(pathToFileURL(join(temp, 'observationStore.js')).href);
  const store = new ObservationStore();
  const world = {
    isPreconditionMet: condition => condition === 'ready',
    applyEffects: () => {}
  };
  const server = new Server(world, {}, store);
  const action = ok => ({ action: 'testAction', preconditions: [], inputs: {}, effects: ['done'], binding: { ok } });
  const previousLog = console.log;
  console.log = () => {};
  try {
    assert.equal((await server.attempt(action(true), {})).result, 'SUCCESS');
    assert.equal((await server.attempt(action(false), {})).result, 'FAIL');
    assert.equal(store.observations.length, 2);
    for (const observation of store.observations) {
      assert.equal(typeof observation.timing.durationMs, 'number');
      assert.ok(Number.isFinite(observation.timing.durationMs));
      assert.ok(observation.timing.durationMs >= 10);
      assert.ok(!Number.isNaN(Date.parse(observation.invocation.timestamp)));
      assert.ok(Date.parse(observation.invocation.timestamp) <= Date.now());
    }
    assert.deepEqual(store.observations.map(o => o.result), ['SUCCESS', 'FAIL']);
    const blocked = { ...action(true), preconditions: ['notReady'] };
    assert.equal((await server.attempt(blocked, {})).result, 'BLOCKED');
    assert.equal(store.observations.length, 2);
  } finally { console.log = previousLog; }
  console.log('Capability timing regression passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}

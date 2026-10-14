import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Test the real facade's pursuit method with deterministic client and world fakes.
const temp = await mkdtemp(join(tmpdir(), 'grail-pursuit-duration-'));
try {
  await writeFile(join(temp, 'package.json'), '{"type":"module"}');
  await copyFile(resolve('grail.js'), join(temp, 'grail.js'));
  for (const name of ['affordanceRegistry', 'worldState', 'observationStore', 'server', 'client']) {
    const symbol = { affordanceRegistry: 'loadAffordanceRegistry', worldState: 'WorldState', observationStore: 'ObservationStore', server: 'Server', client: 'Client' }[name];
    await writeFile(join(temp, `${name}.js`), `export const ${symbol} = () => {};`);
  }
  const { Grail } = await import(pathToFileURL(join(temp, 'grail.js')).href);
  const run = async (reached, withCallback) => {
    const grail = Object.create(Grail.prototype);
    grail.resetPursuit = () => {
      grail.worldState = { state: { done: reached }, isPreconditionMet: () => reached };
      grail.observationStore = { observations: [{ result: 'SUCCESS' }] };
      grail.client = {
        onProgress: null,
        async pursue(goal) {
          this.onProgress?.({ type: 'pursuit.started', goal });
          await new Promise(resolve => setTimeout(resolve, 18));
          this.onProgress?.(reached
            ? { type: 'pursuit.completed', goal, reached: true }
            : { type: 'pursuit.unresolvable', goal });
        }
      };
    };
    const events = [];
    const result = await grail.pursue('done', withCallback ? { onProgress: event => events.push(event) } : {});
    assert.equal(result.reached, reached);
    assert.equal(typeof result.timing.durationMs, 'number');
    assert.ok(result.timing.durationMs >= 10);
    assert.equal(result.observations.length, 1);
    if (withCallback) {
      assert.deepEqual(events.map(e => e.type), ['pursuit.started', reached ? 'pursuit.completed' : 'pursuit.unresolvable']);
      assert.ok(events[1].durationMs >= 10);
      assert.ok(events[1].durationMs <= result.timing.durationMs);
    }
  };
  await run(true, true);
  await run(false, true);
  await run(true, false);
  console.log('Pursuit duration regression passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-observations-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'caps.mjs'), `
export async function forward() { return { ok: true, outputs: { marker: 'forward' } }; }
export async function fail() { throw new Error('forward failed'); }
export async function compensate() { return { result: 'SUCCESS', outputs: { marker: 'recovery' } }; }
`);
  const bind = (fn, recover) => ({ protocol: 'node', module: './caps.mjs', function: fn, outputs: { marker: { from: 'result', path: 'outputs.marker' } }, ...(recover ? { recover } : {}) });
  const entry = (action, effect, binding, preconditions = []) => ({ action, effects: [effect], preconditions, inputs: {}, binding });
  const grail = new Grail({
    registry: {
      a: entry('a', 'a', bind('forward', 'compensate')),
      b: entry('b', 'b', bind('forward'), ['a']),
      c: entry('c', 'done', bind('fail'), ['b'])
    },
    worldstate: {}, baseDir: root,
    observationPath: path.join(root, 'observations.json')
  });
  const result = await grail.pursue('done', { recover: true });
  assert.ok(result.recovery.durationMs >= 0);
  assert.deepEqual((({ durationMs, ...counts }) => counts)(result.recovery), { enabled: true, attempted: true, recovered: 1, failed: 0, skipped: 1 });
  assert.deepEqual(result.observations.map(o => o.phase), ['forward', 'forward', 'forward', 'recovery', 'recovery']);
  const [a, b, , skipped, recovered] = result.observations;
  assert.equal(skipped.result, 'SKIPPED');
  assert.equal(skipped.originalInvocationId, b.invocation.id);
  assert.equal(Object.hasOwn(skipped.invocation, 'id'), false);
  assert.equal(recovered.result, 'RECOVERED');
  assert.equal(recovered.originalInvocationId, a.invocation.id);
  assert.match(recovered.invocation.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(recovered.invocation.id, a.invocation.id);
  assert.equal(recovered.pursuitId, result.pursuitId);
  assert.equal(recovered.outputs.marker, 'recovery');
  assert.ok(recovered.timing.durationMs >= 0);
  assert.deepEqual(grail.observationStore.resolve('$outputs.latest.marker'), { resolved: true, value: 'forward' });
  assert.deepEqual(grail.observationStore.resolve('$outputs.a.latest.marker'), { resolved: true, value: 'forward' });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'observations.json'), 'utf8')), result.observations);
  const disabled = await grail.pursue('done');
  assert.ok(disabled.observations.every(o => o.phase === 'forward'));
  console.log('Recovery observations regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

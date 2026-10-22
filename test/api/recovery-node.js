import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-node-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'caps.js'), `
import { appendFile } from 'node:fs/promises';
export async function forward() { return { ok: true }; }
export async function fail() { throw new Error('expected forward failure'); }
export async function compensate({ pursuitId, invocationId }) {
  await appendFile(${JSON.stringify(path.join(root, 'calls.txt'))}, JSON.stringify({ pursuitId, invocationId }) + '\\n');
  return { result: 'SUCCESS' };
}
export async function reject() { return { result: 'FAIL' }; }
export async function explode() { throw new Error('recovery error'); }
`);
  const bind = (fn, recover) => ({ protocol: 'node', module: './caps.js', function: fn, ...(recover ? { recover } : {}) });
  const affordance = (action, effects, binding, preconditions = []) => ({ action, effects, preconditions, inputs: {}, binding });
  const registry = {
    first: affordance('first', ['a'], bind('forward', 'compensate')),
    second: affordance('second', ['b'], bind('forward', { module: './caps.js', function: 'compensate' }), ['a']),
    skipped: affordance('skipped', ['c'], bind('forward'), ['b']),
    rejected: affordance('rejected', ['d'], bind('forward', 'reject'), ['c']),
    broken: affordance('broken', ['e'], bind('forward', 'explode'), ['d']),
    missing: affordance('missing', ['f'], bind('forward', 'notExported'), ['e']),
    failure: affordance('failure', ['done'], bind('fail'), ['f'])
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });
  const result = await grail.pursue('done', { recover: true });
  assert.equal(result.reached, false);
  assert.ok(result.recovery.durationMs >= 0);
  assert.deepEqual((({ durationMs, ...counts }) => counts)(result.recovery), { enabled: true, attempted: true, recovered: 2, failed: 3, skipped: 1 });
  const calls = (await readFile(path.join(root, 'calls.txt'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map(c => c.invocationId), [result.observations[1].invocation.id, result.observations[0].invocation.id]);
  assert.ok(calls.every(c => c.pursuitId === result.pursuitId));
  assert.equal(result.observations.filter(o => o.phase === 'recovery').length, 6);
  const disabled = await grail.pursue('done');
  assert.equal(Object.hasOwn(disabled, 'recovery'), false);
  assert.equal((await readFile(path.join(root, 'calls.txt'), 'utf8')).trim().split('\n').length, 2);
  console.log('Node recovery regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

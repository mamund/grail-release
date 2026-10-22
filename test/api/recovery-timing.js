import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-timing-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'caps.mjs'), `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function forward() { await sleep(25); return { result: 'SUCCESS' }; }
export async function fail() { await sleep(25); throw new Error('forward failed'); }
export async function compensate() { await sleep(35); return { result: 'SUCCESS' }; }
`);
  const bind = (fn, recover) => ({ protocol: 'node', module: './caps.mjs', function: fn, ...(recover ? { recover } : {}) });
  const registry = {
    a: { action: 'a', effects: ['a'], preconditions: [], inputs: {}, binding: bind('forward', 'compensate') },
    b: { action: 'b', effects: ['done'], preconditions: ['a'], inputs: {}, binding: bind('fail') }
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });
  const result = await grail.pursue('done', { recover: true });
  assert.equal(result.reached, false);
  assert.equal(result.recovery.attempted, true);
  assert.equal(result.recovery.recovered, 1);
  assert.ok(result.timing.forwardDurationMs >= 40);
  assert.ok(result.timing.recoveryDurationMs >= 30);
  assert.ok(result.timing.totalDurationMs >= result.timing.forwardDurationMs + result.timing.recoveryDurationMs);
  assert.equal(result.timing.durationMs, result.timing.totalDurationMs);
  assert.equal(result.recovery.durationMs, result.timing.recoveryDurationMs);

  const disabled = await grail.pursue('done');
  assert.deepEqual(Object.keys(disabled.timing), ['durationMs']);
  assert.equal(Object.hasOwn(disabled, 'recovery'), false);

  const successful = await grail.pursue('a', { recover: true });
  assert.deepEqual(Object.keys(successful.timing), ['durationMs']);
  assert.deepEqual(successful.recovery, { enabled: true, attempted: false });
  console.log('Recovery timing regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-trigger-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  await writeFile(path.join(root, 'capability.js'), `
export async function succeed() { return { ok: true }; }
export async function fail() { throw new Error('expected failure'); }
`);
  const binding = fn => ({ protocol: 'node', module: './capability.js', function: fn });
  const make = registry => new Grail({ registry, worldstate: {}, baseDir: root });
  const success = { action: 'success', preconditions: [], effects: ['done'], inputs: {}, binding: binding('succeed') };
  const fail = { action: 'fail', preconditions: [], effects: ['done'], inputs: {}, binding: binding('fail') };

  const completed = await make({ success }).pursue('done', { recover: true });
  assert.equal(completed.reached, true);
  assert.deepEqual(completed.recovery, { enabled: true, attempted: false });

  const exhausted = await make({ fail }).pursue('done', { recover: true });
  assert.equal(exhausted.reached, false);
  assert.deepEqual(exhausted.recovery, { enabled: true, attempted: true });
  assert.equal(exhausted.observations.length, 1, 'Trigger does not execute handlers');

  const disabled = await make({ fail }).pursue('done');
  assert.equal(disabled.reached, false);
  assert.equal(Object.hasOwn(disabled, 'recovery'), false);

  const noProducer = await make({}).pursue('done', { recover: true });
  assert.equal(noProducer.reached, false);
  assert.equal(noProducer.recovery.attempted, true);

  const missingInput = {
    action: 'needsInput', preconditions: [], effects: ['done'],
    inputs: { missing: '$inputs.missing' }, binding: binding('succeed')
  };
  const blocked = await make({ missingInput }).pursue('done', { recover: true });
  assert.equal(blocked.reached, false);
  assert.equal(blocked.recovery.attempted, false, 'Stopped is not an unresolvable termination');

  // The first failure must not trigger recovery while a viable alternative remains.
  const alternatives = make({ fail, success });
  const originalSelect = alternatives.resetPursuit.bind(alternatives);
  alternatives.resetPursuit = () => {
    originalSelect();
    const select = alternatives.server.selectAffordance.bind(alternatives.server);
    alternatives.server.selectAffordance = choices =>
      (alternatives.observationStore.getByAffordance('fail').some(o => o.result === 'FAIL')
        ? select(choices)
        : choices.find(a => a.action === 'fail') ?? select(choices));
  };
  const recoveredByAlternative = await alternatives.pursue('done', { recover: true });
  assert.equal(recoveredByAlternative.reached, true);
  assert.equal(recoveredByAlternative.recovery.attempted, false);
  assert.deepEqual(recoveredByAlternative.observations.map(o => o.result), ['FAIL', 'SUCCESS']);

  console.log('Recovery trigger regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

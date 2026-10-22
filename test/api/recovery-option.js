import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail, runGrailWorld } from '../../index.js';
import { createFixture } from '../cli/helpers.js';

const registry = {
  noOp: {
    action: 'noOp', preconditions: [], effects: ['done'], inputs: {},
    binding: { protocol: 'node', module: './capabilities/nonexistent-recovery-test.mjs', function: 'run' }
  }
};
const grail = new Grail({ registry, worldstate: { done: false } });
const disabled = await grail.pursue('done');
assert.equal(disabled.reached, false);
assert.equal(Object.hasOwn(disabled, 'recovery'), false);
const enabled = await grail.pursue('done', { recover: true });
assert.equal(enabled.reached, false);
assert.deepEqual(enabled.recovery, { enabled: true, attempted: true, recovered: 0, failed: 0, skipped: 0 });
assert.equal(Object.hasOwn(await grail.pursue('done'), 'recovery'), false, 'Override must not leak');
const configured = new Grail({ registry, worldstate: { done: false }, recover: true });
assert.deepEqual((await configured.pursue('done')).recovery, { enabled: true, attempted: true, recovered: 0, failed: 0, skipped: 0 });
assert.equal(Object.hasOwn(await configured.pursue('done', { recover: false }), 'recovery'), false);

const fixture = createFixture('recovery-option');
try {
  const world = path.join(fixture.tempDir, 'world');
  fixture.assertExit(fixture.runCli(['init', world]), 0, 'init recovery fixture');
  const config = path.join(world, 'config');
  const normal = fixture.runCli(['run', '--config', config, '--output=json']);
  fixture.assertExit(normal, 0, 'default CLI');
  assert.equal(Object.hasOwn(JSON.parse(normal.stdout), 'recovery'), false);
  const recovery = fixture.runCli(['run', '--config', config, '--recover', '--output=json']);
  fixture.assertExit(recovery, 0, 'CLI --recover');
  assert.deepEqual(JSON.parse(recovery.stdout).recovery, { enabled: true, attempted: false });
  const summary = fixture.runCli(['run', '--config', config, '--recover', '--output=summary']);
  fixture.assertExit(summary, 0, 'CLI summary');
  assert.doesNotMatch(summary.stdout, /Recovery:/, 'No recovery summary before an attempt');
  const invalid = fixture.runCli(['run', '--config', config, '--recover', '--recover']);
  fixture.assertExit(invalid, 2, 'duplicate recovery option');
  assert.deepEqual((await runGrailWorld({ worldRoot: world, recover: true })).recovery, { enabled: true, attempted: false });
} finally {
  fixture.cleanup();
}
console.log('Recovery option regression passed.');

import assert from 'node:assert/strict';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('recovery-summary');
try {
  const world = path.join(fixture.tempDir, 'world');
  fixture.assertExit(fixture.runCli(['init', world]), 0, 'init world');
  const config = path.join(world, 'config');
  const args = ['run', '--config', config, '--output=summary'];

  const normal = fixture.runCli(args);
  fixture.assertExit(normal, 0, 'normal successful pursuit');
  assert.doesNotMatch(normal.stdout, /Recovery:/);

  const successful = fixture.runCli([...args, '--recover']);
  fixture.assertExit(successful, 0, 'recovery-enabled successful pursuit');
  assert.doesNotMatch(successful.stdout, /Recovery:/);

  const failed = fixture.runCli([...args, '--goal', 'unreachable', '--recover']);
  fixture.assertExit(failed, 1, 'recovery-enabled unresolvable pursuit');
  assert.match(failed.stdout, /Result: FAIL/);
  assert.match(failed.stdout, /Recovery:\n  Attempted: yes\n  Recovered: 0\n  Failed:    0\n  Skipped:   0\n  Duration:  [\d.]+ ms/);

  const disabled = fixture.runCli([...args, '--goal', 'unreachable']);
  fixture.assertExit(disabled, 1, 'unresolvable pursuit without recovery');
  assert.doesNotMatch(disabled.stdout, /Recovery:/);

  const json = fixture.runCli(['run', '--config', config, '--goal', 'unreachable', '--recover', '--output=json']);
  fixture.assertExit(json, 1, 'JSON recovery result');
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.recovery.attempted, true);
  assert.equal(parsed.recovery.recovered, 0);
  assert.equal(parsed.recovery.failed, 0);
  assert.equal(parsed.recovery.skipped, 0);
  assert.equal(typeof parsed.recovery.durationMs, 'number');

  const help = fixture.runCli(['run', '--help']);
  fixture.assertExit(help, 0, 'run help');
  assert.doesNotMatch(help.stdout, /no handlers executed yet/);

  console.log('CLI recovery summary regression passed.');
} finally {
  fixture.cleanup();
}

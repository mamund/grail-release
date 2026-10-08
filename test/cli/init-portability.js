import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('init-portability');
try {
  const consumer = path.join(fixture.tempDir, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true}\n');

  const init = fixture.runCli(['init', 'sample'], { cwd: consumer });
  fixture.assertExit(init, 0, 'init should succeed in a CommonJS-default project');
  const world = path.join(consumer, 'sample');
  assert.ok(fs.existsSync(path.join(world, 'capabilities', 'hello.mjs')));
  const registry = JSON.parse(fs.readFileSync(path.join(world, 'config', 'registry.json'), 'utf8'));
  assert.equal(registry.createGreeting.binding.module, './capabilities/hello.mjs');

  const validate = fixture.runCli(['validate', '--config', path.join(world, 'config')], { cwd: consumer });
  fixture.assertExit(validate, 0, 'generated world should validate');
  const run = fixture.runCli(['run', '--config', path.join(world, 'config')], { cwd: consumer });
  fixture.assertExit(run, 0, 'generated world should execute without type=module');
  assert.match(run.stdout, /Goal reached: greetingCreated/);
  console.log('Portable CLI init regression passed.');
} finally {
  fixture.cleanup();
}

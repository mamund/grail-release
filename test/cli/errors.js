import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('cli-errors');
const { tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit } = fixture;
try {
  // Invocation and configuration errors exit 2.
  {
    const result = runCli(['bogus']);
    assertExit(result, 2, 'unknown command should exit 2');
    assert.match(result.stderr, /GRAIL: Unknown command: bogus/);
    assert.match(result.stderr, /grail --help/);
  }

  {
    const result = runCli(['run', '--bogus']);
    assertExit(result, 2, 'unknown option should exit 2');
    assert.match(result.stderr, /GRAIL: Unknown option: --bogus/);
    assert.match(result.stderr, /--help/);
  }

  {
    const result = runCli(['run', '--config']);
    assertExit(result, 2, 'missing --config value should exit 2');
    assert.match(result.stderr, /GRAIL: --config requires a directory\./);
    assert.match(result.stderr, /--help/);
  }

  {
    const result = runCli(['run', '--goal']);
    assertExit(result, 2, 'missing --goal value should exit 2');
    assert.match(result.stderr, /GRAIL: --goal requires an effect\./);
    assert.match(result.stderr, /--help/);
  }

  {
    const missingDir = path.join(tempDir, 'does-not-exist');
    const result = runCli(['validate', '--config', missingDir]);
    assertExit(result, 2, 'missing configuration should exit 2');
    assert.match(result.stderr, /Configuration error: directory not found:/);
  }

  {
    const configDir = copyConfig('missing-file');
    fs.rmSync(path.join(configDir, 'inputs.json'));

    const result = runCli(['validate', '--config', configDir]);
    assertExit(result, 2, 'missing configuration file should exit 2');
    assert.match(result.stderr, /Configuration error: inputs\.json not found in/);
  }

  {
    const configDir = copyConfig('malformed-json');
    fs.writeFileSync(path.join(configDir, 'inputs.json'), '{ bad json\n', 'utf8');

    const result = runCli(['validate', '--config', configDir]);
    assertExit(result, 2, 'malformed JSON should exit 2');
    assert.match(result.stderr, /Configuration error: invalid JSON in inputs\.json:/);
  }

  {
    const configDir = copyConfig('invalid-schema');
    writeJson(path.join(configDir, 'goal.json'), {});

    const result = runCli(['validate', '--config', configDir]);
    assertExit(result, 2, 'schema-invalid configuration should exit 2');
    assert.match(result.stderr, /Configuration error: goal\.json failed schema validation:/);
    assert.match(result.stderr, /must have required property 'goal'/);
  }
  // Pursuit and execution failures exit 1.
  {
    const configDir = copyConfig('unresolvable-goal');
    writeJson(path.join(configDir, 'goal.json'), { goal: 'noProducerExists' });

    const result = runCli(['run', '--config', configDir]);
    assertExit(result, 1, 'unresolvable goal should exit 1');
    assert.match(result.stdout, /goal is unresolvable - noProducerExists/);
    assert.match(
      result.stderr,
      /Pursuit failed: goal \"noProducerExists\" cannot be resolved with the available capabilities\./
    );
  }

  {
    const configDir = copyConfig('binding-failure');
    const registryPath = path.join(configDir, 'registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const firstAffordance = Object.values(registry)[0];

    firstAffordance.binding.command = '__grail_command_that_does_not_exist__';
    writeJson(registryPath, registry);

    const result = runCli(['run', '--config', configDir]);
    assertExit(result, 1, 'binding failure should exit 1');
    assert.match(result.stdout, /Binding failed:/);
    assert.match(result.stdout, /goal is unresolvable/);
    assert.match(result.stderr, /Execution failed while pursuing goal/);
    assert.match(result.stderr, /__grail_command_that_does_not_exist__/);
  }
  console.log('CLI errors regression passed.');
} finally {
  fixture.cleanup();
}

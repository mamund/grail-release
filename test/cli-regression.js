import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'cli', 'grail.js');
const sourceConfigDir = path.join(rootDir, 'config');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grail-cli-regression-'));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8'
  });
}

function copyConfig(name) {
  const target = path.join(tempDir, name, 'config');
  fs.mkdirSync(target, { recursive: true });

  for (const filename of ['registry.json', 'worldstate.json', 'inputs.json', 'goal.json']) {
    fs.copyFileSync(path.join(sourceConfigDir, filename), path.join(target, filename));
  }

  return target;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertExit(result, expected, label) {
  assert.equal(
    result.status,
    expected,
    `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

try {
  // Stable success behavior.
  {
    const result = runCli(['--help']);
    assertExit(result, 0, '--help should succeed');
    assert.match(result.stdout, /Usage:/);
  }

  {
    const result = runCli(['--version']);
    assertExit(result, 0, '--version should succeed');
    assert.match(result.stdout, /^0\.1\.0\s*$/);
  }

  {
    const result = runCli(['validate', '--config', sourceConfigDir]);
    assertExit(result, 0, 'valid configuration should validate');
    assert.match(result.stdout, /VALID:/);
  }

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

  console.log('CLI error-message regression passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

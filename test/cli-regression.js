import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'cli', 'grail-cli.js');
const sourceConfigDir = path.join(rootDir, 'config');
const sourceCapabilitiesDir = path.join(rootDir, 'capabilities');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grail-cli-regression-'));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8'
  });
}

function copyConfig(name) {
  const worldDir = path.join(tempDir, name);
  const target = path.join(worldDir, 'config');
  const capabilitiesTarget = path.join(worldDir, 'capabilities');
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(sourceCapabilitiesDir, capabilitiesTarget, { recursive: true });

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
  // Configuration inspection: validated, JSON-only, no execution or persistence.
  {
    const config = copyConfig('show-world');
    const before = fs.readdirSync(config).sort();
    const all = runCli(['show', '--config', config]);
    assertExit(all, 0, 'show all');
    const parsed = JSON.parse(all.stdout);
    assert.deepEqual(Object.keys(parsed), ['registry', 'worldstate', 'inputs', 'goal']);
    for (const name of ['registry', 'worldstate', 'inputs', 'goal']) {
      const single = runCli(['show', name, `--config=${config}`]);
      assertExit(single, 0, `show ${name}`);
      assert.deepEqual(JSON.parse(single.stdout), parsed[name]);
    }
    assert.deepEqual(fs.readdirSync(config).sort(), before, 'show must not write observations');
    const help = runCli(['show', '--help']);
    assertExit(help, 0, 'show help');
    assert.match(help.stdout, /registry\|worldstate\|inputs\|goal/);
    assertExit(runCli(['show', 'unknown', '--config', config]), 2, 'unknown show target');
    assertExit(runCli(['show', 'goal', 'inputs', '--config', config]), 2, 'extra show target');
    assertExit(runCli(['show', '--config']), 2, 'missing show config');
    fs.writeFileSync(path.join(config, 'inputs.json'), '{broken', 'utf8');
    assertExit(runCli(['show', 'goal', '--config', config]), 2, 'show validates entire environment');
  }
  // Stable success behavior.
  {
    const result = runCli(['--help']);
    assertExit(result, 0, '--help should succeed');
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--goal <effect>/);
    assert.match(result.stdout, /--inputs <json>/);
    assert.match(result.stdout, /--inputs-file <file>/);
    assert.match(result.stdout, /--goal greetingCreated/);
    assert.match(result.stdout, /--inputs-file \.\/cases\/mike\.json/);
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

  // Goal overrides apply only to this invocation.
  {
    const configDir = copyConfig('goal-override');
    writeJson(path.join(configDir, 'goal.json'), { goal: 'noProducerExists' });

    const withoutOverride = runCli(['run', '--config', configDir]);
    assertExit(withoutOverride, 1, 'configured unresolvable goal should still be used without override');
    assert.match(withoutOverride.stderr, /goal \"noProducerExists\" cannot be resolved/);

    const withOverride = runCli([
      'run',
      '--config',
      configDir,
      '--goal',
      'greetingCreated'
    ]);
    assertExit(withOverride, 0, 'valid --goal should override goal.json');
    assert.match(withOverride.stdout, /Goal reached: greetingCreated/);

    const persistedGoal = JSON.parse(fs.readFileSync(path.join(configDir, 'goal.json'), 'utf8'));
    assert.equal(persistedGoal.goal, 'noProducerExists', '--goal must not modify goal.json');
  }

  {
    const configDir = copyConfig('unresolvable-goal-override');
    const result = runCli([
      'run',
      `--config=${configDir}`,
      '--goal=noProducerExists'
    ]);
    assertExit(result, 1, 'unresolvable --goal override should exit 1');
    assert.match(result.stderr, /goal \"noProducerExists\" cannot be resolved/);
  }

  // Input overrides replace inputs.json for this invocation.
  {
    const configDir = copyConfig('inline-inputs-override');
    writeJson(path.join(configDir, 'inputs.json'), { name: 'Configured' });

    const result = runCli([
      'run',
      '--config',
      configDir,
      '--inputs',
      '{"name":"Inline"}'
    ]);
    assertExit(result, 0, 'valid --inputs should override inputs.json');

    const observations = JSON.parse(
      fs.readFileSync(path.join(configDir, 'observations.json'), 'utf8')
    );
    assert.equal(observations.at(-1).invocation.inputs.name, 'Inline');
    assert.equal(observations.at(-1).outputs.message, 'Hello, Inline!');

    const persistedInputs = JSON.parse(
      fs.readFileSync(path.join(configDir, 'inputs.json'), 'utf8')
    );
    assert.equal(persistedInputs.name, 'Configured', '--inputs must not modify inputs.json');
  }

  {
    const configDir = copyConfig('inputs-file-override');
    writeJson(path.join(configDir, 'inputs.json'), { name: 'Configured' });
    const callerDir = path.join(tempDir, 'caller');
    fs.mkdirSync(callerDir, { recursive: true });
    writeJson(path.join(callerDir, 'case.json'), { name: 'FromFile' });

    const result = runCli([
      'run',
      '--config',
      configDir,
      '--inputs-file',
      './case.json'
    ], { cwd: callerDir });
    assertExit(result, 0, '--inputs-file should resolve relative to the caller');

    const observations = JSON.parse(
      fs.readFileSync(path.join(configDir, 'observations.json'), 'utf8')
    );
    assert.equal(observations.at(-1).invocation.inputs.name, 'FromFile');
    assert.equal(observations.at(-1).outputs.message, 'Hello, FromFile!');
  }

  {
    const configDir = copyConfig('inputs-equals-override');
    const result = runCli([
      'run',
      `--config=${configDir}`,
      '--inputs={"name":"Equals"}'
    ]);
    assertExit(result, 0, '--inputs=<json> should be supported');
  }

  {
    const configDir = copyConfig('inputs-mutually-exclusive');
    const inputsFile = path.join(tempDir, 'exclusive-inputs.json');
    writeJson(inputsFile, { name: 'File' });
    const result = runCli([
      'run',
      '--config',
      configDir,
      '--inputs',
      '{"name":"Inline"}',
      '--inputs-file',
      inputsFile
    ]);
    assertExit(result, 2, '--inputs and --inputs-file together should exit 2');
    assert.match(result.stderr, /--inputs and --inputs-file cannot be used together/);
  }

  {
    const configDir = copyConfig('malformed-inline-inputs');
    const result = runCli(['run', '--config', configDir, '--inputs', '{bad']);
    assertExit(result, 2, 'malformed --inputs JSON should exit 2');
    assert.match(result.stderr, /Invalid JSON in --inputs:/);
  }

  {
    const configDir = copyConfig('non-object-inline-inputs');
    const result = runCli(['run', '--config', configDir, '--inputs', '["not","object"]']);
    assertExit(result, 2, 'non-object --inputs JSON should exit 2');
    assert.match(result.stderr, /--inputs must contain a JSON object/);
  }

  {
    const configDir = copyConfig('missing-inputs-file');
    const result = runCli([
      'run',
      '--config',
      configDir,
      '--inputs-file',
      './does-not-exist.json'
    ], { cwd: tempDir });
    assertExit(result, 2, 'missing --inputs-file should exit 2');
    assert.match(result.stderr, /Inputs file not found:/);
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

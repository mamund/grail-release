import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('cli-overrides');
const { tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit } = fixture;
try {
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
  console.log('CLI overrides regression passed.');
} finally {
  fixture.cleanup();
}

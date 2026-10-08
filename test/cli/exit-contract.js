import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('cli-exit-contract');
const { tempDir, runCli, copyConfig, assertExit } = fixture;

function check(args, expected, stderrPattern, label) {
  const result = runCli(args);
  assertExit(result, expected, label);
  if (stderrPattern) assert.match(result.stderr, stderrPattern, `${label}: stderr`);
  if (expected === 0) assert.equal(result.stderr, '', `${label}: unexpected stderr`);
  return result;
}

try {
  const target = path.join(tempDir, 'new-world');
  check(['init', target], 0, null, 'init succeeds');
  check(['init', target], 2, /Target already exists:/, 'init existing target');
  check(['init'], 2, /Usage: grail init/, 'init missing target');

  const configDir = path.join(target, 'config');
  check(['validate', '--config', configDir], 0, null, 'validate succeeds');
  check(['show', 'goal', '--config', configDir], 0, null, 'show succeeds');
  check(['run', '--config', configDir, '--output', 'json'], 0, null, 'run succeeds');

  for (const command of ['validate', 'show', 'run']) {
    check([command, '--unknown'], 2, /Unknown option/, `${command} unknown option`);
    check([command, '--config'], 2, /--config requires a directory/, `${command} missing config argument`);
    check([command, '--config', path.join(tempDir, 'missing')], 2,
      /Configuration error: directory not found:/, `${command} missing config directory`);
  }

  check(['show', 'not-a-document', '--config', configDir], 2,
    /Unknown show target/, 'show unknown document');
  check(['run', '--config', configDir, '--output', 'xml'], 2,
    /Invalid --output value: xml. Expected summary or json./, 'run invalid output format');
  check(['run', '--config', configDir, '--inputs', '{broken'], 2,
    /Invalid JSON in --inputs/, 'run malformed inputs');

  const missingGoal = copyConfig('missing-goal');
  check(['run', '--config', missingGoal, '--goal', 'noSuchEffect', '--output', 'json'], 1,
    /Pursuit failed:/, 'run unresolvable goal');

  const fileInsteadOfDirectory = path.join(tempDir, 'not-a-directory');
  fs.writeFileSync(fileInsteadOfDirectory, 'not a directory\n');
  for (const command of ['validate', 'show', 'run']) {
    check([command, '--config', fileInsteadOfDirectory], 2,
      /Configuration error:/, `${command} configuration path is file`);
  }

  // Observation output path is a directory: failure occurs before pursuit execution.
  const unwritableObservation = copyConfig('observations-is-directory');
  fs.mkdirSync(path.join(unwritableObservation, 'observations.json'));
  check(['run', '--config', unwritableObservation], 2,
    /EISDIR|illegal operation on a directory/, 'run observation persistence path error');

  console.log('CLI exit contract regression passed.');
} finally {
  fixture.cleanup();
}

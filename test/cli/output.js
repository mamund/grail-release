import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('cli-output');
const { tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit } = fixture;
try {
  // Explicit output modes provide readable or machine-readable results.
  {
    const world = path.join(tempDir, 'output-world');
    assertExit(runCli(['init', world]), 0, 'init output fixture');
    const config = path.join(world, 'config');
    const summary = runCli(['run', '--config', config, '--output', 'summary']);
    assertExit(summary, 0, 'summary output');
    assert.match(summary.stdout, /Goal: greetingCreated/);
    assert.match(summary.stdout, /Result: SUCCESS/);
    assert.match(summary.stdout, /message: Hello, World!/);
    assert.doesNotMatch(summary.stdout, /\[CLIENT\]|\[SERVER\]/);

    const json = runCli(['run', '--config', config, '--output=json']);
    assertExit(json, 0, 'JSON output');
    const result = JSON.parse(json.stdout);
    assert.equal(result.goal, 'greetingCreated');
    assert.equal(result.reached, true);
    assert.equal(result.observations[0].outputs.message, 'Hello, World!');
    assert.equal(json.stderr, '');

    const defaultRun = runCli(['run', '--config', config]);
    assertExit(defaultRun, 0, 'default trace remains');
    assert.match(defaultRun.stdout, /\[CLIENT\]/);

    for (const args of [['--output', 'yaml'], ['--output'], ['--output=']]) {
      const invalid = runCli(['run', '--config', config, ...args]);
      assertExit(invalid, 2, 'invalid output option');
    }

    const failed = runCli(['run', '--config', config, '--goal', 'impossible', '--output=json']);
    assertExit(failed, 1, 'unresolvable JSON pursuit');
    assert.equal(JSON.parse(failed.stdout).reached, false);
    assert.match(failed.stderr, /Pursuit failed/);
  }
  console.log('CLI output regression passed.');
} finally {
  fixture.cleanup();
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

// Read the expected version from package.json.
const { version } = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

const fixture = createFixture('cli-commands');
const { tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit } = fixture;

try {
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
    assert.equal(result.stdout.trim(), version);
  }

  {
    const result = runCli(['validate', '--config', sourceConfigDir]);
    assertExit(result, 0, 'valid configuration should validate');
    assert.match(result.stdout, /VALID:/);
  }

  console.log('CLI commands regression passed.');
} finally {
  fixture.cleanup();
}


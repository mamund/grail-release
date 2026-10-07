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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grail-path-'));
const worldDir = path.join(tempDir, 'my-world');
const elsewhereDir = path.join(tempDir, 'elsewhere');

fs.mkdirSync(elsewhereDir);

try {
  const init = spawnSync(
    process.execPath,
    [cliPath, 'init', worldDir],
    { cwd: elsewhereDir, encoding: 'utf8' }
  );

  assert.equal(init.status, 0, init.stderr || 'grail init should succeed');

  const configDir = path.join(worldDir, 'config');

  const validate = spawnSync(
    process.execPath,
    [cliPath, 'validate', '--config', configDir],
    { cwd: elsewhereDir, encoding: 'utf8' }
  );

  assert.equal(validate.status, 0, validate.stderr || 'grail validate should succeed');

  const run = spawnSync(
    process.execPath,
    [cliPath, 'run', '--config', configDir],
    { cwd: elsewhereDir, encoding: 'utf8' }
  );

  assert.equal(run.status, 0, run.stderr || 'grail run should succeed outside the world directory');
  assert.match(run.stdout, /Goal reached: greetingCreated/);

  console.log('Path resolution test passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

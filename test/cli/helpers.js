import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(rootDir, 'cli', 'grail-cli.js');
const sourceConfigDir = path.join(rootDir, 'config');
const sourceCapabilitiesDir = path.join(rootDir, 'capabilities');

export function createFixture(label) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `grail-${label}-`));
  function runCli(args, options = {}) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? rootDir,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024
    });
    if (result.error) throw new Error(`CLI subprocess failed: ${result.error.message}`);
    return result;
  }
  function copyConfig(name) {
    const worldDir = path.join(tempDir, name);
    const target = path.join(worldDir, 'config');
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(sourceCapabilitiesDir, path.join(worldDir, 'capabilities'), { recursive: true });
    for (const filename of ['registry.json', 'worldstate.json', 'inputs.json', 'goal.json']) {
      fs.copyFileSync(path.join(sourceConfigDir, filename), path.join(target, filename));
    }
    return target;
  }
  function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
  function assertExit(result, expected, label) {
    assert.equal(result.status, expected,
      `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return {
    tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit,
    cleanup() { fs.rmSync(tempDir, { recursive: true, force: true }); }
  };
}

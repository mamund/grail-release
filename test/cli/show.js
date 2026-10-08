import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFixture } from './helpers.js';

const fixture = createFixture('cli-show');
const { tempDir, sourceConfigDir, runCli, copyConfig, writeJson, assertExit } = fixture;
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
  console.log('CLI show regression passed.');
} finally {
  fixture.cleanup();
}

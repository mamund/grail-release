import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'grail-cli-trace-'));
try {
  const tracePath = join(tmp, 'trace.json');
  const cli = resolve('cli/grail-cli.js');
  const config = resolve('examples/cli-tour/config');
  const run = (...args) => spawnSync(process.execPath, [cli, 'run', '--config', config, ...args], {encoding:'utf8'});
  const normal = run('--output=json');
  const traced = run('--output=json', '--trace', tracePath);
  assert.equal(normal.status, 0, normal.stderr);
  assert.equal(traced.status, 0, traced.stderr);
  const a = JSON.parse(normal.stdout);
  const b = JSON.parse(traced.stdout);
  assert.equal(a.goal, b.goal);
  assert.equal(a.reached, b.reached);
  assert.deepEqual(a.worldstate, b.worldstate);
  assert.deepEqual(a.observations.map(o=>[o.invocation.affordance,o.result,o.outputs]),
                   b.observations.map(o=>[o.invocation.affordance,o.result,o.outputs]));
  const events = JSON.parse(readFileSync(tracePath, 'utf8'));
  assert.ok(events.length >= 3);
  assert.deepEqual(events.map(e=>e.sequence), events.map((_,i)=>i+1));
  assert.ok(events.some(e=>e.type==='affordance.selected'));
  assert.ok(events.some(e=>e.type==='stack.push'));
  assert.ok(events.some(e=>e.type==='stack.pop'));
  const noTrace = join(tmp,'none.json');
  const invalid = run('--trace', '--output=json');
  assert.notEqual(invalid.status,0);
  assert.equal(existsSync(noTrace), false);
  console.log('CLI pursuit trace export passed.');
} finally { rmSync(tmp, {recursive:true,force:true}); }

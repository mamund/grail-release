import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runGrailWorld } from '../../index.js';

const originalCwd = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'grail-run-world-'));
const root = path.join(temp, 'world-anywhere');
const caller = path.join(temp, 'elsewhere');
const config = path.join(root, 'settings');
try {
  mkdirSync(config, { recursive: true });
  mkdirSync(path.join(root, 'capabilities'), { recursive: true });
  mkdirSync(caller);
  const registry = {
    greet: { id: 'greet', type: 'task', action: 'greet', preconditions: [], effects: ['greeted'],
      inputs: { name: '$inputs.name', region: '$inputs.region' },
      binding: { protocol: 'node', module: './capabilities/greet.mjs', function: 'execute',
        outputs: { message: { from: 'result', path: 'message' } } } },
    other: { id: 'other', type: 'task', action: 'other', preconditions: [], effects: ['otherDone'],
      inputs: {}, binding: { protocol: 'node', module: './capabilities/other.mjs', function: 'execute' } }
  };
  for (const [file, value] of Object.entries({
    'registry.json': registry,
    'worldstate.json': {},
    'inputs.json': { name: 'Configured', region: 'US' },
    'goal.json': { goal: 'greeted' }
  })) writeFileSync(path.join(config, file), JSON.stringify(value));
  writeFileSync(path.join(root, 'capabilities/greet.mjs'), 'export async function execute({name,region}) { return {message:`${name}:${region}`}; }\n');
  writeFileSync(path.join(root, 'capabilities/other.mjs'), 'export async function execute() { return {}; }\n');
  process.chdir(caller);
  const run = (options = {}) => runGrailWorld({ worldRoot: root, configDir: 'settings', ...options });
  const message = result => result.observations.find(o => o.invocation.affordance === 'greet')?.outputs?.message;
  const configured = await run();
  assert.equal(configured.reached, true);
  assert.equal(message(configured), 'Configured:US');
  const overridden = await run({ inputs: { name: 'Caller' } });
  assert.equal(message(overridden), 'Caller:US');
  const replaced = await run({ inputs: { name: 'Only' }, inputMode: 'replace' });
  assert.equal(replaced.reached, false);
  const emptyReplace = await run({ inputs: {}, inputMode: 'replace' });
  assert.equal(emptyReplace.reached, false);
  const omittedReplace = await run({ inputMode: 'replace' });
  assert.equal(message(omittedReplace), 'Configured:US');
  const alternateGoal = await run({ goal: 'otherDone' });
  assert.equal(alternateGoal.reached, true);
  assert.equal(alternateGoal.goal, 'otherDone');
  assert.equal(alternateGoal.observations[0].invocation.affordance, 'other');
  const defaultLayout = path.join(root, 'config');
  mkdirSync(defaultLayout);
  for (const [file, value] of Object.entries({
    'registry.json': registry, 'worldstate.json': {},
    'inputs.json': { name: 'Default', region: 'EU' }, 'goal.json': { goal: 'greeted' }
  })) writeFileSync(path.join(defaultLayout, file), JSON.stringify(value));
  assert.equal(message(await runGrailWorld({ worldRoot: root })), 'Default:EU');
  await assert.rejects(() => run({ inputMode: 'append' }), /inputMode/);
  await assert.rejects(() => run({ inputs: null }), /inputs/);
  await assert.rejects(() => runGrailWorld(), /worldRoot/);
  assert.equal(process.cwd(), caller);
  console.log('runGrailWorld API regression passed.');
} finally {
  process.chdir(originalCwd);
  rmSync(temp, { recursive: true, force: true });
}

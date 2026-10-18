import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Grail, loadEnvironment } from '../../index.js';

const originalCwd = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'grail-portability-'));
const world = path.join(temp, 'arbitrary-location', 'node-world');
const stdioWorld = path.join(temp, 'other-location', 'stdio-world');
const parentWorld = path.join(temp, 'parent-location', 'parent-world');
const unrelated = path.join(temp, 'unrelated-caller');

function makeWorld(root, registry, goal, files) {
  mkdirSync(path.join(root, 'config'), { recursive: true });
  mkdirSync(path.join(root, 'capabilities'), { recursive: true });
  writeFileSync(path.join(root, 'config', 'registry.json'), JSON.stringify(registry));
  writeFileSync(path.join(root, 'config', 'worldstate.json'), '{}');
  writeFileSync(path.join(root, 'config', 'inputs.json'), '{"name":"Portable"}');
  writeFileSync(path.join(root, 'config', 'goal.json'), JSON.stringify({ goal }));
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(path.join(root, 'capabilities', name), source);
  }
}
function run(root, { passBaseDir = true } = {}) {
  const env = loadEnvironment(path.join(root, 'config'));
  const grail = new Grail({
    registry: env.registry, worldstate: env.worldstate, inputs: env.inputs,
    ...(passBaseDir ? { baseDir: env.baseDir } : {})
  });
  return grail.pursue(env.goal);
}

try {
  mkdirSync(unrelated, { recursive: true });
  makeWorld(world, {
    hello: { id: 'aff-hello', type: 'task', action: 'hello', preconditions: [], effects: ['nodeDone'],
      inputs: { name: '$inputs.name' },
      binding: { protocol: 'node', module: './capabilities/hello.mjs', function: 'execute',
        outputs: { message: { from: 'result', path: 'message' } } } }
  }, 'nodeDone', { 'hello.mjs': 'export async function execute({name}) { return {message:`Hello ${name}`}; }\n' });
  makeWorld(stdioWorld, {
    hello: { id: 'aff-hello', type: 'task', action: 'hello', preconditions: [], effects: ['stdioDone'],
      inputs: { name: '$inputs.name' },
      binding: { protocol: 'stdio', command: process.execPath, args: ['./capabilities/hello.mjs'],
        outputs: { message: { from: 'stdout', path: 'message' } } } }
  }, 'stdioDone', { 'hello.mjs': 'let data=""; for await (const chunk of process.stdin) data += chunk; process.stdout.write(JSON.stringify({message:`Hello ${JSON.parse(data).name}`}));\n' });

  const apiUrl = pathToFileURL(path.resolve('index.js')).href;
  makeWorld(parentWorld, {
    child: { id: 'aff-child', type: 'task', action: 'child', preconditions: [], effects: ['nestedDone'], inputs: {},
      binding: { protocol: 'node', module: './capabilities/child.mjs', function: 'execute' } }
  }, 'nestedDone', { 'child.mjs': `import { Grail, loadEnvironment } from ${JSON.stringify(apiUrl)};
export async function execute() {
  const env = loadEnvironment(${JSON.stringify(path.join(world, 'config'))});
  const child = new Grail({ registry: env.registry, worldstate: env.worldstate, inputs: env.inputs, baseDir: env.baseDir });
  const result = await child.pursue(env.goal);
  if (!result.reached) throw new Error('Child pursuit failed');
  return { childReached: result.reached };
}\n` });

  // A different process cwd must not affect any binding's local paths.
  process.chdir(unrelated);
  for (const [label, root] of [['Node', world], ['STDIO', stdioWorld], ['nested', parentWorld]]) {
    const result = await run(root);
    assert.equal(result.reached, true, `${label} world must reach its goal from unrelated cwd`);
    assert.equal(result.observations.at(-1)?.result, 'SUCCESS', `${label} must execute successfully`);
    assert.equal(process.cwd(), unrelated, `${label} must not change cwd`);
  }

  // Document the current API limitation: omitting baseDir falls back to process.cwd().
  const withoutBaseDir = await run(world, { passBaseDir: false });
  assert.equal(withoutBaseDir.reached, false, 'Node binding without baseDir currently fails from unrelated cwd');
  assert.equal(withoutBaseDir.observations.at(-1)?.result, 'FAIL');
  assert.equal(process.cwd(), unrelated);
  console.log('World root portability regression passed (including documented missing-baseDir behavior).');
} finally {
  process.chdir(originalCwd);
  rmSync(temp, { recursive: true, force: true });
}

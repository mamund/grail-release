import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Grail } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configDir = path.join(rootDir, 'config');

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(configDir, filename), 'utf8'));
}

const registry = loadJson('registry.json');
const worldstate = loadJson('worldstate.json');
const inputs = loadJson('inputs.json');
const goal = loadJson('goal.json');

const grail = new Grail({
  registry,
  worldstate,
  inputs
});

const result = await grail.pursue(goal.goal);

assert.equal(result.reached, true, 'GRAIL should reach the requested goal');
assert.equal(result.goal, goal.goal, 'Result should report the requested goal');
assert.equal(result.worldstate[goal.goal], true, `Worldstate should contain ${goal.goal}=true`);
assert.ok(result.observations.length > 0, 'GRAIL should record at least one observation');

const successfulStdio = result.observations.find(
  observation =>
    observation.invocation?.command === 'python3' &&
    observation.response?.exitCode === 0 &&
    observation.result === 'SUCCESS'
);

assert.ok(successfulStdio, 'The stdio capability should execute successfully');
assert.equal(successfulStdio.outputs?.message, 'Hello, Mike!', 'The stdio capability should return the expected greeting');

console.log('Smoke test passed.');

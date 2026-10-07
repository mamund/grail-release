import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Grail, loadEnvironment } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configDir = path.join(rootDir, 'config');

const environment = loadEnvironment(configDir);

const grail = new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs
});

const result = await grail.pursue(environment.goal);

assert.equal(result.reached, true, 'GRAIL should reach the requested goal');
assert.equal(result.goal, environment.goal, 'Result should report the requested goal');
assert.equal(result.worldstate[environment.goal], true, `Worldstate should contain ${environment.goal}=true`);
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

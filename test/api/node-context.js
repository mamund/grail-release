import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-node-context-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  await writeFile(path.join(root, 'capability.js'), `
export async function inspect(inputs, context) {
  return { name: inputs.name, pursuitId: context.pursuitId, invocationId: context.invocationId };
}
`);
  const grail = new Grail({
    registry: {
      inspect: {
        action: 'inspect', preconditions: [], effects: ['inspected'],
        inputs: { name: '$inputs.name' },
        binding: {
          protocol: 'node', module: './capability.js', function: 'inspect',
          outputs: { name: { from: 'result', path: 'name' } }
        }
      }
    },
    worldstate: {}, inputs: { name: 'World' }, baseDir: root
  });
  const first = await grail.pursue('inspected');
  assert.equal(first.reached, true);
  const observation = first.observations[0];
  assert.equal(observation.response.result.name, 'World');
  assert.equal(observation.response.result.pursuitId, first.pursuitId);
  assert.equal(observation.response.result.invocationId, observation.invocation.id);
  assert.equal(observation.outputs.name, 'World');
  const second = await grail.pursue('inspected');
  assert.notEqual(second.pursuitId, first.pursuitId);
  assert.notEqual(second.observations[0].invocation.id, observation.invocation.id);
  assert.equal(second.observations[0].response.result.pursuitId, second.pursuitId);
  assert.equal(second.observations[0].response.result.invocationId, second.observations[0].invocation.id);
  console.log('Node execution context test passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

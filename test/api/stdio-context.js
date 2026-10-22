import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-stdio-context-'));
const priorPursuit = process.env.GRAIL_PURSUIT_ID;
const priorInvocation = process.env.GRAIL_INVOCATION_ID;
try {
  await writeFile(path.join(root, 'probe.mjs'), `
let input = '';
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify({
  input: JSON.parse(input),
  pursuitId: process.env.GRAIL_PURSUIT_ID,
  invocationId: process.env.GRAIL_INVOCATION_ID,
  inherited: process.env.GRAIL_CONTEXT_TEST_MARKER
}));
`);
  process.env.GRAIL_CONTEXT_TEST_MARKER = 'preserved';
  const grail = new Grail({
    registry: {
      inspect: {
        action: 'inspect', preconditions: [], effects: ['inspected'],
        inputs: { name: '$inputs.name' },
        binding: {
          protocol: 'stdio', command: process.execPath, args: ['probe.mjs'],
          outputs: { name: { from: 'stdout', path: 'input.name' } }
        }
      }
    },
    worldstate: {}, inputs: { name: 'World' }, baseDir: root
  });
  const first = await grail.pursue('inspected');
  assert.equal(first.reached, true);
  const observation = first.observations[0];
  assert.deepEqual(observation.response.stdout.input, { name: 'World' });
  assert.equal(observation.response.stdout.pursuitId, first.pursuitId);
  assert.equal(observation.response.stdout.invocationId, observation.invocation.id);
  assert.equal(observation.response.stdout.inherited, 'preserved');
  assert.equal(observation.outputs.name, 'World');
  const second = await grail.pursue('inspected');
  assert.notEqual(second.pursuitId, first.pursuitId);
  assert.notEqual(second.observations[0].invocation.id, observation.invocation.id);
  assert.equal(second.observations[0].response.stdout.pursuitId, second.pursuitId);
  assert.equal(second.observations[0].response.stdout.invocationId, second.observations[0].invocation.id);
  assert.equal(process.env.GRAIL_PURSUIT_ID, priorPursuit);
  assert.equal(process.env.GRAIL_INVOCATION_ID, priorInvocation);
  console.log('STDIO execution context test passed.');
} finally {
  delete process.env.GRAIL_CONTEXT_TEST_MARKER;
  await rm(root, { recursive: true, force: true });
}

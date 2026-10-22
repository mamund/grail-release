import assert from 'node:assert/strict';
import { validateConfig } from '../../utils/validateWithSchema.js';

const base = {
  id: 'test', action: 'test', type: 'task', preconditions: [], inputs: {}, effects: ['done']
};
const bindings = {
  node: { protocol: 'node', module: './missing.mjs', function: 'forward' },
  http: { protocol: 'http', method: 'POST', url: 'https://example.invalid/forward' },
  stdio: { protocol: 'stdio', command: 'missing-executable' }
};
function check(binding, valid = true) {
  const registry = { test: { ...base, binding } };
  if (valid) assert.equal(validateConfig(registry, 'registry.schema.json', 'test', { silent: true }), true);
  else assert.throws(() => validateConfig(registry, 'registry.schema.json', 'test', { silent: true }), /Invalid test file/);
}
for (const binding of Object.values(bindings)) check(binding);
check({ ...bindings.node, recover: 'recoverForward' });
check({ ...bindings.node, recover: { module: './not-installed.mjs', function: 'undo' } });
check({ ...bindings.http, recover: { method: 'DELETE', url: 'https://example.invalid/undo' } });
check({ ...bindings.stdio, recover: { command: 'missing-undo', args: ['--undo'] } });
for (const invalid of ['', {}, { module: './undo.mjs' }, { module: '', function: 'undo' }, 42]) check({ ...bindings.node, recover: invalid }, false);
for (const invalid of [{ method: 'INVALID', url: 'https://example.invalid' }, { method: 'DELETE' }, { method: 'DELETE', url: '' }, 'undo']) check({ ...bindings.http, recover: invalid }, false);
for (const invalid of [{}, { command: '' }, { command: 'undo', args: [5] }, 'undo']) check({ ...bindings.stdio, recover: invalid }, false);
console.log('Recovery declaration schema test passed.');

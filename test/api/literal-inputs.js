import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Server } from '../../server.js';

const server = new Server({}, {}, {
  resolve(reference) {
    if (reference === '$outputs.validateSupplier.latest.valid') {
      return { resolved: true, value: false };
    }
    return { resolved: false };
  }
});

const inputs = { accountId: 'ACC-200', enabled: false, count: 0, nullable: null };

test('literal strings resolve unchanged', () => {
  assert.deepEqual(server.resolveInput('account', inputs), { resolved: true, value: 'account' });
});

test('existing input references resolve including false, zero and null', () => {
  for (const key of ['accountId', 'enabled', 'count', 'nullable']) {
    assert.deepEqual(server.resolveInput(`$inputs.${key}`, inputs), { resolved: true, value: inputs[key] });
  }
});

test('existing named output references resolve including false', () => {
  assert.deepEqual(server.resolveInput('$outputs.validateSupplier.latest.valid', inputs), { resolved: true, value: false });
});

test('missing and unsupported references remain unresolved', () => {
  for (const source of ['$inputs.missing', '$inputs.', '$outputs.missing.latest.valid', '$unknown.value']) {
    assert.deepEqual(server.resolveInput(source, inputs), { resolved: false });
  }
});

test('primitive literals are supported at resolver level', () => {
  for (const value of [12, 0, false, true, null]) {
    assert.deepEqual(server.resolveInput(value, inputs), { resolved: true, value });
  }
});

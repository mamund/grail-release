import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-http-'));
const calls = [];
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/recover/')) {
    calls.push({
      url: req.url, method: req.method,
      pursuitId: req.headers['grail-pursuit-id'],
      invocationId: req.headers['grail-invocation-id']
    });
    const outcome = req.url.split('/').pop();
    if (outcome === 'invalid') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('not json');
    } else if (outcome === 'http-error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: 'SUCCESS' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: outcome === 'success' ? 'SUCCESS' : 'FAIL' }));
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'caps.js'), `export async function fail() { throw new Error('forward failure'); }`);
  const forward = (outcome) => ({
    protocol: 'http', method: 'POST', url: `${base}/forward`,
    recover: { method: 'DELETE', url: `${base}/recover/${outcome}` }
  });
  const affordance = (action, effect, binding, preconditions = []) => ({
    action, effects: [effect], preconditions, inputs: {}, binding
  });
  const registry = {
    first: affordance('first', 'a', forward('success')),
    second: affordance('second', 'b', forward('fail'), ['a']),
    third: affordance('third', 'c', forward('invalid'), ['b']),
    fourth: affordance('fourth', 'd', forward('http-error'), ['c']),
    fifth: affordance('fifth', 'e', {
      protocol: 'node', module: './caps.js', function: 'fail'
    }, ['d'])
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });
  const result = await grail.pursue('e', { recover: true });
  assert.equal(result.reached, false);
  assert.deepEqual(result.recovery, { enabled: true, attempted: true, recovered: 1, failed: 3, skipped: 0 });
  assert.deepEqual(calls.map(c => c.url), [
    '/recover/http-error', '/recover/invalid', '/recover/fail', '/recover/success'
  ]);
  assert.ok(calls.every(c => c.method === 'DELETE'));
  assert.ok(calls.every(c => c.pursuitId === result.pursuitId));
  assert.deepEqual(calls.map(c => c.invocationId),
    result.observations.slice(0, 4).reverse().map(o => o.invocation.id));
  assert.equal(result.observations.filter(o => o.phase === 'recovery').length, 4);
  const disabled = await grail.pursue('e');
  assert.equal(Object.hasOwn(disabled, 'recovery'), false);
  assert.equal(calls.length, 4, 'Disabled recovery makes no recovery requests');
  console.log('HTTP recovery regression passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}

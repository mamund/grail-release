import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Grail } from '../../grail.js';

const received = [];
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  received.push({
    headers: req.headers,
    body: Buffer.concat(chunks).toString(),
    url: req.url,
    method: req.method
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ accepted: true }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}/accept`;
  for (const mapped of [false, true]) {
    const grail = new Grail({
      registry: {
        send: {
          action: 'send', preconditions: [], effects: ['sent'],
          inputs: { name: '$inputs.name', custom: '$inputs.custom' },
          binding: {
            protocol: 'http', method: 'POST', url,
            ...(mapped ? { parameters: {
              name: { in: 'body', name: 'name' },
              custom: { in: 'header', name: 'X-Custom' }
            }} : {}),
            outputs: { accepted: { from: 'body', path: 'accepted' } }
          }
        }
      },
      worldstate: {}, inputs: { name: 'World', custom: 'preserved' }
    });
    const result = await grail.pursue('sent');
    assert.equal(result.reached, true);
    const observation = result.observations[0];
    const request = received.at(-1);
    assert.equal(request.headers['grail-pursuit-id'], result.pursuitId);
    assert.equal(request.headers['grail-invocation-id'], observation.invocation.id);
    assert.equal(observation.invocation.request.headers['Grail-Pursuit-Id'], result.pursuitId);
    assert.equal(observation.invocation.request.headers['Grail-Invocation-Id'], observation.invocation.id);
    assert.equal(observation.outputs.accepted, true);
    if (mapped) {
      assert.equal(request.headers['x-custom'], 'preserved');
      assert.deepEqual(JSON.parse(request.body), { name: 'World' });
    } else {
      assert.deepEqual(JSON.parse(request.body), { name: 'World', custom: 'preserved' });
    }
  }
  assert.notEqual(received[0].headers['grail-pursuit-id'], received[1].headers['grail-pursuit-id']);
  assert.notEqual(received[0].headers['grail-invocation-id'], received[1].headers['grail-invocation-id']);
  console.log('HTTP execution context test passed.');
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Grail } from '../../grail.js';

const root = await mkdtemp(path.join(tmpdir(), 'grail-recovery-stdio-'));
try {
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'forward.mjs'), `
process.stdin.resume();
let input = '';
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify({ result: 'SUCCESS' }));
`);
  await writeFile(path.join(root, 'fail.mjs'), `throw new Error('expected forward failure');`);
  await writeFile(path.join(root, 'recover.mjs'), `
import { appendFile } from 'node:fs/promises';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const ids = JSON.parse(input);
await appendFile(${JSON.stringify(path.join(root, 'calls.txt'))}, JSON.stringify({ ...ids, mode: process.argv[2] }) + '\\n');
if (process.argv[2] === 'exit') process.exit(2);
if (process.argv[2] === 'invalid') process.stdout.write('invalid json');
else if (process.argv[2] === 'fail') process.stdout.write(JSON.stringify({ result: 'FAIL' }));
else process.stdout.write(JSON.stringify({ result: 'SUCCESS' }));
`);
  const binding = mode => ({
    protocol: 'stdio', command: process.execPath, args: ['./forward.mjs'],
    recover: { command: process.execPath, args: ['./recover.mjs', mode] }
  });
  const affordance = (action, effect, b, preconditions = []) => ({ action, effects: [effect], preconditions, inputs: {}, binding: b });
  const registry = {
    a: affordance('a', 'a', binding('success')),
    b: affordance('b', 'b', binding('fail'), ['a']),
    c: affordance('c', 'c', binding('invalid'), ['b']),
    d: affordance('d', 'd', binding('exit'), ['c']),
    e: affordance('e', 'e', { protocol: 'stdio', command: process.execPath, args: ['./fail.mjs'] }, ['d'])
  };
  const grail = new Grail({ registry, worldstate: {}, baseDir: root });
  const result = await grail.pursue('e', { recover: true });
  assert.equal(result.reached, false);
  assert.ok(result.recovery.durationMs >= 0);
  assert.deepEqual((({ durationMs, ...counts }) => counts)(result.recovery), { enabled: true, attempted: true, recovered: 1, failed: 3, skipped: 0 });
  const calls = (await readFile(path.join(root, 'calls.txt'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map(c => c.mode), ['exit', 'invalid', 'fail', 'success']);
  assert.ok(calls.every(c => c.pursuitId === result.pursuitId));
  assert.deepEqual(calls.map(c => c.invocationId), result.observations.slice(0, 4).reverse().map(o => o.invocation.id));
  assert.equal(result.observations.filter(o => o.phase === 'recovery').length, 4);
  const disabled = await grail.pursue('e');
  assert.equal(Object.hasOwn(disabled, 'recovery'), false);
  assert.equal((await readFile(path.join(root, 'calls.txt'), 'utf8')).trim().split('\n').length, 4);
  console.log('STDIO recovery regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

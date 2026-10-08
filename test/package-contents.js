import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 30000,
});
const [pkg] = JSON.parse(output);
const names = new Set(pkg.files.map(file => file.path));
const required = [
  'package.json', 'index.js', 'grail.js', 'client.js', 'server.js',
  'cli/grail-cli.js', 'config-loader/loadEnvironment.js',
  'schemas/registry.schema.json', 'bindings/stdioBinding.js',
  'docs/ENVIRONMENT.md', 'examples/cli-tour/README.md',
  'examples/cli-tour/config/registry.json',
  'examples/cli-tour/capabilities/hello.js',
];
for (const name of required) assert(names.has(name), `Missing from npm package: ${name}`);
for (const name of names) {
  assert(!name.startsWith('test/'), `Development test included: ${name}`);
  assert(!name.startsWith('capabilities/'), `Development fixture included: ${name}`);
  assert(!name.startsWith('config/'), `Development config included: ${name}`);
  assert(!name.endsWith('.tgz'), `Nested tarball included: ${name}`);
}
console.log(`Package contents passed (${names.size} files).`);

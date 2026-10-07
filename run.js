import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grail, loadEnvironment } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configDir = path.join(__dirname, 'config');

const environment = loadEnvironment(configDir);

const grail = new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs,
  observationPath: path.join(configDir, 'observations.json')
});

await grail.pursue(environment.goal);

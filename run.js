import path from 'path';
import { fileURLToPath } from 'url';
import { loadAndValidateJSON } from './utils/loadJSON.js';
import { Grail } from './index.js';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to config files
const configDir = path.join(__dirname, 'config');

// Load configs
const inputs = loadAndValidateJSON(
  path.join(configDir, 'inputs.json'),
  'inputs.schema.json'
);

const registry = loadAndValidateJSON(
  path.join(configDir, 'registry.json'),
  'registry.schema.json'
);

const worldstate = loadAndValidateJSON(
  path.join(configDir, 'worldstate.json'),
  'worldstate.schema.json'
);

const goalObj = loadAndValidateJSON(
  path.join(configDir, 'goal.json'),
  'goal.schema.json'
);

const grail = new Grail({
  registry,
  worldstate,
  inputs,
  observationPath: path.join(configDir, 'observations.json')
});

await grail.pursue(goalObj.goal);

import path from 'node:path';
import { loadAndValidateJSON } from '../utils/loadJSON.js';

/**
 * Load and validate a GRAIL environment from a configuration directory.
 *
 * Filesystem loading belongs outside the runtime itself. The returned object
 * can be passed directly to Grail; the goal is returned alongside the runtime
 * configuration for the caller to pursue explicitly.
 *
 * @param {string} configDir - Directory containing the GRAIL JSON files.
 * @returns {{registry: object, worldstate: object, inputs: object, goal: string}}
 */
export function loadEnvironment(configDir) {
  if (!configDir) {
    throw new Error('loadEnvironment requires a config directory.');
  }

  const resolvedConfigDir = path.resolve(configDir);

  const inputs = loadAndValidateJSON(
    path.join(resolvedConfigDir, 'inputs.json'),
    'inputs.schema.json'
  );

  const registry = loadAndValidateJSON(
    path.join(resolvedConfigDir, 'registry.json'),
    'registry.schema.json'
  );

  const worldstate = loadAndValidateJSON(
    path.join(resolvedConfigDir, 'worldstate.json'),
    'worldstate.schema.json'
  );

  const goalObj = loadAndValidateJSON(
    path.join(resolvedConfigDir, 'goal.json'),
    'goal.schema.json'
  );

  return {
    registry,
    worldstate,
    inputs,
    goal: goalObj.goal
  };
}

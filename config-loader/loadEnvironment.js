import fs from 'node:fs';
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
 * @returns {{registry: object, worldstate: object, inputs: object, goal: string, baseDir: string}}
 */
export function loadEnvironment(configDir) {
  if (!configDir) {
    throw new Error('Configuration error: no configuration directory was provided.');
  }

  const resolvedConfigDir = path.resolve(configDir);

  if (!fs.existsSync(resolvedConfigDir)) {
    throw new Error(`Configuration error: directory not found: ${resolvedConfigDir}`);
  }

  if (!fs.statSync(resolvedConfigDir).isDirectory()) {
    throw new Error(`Configuration error: not a directory: ${resolvedConfigDir}`);
  }

  const loadConfig = (filename, schemaName) => {
    const filePath = path.join(resolvedConfigDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration error: ${filename} not found in ${resolvedConfigDir}`);
    }

    try {
      return loadAndValidateJSON(filePath, schemaName, { silent: true });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Configuration error: invalid JSON in ${filename}: ${error.message}`);
      }

      if (error.validationErrors) {
        const details = error.validationErrors
          .map(validationError => {
            const location = validationError.instancePath || '/';
            return `${location} ${validationError.message}`;
          })
          .join('; ');

        throw new Error(`Configuration error: ${filename} failed schema validation: ${details}`);
      }

      throw error;
    }
  };

  const inputs = loadConfig('inputs.json', 'inputs.schema.json');
  const registry = loadConfig('registry.json', 'registry.schema.json');
  const worldstate = loadConfig('worldstate.json', 'worldstate.schema.json');
  const goalObj = loadConfig('goal.json', 'goal.schema.json');

  return {
    registry,
    worldstate,
    inputs,
    goal: goalObj.goal,
    baseDir: path.dirname(resolvedConfigDir)
  };
}

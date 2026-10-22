import path from 'node:path';
import { Grail } from './grail.js';
import { loadEnvironment } from './config-loader/loadEnvironment.js';

/**
 * Pursue a goal in a portable GRAIL world.
 *
 * `worldRoot` identifies the world directory; `configDir` is relative to that
 * root unless absolute. Omitted inputs use inputs.json. Supplied inputs either
 * override matching configured keys (default) or replace them entirely.
 * No files or process-wide working directory are changed.
 */
export async function runGrailWorld({
  worldRoot,
  configDir = 'config',
  goal,
  inputs,
  inputMode = 'override',
  recover = false
} = {}) {
  if (typeof worldRoot !== 'string' || !worldRoot.trim()) {
    throw new Error('runGrailWorld requires a non-empty worldRoot.');
  }
  if (typeof configDir !== 'string' || !configDir.trim()) {
    throw new Error('runGrailWorld requires a non-empty configDir.');
  }
  if (inputMode !== 'override' && inputMode !== 'replace') {
    throw new Error('inputMode must be "override" or "replace".');
  }
  if (inputs !== undefined && (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs))) {
    throw new Error('inputs must be a plain object when supplied.');
  }
  if (goal !== undefined && (typeof goal !== 'string' || !goal.trim())) {
    throw new Error('goal must be a non-empty string when supplied.');
  }

  const root = path.resolve(worldRoot);
  const configPath = path.resolve(root, configDir);
  const environment = loadEnvironment(configPath);
  const effectiveInputs = inputs === undefined
    ? { ...environment.inputs }
    : inputMode === 'replace'
      ? { ...inputs }
      : { ...environment.inputs, ...inputs };

  const grail = new Grail({
    registry: structuredClone(environment.registry),
    worldstate: structuredClone(environment.worldstate),
    inputs: effectiveInputs,
    baseDir: root,
    recover
  });
  return grail.pursue(goal ?? environment.goal);
}

#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
);

function showHelp() {
  console.log(`GRAIL

Usage:
  grail <command> [options]

Commands:
  run        Run a GRAIL environment
  validate   Validate a GRAIL environment

Options:
  --config <directory>   Configuration directory (default: ./config)
  --help, -h             Show help
  --version, -v          Show version

Examples:
  grail validate --config ./config
  grail run --config ./config`);
}

function showCommandHelp(command) {
  if (command === 'run') {
    console.log(`GRAIL run

Usage:
  grail run [--config <directory>]

Runs the goal declared by the GRAIL environment.

Options:
  --config <directory>   Configuration directory (default: ./config)
  --help, -h             Show help`);
    return;
  }

  if (command === 'validate') {
    console.log(`GRAIL validate

Usage:
  grail validate [--config <directory>]

Loads and validates the GRAIL environment without running it.

Options:
  --config <directory>   Configuration directory (default: ./config)
  --help, -h             Show help`);
  }
}

function parseConfig(args) {
  let configDir = './config';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--config') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--config requires a directory.');
      }
      configDir = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      const value = arg.slice('--config='.length);
      if (!value) throw new Error('--config requires a directory.');
      configDir = value;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return path.resolve(configDir);
}

async function runCommand(args) {
  if (args.includes('--help') || args.includes('-h')) {
    showCommandHelp('run');
    return;
  }

  const { Grail, loadEnvironment } = await import('../index.js');
  const configDir = parseConfig(args);
  const environment = loadEnvironment(configDir);

  const grail = new Grail({
    registry: environment.registry,
    worldstate: environment.worldstate,
    inputs: environment.inputs,
    observationPath: path.join(configDir, 'observations.json')
  });

  await grail.pursue(environment.goal);
}

async function validateCommand(args) {
  if (args.includes('--help') || args.includes('-h')) {
    showCommandHelp('validate');
    return;
  }

  const { loadEnvironment } = await import('../index.js');
  const configDir = parseConfig(args);
  loadEnvironment(configDir);
  console.log(`VALID: ${configDir}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(packageJson.version);
    return;
  }

  const [command, ...commandArgs] = args;

  if (command === 'run') {
    await runCommand(commandArgs);
    return;
  }

  if (command === 'validate') {
    await validateCommand(commandArgs);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => {
  console.error(`GRAIL: ${error.message}`);
  process.exitCode = 1;
});

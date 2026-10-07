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
  init       Create a runnable GRAIL world
  run        Run a GRAIL environment
  validate   Validate a GRAIL environment

Options:
  --config <directory>   Configuration directory (default: ./config)
  --help, -h             Show help
  --version, -v          Show version

Examples:
  grail init my-world
  grail validate --config ./config
  grail run --config ./config`);
}

function showCommandHelp(command) {

  if (command === 'init') {
    console.log(`GRAIL init

Usage:
  grail init <directory>

Creates a complete, runnable GRAIL world.

Example:
  grail init my-world`);
    return;
  }

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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function initCommand(args) {
  if (args.includes('--help') || args.includes('-h')) {
    showCommandHelp('init');
    return;
  }

  if (args.length !== 1 || args[0].startsWith('-')) {
    throw new Error('Usage: grail init <directory>');
  }

  const targetDir = path.resolve(args[0]);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Target already exists: ${targetDir}`);
  }

  const configDir = path.join(targetDir, 'config');
  const capabilitiesDir = path.join(targetDir, 'capabilities');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(capabilitiesDir, { recursive: true });

  writeJson(path.join(configDir, 'registry.json'), {
    createGreeting: {
      id: 'aff-create-greeting',
      action: 'createGreeting',
      type: 'task',
      preconditions: [],
      inputs: {
        name: '$inputs.name'
      },
      effects: ['greetingCreated'],
      binding: {
        protocol: 'node',
        module: './capabilities/hello.js',
        function: 'createGreeting',
        outputs: {
          message: {
            from: 'result',
            path: 'message'
          }
        }
      }
    }
  });

  writeJson(path.join(configDir, 'worldstate.json'), {
    greetingCreated: false
  });

  writeJson(path.join(configDir, 'inputs.json'), {
    name: 'World'
  });

  writeJson(path.join(configDir, 'goal.json'), {
    goal: 'greetingCreated'
  });

  fs.writeFileSync(
    path.join(capabilitiesDir, 'hello.js'),
    `export async function createGreeting({ name }) {\n  return {\n    message: \`Hello, \${name}!\`\n  };\n}\n`,
    'utf8'
  );

  console.log(`Created GRAIL world: ${args[0]}\n\n  config/registry.json\n  config/worldstate.json\n  config/inputs.json\n  config/goal.json\n  capabilities/hello.js\n\nNext:\n\n  cd ${args[0]}\n  grail validate\n  grail run`);
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

  if (command === 'init') {
    initCommand(commandArgs);
    return;
  }

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

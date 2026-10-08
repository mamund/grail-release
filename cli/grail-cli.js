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
  show       Display validated configuration
  validate   Validate a GRAIL environment

Options:
  --config <directory>   Configuration directory (default: ./config)
  --goal <effect>        Override the configured goal (run only)
  --inputs <json>        Override inputs with a JSON object (run only)
  --inputs-file <file>   Override inputs from a JSON file (run only)
  --help, -h             Show help
  --version, -v          Show version

Examples:
  grail init my-world
  grail validate --config ./config
  grail show registry
  grail run --config ./config
  grail run --config ./config --goal greetingCreated
  grail run --config ./config --inputs '{"name":"Mike"}'
  grail run --config ./config --inputs-file ./cases/mike.json`);
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
  grail run [--config <directory>] [--goal <effect>] [--inputs <json> | --inputs-file <file>]

Runs the goal declared by the GRAIL environment, with optional invocation-specific goal and input overrides.

Options:
  --config <directory>   Configuration directory (default: ./config)
  --goal <effect>        Override the goal declared in goal.json for this run
  --inputs <json>        Replace inputs.json for this run with an inline JSON object
  --inputs-file <file>   Replace inputs.json for this run with a JSON file
  --help, -h             Show help`);
    return;
  }

  if (command === 'show') {
    console.log(`GRAIL show

Usage:
  grail show [registry|worldstate|inputs|goal] [--config <directory>]

Displays validated configuration as formatted JSON without executing capabilities.
Without a target, displays all four configuration documents.

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
        const error = new Error('--config requires a directory.');
        error.hint = 'Run \"grail run --help\" or \"grail validate --help\" for usage.';
        throw error;
      }
      configDir = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      const value = arg.slice('--config='.length);
      if (!value) {
        const error = new Error('--config requires a directory.');
        error.hint = 'Run \"grail run --help\" or \"grail validate --help\" for usage.';
        throw error;
      }
      configDir = value;
      continue;
    }

    const error = new Error(`Unknown option: ${arg}`);
    error.hint = 'Run the command with --help for supported options.';
    throw error;
  }

  return path.resolve(configDir);
}

function parseRunOptions(args) {
  let configDir = './config';
  let goal;
  let inputs;
  let inputsFile;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--config') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        const error = new Error('--config requires a directory.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      configDir = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      const value = arg.slice('--config='.length);
      if (!value) {
        const error = new Error('--config requires a directory.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      configDir = value;
      continue;
    }

    if (arg === '--goal') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        const error = new Error('--goal requires an effect.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      goal = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--goal=')) {
      const value = arg.slice('--goal='.length);
      if (!value) {
        const error = new Error('--goal requires an effect.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      goal = value;
      continue;
    }

    if (arg === '--inputs') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        const error = new Error('--inputs requires a JSON object.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      inputs = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--inputs=')) {
      const value = arg.slice('--inputs='.length);
      if (!value) {
        const error = new Error('--inputs requires a JSON object.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      inputs = value;
      continue;
    }

    if (arg === '--inputs-file') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        const error = new Error('--inputs-file requires a file.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      inputsFile = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--inputs-file=')) {
      const value = arg.slice('--inputs-file='.length);
      if (!value) {
        const error = new Error('--inputs-file requires a file.');
        error.hint = 'Run "grail run --help" for usage.';
        throw error;
      }
      inputsFile = value;
      continue;
    }

    const error = new Error(`Unknown option: ${arg}`);
    error.hint = 'Run "grail run --help" for supported options.';
    throw error;
  }

  if (inputs !== undefined && inputsFile !== undefined) {
    const error = new Error('--inputs and --inputs-file cannot be used together.');
    error.hint = 'Run "grail run --help" for usage.';
    throw error;
  }

  return { configDir: path.resolve(configDir), goal, inputs, inputsFile };
}

function parseInputsJson(value, source) {
  let parsed;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${error.message}`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${source} must contain a JSON object.`);
  }

  return parsed;
}

function loadInputsFile(file) {
  const filePath = path.resolve(file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Inputs file not found: ${filePath}`);
  }

  if (!fs.statSync(filePath).isFile()) {
    throw new Error(`Inputs file is not a file: ${filePath}`);
  }

  return parseInputsJson(fs.readFileSync(filePath, 'utf8'), `inputs file ${filePath}`);
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
  const {
    configDir,
    goal: goalOverride,
    inputs: inputsOverride,
    inputsFile
  } = parseRunOptions(args);
  const environment = loadEnvironment(configDir);
  const goal = goalOverride ?? environment.goal;
  const inputs = inputsOverride !== undefined
    ? parseInputsJson(inputsOverride, '--inputs')
    : inputsFile !== undefined
      ? loadInputsFile(inputsFile)
      : environment.inputs;

  const grail = new Grail({
    registry: environment.registry,
    worldstate: environment.worldstate,
    inputs,
    baseDir: environment.baseDir,
    observationPath: path.join(configDir, 'observations.json')
  });

  try {
    const result = await grail.pursue(goal);

    if (!result.reached) {
      const failedObservation = [...result.observations]
        .reverse()
        .find(observation => observation.result === 'FAIL');

      if (failedObservation) {
        const detail =
          failedObservation.response?.error ||
          failedObservation.response?.stderr ||
          'a capability invocation failed';

        console.error(
          `GRAIL: Execution failed while pursuing goal \"${goal}\": ${detail}`
        );
      } else {
        console.error(
          `GRAIL: Pursuit failed: goal \"${goal}\" cannot be resolved with the available capabilities.`
        );
      }

      process.exitCode = 1;
    }
  } catch (error) {
    error.exitCode = 1;
    throw error;
  }
}

async function showCommand(args) {
  if (args.includes('--help') || args.includes('-h')) {
    showCommandHelp('show');
    return;
  }

  const targets = new Set(['registry', 'worldstate', 'inputs', 'goal']);
  let target;
  const configArgs = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--config') {
      configArgs.push(arg);
      if (i + 1 < args.length) configArgs.push(args[++i]);
    } else if (arg.startsWith('--config=')) {
      configArgs.push(arg);
    } else if (!arg.startsWith('-') && target === undefined) {
      target = arg;
    } else {
      const error = new Error(`Unknown option or extra argument: ${arg}`);
      error.hint = 'Run "grail show --help" for usage.';
      throw error;
    }
  }

  if (target !== undefined && !targets.has(target)) {
    const error = new Error(`Unknown show target: ${target}`);
    error.hint = 'Choose registry, worldstate, inputs, or goal.';
    throw error;
  }

  const { loadEnvironment } = await import('../index.js');
  const environment = loadEnvironment(parseConfig(configArgs));
  const documents = {
    registry: environment.registry,
    worldstate: environment.worldstate,
    inputs: environment.inputs,
    goal: { goal: environment.goal }
  };
  console.log(JSON.stringify(target ? documents[target] : documents, null, 2));
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

  if (command === 'show') {
    await showCommand(commandArgs);
    return;
  }

  if (command === 'validate') {
    await validateCommand(commandArgs);
    return;
  }

  const error = new Error(`Unknown command: ${command}`);
  error.hint = 'Run \"grail --help\" for available commands.';
  throw error;
}

main().catch(error => {
  console.error(`GRAIL: ${error.message}`);
  if (error.hint) {
    console.error(error.hint);
  }
  process.exitCode = error.exitCode ?? 2;
});

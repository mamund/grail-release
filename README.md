<img src="./images/grail-release-banner.png" />

GRAIL is a runtime for pursuing a declared goal within a bounded environment of available capabilities.

A GRAIL world describes the conditions that matter, the capabilities that can change those conditions, and the effects produced when those capabilities succeed. The runtime works from the goal and the current world state to determine what condition needs to change and which available affordance can change it.

The environment defines the possibilities. GRAIL pursues the goal without requiring a predefined workflow or execution path.

> Define the environment, not the path.

## Status

GRAIL is currently being prepared for beta release. The core runtime, configuration validation, Node/HTTP/stdio bindings, programmatic API, and initial CLI are working. Interfaces and package details may still change before the beta is declared stable.

## Quick start

During development, install the repository and expose the local CLI:

```bash
npm install
npm link
```

Create a runnable GRAIL world:

```bash
grail init my-world
cd my-world
grail validate
grail run
```

`grail init` creates a complete example using a small Node capability. A successful run pursues the generated `greetingCreated` goal and executes the capability needed to establish it.

## A GRAIL world

The generated world has this structure:

```text
my-world/
├── capabilities/
│   └── hello.mjs
└── config/
    ├── goal.json
    ├── inputs.json
    ├── registry.json
    └── worldstate.json
```

The four configuration documents have distinct responsibilities:

- `goal.json` declares the condition GRAIL is trying to establish.
- `worldstate.json` records the conditions that currently hold in the world.
- `inputs.json` supplies initial data available to capabilities.
- `registry.json` describes available affordances, their preconditions and effects, their inputs, and their executable bindings.

Executable domain behavior lives in capabilities. GRAIL remains opaque to the application domain.

## How pursuit works

Suppose the goal is:

```json
{
  "goal": "greetingCreated"
}
```

and the initial world contains:

```json
{
  "greetingCreated": false
}
```

The registry can expose an affordance whose effect is `greetingCreated`. GRAIL can select that affordance, resolve its inputs, invoke its bound capability, and apply the declared effect when execution succeeds.

Conceptually:

```text
goal
  ↓
inspect current world state
  ↓
select an unresolved condition
  ↓
select an affordance that can establish it
  ↓
resolve inputs and execute its capability
  ↓
apply effects on success
  ↓
continue until the goal is reached or cannot be resolved
```

The exact traversal is not encoded as a workflow. It emerges from the current conditions and the affordances available in the world.

## CLI

### `grail init`

Create a complete runnable world:

```bash
grail init my-world
```

GRAIL refuses to overwrite an existing target directory.

### `grail validate`

Load and validate a GRAIL environment without executing it:

```bash
grail validate
```

The default configuration directory is `./config`. A different directory can be supplied with:

```bash
grail validate --config ./path/to/config
```

### `grail show`

Inspect a validated GRAIL world without executing capabilities:

```bash
grail show
grail show registry
grail show worldstate
grail show inputs
grail show goal
grail show registry --config ./my-world/config
```

Without a target, `show` prints all four configuration documents as a single JSON object. With a target, it prints that document as formatted JSON. The entire environment must validate first, even when only one document is requested. `show` displays configured initial values, not the worldstate or observations from a previous run, and does not write files.

### `grail run`

Pursue the goal declared by an environment:

```bash
grail run
```

or:

```bash
grail run --config ./path/to/config
```

The CLI persists execution observations to `observations.json` in the selected configuration directory.

The goal and inputs declared by the environment can be overridden for a single invocation. A goal override takes precedence over `goal.json`:

```bash
grail run --config ./config --goal anotherGoal
```

Inputs can be supplied as an inline JSON object:

```bash
grail run --config ./config --inputs '{"name":"Mike"}'
```

or loaded from a JSON file:

```bash
grail run --config ./config --inputs-file ./cases/mike.json
```

To inspect results rather than the default execution trace, use `--output`:

```bash
grail run --output summary
grail run --output json
```

`summary` prints the goal, success or failure, capability invocation count, and captured outputs. `json` prints the complete pursuit result (`goal`, `reached`, `worldstate`, and `observations`) as valid JSON suitable for tools such as `jq`. Routine runtime trace messages are suppressed in these modes; errors still appear on stderr. Omitting `--output` preserves the existing trace. The option accepts both `--output json` and `--output=json`. Invalid modes exit with code `2`.

Input overrides replace the contents of `inputs.json` for that invocation; they are not merged with it. `--inputs` and `--inputs-file` are mutually exclusive. Neither goal nor input overrides modify the environment files on disk.

Relative binding paths are resolved from the GRAIL world root—the parent directory of the selected configuration directory—not from the shell's current working directory. This allows a world to be run from another directory without changing the paths declared by its bindings. Paths supplied with `--inputs-file`, however, are resolved relative to the caller's current working directory.

General CLI information is available with:

```bash
grail --help
grail --version
grail init --help
grail validate --help
grail run --help
```

### Exit codes

GRAIL uses process exit codes so CLI commands can be used reliably from shell scripts and other automation:

| Code | Meaning |
| ---: | --- |
| `0` | The command completed successfully. For `grail run`, the goal was reached. |
| `1` | GRAIL ran, but the pursuit or capability execution failed. |
| `2` | The command, configuration, or environment was invalid. |

For example, a caller can vary the inputs while GRAIL performs one independent pursuit for each invocation:

```bash
for input in ./cases/*.json
do
  grail run --config ./config --inputs-file "$input" || break
done
```

Iteration remains the responsibility of the caller; GRAIL pursues the selected goal once per invocation.

### Errors

CLI errors identify the kind of failure and provide relevant context. Typical messages include:

```text
GRAIL: Configuration error: ...
GRAIL: Execution failed while pursuing goal "...": ...
GRAIL: Pursuit failed: goal "..." cannot be resolved with the available capabilities.
```

Configuration and invocation errors exit with code `2`. Execution and pursuit failures exit with code `1`. Expected user errors are reported as concise CLI messages rather than uncaught stack traces.

## Command-line Tour

For a hands-on introduction to GRAIL, see [A Tour of GRAIL at the Command Line](./examples/cli-tour/README.md).

The tour uses a complete example world to explore:

- running and validating a GRAIL world
- overriding inputs from the command line or a file
- running a world from different filesystem locations
- pursuing different goals in the same world
- recognizing an unresolvable goal
- using exit codes and shell loops to compose GRAIL with other tools

The tour is designed to be run directly from the command line and includes all required capabilities, configuration, and sample inputs.

## Programmatic API

GRAIL can also be loaded as a module by another application or front end.

Load a filesystem-based environment and pursue its goal:

```javascript
import { Grail, loadEnvironment } from 'grail';

const environment = loadEnvironment('./config');

const grail = new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs
});

const result = await grail.pursue(environment.goal);

console.log(result.reached);
console.log(result.worldstate);
console.log(result.observations);
```

The `Grail` runtime itself does not require filesystem-backed observations. Observations are retained in memory by default. A caller can provide an `observationPath` when file persistence is wanted.

`pursue()` returns the pursued goal, whether it was reached, the resulting world state, and the observations collected during execution.

## Bindings

An affordance may be connected to an executable capability through a binding. The current runtime supports three protocols:

| Protocol | Purpose |
| --- | --- |
| `node` | Invoke a local JavaScript module and exported function. |
| `http` | Invoke a capability through HTTP. |
| `stdio` | Launch a local process, send JSON inputs on stdin, and consume JSON output from stdout. |

Bindings are adapters between GRAIL affordances and capability implementations. Goal pursuit does not depend on the implementation technology behind a capability.

## Execution results and observations

Bound capabilities reduce execution to GRAIL's runtime result model. Successful execution permits declared effects to be applied; failed execution does not.

Observations retain execution evidence such as invocation details, responses, extracted outputs, and the resulting execution status. This allows GRAIL to keep its runtime contract small while preserving useful diagnostic information.

## Validation and tests

Run the current automated test suite with:

```bash
npm test
```

The suite covers end-to-end goal pursuit through the public API, stdio execution and output handling, world-relative path resolution, goal and input invocation overrides, and CLI behavior including configuration errors, execution failures, pursuit failures, messages, and exit codes.

Tests run as independent suites with start/pass/fail reporting and a 30-second timeout per suite. The CLI regression tests are organized under `test/cli/` into commands, show, output, overrides, and errors. Run an individual suite directly, for example:

```bash
node test/cli/output.js
```

Each CLI subprocess also has a 15-second timeout so a hanging command fails with a useful error rather than blocking the entire suite.


## Design notes

Two documents in `docs/` provide additional architectural context:

- [What Is Not in the Agent Must Be in the Environment](./docs/ENVIRONMENT.md) discusses GRAIL's environment-first approach to bounded autonomy.
- [GRAIL Trust Model](./docs/grail-trust-model.md) describes the runtime's trust boundaries and the responsibilities retained by capabilities and the surrounding environment.

## Beta scope

The beta is centered on a small runtime and CLI for composing and executing GRAIL worlds. Current work is focused on hardening the public module boundary, CLI behavior, path semantics, error handling, package metadata, documentation, and regression coverage.

More advanced selection strategies, additional tooling, richer authoring experiences, and other execution features can build on this foundation without changing the basic model of goal pursuit through conditions, affordances, effects, and bound capabilities.

# GRAIL

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
│   └── hello.js
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

General CLI information is available with:

```bash
grail --help
grail --version
grail init --help
grail validate --help
grail run --help
```

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

Run the current end-to-end smoke test with:

```bash
npm test
```

The smoke test loads a validated environment through the public API, pursues its goal, executes a stdio capability, verifies its output, and confirms that the goal is reached.

## Design notes

Two documents in `docs/` provide additional architectural context:

- [What Is Not in the Agent Must Be in the Environment](./docs/ENVIRONMENT.md) discusses GRAIL's environment-first approach to bounded autonomy.
- [GRAIL Trust Model](./docs/grail-trust-model.md) describes the runtime's trust boundaries and the responsibilities retained by capabilities and the surrounding environment.

## Beta scope

The beta is centered on a small runtime and CLI for composing and executing GRAIL worlds. Current work is focused on hardening the public module boundary, CLI behavior, path semantics, error handling, package metadata, documentation, and regression coverage.

More advanced selection strategies, additional tooling, richer authoring experiences, and other execution features can build on this foundation without changing the basic model of goal pursuit through conditions, affordances, effects, and bound capabilities.

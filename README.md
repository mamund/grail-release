<img src="./images/grail-release-banner.png" />

# GRAIL

**GRAIL Website:** [A different approach to automation](https://mamund.github.io/grail-site/)

Learn how GRAIL enables bounded autonomy by defining outcomes, conditions, and capabilities instead of prescribing workflows.


GRAIL is a runtime for pursuing a declared goal within a bounded environment of available capabilities.

A GRAIL world describes the conditions that matter, the capabilities that can change those conditions, and the effects produced when those capabilities succeed. The runtime works from the goal and the current world state to determine what condition needs to change and which available affordance can change it.

The environment defines the possibilities. GRAIL pursues the goal without requiring a predefined workflow or execution path.

> Define the environment, not the path.

## Status

**GRAIL v0.3.0-beta.1 is the current published beta.** This release adds Recovery v1 (optional compensation of completed side effects) and pursuit instrumentation, including selection and stack events and trace export. It builds on v0.2.0, which introduced interactive stdio capabilities, progress reporting, and execution timing. GRAIL remains in beta; interfaces and implementation details may evolve. The literal-input resolution fix is implemented in development source but is not included in v0.3.0-beta.1.

## Quick start

Install the current beta (v0.3.0-beta.1) and run it as follows:

```bash
npm install -g @mamund/grail@beta
```

To pin this specific release instead of following the beta tag:

```bash
npm install -g @mamund/grail@0.3.0-beta.1
```

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

The CLI writes execution observations to `observations.json` in the selected configuration directory. Each `grail run` starts an independent pursuit and overwrites this file rather than appending to prior runs. Copy or rename the file before another run if you need to retain its execution record. The configured `worldstate.json` is not modified.

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

`summary` prints the goal, success or failure, capability invocation count, captured outputs, and total pursuit duration. `json` prints the complete pursuit result (`goal`, `reached`, `worldstate`, `observations`, and `timing`) as valid JSON suitable for tools such as `jq`. Routine runtime trace messages are suppressed in these modes; errors still appear on stderr. Omitting `--output` preserves the existing trace. The option accepts both `--output json` and `--output=json`. Invalid modes exit with code `2`.

### Optional recovery (v0.3.0-beta.1)

Use `--recover` to enable best-effort compensation when a pursuit becomes unresolvable after normal affordance alternatives have been exhausted:

```bash
grail run --recover --output=summary
```

Recovery is disabled by default. When enabled, GRAIL records successful capability invocations and, if the pursuit becomes unresolvable, invokes declared recovery handlers in reverse completion order. A failed capability invocation does not itself trigger recovery. The summary reports recovered, failed, and skipped compensation attempts when recovery is attempted. The original goal result and CLI exit status are unchanged by compensation.

Recovery v1 is included in the published v0.3.0-beta.1 release. See [Capability Recovery Guide](./docs/capability-recovery-guide.md) for handler contracts and [Recovery v1 Specification](./docs/recovery-spec.md) for the design and limitations.

### Progress reporting

Use `--progress` to receive live progress events on stderr while keeping the final summary or JSON result on stdout:

```bash
grail run --output=summary --progress
grail run --output=json --progress > result.json
```

Use `--no-progress` to suppress optional progress reporting. Progress and result formatting are independent: this is especially useful for long-running HTTP, local-process, or LLM-backed capabilities. A progress event indicates an execution milestone, not a guarantee of eventual goal completion.

### Pursuit trace export (v0.3.0-beta.1)

Use `--trace <file>` to save an ordered JSON record of the runtime's selection decisions and pursuit stack changes:

```bash
grail run --config ./config --output=json --trace ./pursuit-trace.json
```

The trace is written to the specified file separately from the normal CLI result. It contains events with monotonically increasing `sequence` numbers:

| Event | Recorded information |
| --- | --- |
| `condition.selected` | Selected unmet condition and the candidate conditions considered. |
| `affordance.selected` | Selected affordance and eligible candidate affordances. |
| `stack.push` | Affordance pushed and the resulting stack snapshot. |
| `stack.pop` | Affordance popped, its `SUCCESS` or `FAIL` result, and the resulting stack snapshot. |

This **pursuit trace** records runtime decisions and stack activity. It differs from `observations.json`, which records capability invocations, responses, outputs, results, and timing. Together with `registry.json`, these files can be used to inspect the available affordances and reconstruct the observed pursuit. A trace is optional; running without `--trace` does not create a pursuit trace file.

If the trace destination cannot be written, the CLI reports the file error and exits with code `1`, even if the pursuit itself reached its goal. Create the destination directory before running the command.

The `--trace` option is included in the published v0.3.0-beta.1 release.

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
| `1` | GRAIL ran, but pursuit, capability execution, or an output operation such as trace export failed. |
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

### Run a configured world

For a filesystem-backed world, the new `runGrailWorld()` helper combines environment loading, a fresh runtime instance, and goal pursuit:

```javascript
import { runGrailWorld } from '@mamund/grail';

const result = await runGrailWorld({
  worldRoot: '/anywhere/on/disk/my-world',
  inputs: { customerId: 'C200' },
  inputMode: 'override',
  goal: 'customerVerified'
});

console.log(result.reached);
```

Only `worldRoot` is required. By default, configuration is loaded from `<worldRoot>/config`, the goal comes from `goal.json`, and omitted inputs come from `inputs.json`. Supplied inputs use shallow `override` merging (caller wins) unless `inputMode: 'replace'` is specified. The helper returns the normal pursuit result, including unsuccessful pursuits, without interpreting domain outcomes. See [Running a GRAIL world from Node.js](./docs/run-grail-world.md) for the full contract and portability notes.

**Availability:** `runGrailWorld()` is available in v0.3.0-beta.1.

### Lower-level API

Load a filesystem-based environment and pursue its goal:

```javascript
import { Grail, loadEnvironment } from '@mamund/grail';

const environment = loadEnvironment('./config');

const grail = new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs,
  baseDir: environment.baseDir
});

const result = await grail.pursue(environment.goal);

console.log(result.reached);
console.log(result.worldstate);
console.log(result.observations);
```

Pass `environment.baseDir` when constructing `Grail` directly to keep relative Node binding paths and stdio subprocess working directories rooted at the world, rather than at the invoking process.

The `Grail` runtime itself does not require filesystem-backed observations. Observations are retained in memory by default. A caller can provide an `observationPath` when file persistence is wanted.

`pursue()` returns the pursued goal, whether it was reached, the resulting world state, observations, and a `timing` object containing the total `durationMs`. Binding-invocation observations also record `timing.durationMs` for the individual capability execution.

Applications can subscribe to structured progress events with an optional callback:

```javascript
const result = await grail.pursue(environment.goal, {
  onProgress(event) {
    console.log(event);
  }
});
```

Events include `pursuit.started`, `capability.started`, `capability.completed`, and `pursuit.completed`. The callback makes it possible to build a user interface or telemetry integration without parsing CLI output. Calling `pursue(environment.goal)` without a callback remains supported.

For a complete working example, see [API Consumer](./examples/api-consumer/README.md). It demonstrates goal pursuit, structured progress events, execution timing, and unresolvable-goal handling using GRAIL as an installed npm dependency.


### Recovery from the Node API (v0.3.0-beta.1)

Recovery can be enabled when constructing a runtime or for an individual pursuit:

```javascript
const grail = new Grail({
  registry: environment.registry,
  worldstate: environment.worldstate,
  inputs: environment.inputs,
  baseDir: environment.baseDir,
  recover: true
});

const result = await grail.pursue(environment.goal);
// Or override the setting for one pursuit:
// const result = await grail.pursue(environment.goal, { recover: true });
```

Recovery is off by default. With recovery enabled, the result includes a `recovery` object; when compensation is attempted it reports `recovered`, `failed`, `skipped`, and duration. Without recovery enabled, the property is omitted. The result's `reached` field continues to describe the original goal, not the compensation outcome. The portable `runGrailWorld()` helper also accepts a `recover` option.

### Literal affordance inputs (unreleased)

An upcoming release corrects input resolution so affordances can supply literal string values alongside references to configured inputs and prior capability outputs. For example:

```json
{
  "value": "$inputs.supplierId",
  "ruleId": "supplier"
}
```

Here, `value` is resolved from `inputs.json`, while `ruleId` is passed directly as the literal string `supplier`. Previously, the literal was treated as an unresolved input and blocked execution. The fix preserves `$inputs.*` and `$outputs.*` resolution; unsupported `$`-prefixed references remain unresolved. The [`purchase-order-validation`](https://github.com/mamund/grail-worlds/tree/main/purchase-order-validation) world demonstrates this behavior. This fix is present in the updated development source but is **not included in 0.3.0-beta.1**.

## Bindings

An affordance may be connected to an executable capability through a binding. The current runtime supports three protocols:

| Protocol | Purpose |
| --- | --- |
| `node` | Invoke a local JavaScript module and exported function. |
| `http` | Invoke a capability through HTTP. |
| `stdio` | Launch a local process and consume JSON output from stdout; supports ordinary and interactive execution. |

### Recovery handlers (v0.3.0-beta.1)

A binding may optionally declare a `recover` handler. Node handlers can name an exported function in the same module or specify a separate module and function; HTTP handlers specify a method and URL; stdio handlers specify a command and arguments. GRAIL validates declaration syntax without requiring the handler to be available until compensation is attempted.

Recovery handlers receive the **original** pursuit and invocation identifiers, rather than the original domain inputs. They are responsible for locating the side effect, making compensation safe to repeat, and returning `SUCCESS` or `FAIL`. GRAIL records recovery observations and progress events separately from forward effects, and does not alter Boolean worldstate during compensation.

For examples of all three bindings, see [Capability Recovery Guide](./docs/capability-recovery-guide.md). A runnable Node-based example is available in the separate `grail-worlds/recovery-demo` world.

### Interactive stdio capabilities

A stdio binding can opt into terminal interaction by declaring `"interactive": true` on the binding. In this mode, the child process inherits the terminal input stream so it can prompt a person. GRAIL provides resolved inputs through the temporary JSON file named by `GRAIL_INPUTS_FILE`; the process returns machine-readable JSON on stdout and can write prompts and diagnostic messages to stderr. An interactive terminal is required.

This makes human participation an ordinary capability implementation rather than a special kind of goal-pursuit step. The capability remains responsible for deciding whether its domain operation succeeded. Interactive stderr is normalized in stored observations to make terminal output more readable.

Bindings are adapters between GRAIL affordances and capability implementations. Goal pursuit does not depend on the implementation technology behind a capability.

## Execution results and observations

Bound capabilities reduce execution to GRAIL's runtime result model. Successful execution permits declared effects to be applied; failed execution does not.

Observations retain execution evidence such as invocation details, responses, extracted outputs, execution duration, and the resulting execution status. This allows GRAIL to keep its runtime contract small while preserving useful diagnostic information.

## Validation and tests

Run the current automated test suite with:

```bash
npm test
```

The suite covers end-to-end goal pursuit through the public API, stdio execution and output handling, world-relative path resolution, goal and input invocation overrides, stack and selection telemetry, pursuit trace collection and CLI export, and CLI behavior including configuration errors, execution failures, pursuit failures, messages, and exit codes, execution identity propagation, and recovery configuration, dispatch, observations, progress, timing, and CLI reporting.

Tests run as independent suites with start/pass/fail reporting and a 30-second timeout per suite. The CLI regression tests are organized under `test/cli/` into commands, show, output, overrides, and errors. Run an individual suite directly, for example:

```bash
node test/cli/output.js
```

Each CLI subprocess also has a 15-second timeout so a hanging command fails with a useful error rather than blocking the entire suite.

## Sharing GRAIL Worlds

GRAIL separates the mechanics of goal pursuit from the environments in which goals are pursued. This makes it possible to package and share reusable worlds independently of the runtime.

A **world** defines the available possibilities, a **scenario** identifies a goal and supplies its initial conditions, and **observations** record what happened during execution.

A single world can support many scenarios, and its capabilities can evolve without requiring existing scenarios to change.

Read [Sharing GRAIL Worlds: Packaging Reusable Environments for Goal-Directed Autonomy](docs/grail-world-packaging.md) for the packaging pattern, architectural rationale, and experimental evidence from demo-25.

## Design notes

Two documents in `docs/` provide additional architectural context:

- [What Is Not in the Agent Must Be in the Environment](./docs/ENVIRONMENT.md) discusses GRAIL's environment-first approach to bounded autonomy.
- [GRAIL Trust Model](./docs/grail-trust-model.md) describes the runtime's trust boundaries and the responsibilities retained by capabilities and the surrounding environment.

**Security and trust**: GRAIL executes capabilities defined by a trusted world. Only run reviewed configurations and bindings. Capabilities are responsible for authentication, authorization, and domain security. Observations may contain sensitive data, and the beta runtime does not enforce execution timeouts. See the GRAIL Trust Model for execution boundaries and operational limitations.

## Beta scope

The beta centers on a small runtime and CLI for composing and executing GRAIL worlds. Version 0.3.0-beta.1 adds Recovery v1 and pursuit instrumentation to the interactive stdio, progress reporting, and timing introduced in v0.2.0. Literal affordance input resolution improvements remain unreleased.

More advanced selection strategies, additional tooling, richer authoring experiences, and other execution features can build on this foundation without changing the basic model of goal pursuit through conditions, affordances, effects, and bound capabilities.

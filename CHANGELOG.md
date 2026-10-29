# Changelog

## Unreleased — Cyclic dependency resolution and input resolution

- Detect repeated affordances on the active dependency path to prevent unbounded recursive resolution.
- Exclude cyclic or exhausted producers temporarily and backtrack to alternative affordances when available.
- Treat missing producers as exhausted dependency paths, allowing alternatives at earlier decision points.
- Preserve pursuit-local exclusions separately from capability failure observations; terminate as unresolvable when no path remains.
- Add six cyclic dependency regression tests, including nested backtracking and multiple preconditions.

- Fixed affordance input resolution to accept literal string values alongside `$inputs.*` and `$outputs.*` references.
- Preserved unresolved-reference handling for missing inputs and unsupported `$`-prefixed references.
- Added regression coverage for literal affordance inputs.

## 0.3.0-beta.1 — Recovery v1 and pursuit instrumentation

- Added opt-in recovery support for compensating previously completed side effects when a pursuit cannot reach its goal.
- Added CLI `--recover` to enable recovery during a pursuit.
- Added capability-defined recovery handlers, with runtime coordination of compensation in reverse completion order.
- Added recovery reporting and observations so compensation attempts and outcomes can be inspected.
- Added recovery regression coverage and a recovery demonstration world.

### Pursuit instrumentation

- Added optional diagnostic events for condition and affordance selection, including the candidates considered.
- Added optional stack push/pop events with stack snapshots and completion results.
- Added an ordered pursuit trace collector for selection and stack events.
- Added CLI `--trace <file>` to export pursuit telemetry as JSON without changing normal result formatting.
- Added regression coverage for stack events, selection events, trace collection, and CLI trace export.

## 0.2.0 — Interactive capabilities and execution visibility

- Added interactive stdio bindings (`"interactive": true`) for capabilities that require terminal input, including human participation during a pursuit.
- Added structured progress events to the programmatic API through the optional `onProgress` callback: `pursuit.started`, `capability.started`, `capability.completed`, and `pursuit.completed`.
- Added CLI `--progress` and `--no-progress` options, with progress reported on stderr independently of final output on stdout.
- Added execution timing: `timing.durationMs` for capability invocations and total pursuit duration in the result returned by `pursue()`.
- Improved normalization of interactive stderr captured in execution observations.
- Added a standalone API consumer example demonstrating progress events, timing, and pursuit outcomes.
- Expanded regression coverage for interactive stdio, progress reporting, timing, and public API behavior.

## 0.1.0 — Initial beta

- Goal pursuit over declared world conditions and affordances, without a predefined workflow.
- Node.js, HTTP, and stdio capability bindings.
- CLI commands: `grail init`, `grail validate`, `grail show`, and `grail run`.
- Programmatic API: `Grail` and `loadEnvironment`.
- Independent pursuit execution contexts, with worldstate and observation results returned to callers.
- Configuration validation, execution observations, and example CLI tour.

### Beta limitations

- GRAIL executes trusted configurations and capabilities; it is not a sandbox.
- Capabilities manage authentication, authorization, and domain security.
- The runtime does not enforce execution timeouts.
- The CLI overwrites its observations file on each run; configured worldstate is not persisted by a run.

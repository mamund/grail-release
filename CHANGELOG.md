# Changelog

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

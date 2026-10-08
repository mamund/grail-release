# Changelog

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

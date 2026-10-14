# GRAIL v0.2.0 API consumer smoke test

This standalone consumer tests GRAIL as a library, outside the source repository. It uses a deterministic STDIO capability and does not need Ollama or a terminal prompt.

## Install from a locally packed release

1. In `grail-release`, after updating the package version to 0.2.0 and running `npm test`, run `npm pack`. Note the absolute path to the generated `.tgz` file.
2. Extract this example into a **separate directory** (not inside `grail-release`).
3. In the example directory, run:

   ```sh
   npm install --no-save /absolute/path/to/mamund-grail-0.2.0.tgz
   npm test
   ```

Do not install the published 0.1.0 package for this test: the progress and timing API is new in 0.2.0.

## What is asserted

- `loadEnvironment` and `new Grail({...})` work from a package consumer.
- `pursue(goal, { onProgress })` emits structured pursuit/capability events.
- SUCCESS observations contain binding outputs and `timing.durationMs`.
- Pursuit result and terminal event include total duration.
- `pursue(goal)` works without an event callback.
- An unknown goal terminates as unreached and emits an unresolvable event.

The example checks shape and nonnegative timing values rather than exact durations. It does not exercise interactive STDIO; that is covered by the separate refund world.

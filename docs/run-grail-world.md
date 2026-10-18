# Running a GRAIL world from Node.js

`runGrailWorld()` is a convenience function exported by `@mamund/grail`.
It loads a world, constructs an isolated runtime instance, and pursues a goal.

**Availability:** This helper is included in the updated development source, but not in the published `@mamund/grail` v0.2.0 beta. Install the updated local package (or a future release that includes the export) before using the examples below.

```js
import { runGrailWorld } from '@mamund/grail';

const result = await runGrailWorld({
  worldRoot: '/anywhere/on/disk/my-world',
  inputs: { customerId: 'C200' },
  inputMode: 'override',
  goal: 'customerVerified'
});
console.log(result.reached);
```

| Option | Required | Default |
| --- | --- | --- |
| `worldRoot` | Yes | — (absolute or caller-working-directory-relative path to the world directory) |
| `configDir` | No | `'config'` (relative to worldRoot; absolute paths also accepted) |
| `goal` | No | `goal.json` |
| `inputs` | No | `inputs.json` unchanged |
| `inputMode` | No | `'override'` |

For the conventional layout, `worldRoot` contains a `config/` directory with `registry.json`, `worldstate.json`, `inputs.json`, and `goal.json`. `configDir` can override that location.

A call with only `worldRoot` uses the configured goal and inputs:

```js
const result = await runGrailWorld({ worldRoot: '/anywhere/on/disk/my-world' });
```

Input modes use shallow key-based merges:

- `override`: `{ ...configuredInputs, ...inputs }` (caller wins).
- `replace`: use only supplied inputs.
- Omitted `inputs`: use configured inputs even when `inputMode` is `'replace'`.
- Explicit `inputs: {}` with `'replace'` intentionally clears inputs.

The function returns the original `Grail.pursue()` result, including `goal`,
`reached`, `worldstate`, `observations`, and any runtime-provided metadata.
An unreached goal is not automatically thrown as an exception.

The helper sets `baseDir` to the world root, so Node binding module paths and
stdio subprocess working directories use the portable-world convention. It does
not change `process.cwd()` or edit configuration files. Dependencies *inside*
a capability remain that capability's responsibility.

The helper uses a fresh `Grail` instance for every call. A child GRAIL world can be invoked in exactly the same way as a standalone world; the calling capability remains responsible for interpreting the child result and deciding whether an unreached goal should be treated as an error.

### Example: nested invocation

```js
import { runGrailWorld } from '@mamund/grail';

const childResult = await runGrailWorld({
  worldRoot: childRoot,
  inputs: { customerId },
  inputMode: 'override'
});

if (!childResult.reached) {
  throw new Error(`Child pursuit did not reach ${childResult.goal}`);
}
```

`reached: true` means the GRAIL goal was established. It does not imply a favorable domain outcome: for example, a verification world may complete successfully and return `REJECTED`. Domain values are interpreted by the calling capability, not by `runGrailWorld()`.

### Portability boundary

The helper resolves world configuration and binding-level filesystem paths using the selected world root without changing the process working directory. It does **not** rewrite filesystem references made inside Node capabilities or guarantee that external services, environment variables, and other capability dependencies are available. Capabilities own those dependencies.

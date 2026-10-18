# Running a GRAIL world from Node.js

`runGrailWorld()` is a convenience function exported by `@mamund/grail`.
It loads a world, constructs an isolated runtime instance, and pursues a goal.

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
| `worldRoot` | Yes | — |
| `configDir` | No | `'config'` (relative to worldRoot; absolute paths also accepted) |
| `goal` | No | `goal.json` |
| `inputs` | No | `inputs.json` unchanged |
| `inputMode` | No | `'override'` |

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

The helper uses a fresh `Grail` instance for every call.

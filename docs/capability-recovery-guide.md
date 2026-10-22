# Capability recovery guide

**GRAIL Recovery v1 — capability author reference**

Recovery is an optional, best-effort way to compensate side effects from successful capability invocations after a pursuit becomes unresolvable. It is not a rollback transaction. The runtime coordinates *when* and *in what order* compensation is attempted; each capability owns the domain-specific compensation operation.

## 1. When recovery runs

Enable recovery for a pursuit:

```sh
grail run --recover --output=summary
```

Or through the Node API:

```js
const grail = new Grail({ registry, worldstate, recover: true });
const result = await grail.pursue('orderFinalized');
// Alternatively: grail.pursue('orderFinalized', { recover: true })
```

Recovery is off by default. It starts only when GRAIL determines that the goal is unresolvable, **after** normal alternative affordances have been exhausted. A single forward `FAIL` does not trigger compensation. A successful pursuit does not trigger compensation.

When recovery is enabled, GRAIL records each successful forward invocation on a pursuit-local stack, including invocations without recovery handlers. If recovery starts, it processes those entries in reverse completion order (LIFO). Failed forward invocations are not added to the stack.

## 2. Correlation and capability responsibilities

Each pursuit has a UUID `pursuitId`; each forward invocation has a UUID `invocationId`. The recovery handler receives **the original IDs**, not the new ID assigned to its recovery observation.

A recovery handler MUST use those IDs to identify the operation to compensate. It SHOULD maintain any necessary durable or local mapping from invocation identity to the original side effect. GRAIL does not provide the original domain inputs to the recovery handler.

Capability authors SHOULD:

- Persist enough information during the successful forward operation to find and compensate its side effect later.
- Make compensation idempotent where possible; repeated or already-completed compensation should be handled deliberately.
- Return a standard result object with `result: 'SUCCESS'` or `result: 'FAIL'`.
- Clean up partial side effects **inside the forward capability** if that capability itself returns `FAIL`; GRAIL only stacks successful forward invocations.
- Treat recovery as best effort, not a guarantee that the external domain state is fully restored.

## 3. Node binding

A same-module handler is declared with a function name:

```json
{
  "protocol": "node",
  "module": "./capabilities/operations.mjs",
  "function": "reserveInventory",
  "recover": "releaseInventory"
}
```

Alternatively, use a separate module:

```json
"recover": {
  "module": "./capabilities/recovery.mjs",
  "function": "releaseInventory"
}
```

A forward Node capability may accept execution context as an optional second argument:

```js
export async function reserveInventory(inputs, { pursuitId, invocationId }) {
  // Store the created reservation under these IDs.
  return { result: 'SUCCESS' };
}
```

The recovery handler accepts **one argument** containing the original IDs:

```js
export async function releaseInventory({ pursuitId, invocationId }) {
  // Find the reservation created by this invocation and release it.
  return { result: 'SUCCESS' };
}
```

Existing forward capabilities accepting only `inputs` remain valid.

## 4. HTTP binding

Declare an independent recovery endpoint on the HTTP binding:

```json
"recover": {
  "method": "DELETE",
  "url": "https://example.com/reservations/recover"
}
```

The recovery request carries the **original** IDs in headers:

```http
Grail-Pursuit-Id: <original-pursuit-uuid>
Grail-Invocation-Id: <original-invocation-uuid>
```

The recovery endpoint should return a successful HTTP status and JSON such as:

```json
{ "result": "SUCCESS" }
```

A non-success HTTP status, transport error, malformed JSON, or any response without `result: 'SUCCESS'` is treated as a recovery failure. HTTP recovery does not send the original domain inputs. The current schema permits `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` recovery methods.

## 5. Stdio binding

Declare a separate recovery command:

```json
"recover": {
  "command": "node",
  "args": ["./capabilities/recover-reservation.mjs"]
}
```

GRAIL launches a separate noninteractive process and writes **only** the original IDs as JSON to stdin:

```json
{
  "pursuitId": "<original-pursuit-uuid>",
  "invocationId": "<original-invocation-uuid>"
}
```

The process must write a JSON result to stdout:

```json
{ "result": "SUCCESS" }
```

A nonzero exit, invalid JSON, execution error, or any result other than `SUCCESS` counts as a recovery failure. The forward stdio capability separately receives `GRAIL_PURSUIT_ID` and `GRAIL_INVOCATION_ID` in its **child-process environment**; the parent environment is not mutated.

## 6. Outcomes and failure isolation

| Recovery situation | Recorded status |
|---|---|
| Handler returns `SUCCESS` | `RECOVERED` |
| Handler returns `FAIL` or another result | `RECOVERY_FAILED` |
| Handler throws, cannot be resolved, or fails in transport/process execution | `RECOVERY_FAILED` |
| No recovery declaration exists | `SKIPPED` |

GRAIL continues through the remaining stack entries even after a recovery failure. It does not automatically retry compensation. Missing recovery declarations are not errors; a **declared** but broken handler is a failure when invoked.

The pursuit's `reached` result and CLI exit status continue to describe the original goal. Recovery does **not** rewrite Boolean worldstate occurrences.

## 7. Evidence and reporting

Forward observations use `phase: 'forward'`. Recovery observations use `phase: 'recovery'`, refer to the original forward invocation with `originalInvocationId`, and include a new invocation UUID when a recovery handler actually runs. `SKIPPED` observations have no new recovery invocation ID.

Recovery observations MAY include handler responses, outputs, errors, and duration. Recovery outputs are **not** made available through normal `$outputs` resolution.

Recovery emits these progress events:

- `recovery.started`
- `recovery.invocation.started` (executed handlers only)
- `recovery.invocation.completed` (including skipped entries)
- `recovery.completed`

When recovery is enabled but not triggered, the result includes:

```json
"recovery": { "enabled": true, "attempted": false }
```

When triggered, the summary includes `recovered`, `failed`, `skipped`, and `durationMs`. Timing also distinguishes `forwardDurationMs`, `recoveryDurationMs`, and `totalDurationMs`, while preserving the existing `timing.durationMs` meaning. When recovery is disabled, the `recovery` object is omitted.

The counts report what handlers did, **not** proof that domain state has been restored.

## 8. Validation, scope, and limitations

`grail validate` checks the syntax of optional `binding.recover` declarations. It does **not** verify that modules, executables, or HTTP endpoints exist; those are resolved when recovery actually runs. An unused broken recovery declaration does not prevent ordinary forward execution.

Recovery v1 is pursuit-local and in-memory. It does not provide crash-safe persistence, durable resume, distributed transactions, automatic retry, or host-requested recovery of a previously completed pursuit. Nested worlds maintain their own pursuit/recovery scope; parent-level compensation for a successful child pursuit remains the responsibility of the parent capability author.

## 9. Try the portable example

See `grail-worlds/recovery-demo` (a **separate repository** from `grail-release`). From its directory:

```sh
node scripts/reset.mjs
grail validate
grail run --recover --output=summary
cat state/ledger.json
```

The demonstration reserves inventory and allocates shipping, then deliberately fails order finalization. Compensation releases shipping before inventory. The original goal remains unreached, even when the local ledger shows no active side effects. A nonzero CLI exit status is expected.

The demo requires a recovery-enabled GRAIL runtime; do not assume the published `@mamund/grail@0.2.0` includes these unreleased changes.

---

**Related documentation:** `docs/recovery-spec.md` (Recovery v1 design) and `grail-worlds/recovery-demo/README.md` (end-to-end example).

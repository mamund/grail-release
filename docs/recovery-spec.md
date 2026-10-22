# GRAIL recovery v1: design specification

**Status:** Design decisions approved; implementation not started  
**Date:** 2026-10-21  
**Basis:** October 19 recovery context and subsequent design decisions 1–35  
**Scope:** Opt-in, pursuit-local, best-effort compensation

## 1. Purpose and architectural boundary

GRAIL coordinates compensation for successful capability invocations when a pursuit becomes unrecoverable. Capabilities implement domain-specific compensation. The runtime does not infer whether an external system has been restored to its prior state.

The recovery mechanism is separate from its trigger, allowing future host-requested or explicit recovery without redefining compensation dispatch.

Normative terms **MUST**, **SHOULD**, and **MAY** indicate requirements, recommendations, and permitted behavior in this proposed specification.

## 2. Activation and trigger

- Recovery MUST be disabled by default.
- The CLI MUST support `grail run --recover`; the Node API MUST accept a pursuit-level `recover: true` option. The exact API argument placement is subject to compatibility review.
- Recovery configuration MUST remain outside `registry.json`, `worldstate.json`, and `goal.json`. Nested pursuits configure recovery independently.
- When enabled, recovery MUST begin only after the existing pursuit algorithm determines the goal is unreachable, including exhaustion of eligible alternative affordances.
- Individual capability `FAIL` results MUST first follow existing alternative selection. They MUST NOT independently trigger compensation.
- A successful pursuit MUST discard its in-memory recovery stack without invoking compensation or emitting recovery lifecycle events.
- Explicit cancellation, host-requested recovery, completed-pursuit recovery, and crash-triggered recovery are outside v1.

## 3. Execution identity

- Every pursuit MUST receive a globally unique `pursuitId`, whether or not recovery is enabled.
- Every forward capability invocation MUST receive a globally unique `invocationId`, whether or not recovery is enabled.
- Identifiers MUST be exposed in applicable results, observations, and traces.
- Identifiers MUST be passed as execution context without changing the business-input contract of existing capabilities.
- Each executed recovery handler MUST receive a distinct invocation identity for telemetry and MUST refer to the original forward invocation using `originalInvocationId`.
- Recovery handlers receive the *original* `pursuitId` and forward `invocationId` as their recovery request, not the telemetry identity of the recovery invocation.
- A `SKIPPED` observation does not require a new invocation ID because no handler runs.

## 4. Recovery stack and algorithm

When recovery is enabled, GRAIL MUST maintain an in-memory stack local to each pursuit. It MUST push one entry for **every successful forward capability invocation**, whether or not `binding.recover` is declared. Each entry MUST retain the original binding and enough execution metadata to dispatch the declared recovery operation. Repeated successful invocations of the same affordance MUST produce separate entries. Multiple effects from one invocation MUST NOT create additional entries.

Entries MUST be unwound sequentially in reverse **completion** order. Failed or blocked forward invocations do not enter the stack. A forward capability that returns `FAIL` is responsible for its own partial side effects.

Conceptual behavior:

```text
pursue(goal, recover=false):
    pursuitId = uniqueId()
    stack = []
    run normal pursuit with unique IDs for every invocation
    if recover:
        on forward SUCCESS: push completed invocation onto stack
    if goal reached:
        discard stack
        return original success result
    if goal unreachable and recover:
        emit recovery.started
        while stack not empty:
            entry = pop(stack)
            if entry.binding.recover absent:
                append recovery observation SKIPPED
                emit recovery.invocation.completed (SKIPPED)
                continue
            recoveryInvocationId = uniqueId()
            emit recovery.invocation.started
            invoke declared handler with original IDs
            classify result; append recovery observation
            emit recovery.invocation.completed
        emit recovery.completed
    return original pursuit result with applicable recovery evidence
```

The pseudocode does not prescribe a source-code structure. Compensation MUST NOT invoke affordance selection, dependency resolution, or worldstate effect application.

## 5. Binding declarations and recovery request

Recovery is an optional member of the original `binding`. A missing declaration is intentional absence of compensation; a declared but unavailable handler is an execution failure.

### 5.1 Node

Same-module shorthand:

```json
{
  "binding": {
    "type": "node",
    "module": "./capabilities/allocate-vm.mjs",
    "function": "allocateVM",
    "recover": "recoverVM"
  }
}
```

Separate-module form:

```json
{
  "binding": {
    "type": "node",
    "module": "./capabilities/allocate-vm.mjs",
    "function": "allocateVM",
    "recover": {
      "module": "./capabilities/recover-vm.mjs",
      "function": "recoverVM"
    }
  }
}
```

A Node forward invocation receives execution identifiers as a context argument without modifying its domain inputs. The proposed convention is `forward(inputs, { pursuitId, invocationId })`. Recovery receives `{ pursuitId, invocationId }`, with `invocationId` identifying the original forward call. Exact integration with the existing Node dispatcher MUST be checked before coding.

### 5.2 HTTP

```json
{
  "binding": {
    "type": "http",
    "method": "POST",
    "url": "https://example.com/vm",
    "recover": {
      "method": "DELETE",
      "url": "https://example.com/vm/recover"
    }
  }
}
```

Any method already supported by the HTTP binding MAY be declared for recovery. The recovery endpoint need not be related to the forward endpoint. Forward and recovery requests MUST carry `Grail-Pursuit-Id` and `Grail-Invocation-Id` headers. During recovery, the latter identifies the **original** invocation. The existing HTTP capability response convention applies; status-code mapping and parsing details must be verified against the current implementation.

### 5.3 Stdio

```json
{
  "binding": {
    "type": "stdio",
    "command": "node",
    "args": ["./capabilities/allocate-vm.mjs"],
    "recover": {
      "command": "node",
      "args": ["./capabilities/recover-vm.mjs"]
  }
}
```

Forward stdio invocations MUST receive `GRAIL_PURSUIT_ID` and `GRAIL_INVOCATION_ID` through their spawned process environment. GRAIL MUST construct an environment per subprocess and MUST NOT mutate the host process's global `process.env` to pass invocation-specific values. This avoids collisions between simultaneous and nested processes. Existing forward stdin JSON MUST remain unchanged.

Recovery handlers receive on stdin:

```json
{"pursuitId":"p-123","invocationId":"i-456"}
```

Recovery results are emitted as JSON on stdout; stderr remains diagnostic. A recovery subprocess may receive process-local environment variables as well, but the stdin object is the agreed recovery request contract.

## 6. Handler results and dispatch errors

Recovery handlers MUST use the existing `SUCCESS` / `FAIL` capability result convention:

```json
{"result":"SUCCESS"}
```

```json
{"result":"FAIL","error":"Unable to release resource"}
```

| Handler outcome | GRAIL classification | Continue unwinding? |
|---|---|---|
| `SUCCESS` | `RECOVERED` | Yes |
| `FAIL` | `RECOVERY_FAILED` | Yes |
| Exception, unavailable declared handler, invalid response | `RECOVERY_FAILED` | Yes |
| `BLOCKED` | `RECOVERY_FAILED` (preserve raw response) | Yes |
| No recovery declaration | `SKIPPED` (no handler invoked) | Yes |

`BLOCKED` MUST NOT trigger dependency resolution, WAIT, or alternative selection during recovery. GRAIL MUST attempt each declared handler at most once in v1; there are no automatic retries. Existing binding-level timeout behavior applies; there is no recovery-specific timeout. A hung handler may prevent completion.

A recovery handler SHOULD be idempotent. A request for an already-compensated operation SHOULD return `SUCCESS`. Capability authors are responsible for retaining or reconstructing context indexed by the original identifiers, for cleaning up partial side effects before returning forward `FAIL`, and for deciding the domain meaning of compensation.

## 7. Observations, outputs, and events

Forward and recovery records MUST be appended chronologically to the existing `observations` collection. Each MUST identify its `phase` (`forward` or `recovery`) and relevant execution identifiers. Recovery records MUST identify the original invocation; executed handlers also have their own telemetry `invocationId`.

Illustrative recovery observation:

```json
{
  "phase": "recovery",
  "pursuitId": "p-123",
  "invocationId": "i-789",
  "originalInvocationId": "i-456",
  "result": "RECOVERED",
  "outputs": {"resourceReleased": true},
  "durationMs": 42
}
```

A `SKIPPED` observation identifies the original invocation and classification without implying an executed handler. Existing binding diagnostics (HTTP response, process exit code, stderr, error messages) SHOULD be retained subject to existing sensitive-data protections. Recovery outputs MUST remain structured, source-identifiable evidence. They MUST NOT enter normal `$outputs` bindings, modify worldstate, or affect forward affordance selection. A future `$outputs.recover.*` namespace is deferred.

GRAIL MUST emit these recovery lifecycle events when compensation runs:

- `recovery.started`
- `recovery.invocation.started` (only for executed handlers)
- `recovery.invocation.completed` (including `SKIPPED`)
- `recovery.completed`

Events MUST carry relevant identities and follow existing trace/progress conventions. When `--progress` is enabled, recovery progress goes to stderr; `--trace` includes recovery events. The recovery subsystem SHOULD emit structured records independently of the eventual storage representation so a separate recovery collection can be introduced later.

## 8. Worldstate, result, and timing

Recovery MUST NOT change worldstate. The returned worldstate represents forward execution, not a verified external snapshot after compensation. Recovery outcomes are evidence of attempted operations, not a claim that all side effects were reversed.

The original pursuit outcome (`reached`) MUST remain unchanged, and compensation MUST NOT alter the CLI exit code determined by that outcome.

Recovery result reporting is conditional:

- Recovery disabled: omit the `recovery` object entirely.
- Recovery enabled and no compensation: include `{ "enabled": true, "attempted": false }`.
- Recovery attempted: include `enabled`, `attempted`, and factual `recovered`, `failed`, and `skipped` counts.

Illustrative unsuccessful pursuit result:

```json
{
  "goal": "accountActivated",
  "reached": false,
  "pursuitId": "p-123",
  "worldstate": {},
  "observations": [],
  "timing": {
    "executionDurationMs": 120,
    "recoveryDurationMs": 45,
    "totalDurationMs": 165
  },
  "recovery": {
    "enabled": true,
    "attempted": true,
    "recovered": 2,
    "failed": 0,
    "skipped": 1
  }
}
```

Timing MUST distinguish execution, recovery, and total elapsed duration, retaining compatibility with current timing fields. Recovery-disabled results SHOULD avoid gratuitous changes to existing timing representations; the exact additive mapping needs implementation review.

`--output=summary` MUST show recovery counts only when compensation was attempted. `--output=json` follows the conditional recovery object rules. Existing output modes and exit codes remain valid.

## 9. Nested worlds and interruption

Each nested GRAIL pursuit has independent recovery configuration, identifiers, and stack. If a child becomes unrecoverable during its own execution, it may compensate before returning failure. If a child succeeds and the parent later fails, the parent invokes the recovery handler declared by the **parent's child-invoking capability**. The parent MUST NOT automatically unwind the child's completed pursuit. The child-invoking capability owns any compensation needed at that boundary.

The stack is memory-only and pursuit-local. If the process terminates, unfinished compensation is not automatically resumed. Recovery evidence survives only to the extent already emitted to an external destination. Durable stacks, explicit recovery of completed pursuits, and resume semantics are outside v1.

## 10. Validation and compatibility

`grail validate` MUST validate the syntax and shape of recovery declarations. Runtime availability of a declared handler MUST be checked when compensation is dispatched, rather than preventing a normal pursuit from starting. Existing registries without `binding.recover` MUST remain valid.

Existing Node, HTTP, and stdio forward contracts MUST remain compatible. Existing `$outputs.latest.<field>` and `$outputs.<source>.<field>` behavior MUST remain unchanged. Observation consumers MUST be able to ignore additive identity and phase fields. Existing regression tests MUST pass.

## 11. Acceptance tests

1. Recovery disabled: original pursuit behavior, no recovery stack dispatch, no `recovery` result object.
2. Recovery enabled and goal reached: no compensation; recovery stack discarded; `attempted: false`.
3. Recovery enabled and goal unreachable: alternatives exhausted before compensation.
4. All successful invocations, including those without handlers, considered exactly once in reverse completion order.
5. Multiple effects from one invocation produce one recovery entry; repeated invocations produce separate entries.
6. Failed forward alternatives never enter recovery stack; successful alternative uses its own binding's handler.
7. Missing declaration yields `SKIPPED`; missing declared handler yields `RECOVERY_FAILED`.
8. Handler `SUCCESS`, `FAIL`, `BLOCKED`, invalid output, and thrown error are classified as specified; later entries still run.
9. Node same-module and separate-module handlers work; HTTP headers and stdio environment/stdin contracts work.
10. Parallel independent processes and nested GRAIL worlds do not overwrite invocation environment variables.
11. Recovery events, observations, identifiers, timings, outputs, and summary counts correlate correctly.
12. Recovery does not modify worldstate, normal `$outputs`, original `reached`, or CLI exit code.
13. Recovery-enabled API and CLI reporting follow conditional result structure; `summary`, `json`, `--trace`, and `--progress` behave as specified.
14. Recovery handlers can be independently tested using original identifiers and `SUCCESS`/`FAIL` responses.
15. All existing regression tests pass.

## 12. Required deliverables and implementation order

1. Review and approve this normative specification against the current runtime and schemas.
2. Implement execution identity separately, with regression coverage.
3. Extend `binding.recover` schema and validator for Node, HTTP, and stdio.
4. Implement the opt-in in-memory stack and sequential dispatcher.
5. Add unified recovery observations, events, timing, and conditional reporting.
6. Add unit, binding, integration, and independent handler tests, plus a portable recovery demonstration world in `grail-worlds`.
7. Publish `docs/capability-recovery-guide.md` covering eligibility, context retention, interfaces, idempotency, partial side effects, and testing.

## 13. Deferred extensions

- Host-requested compensation and explicit recovery of a previously completed pursuit.
- Durable recovery stacks, process-crash resumption, WAIT, and retry policies.
- Global or per-handler recovery-specific timeouts.
- Concurrent compensation.
- Automatic compensation across completed nested pursuits.
- Separate recovery observation collection.
- Capability-reported recovery effects and worldstate updates.
- Recovery output bindings such as `$outputs.recover.latest.*` and `$outputs.recover.<source>.*`.
- Generalized input/output and affordance interface contracts.

## 14. Items to verify against the current code before implementation

These are integration checks, not reversals of approved design decisions:

- Exact Node API signature and where pursuit-level `recover` is accepted.
- Existing Node capability call signature and compatibility of an additional context argument.
- Current HTTP result parsing, status handling, header support, and binding URL conventions.
- Current stdio JSON result envelope, environment handling, and error classification.
- Existing observation schema and trace event shape, especially whether `result` already has a specific type.
- Existing timing fields, CLI summary formatting, and CLI exit-code contract.
- Existing registry schema structure and schema-validator behavior for each binding.
- Whether forward `SUCCESS` is recorded after all required output/effect processing, so recovery stack order matches actual successful completion.

No runtime implementation should begin until these details have been checked and any necessary specification refinements approved.

# Cyclic dependency resolution

**Status:** Implemented in development source; not included in the published `0.3.0-beta.1` release.

## Purpose

A GRAIL world may contain affordances whose preconditions depend, directly or indirectly, on their own effects. A cycle in the registry is not necessarily an error: initial worldstate or an alternative producer may permit the goal to be reached. The resolver must avoid expanding the same active dependency indefinitely and must preserve viable alternatives.

## Resolution behavior

1. The client maintains the active pursuit stack. The server chooses an unmet condition and selects an eligible affordance that produces it.
2. While resolving a prerequisite, the server excludes affordances whose actions already occur on the active stack. This detects recursive reuse on the current dependency path.
3. If a producer has no eligible way to satisfy a prerequisite—including when no producer exists—the client abandons that producer and records a temporary exclusion at the parent decision point for that condition.
4. The resolver tries another producer for the same condition. When the current branch is exhausted, it unwinds further toward the goal.
5. A pursuit succeeds when its goal becomes satisfied. If the available resolution paths are exhausted, it ends as unresolvable.

Exclusions are scoped to the current pursuit and dependency context. They are not written to the capability failure observation store. The implementation does not add registry fields, binding contracts, or configuration flags.

## Example

```text
Goal: conditionA
  establishA requires conditionB
    establishB requires conditionA  <-- active-path cycle
    seedB requires nothing         <-- alternative producer
```

The resolver can reject the recursive selection of `establishA`, backtrack from `establishB`, select `seedB`, and then complete `establishA`. If `seedB` is unavailable and no other producer exists, the pursuit ends as unresolvable.

## Observability and outcomes

Cycle detection and dependency exhaustion occur during planning/resolution, before any implicated capability invocation. They should not be interpreted as capability `FAIL` observations. Existing stack and selection diagnostics can help explain which affordances were considered and where backtracking occurred. An unresolvable pursuit remains distinct from a successful goal.

## Regression coverage

| Test | Scenario | Expected behavior |
| --- | --- | --- |
| CD-01 | Unavoidable cycle | Terminate as unresolvable without an infinite traversal |
| CD-02 | Cyclic producer with an alternative | Reach the goal using the alternative |
| CD-03 | Initially satisfied condition breaks a cycle | Reach the goal |
| CD-04 | Multiple required preconditions | Resolve every required condition without skipping one |
| CD-05 | Deeply nested cycle with a higher-level alternative | Unwind multiple stack levels and reach the goal |
| CD-06 | Missing producer in one branch, alternative in another | Backtrack and reach the goal |

Run the complete suite with `npm test`, or run the individual tests under `test/api/`.

## Scope and limitations

- Detection uses active affordance action names, not a general graph-analysis or global planning algorithm.
- The resolver uses its existing condition and affordance selection strategies; eligible choices can vary with selection order.
- Current worldstate behavior is monotonic for declared effects: successful affordances establish conditions. Temporary exclusions were reviewed under this assumption. If future versions permit retracting conditions, exclusion invalidation should be reassessed.
- This feature prevents the tested recursive dependency loops; it does not introduce general runtime execution timeouts for capabilities.
- CD-07 was explored as a potential stale-exclusion scenario, but no reproducing case was established under current semantics; it is not part of the six-test regression set.

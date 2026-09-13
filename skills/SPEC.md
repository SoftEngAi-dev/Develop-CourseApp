# PHASE 7 · AUTONOMOUS EVOLUTION — SPEC

> **Status: SKELETON.** `skills/index.js` declares the real signatures and returns
> `notImplemented(...)`. Scope: DEC-00009.

| Field | Value |
| --- | --- |
| Phase | `phase-7` · Task `TSK-00010` · Layer `10 learning-evolution` |
| Weight | 5% |
| Cycle | LESSON → RULE → PRECHECK → SKILL → OPTIMIZATION → ARCHITECTURE EVOLUTION |

## 1. The boundary: remembering vs learning

A lesson that is only written down is literature. A rule that is **checked before
the next action** changes behaviour. Phase 7 exists to cross that line:

```js
registerSkill({ name, trigger, steps, verification, failure_examples })
promoteRules({ approval })          // proposals -> control/policies.json
installPrechecks({ gates })         // hard rules run BEFORE every mutation
evolutionMetrics({ since })         // repeated failures, rules enforced, time-to-recover
proposeArchitectureEvolution({ evidence })  // as a NEW Decision Trace, never auto-applied
```

## 2. Already in place (the floor)

- 2 real lessons, each paired with a proposed rule:
  `core.zero_dependencies = true` (hard) and
  `infra.verify_permissions_before_promising = true` (hard).
- `memory/lessons → pendingRules()` lists candidates with key/value/enforcement.
- 11 active policies in `control/policies.json` (POL-0001 … POL-0011).
- The gate mechanism is declared in `core/verifier` and probed by `genesis doctor`.

## 3. Acceptance criteria (exit gate)

- [ ] A repeated failure proposes a rule; an approved rule becomes a precheck.
- [ ] A violated hard precheck blocks the mutation and emits `INTERRUPTION_RAISED`.
- [ ] Skills are executable, versioned and carry failure examples.
- [ ] Architecture evolution is always a human-approved Decision Trace.

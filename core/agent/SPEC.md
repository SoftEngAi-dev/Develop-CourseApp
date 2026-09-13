# PHASE 5 · AUTONOMOUS AGENT — SPEC

> **Status: SKELETON.** Every function in `core/agent/`, `core/orchestrator/`,
> `core/planner/`, `core/executor/`, `core/verifier/` and `core/recovery/`
> exists with its real signature and returns `notImplemented(...)`.
> Agreed scope (DEC-00009): skeleton of all 8 phases, Phases 0–2 executable.

| Field | Value |
| --- | --- |
| Phase | `phase-5` |
| Task | `TSK-00008` |
| Layer | `6 agents`, `7 automation`, `8 verification` |
| Weight | 20% of total progress — the heaviest phase |
| Depends on | `phase-2` (**completed**), `phase-3` (documentation) |
| Modules | `core/agent`, `core/orchestrator`, `core/planner`, `core/executor`, `core/verifier`, `core/recovery` |

## 1. The loop (POL-0006 fixes the order)

```
observe → contextualize → reason → plan → execute → verify → learn
```

`contextualize` **must** run before `reason`. An agent that reasons before loading
memory re-proposes rejected alternatives and contradicts approved decisions.

## 2. Modules and contracts

| Module | Responsibility | Already working today |
| --- | --- | --- |
| `core/agent` | the 7-stage loop, agent state machine | `control/agent-state.json`, `genesis status` |
| `core/orchestrator` | sequences several agent turns, parallelism limits, budgets | `core/event-bus` (every step emits events) |
| `core/planner` | decision → ordered steps with acceptance + rollback points | `plans` table (4 real plans extracted) |
| `core/executor` | mutation protocol `READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT` | `core/checkpoint` (snapshot/diff/rollback) |
| `core/verifier` | gates: schema, tests, policies, acceptance | `core/validation/schema.js`, `node --test tests/`, `genesis doctor` |
| `core/recovery` | the 11 interruption types + 8 recovery capabilities | `core/checkpoint`, `EventBus` INTERRUPTION_RAISED |

## 3. Mutation protocol (POL-0002 — non-negotiable)

```
READ       read the current file/row exactly as it is
UNDERSTAND parse it into a structure (never treat source as opaque text)
DIFF       compute the minimal difference against the desired state
PLAN       list the concrete patches, in order, each reversible
PATCH      apply the SMALLEST possible change (never rewrite the whole file)
VERIFY     run the gates; on failure, stop
COMMIT     write, checkpoint, emit events, update state
```

Anti-goal (from `control/manifest.json → vision.anti_goals`): *letting the AI
rewrite entire files or the whole project instead of patching them.*

## 4. Interruptions and recovery (DEC-00004)

11 types: `blocked`, `failed`, `interrupted`, `waiting_user`, `dependency_missing`,
`tool_error`, `ambiguity`, `conflict`, `resource_limit`, `security_stop`,
`scope_change`.

8 capabilities: `checkpoint`, `rollback`, `resume`, `retry`, `recover`, `skip`,
`pause`, `continue`. Implemented today: `checkpoint`, `rollback`, `resume`, `diff`.

Every interruption is a **first-class event**: it is written to the RAW sink,
indexed, visible in `genesis timeline` and shown as an open block in
`genesis status` and in the console dashboard. Real example already stored:
`INT-00001 · security_stop · GitHub token cannot create repositories (HTTP 403)`
blocking `TSK-00011`.

## 5. External orchestrators are adapters only

LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise, Langflow and MCP servers plug in
through `mcp/` and `automation/`. The core never imports them (POL-0001:
zero npm dependencies, fully offline). An adapter that disappears must not break
a single core capability.

## 6. Acceptance criteria (exit gate)

- [ ] `genesis agent run --turns 1` executes the 7 stages and emits one event per stage.
- [ ] A checkpoint is created before every mutation and `genesis diff` shows the patch.
- [ ] A failing verification gate triggers automatic rollback, not a half-applied change.
- [ ] Every interruption carries one of the 11 types and is recoverable or explicitly not.
- [ ] `reason` writes a Decision Trace (objective/context/constraints/alternatives/
      decision/justification/consequence/status) — never private model reasoning.
- [ ] The agent works with an empty `node_modules` and no network.
- [ ] Budgets (turns, tokens, wall time, files touched) are enforced and observable.

## 7. Related

`core/agent/SPEC.md` (this file) · `memory/SPEC.md` · `skills/SPEC.md` ·
`docs/ARCHITECTURE.md` · `control/policies.json` (POL-0002, POL-0006) ·
`control/roadmap.json → phase-5`

# MEMORY LAYER — SPEC (implemented façades over Phases 0–2)

> **Status: IMPLEMENTED (read-only).** The memory layer adds no new behaviour: it
> composes data already produced by Phases 0–2 behind one door, so Phase 5 (the
> agent) never has to know how anything is stored.

| Field | Value |
| --- | --- |
| Modules | `memory/project`, `memory/session`, `memory/decisions`, `memory/lessons`, `memory/index.js` |
| Layer | `6 agents` (consumed by the agent loop) |
| Contract | every function returns `Result {ok, value | error}` |
| Depends on | `core/manifest`, `core/state`, `core/capture`, `knowledge/*` |

## 1. The four memories (cognitive metaphor, deliberately)

| Façade | Question it answers | Cognitive analogue |
| --- | --- | --- |
| `projectMemory()` | What is this project and where does it stand? | semantic memory (stable facts) |
| `sessionMemory(id)` | What just happened in this conversation? | episodic memory (events in time) |
| `decisionMemory()` | Why is the project the way it is? | justificatory memory (reasons) |
| `lessonMemory()` | What must we not repeat, and which rule enforces it? | procedural memory (how to act) |

`memory/index.js` aggregates them:

```js
memorySnapshot({ compact, sessionId, language })  // what an agent loads on startup
recall(query)                                      // FTS5 across every entity + why-chains
recallForPrompt({ language })                      // one page of text for a prompt
```

## 2. Rules

1. **Read-only.** No façade writes. Writing stays in the pipeline and the CLI, so
   "who changed this?" always has one answer.
2. **One door.** Phase 5 modules must import `memory/*`, never open tables.
3. **Flags, not lies.** Anything derived is labelled (`generated_at`, totals).
4. **Mixed contracts are debt, documented.** `loadDecision()` returns a plain
   object or `null` while the rest returns `Result`; unifying both is a Phase 3
   task noted in `docs/CONVENTIONS.md`.

## 3. Acceptance criteria (met)

- [x] `memorySnapshot({compact:true})` renders a one-page project memory.
- [x] `sessionMemory()` returns RAW content + interpretation + produced entities.
- [x] `recallDecision()` carries the rendered trace and its provenance chain.
- [x] `lessonMemory()` exposes lessons, origin errors, histogram and proposed rules.
- [x] Missing arguments and unknown ids fail with typed, readable errors.
- [x] Covered by `tests/memory-facades.test.js` (11 cases).

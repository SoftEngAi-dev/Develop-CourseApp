# PHASE 3 · DOCUMENTATION ENGINE — SPEC

> **Status: SKELETON.** The module signatures in `documentation/engine/index.js`
> exist and return `notImplemented(...)`. Nothing here is executable yet.
> Agreed scope (DEC-00009): physical skeleton of all 8 phases, Phases 0–2 executable.

| Field | Value |
| --- | --- |
| Phase | `phase-3` |
| Task | `TSK-00006` |
| Layer | `9 documentation` |
| Weight | 10% of total progress |
| Depends on | `phase-2` (Knowledge Engine) — **completed** |
| Module | `documentation/engine/index.js` |
| Output | `documentation/generated/`, `documentation/architecture/`, `documentation/sessions/`, `documentation/tutorials/`, `documentation/courses/` |

## 1. Purpose

Documentation must be a **by-product of data that already exists**, never a task
somebody has to remember. If the knowledge base holds 11 Decision Traces, 19+
observable events and a 78-node graph, then the documentation is already written —
it only has to be *rendered*.

Central rule inherited from Layer 0: **nothing happens without leaving an
observable project event.** The Documentation Engine is the layer that turns those
events into human-readable form.

## 2. Inputs (all already produced by Phase 2)

| Input | Source | Access |
| --- | --- | --- |
| Decision Traces | `decisions` table | `knowledge/processor/decisions.js → loadDecision / renderDecisionTrace` |
| Provenance chains | `searches`, `sources`, `actions`, `lessons` | `knowledge/processor/searches.js → provenanceChain(db, id)` |
| Timeline | `events` sink + database | `knowledge/retrieval/search.js → timeline()` |
| Knowledge graph | `nodes`, `edges` | `knowledge/graph/index.js → exportGraph / nodeProfile` |
| Requirements | `requirements` + `requirement_changes` | `knowledge/processor/requirements.js → requirementCoverage` |
| Lessons & failures | `lessons`, `errors` | `memory/lessons/index.js → lessonMemory()` |
| Architecture facts | `control/manifest.json`, `control/roadmap.json` | `core/manifest/index.js` |
| Session context | Context Engine | `knowledge/retrieval/context.js → renderContextMarkdown()` |

## 3. Planned capabilities (declared signatures)

```js
generateAll({ db, outDir, formats, languages })          // every generator, in order
generateArchitectureDocs({ db, outDir, languages })      // levels, layers, pipeline, modules, graph
generateTimeline({ db, outDir, from, to, granularity })  // day -> events -> decisions -> deliveries
generateDecisionDocs({ db, outDir, languages })          // one Markdown file per DEC-xxxxx + index
generateTutorials({ db, outDir, audience })              // plans + searches + lessons -> how-to
verifyDocumentation({ db, outDir })                      // drift detection: docs vs database
```

## 4. Output contract

```
documentation/
  generated/
    INDEX.md                     # entry point, links to everything below
    architecture/OVERVIEW.md     # levels (5), layers (11), pipeline, mutation protocol
    architecture/GRAPH.md        # node kinds, relation kinds, hubs, density
    timeline/TIMELINE.md         # chronological, grouped by day
    decisions/INDEX.md           # table: id, status, layer, one-line decision
    decisions/DEC-00001.md       # full trace + provenance + consequences
    tutorials/<slug>.md          # step-by-step, generated from real plans
    requirements/COVERAGE.md     # every REQ + acceptance + status
  sessions/                      # one narrative file per captured session
  architecture/                  # hand-maintained diagrams and ADR references
  tutorials/                     # hand-written material that survives regeneration
  courses/                       # Phase 6 output (Reverse Engineering Curriculum)
```

Rules:

1. **`generated/` is never hand-edited.** Regeneration overwrites it. Anything a
   human wants to keep lives in `tutorials/`, `architecture/` or `docs/`.
2. **Trilingual content model.** Narrative sections are rendered in `es`, `en`,
   `pt` from the `{es, en, pt}` fields that entities already carry
   (see `docs/GLOSSARY.md`). Identifiers, code and file names stay in English.
3. **Every generated file carries a provenance header**: generator name, database
   row IDs used, generation timestamp, and the hash of its inputs. Identical
   inputs must produce identical bytes — the engine is deterministic, so a
   `git diff` after regeneration shows only real changes.
4. **Documentation is idempotent**, exactly like the pipeline (DEC-00007):
   running `generateAll()` twice in a row produces no diff.

## 5. Acceptance criteria (exit gate)

- [ ] `genesis docs` generates the whole tree in one call and prints a summary.
- [ ] Running it twice produces zero byte differences (`git diff --exit-code`).
- [ ] Every `DEC-xxxxx` in the database has a Markdown file, with alternatives,
      justification, consequence, status and provenance.
- [ ] `TIMELINE.md` contains every event in the sink, grouped by day.
- [ ] Every generated file has its provenance header and input hash.
- [ ] `verifyDocumentation()` reports drift when a row is changed by hand.
- [ ] `GET /api/docs` and `GET /api/docs/:path` serve the generated tree.
- [ ] All of it works offline, with zero npm dependencies (POL-0001, DEC-00005).

## 6. Why it is not implemented yet

The Knowledge Engine (Phase 2) is the source of every document. Building the
renderer before the extractors were stable would have produced documentation of
half-correct data — and, worse, documentation that *looked* authoritative.
Phase 2 is now verified idempotent (`init → demo → demo → process --force →
process --force` produces no duplicates), so Phase 3 can be built on solid ground.

## 7. Related

- `docs/ARCHITECTURE.md` — hand-written architecture reference (kept until Phase 3 replaces it)
- `docs/DECISIONS.md` — the 11 seeded Decision Traces in readable form
- `docs/CONVENTIONS.md` — trilingual comment policy and the generated-vs-written rule
- `control/roadmap.json` → `phase-3`

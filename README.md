# 🧬 GENESIS — Project Knowledge & Autonomous Engine

> **Central rule:** *Nothing happens without leaving an observable project event.*
>
> **North star:** *No future session should have to re-read the universe — the
> project explains, recovers, continues and improves itself.*

GENESIS turns every development conversation into structured knowledge,
documentation, an interactive course and an executable project state.

**Zero npm dependencies. Zero build. Fully offline.** Node ≥ 22.5 is the only
requirement (`node:sqlite` + FTS5 are built in).

---

## Quick start

```bash
node core/cli/genesis.js doctor      # environment check: node, sqlite, FTS5, paths
npm run pipeline                     # init → demo → process → checkpoint → snapshot
npm run serve                        # API + installable offline console on :4321
npm test                             # 65 tests on Node's built-in runner
```

Then open `http://127.0.0.1:4321` and **install it as an app** (desktop: browser
menu → Install; mobile: Add to Home Screen). It keeps working with the server
stopped.

Use `--port 3000 --host 0.0.0.0` to publish it on another port/interface.

## The two modes (DEC-00012, POL-0011)

| Mode | Data source | When |
| --- | --- | --- |
| **ONLINE** | live API (`/api/*`, 31 routes) | server reachable |
| **OFFLINE** | service-worker cache of the last good responses | server down, app used before |
| **SNAPSHOT** | bundled `apps/console/snapshot.json` (77 frozen API responses) | never connected yet |

The interface always shows which mode is active and when it last synced. Stale
data is never presented as fresh.

## What actually runs today (Phases 0–2 + application)

```
genesis init        directories, manifest, state, first checkpoint
genesis demo        ingest + process the real founding conversation
genesis process     idempotent extraction → decisions, plans, errors, searches,
                    requirements, lessons, knowledge graph, FTS5 index
genesis resume      Context Engine: state + task + checkpoint + decisions +
                    failed attempts + constraints + files, as text or Markdown
genesis search q    FTS5 across every entity (diacritics-insensitive, trilingual)
genesis graph       nodes/edges/hubs; #/graph draws it with a force simulation
genesis decisions   12 explainable Decision Traces with provenance
genesis timeline    the observable history, day by day
genesis checkpoint | diff | rollback      mutation safety net (POL-0002/0003)
genesis serve       node:http API + offline PWA console, zero dependencies
```

## Repository map (5 levels, DEC-00001)

```
control/            level 5 CONTROL   manifest, state, roadmap, tasks, policies,
                                      decisions, checkpoints
data/raw            level 1 RAW       sessions, messages, events (append-only)
data/processed      level 2 PROCESSED interpretations and summaries
knowledge/          level 3 KNOWLEDGE db+migrations, ingestion, processors, graph,
                                      retrieval (search + context)
memory/             level 3 façade    project / session / decisions / lessons
core/               level 4 PROJECT   shared, logger, event-bus, manifest, state,
                                      checkpoint, capture, validation, api, cli,
                                      agent|orchestrator|planner|executor|verifier|
                                      recovery (Phase 5 skeletons)
apps/console        level 4           installable offline PWA (vanilla, dual mode)
apps/web            level 4           Next.js enhancement (deps isolated, optional)
documentation/      level 3 output    engine skeleton + generated/ sessions/ courses/
agents/ mcp/ automation/ skills/      adapter & evolution skeletons (Phases 5–7)
docs/               hand-written      ARCHITECTURE · ROADMAP · DECISIONS · GLOSSARY ·
                                      CONVENTIONS
tests/              verification      node:test suites (4 levels: unit, integration,
                                      pipeline idempotency, mutation-safety)
scripts/            rituals           seed-demo-session · run-full-pipeline ·
                                      generate-icons · export-console-snapshot
```

## Architecture in one breath

Five data levels · eleven build layers · Decision Traces instead of private model
reasoning (DEC-00003) · interruptions as first-class typed events (DEC-00004) ·
mutation protocol `READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT`
(POL-0002) · external orchestrators (LangGraph, CrewAI, AutoGen, n8n, Dify,
Flowise, Langflow, MCP) as **optional adapters only**, never core imports
(POL-0001) · learning loop `ERROR → ANALYSIS → RECOVERY → LESSON → RULE →
PRECHECK`.

Phases 3–7 exist as honest skeletons: real signatures that return
`notImplemented({...})` with the phase, the SPEC path and what you can use today
(see each `SPEC.md` and `docs/ROADMAP.md`).

## Education policy

Every source file carries a trilingual ES/EN/PT header and a **BEGINNER COURSE**
block that explains its concepts as if the reader had never programmed. Narrative
data is stored as `{es, en, pt}`; identifiers and code stay in English
(`docs/CONVENTIONS.md`, `docs/GLOSSARY.md`).

## Status

Progress 40% (Phases 0–2 complete) · 12 Decision Traces · 11 policies · 80 graph
nodes / 150 edges · 2 lessons with proposed hard rules · 1 open interruption
(`INT-00001`, security_stop: the sandbox token cannot create the mirror
repository — recovery plan in `control/tasks.json`, DEC-00011).

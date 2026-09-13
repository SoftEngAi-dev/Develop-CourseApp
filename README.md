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
npm run pipeline                     # init → demo → process → docs → checkpoint → snapshot
npm run serve                        # API + installable offline console on :4321
npm test                             # 90 tests on Node's built-in runner
```

Optional Next.js enhancement (Phase 4, isolated in `apps/web`):

```bash
npm run web:install                  # next/react ONLY inside apps/web
npm run web:build                    # GENESIS_API defaults to http://127.0.0.1:4321
npm run web:start                    # server-rendered app on :4000, proxies /api/*
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
| **SNAPSHOT** | bundled `apps/console/snapshot.json` (83 frozen API responses) | never connected yet |

The interface always shows which mode is active and when it last synced. Stale
data is never presented as fresh.

## What actually runs today (all 8 phases)

```
genesis init        directories, manifest, state, first checkpoint
genesis demo        ingest + process the real founding conversation
genesis process     idempotent extraction → decisions, plans, errors, searches,
                    requirements, lessons, knowledge graph, FTS5 index
genesis resume      Context Engine: state + task + checkpoint + decisions +
                    failed attempts + constraints + files, as text or Markdown
genesis search q    FTS5 across every entity (diacritics-insensitive, trilingual)
genesis graph       nodes/edges/hubs; #/graph draws it with a force simulation
genesis decisions   13 explainable Decision Traces with provenance
genesis timeline    the observable history, day by day
genesis checkpoint | diff | rollback      mutation safety net (POL-0002/0003)
genesis serve       node:http API + offline PWA console, zero dependencies
genesis docs        automatic documentation set + drift verifier (Phase 3)
genesis agent       autonomous 7-stage turn, dry-run by default (Phase 5)
genesis courses     completed builds → lessons with exercises + real code (Phase 6)
genesis evolve      promote rules → policies → prechecks, metrics (Phase 7)
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
                                      planner, executor, verifier, recovery,
                                      orchestrator, agent (Phase 5 implemented)
apps/console        level 4           installable offline PWA (vanilla, dual mode)
apps/web            level 4           Next.js enhancement — DELIVERED: 12 server-
                                      rendered routes, deps isolated, optional
documentation/      level 3 output    engine + courses (Phases 3/6 implemented) +
                                      generated/ (docs, decision traces, lessons)
agents/ mcp/ automation/              adapter skeletons (external frameworks only)
skills/             level 3           evolution engine (Phase 7 implemented)
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

All eight phases are **implemented** (DEC-00013, DEC-00014): the documentation
engine generates and verifies its own docs, the agent runs the 7-stage loop
dry-run-first with a tool whitelist, completed builds become lessons with
runnable solutions, lesson rules get promoted to machine-checked policies, and
the Next.js app (`apps/web`) renders 12 server-side routes from the same
31-route API. Only the external adapter surfaces (`agents/`, `mcp/`,
`automation/`) remain honest skeletons by design (DEC-00009): real signatures
that return `notImplemented({...})` — frameworks like LangGraph or MCP servers
plug in as API clients, never as core imports.

## Education policy

Every source file carries a trilingual ES/EN/PT header and a **BEGINNER COURSE**
block that explains its concepts as if the reader had never programmed. Narrative
data is stored as `{es, en, pt}`; identifiers and code stay in English
(`docs/CONVENTIONS.md`, `docs/GLOSSARY.md`).

## Status

**Progress 100% — all 8 phases complete** (the state machine computed it: every
task traversed planned→ready→running→verifying→completed) ·
14 Decision Traces · 12 policies (POL-0012 born from lesson LES-00001) ·
13 prechecks installed (2 blocking) · 82 graph nodes / 159 edges · 2 lessons ·
3 completed builds turned into course lessons · 90 green tests · generated
documentation verified consistent · 1 open interruption (`INT-00001`,
security_stop: the sandbox token cannot create the mirror repository on GitHub —
recovery plan in `control/tasks.json`, DEC-00011; the local mirror is synced and
the push command is ready for a human with permission).

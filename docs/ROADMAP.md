# ROADMAP

Source of truth: `control/roadmap.json` + `control/tasks.json` (weighted phase
completion). Read the live view with `genesis status` or the console dashboard.

| Phase | Name | Weight | Status | Delivered in this repo |
| --- | --- | --- | --- | --- |
| 0 | Bootstrap | 10% | ✅ completed | manifest, state, event bus, logger, checkpoints, schema validation |
| 1 | Capture | 10% | ✅ completed | session ingestion, RAW storage by hash, trilingual message parser |
| 2 | Knowledge Engine | 20% | ✅ completed | SQLite+FTS5, extractors (decisions/plans/errors/searches/requirements/lessons), knowledge graph, search, Context Engine |
| 3 | Documentation Engine | 10% | ✅ completed | `documentation/engine`: 4 generators (architecture, timeline, decision traces, tutorials) + `verifyDocumentation` drift gate; wired into `npm run pipeline` (auto-docs step) and `genesis docs` |
| 4 | Web App | 15% |  skeleton + ✅ PWA | installable offline console (dual mode) delivered; Next.js source present, deps not installed |
| 5 | Agent | 20% | ✅ completed | `core/planner` (verifiable steps, tool whitelist) · `core/executor` (mutation protocol, dry-run first, shell-free runCommand) · `core/verifier` (4 gates with evidence) · `core/recovery` (typed interruptions, suggest, recover) · `core/orchestrator` (budgets + PID lock + adapters) · `core/agent` (7-stage turn) · `genesis agent [--run]` + memory façades |
| 6 | Education | 10% | ✅ completed | `documentation/courses`: builds→lessons with the 8-section anatomy, REAL code excerpts, runnable solutions; reverse-engineered curriculum from decisions/errors/lessons; `genesis courses [--reverse]` |
| 7 | Autonomous Evolution | 5% | ✅ completed | `skills`: promoteRules (LES-00001→POL-0012), installPrechecks (13 checks, 2 blocking, consumed by verifyPolicies), registerSkill, evolutionMetrics (is_learning=true), proposeArchitectureEvolution (proposes, never self-applies); `genesis evolve` |

Cross-cutting: `TSK-00011` (mirror repository + PR) is **blocked** by `INT-00001`
(security_stop: the sandbox token cannot create repositories). Recovery plan is
written in `control/tasks.json`.

Progress model: `weighted_phase_completion`. A phase is complete only when its exit
criteria are verifiable by a command, not by opinion.

Current verified progress: **92.5%** (DEC-00013). Remaining: Phase 4 Next.js app
(`TSK-00007`) and the blocked mirror publication (`TSK-00011`, waiting on a human
with GitHub repo-creation permission).

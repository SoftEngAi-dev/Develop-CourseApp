# ROADMAP

Source of truth: `control/roadmap.json` + `control/tasks.json` (weighted phase
completion). Read the live view with `genesis status` or the console dashboard.

| Phase | Name | Weight | Status | Delivered in this repo |
| --- | --- | --- | --- | --- |
| 0 | Bootstrap | 10% | ✅ completed | manifest, state, event bus, logger, checkpoints, schema validation |
| 1 | Capture | 10% | ✅ completed | session ingestion, RAW storage by hash, trilingual message parser |
| 2 | Knowledge Engine | 20% | ✅ completed | SQLite+FTS5, extractors (decisions/plans/errors/searches/requirements/lessons), knowledge graph, search, Context Engine |
| 3 | Documentation Engine | 10% | 🦴 skeleton | `documentation/engine` signatures + SPEC; material lives in code comments and `docs/` |
| 4 | Web App | 15% |  skeleton + ✅ PWA | installable offline console (dual mode) delivered; Next.js source present, deps not installed |
| 5 | Agent | 20% | 🦴 skeleton | `core/agent|orchestrator|planner|executor|verifier|recovery` + memory façades implemented |
| 6 | Education | 10% | 🦴 skeleton | `documentation/courses` signatures + SPEC; BEGINNER COURSE blocks already teach |
| 7 | Autonomous Evolution | 5% | 🦴 skeleton | `skills` signatures + SPEC; 2 proposed hard rules waiting approval |

Cross-cutting: `TSK-00011` (mirror repository + PR) is **blocked** by `INT-00001`
(security_stop: the sandbox token cannot create repositories). Recovery plan is
written in `control/tasks.json`.

Progress model: `weighted_phase_completion`. A phase is complete only when its exit
criteria are verifiable by a command, not by opinion.

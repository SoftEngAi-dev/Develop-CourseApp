# AUTOMATION / TRIGGER LAYER — SPEC (skeleton)

> **Status: SKELETON.** `automation/index.js` publishes `PLANNED_FLOWS` and returns
> `notImplemented(...)`. The real trigger already exists: the Event Bus (19 typed
> events, RAW sink at `data/raw/events`). An automation is a persistent subscriber
> with an action attached.

Planned flows, by usefulness:

| id | trigger | action |
| --- | --- | --- |
| capture-then-process | `SESSION_ENDED` | process session, rebuild graph |
| process-then-document | `KNOWLEDGE_EXTRACTED` | regenerate `documentation/generated` (Phase 3) |
| error-then-lesson | `ERROR_DETECTED` | record analysis/recovery/lesson, propose rule |
| critical-then-stop | `ERROR_DETECTED (critical)` | raise `security_stop`, wait for a human |
| decision-then-notify | `DECISION_MADE` | notify affected tasks, update state |
| nightly-then-report | schedule daily | progress report from timeline + metrics |

Rules: subscribe, never poll; every flow must be idempotent (DEC-00007) because
retries and restarts will run it many times; external flow tools (n8n, Dify,
Flowise, Langflow) connect through webhooks over the HTTP API only.

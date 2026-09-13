# REVERSE-ENGINEERED CURRICULUM (generated)

> Generated 2026-09-13T18:07:17.322Z from 12 decisions, 1 errors, 2 lessons.
> 🇪🇸 Qué había que saber, deducido de lo que el proyecto hizo. 🇬🇧 What you had to know, inferred from what the project did. 🇧🇷 O que era preciso saber, deduzido do que o projeto fez.

## Prerequisite chain by layer

### decisions
- how a conversation becomes structured data (Phase 1 capture)
- the Result pattern: every function says ok/fail with evidence

### knowledge
- SQL basics + why SQLite (DEC-00002)
- FTS5 full-text search and its trigger traps

### core-engine
- the Event Bus closed taxonomy (DEC-00004)
- the 5 data levels and 11 layers (manifest)

### application
- HTTP without frameworks: node:http (POL-0001)
- PWA: service worker + manifest + snapshot (DEC-00012)

### verification
- node:test runner and TAP output
- mutation protocol and checkpoints (POL-0002/0003)

### learning-evolution
- lessons vs rules vs policies (the promotion chain)
- agent loop: observe→…→learn (POL-0006)

## Decision walk (in order)

- `DEC-00001` (architecture, approved) — Five-level separation (raw, processed, knowledge, project, control).
- `DEC-00002` (infrastructure, approved) — node:sqlite (integrado en Node 22) + tablas virtuales FTS5, con archivos
JSON para la configuración.
- `DEC-00003` (core-engine, approved) — Store Decision Traces: objective -> context used -> constraints -> alternatives considered -> decision -> justification -> action -> result -> verification -> learning.
- `DEC-00004` (core-engine, approved) — Interruptions become first-class events with types: blocked, failed, interrupted, waiting_user, dependency_missing, tool_error, ambiguity, conflict, resource_limit, security_stop, scope_change.
- `DEC-00005` (application, approved) — Front end híbrido de tres capas: (1) core/api, servidor HTTP sin
dependencias; (2) apps/console, interfaz estática offline servida por ese servidor;
(3) apps/web, aplicación Next.js que consume el mismo contrato de API.
- `DEC-00006` (documentation, approved) — Identifiers, types and events in English. Every file carries a trilingual header and a BEGINNER COURSE block; key logic carries stacked ES/EN/PT inline comments.
- `DEC-00007` (requirements, approved) — Full directory skeleton (section 25 of the architecture) with a SPEC.md per module, plus Phase 0 (Bootstrap), Phase 1 (Capture) and Phase 2 (Knowledge Engine) really implemented and tested.
- `DEC-00008` (core-engine, approved) — Implement core/validation/schema.js: a ~200-line chainable validator (z.string(), z.enum(), z.array(), z.object(), optional/default/parse/safeParse).
- `DEC-00009` (architecture, approved) — External orchestrators are optional adapters only. The core ships its own orchestrator/planner/executor contract.
- `DEC-00010` (verification, approved) — ESM modules ("type": "module") with the built-in node:test runner and node:assert/strict.
- `DEC-00011` (infrastructure, blocked) — Mirror the work into a local git repository named develo-courseapp-simplify, pre-configured with per-phase commits and a remote placeholder, so the user only has to create the GitHub repo and push.
- `DEC-00012` (application, approved) — Ship the console as an installable PWA: web manifest + generated PNG icons + service worker with per-resource cache strategies (cache-first shell, network-first API with last-good fallback) + a bundled snapshot.json so a never-connected install still opens with real data. One responsive codebase (drawer + bottom tabs on mobile, sidebar on desktop) covers both form factors. The UI always displays the active mode (live / cached / snapshot) and the sync time.

## Errors that taught something

- `ERR-00001` — gh repo create SoftEngAi-dev/develo-courseapp-simplify
  - recovery: construir en la rama de la sesión (cuyo push sí funciona) y dejar preparado un repositorio local listo para publicar en 

## Lessons (the distilled curriculum)

- `LES-00001` (verification) — Verificar los permisos reales del token antes de prometer operaciones de infraestructura externa; un dry-run de push no equivale a permiso de creación.
- `LES-00002` (learning-evolution) — La capacidad offline no es una característica de la interfaz, es una propiedad del núcleo. Si el núcleo depende de npm, ninguna interfaz será offline.

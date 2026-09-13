# DECISIONS

> Generated from `control/decisions.json` (the control plane is the source of
> truth; this file is its human face). Read any trace in full with
> `genesis decisions --why <term>` or in the console at #/decisions/<id>.

| ID | Layer | Status | Decision |
| --- | --- | --- | --- |
| DEC-00001 | architecture | approved | Five-level separation (raw, processed, knowledge, project, control). |
| DEC-00002 | infrastructure | approved | node:sqlite (built into Node 22) + FTS5 virtual tables, with JSON files for configuration. |
| DEC-00003 | core-engine | approved | Store Decision Traces: objective -> context used -> constraints -> alternatives considered -> decision -> justification -> action -> result -> verification -> learning. |
| DEC-00004 | core-engine | approved | Interruptions become first-class events with types: blocked, failed, interrupted, waiting_user, dependency_missing, tool_error, ambiguity, conflict, resource_limit, security_stop, scope_change. |
| DEC-00005 | application | approved | Hybrid three-layer front end: (1) core/api zero-dep HTTP server, (2) apps/console offline static UI served by it, (3) apps/web Next.js app consuming the identical API contract. |
| DEC-00006 | documentation | approved | Identifiers, types and events in English. Every file carries a trilingual header and a BEGINNER COURSE block; key logic carries stacked ES/EN/PT inline comments. |
| DEC-00007 | requirements | approved | Full directory skeleton (section 25 of the architecture) with a SPEC.md per module, plus Phase 0 (Bootstrap), Phase 1 (Capture) and Phase 2 (Knowledge Engine) really implemented and tested. |
| DEC-00008 | core-engine | approved | Implement core/validation/schema.js: a ~200-line chainable validator (z.string(), z.enum(), z.array(), z.object(), optional/default/parse/safeParse). |
| DEC-00009 | architecture | approved | External orchestrators are optional adapters only. The core ships its own orchestrator/planner/executor contract. |
| DEC-00010 | verification | approved | ESM modules ("type": "module") with the built-in node:test runner and node:assert/strict. |
| DEC-00011 | infrastructure | blocked | Mirror the work into a local git repository named develo-courseapp-simplify, pre-configured with per-phase commits and a remote placeholder, so the user only has to create the GitHub repo and push. |
| DEC-00012 | application | approved | Ship the console as an installable PWA: web manifest + generated PNG icons + service worker with per-resource cache strategies (cache-first shell, network-first API with last-good fallback) + a bundled snapshot.json so a never-connected install still opens with real data. One responsive codebase (drawer + bottom tabs on mobile, sidebar on desktop) covers both form factors. The UI always displays the active mode (live / cached / snapshot) and the sync time. |

## Full traces

### DEC-00001 — approved (architecture)

- **Objective (EN):** Decide how to organize system data so that nothing gets mixed together.
- **Objective (ES):** Decidir cómo organizar los datos del sistema para que nada se mezcle.
- **Objective (PT):** Decidir como organizar os dados do sistema para que nada se misture.
- **Context:** The system must preserve history, allow analysis, produce reusable knowledge and expose an operational brain.
- **Constraints:** Must survive between sessions; Must be inspectable by a human; Must not require a server to run
- **Alternatives:**
  - ❌ One single database holding everything — rejected: Mixes interpretation with raw history; impossible to audit.
  - ❌ One flat folder of markdown files — rejected: Not queryable, no relations, no graph.
  - ✅ Five separated levels: raw / processed / knowledge / project / control
- **Decision:** Five-level separation (raw, processed, knowledge, project, control).
- **Justification:** Raw stays immutable and auditable; processed can be regenerated; knowledge becomes reusable; control lets a new session avoid re-reading the universe.
- **Consequence:** The processed level can always be rebuilt from raw. Losing an index is never losing history.
- **Evidence:** Session where the architecture was defined by the user and validated against an empty repository.

### DEC-00002 — approved (infrastructure)

- **Objective (EN):** Choose the database and search engine for the Knowledge Engine.
- **Objective (ES):** Elegir la base de datos y el motor de búsqueda del Knowledge Engine.
- **Objective (PT):** Escolher o banco de dados e o motor de busca do Knowledge Engine.
- **Context:** Node 22.22 ships node:sqlite natively. Verified in this sandbox: table creation, writes, reads and FTS5 MATCH queries all work with zero npm packages.
- **Constraints:** Must work offline; Must not require npm install; Must support full-text search; Must be able to evolve to PostgreSQL later
- **Alternatives:**
  - ❌ JSON files only — rejected: No full-text search, no relations, O(n) scans.
  - ❌ better-sqlite3 (npm) — rejected: Native compilation, install step, breaks offline-first.
  - ❌ PostgreSQL — rejected: Requires a running server; overkill for a local-first MVP.
  - ❌ Vector DB — rejected: Heavy dependency; semantic search can be added later as an adapter.
  - ✅ node:sqlite (built-in) + FTS5
- **Decision:** node:sqlite (built into Node 22) + FTS5 virtual tables, with JSON files for configuration.
- **Justification:** Lowest initial complexity, real full-text search, local/offline operation, zero supply-chain risk.
- **Consequence:** The schema is portable SQL, so it can migrate to PostgreSQL later without redesign.
- **Evidence:** Executed probe: FTS5 OK, sqlite version 3.51.3.

### DEC-00003 — approved (core-engine)

- **Objective (EN):** Decide what to store about the AI's reasoning.
- **Objective (ES):** Decidir qué guardar del razonamiento de la IA.
- **Objective (PT):** Decidir o que guardar do raciocínio da IA.
- **Context:** The user asked to document reasoning. A literal transcription of a model's private reasoning is neither accessible nor useful.
- **Constraints:** Must be reproducible; Must be useful for learning; Must not fabricate internal thoughts
- **Alternatives:**
  - ❌ Store raw chain-of-thought — rejected: Not reliably available; noisy; not a learning artifact.
  - ❌ Store only the final answer — rejected: Loses the 'why', which is the whole point.
  - ✅ Store an explainable Decision Trace
- **Decision:** Store Decision Traces: objective -> context used -> constraints -> alternatives considered -> decision -> justification -> action -> result -> verification -> learning.
- **Justification:** It is more useful than raw reasoning because it is structured, queryable and teachable.
- **Consequence:** The question 'why did we choose X?' becomes answerable by navigating decision -> searches -> sources -> comparison -> implementation -> result.
- **Evidence:** Decision Trace example #00421 in the architecture conversation.

### DEC-00004 — approved (core-engine)

- **Objective (EN):** Formalize the process 'interruptions'.
- **Objective (ES):** Formalizar los 'cortes' (interrupciones) del proceso.
- **Objective (PT):** Formalizar os 'cortes' (interrupções) do processo.
- **Context:** The user called them 'Cortes'. They were informal notes about blocked work.
- **Constraints:** Must be machine-readable; Must feed a Failure & Recovery Engine
- **Alternatives:**
  - ❌ Keep them as free text notes — rejected: Not queryable, not recoverable.
  - ✅ First-class INTERRUPTION EVENT with typed taxonomy
- **Decision:** Interruptions become first-class events with types: blocked, failed, interrupted, waiting_user, dependency_missing, tool_error, ambiguity, conflict, resource_limit, security_stop, scope_change.
- **Justification:** A typed taxonomy allows automatic recovery planning and metrics on failure patterns.
- **Consequence:** Enables the Failure & Recovery Engine and the EVOLVE mode.
- **Evidence:** INTERRUPTION EVENT schema in the architecture conversation.

### DEC-00005 — approved (application)

- **Objective (EN):** Choose the application layer stack.
- **Objective (ES):** Elegir el stack de la capa de aplicación.
- **Objective (PT):** Escolher o stack da camada de aplicação.
- **Context:** The user answered 'all three options' and demanded: full-featured AND fully offline.
- **Constraints:** Must work with no node_modules at all; Must also offer the full React/Next.js experience; Both must share one API
- **Alternatives:**
  - ❌ Next.js only — rejected: Requires npm install; not offline-capable from a clean clone.
  - ❌ Zero-dep static SPA only — rejected: Does not satisfy the requested full stack.
  - ✅ Hybrid: zero-dep core + zero-dep console + Next.js app on the same API
- **Decision:** Hybrid three-layer front end: (1) core/api zero-dep HTTP server, (2) apps/console offline static UI served by it, (3) apps/web Next.js app consuming the identical API contract.
- **Justification:** The API contract becomes the seam. Offline capability is guaranteed by layer 1+2; full features by layer 3.
- **Consequence:** Any UI can be replaced without touching the engine.
- **Evidence:** User answer: 'Quiero una mezcla o seria hibrido... Seria una respuesta = Las 3.'

### DEC-00006 — approved (documentation)

- **Objective (EN):** Define the language of code and comments.
- **Objective (ES):** Definir el idioma del código y de los comentarios.
- **Objective (PT):** Definir o idioma do código e dos comentários.
- **Context:** User: 'todo la creacion en ingles, los comentarios de los codigos en trilingue con explicacion total como si fuera un curso para recien iniciando en el lenguaje y programacion en si.'
- **Constraints:** Code must be conventional; Comments must teach programming itself, not just this project
- **Alternatives:**
  - ❌ English-only comments — rejected: Contradicts the explicit trilingual teaching requirement.
  - ❌ Manual translation of prose docs only — rejected: Does not teach while reading code.
  - ✅ English identifiers + trilingual pedagogical comment blocks (ES/EN/PT) with a BEGINNER COURSE section
- **Decision:** Identifiers, types and events in English. Every file carries a trilingual header and a BEGINNER COURSE block; key logic carries stacked ES/EN/PT inline comments.
- **Justification:** Reading the source becomes a programming course in three languages at once.
- **Consequence:** Files are longer. That is accepted deliberately: teaching value outweighs brevity.
- **Evidence:** User answer to the language question.

### DEC-00007 — approved (requirements)

- **Objective (EN):** Define the scope of the first real delivery.
- **Objective (ES):** Definir el alcance de la primera entrega real.
- **Objective (PT):** Definir o escopo da primeira entrega real.
- **Context:** 32 sections of architecture existed but the repository contained only a 20-byte README.
- **Constraints:** Must not attempt 30 modules at once; Must leave a complete map for future sessions
- **Alternatives:**
  - ❌ Build phases 0-5 now — rejected: High risk of leaving everything half-finished.
  - ❌ Build only the core with no structure — rejected: Future sessions would have to redesign the layout.
  - ✅ Complete physical skeleton of all 8 phases + phases 0-2 fully executable
- **Decision:** Full directory skeleton (section 25 of the architecture) with a SPEC.md per module, plus Phase 0 (Bootstrap), Phase 1 (Capture) and Phase 2 (Knowledge Engine) really implemented and tested.
- **Justification:** A new session can read the skeleton and know exactly what exists, what is stubbed and what to build next.
- **Consequence:** Phases 3-7 are documented stubs, not dead folders: each has an executable-shaped contract.
- **Evidence:** User selected 'skeleton' scope.

### DEC-00008 — approved (core-engine)

- **Objective (EN):** Decide how to validate data without breaking the zero-dependency rule.
- **Objective (ES):** Decidir cómo validar datos sin romper la regla de cero dependencias.
- **Objective (PT):** Decidir como validar dados sem quebrar a regra de zero dependências.
- **Context:** The original stack table listed Zod for validation. Zod is an npm package; POL-0005 forbids core dependencies.
- **Constraints:** Zero npm dependencies; Readable error messages; Enough for manifest/state/event validation
- **Alternatives:**
  - ❌ Use Zod — rejected: Violates the zero-dependency core policy.
  - ❌ No validation at all — rejected: Corrupt control files would silently break every session.
  - ✅ Hand-written micro-validator with a chainable Zod-like API
- **Decision:** Implement core/validation/schema.js: a ~200-line chainable validator (z.string(), z.enum(), z.array(), z.object(), optional/default/parse/safeParse).
- **Justification:** Keeps the API shape familiar from Zod so swapping to the real Zod later is a one-line adapter change.
- **Consequence:** Validation covers the control plane; it is intentionally not a general-purpose schema library.
- **Evidence:** Verified npm-free runtime requirement.

### DEC-00009 — approved (architecture)

- **Objective (EN):** Decide the role of LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise and Langflow.
- **Objective (ES):** Decidir el papel de LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise y Langflow.
- **Objective (PT):** Decidir o papel de LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise e Langflow.
- **Context:** These frameworks were studied previously and are tempting to embed.
- **Constraints:** Must be replaceable without destroying the system
- **Alternatives:**
  - ❌ Put them all inside the core — rejected: Creates an unmaintainable monstrosity.
  - ❌ Ignore them — rejected: Throws away useful research.
  - ✅ Optional adapters behind a stable interface
- **Decision:** External orchestrators are optional adapters only. The core ships its own orchestrator/planner/executor contract.
- **Justification:** Technology can change without destroying the system.
- **Consequence:** mcp/ and agents/ directories define adapter contracts, not implementations, in this phase.
- **Evidence:** Architecture section 26 and 27.

### DEC-00010 — approved (verification)

- **Objective (EN):** Choose the test runner and module system.
- **Objective (ES):** Elegir el runner de pruebas y el sistema de módulos.
- **Objective (PT):** Escolher o runner de testes e o sistema de módulos.
- **Context:** Node 22 includes node:test and node:assert natively and supports ESM.
- **Constraints:** Zero dependencies; Watch mode desirable; Modern syntax
- **Alternatives:**
  - ❌ Jest/Vitest — rejected: npm dependencies.
  - ❌ CommonJS + no tests — rejected: Legacy syntax and no verification layer.
  - ✅ ESM + node:test + node:assert
- **Decision:** ESM modules ("type": "module") with the built-in node:test runner and node:assert/strict.
- **Justification:** Verification exists from day one at zero cost, satisfying Layer 8.
- **Consequence:** Tests run with `npm test` or `node --test tests/`.
- **Evidence:** node --test available in v22.22.3.

### DEC-00011 — blocked (infrastructure)

- **Objective (EN):** Create the separate develo-courseapp-simplify repository and open the PR there.
- **Objective (ES):** Crear el repositorio separado develo-courseapp-simplify y abrir allí el PR.
- **Objective (PT):** Criar o repositório separado develo-courseapp-simplify e abrir o PR nele.
- **Context:** The user asked for a second repository. The sandbox GitHub token is a limited integration.
- **Constraints:** Cannot create repositories; Cannot leave the session branch
- **Alternatives:**
  - ❌ Create the repo via gh — rejected: HTTP 403 'Resource not accessible by integration (createRepository)'.
  - ❌ Silently skip the request — rejected: Violates traceability.
  - ✅ Build in the session branch AND prepare a ready-to-push local repository /home/user/develo-courseapp-simplify with a simplify remote
- **Decision:** Mirror the work into a local git repository named develo-courseapp-simplify, pre-configured with per-phase commits and a remote placeholder, so the user only has to create the GitHub repo and push.
- **Justification:** Preserves the user's intent without inventing permissions we do not have.
- **Consequence:** One manual step remains for the human: create the GitHub repo (or grant permission) and run the provided push command.
- **Evidence:** gh repo create -> 403; git push --dry-run origin -> success.
- **Amendment (2026-09-13, after the verification suite):** The 403 applies ONLY to `createRepository`. `gh pr create` DOES work: PR https://github.com/SoftEngAi-dev/Develop-CourseApp/pull/1 is open from arena/01a09b49-develop-courseapp into main. TSK-00011 moves to 80%: the remaining blocked step is publishing the mirror repo develo-courseapp-simplify, which still needs a human to create it on GitHub (then: `git -C /home/user/develo-courseapp-simplify push -u origin main`). Observable events: TASK_PROGRESS emitted, checkpoint CHK-00006 (label pr-opened).

### DEC-00012 — approved (application)

- **Objective (EN):** Deliver the application usable on desktop and mobile, with and without internet connection, without adding dependencies.
- **Objective (ES):** Entregar la aplicación utilizable en escritorio y móvil, con y sin conexión a internet, sin añadir dependencias.
- **Objective (PT):** Entregar o aplicativo utilizável em desktop e celular, com e sem conexão com a internet, sem adicionar dependências.
- **Context:** The user asked for the app to work on desktop AND mobile, offline AND online (both modes). The console was already a zero-dependency web app served by genesis serve, but it was not installable and it died when the API was unreachable.
- **Constraints:** POL-0001: zero npm dependencies in the core, fully offline; No build step allowed for the offline console; One codebase must serve desktop and mobile; Stale data may be shown but must always be flagged as stale
- **Alternatives:**
  - ❌ Electron desktop app + Cordova/Capacitor mobile wrapper — rejected: Bundles Chromium/native toolchains and hundreds of npm packages; breaks POL-0001 and the empty-node_modules acceptance test, and triples repo size.
  - ❌ Tauri (Rust) shell — rejected: Requires a Rust toolchain on every machine that builds the app; the project must run on a bare Node 22 install.
  - ❌ Plain website without service worker, showing "you are offline" when the API dies — rejected: Fails the explicit requirement of being usable without connection; an error screen is not a mode.
  - ✅ Installable PWA (manifest + service worker + bundled snapshot.json) with a three-tier data layer: live API -> service-worker cache -> snapshot
- **Decision:** Ship the console as an installable PWA: web manifest + generated PNG icons + service worker with per-resource cache strategies (cache-first shell, network-first API with last-good fallback) + a bundled snapshot.json so a never-connected install still opens with real data. One responsive codebase (drawer + bottom tabs on mobile, sidebar on desktop) covers both form factors. The UI always displays the active mode (live / cached / snapshot) and the sync time.
- **Justification:** A PWA is the only option that installs on desktop and mobile, works offline, keeps zero dependencies and needs no build step. The service worker turns "offline" from an error into a mode with real data, and the snapshot makes even the first offline boot useful.
- **Consequence:** apps/console gains sw.js, manifest.webmanifest, icons/ (generated by scripts/generate-icons.js) and snapshot.json (generated by scripts/export-console-snapshot.js). POL-0011 now forbids shipping a view that cannot render from cache or snapshot. Regenerating the snapshot is part of the release ritual.
- **Evidence:** curl: /manifest.webmanifest -> application/manifest+json; /sw.js -> no-cache; /snapshot.json -> 74 frozen API responses; icons are valid PNGs (192/512/maskable) produced by a dependency-free encoder.

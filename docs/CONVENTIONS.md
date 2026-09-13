# CONVENTIONS

## 1 · Language policy

- Code, identifiers, file names, UI: **English**.
- Code comments: **trilingual ES/EN/PT**, each file opening with a header block
  (what it does, why it exists) and a **BEGINNER COURSE** section explaining its
  concepts as if the reader had never programmed.
- Narrative data (objectives, lessons, docs): `{es, en, pt}` objects.

## 2 · Results, not exceptions

Public functions return `{ok: true, value}` or `{ok: false, error}` where `error`
carries `message, code, interruptionType, layer, task, recoverable, details`.
Known deviation (documented debt, to unify in Phase 3): `loadDecision()` returns a
plain object or `null`.

## 3 · Idempotency (DEC-00007)

Every pipeline step must be safe to run twice: RAW is stored by SHA-256 hash,
derived entities dedupe by fingerprint, the graph rebuilds with `fresh: true`,
FTS indexes are rebuilt defensively on open. Verified by running
`init → demo → demo → process --force → process --force` with zero duplicates.

## 4 · Patch, never rewrite (POL-0002)

Mutations follow READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT with a
checkpoint before. Generated files (`documentation/generated`, `snapshot.json`,
icons) are the only exceptions: they are regenerated wholesale on purpose.

## 5 · Events

Anything observable emits a typed event to the RAW sink. New event types are added
to `core/event-bus/event-types.js` first, never invented inline.

## 6 · Dependencies

Root `package.json` keeps `dependencies: {}` and `devDependencies: {}` forever.
Node ≥ 22.5 (node:sqlite). Tests run on the built-in runner: `npm test`.
Anything needing npm lives in `apps/web` only.

## 7 · Skeletons shout

Phase 3–7 functions exist with their real signatures and return
`notImplemented({...})` from `core/shared/stub.js`, carrying phase, capability,
SPEC path and "what you can use today". A silent `undefined` is a defect.

## 8 · Commits

One logical commit per phase/area; messages state the layer touched. The mirror
repository (`develo-courseapp-simplify`) receives the same history.

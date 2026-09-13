# PHASE 6 · EDUCATION ENGINE — SPEC

> **Status: SKELETON.** `documentation/courses/index.js` declares the real
> signatures and returns `notImplemented(...)`. Scope: DEC-00009.

| Field | Value |
| --- | --- |
| Phase | `phase-6` · Task `TSK-00009` · Layer `9 documentation` |
| Weight | 10% |
| Modes | `learn`, `reverse-engineering-curriculum` (manifest `education.modes`) |
| Lesson anatomy | title · objective · concepts · implementation · explanation · tutorial · exercise · solution |
| Languages | es · en · pt (trilingual content model, never a translation step) |

## 1. Idea

The curriculum is **reverse-engineered from evidence**: what the project actually
did (11 Decision Traces, 4 plans, 1 full error cycle, 2 lessons, 1 search with
provenance) implies what had to be known to do it. The syllabus comes from data,
not from taste.

## 2. Declared capabilities

```js
buildCurriculum({ db, outDir, languages })
generateLesson({ db, topic, language })
generateExercises({ db, lessonId, runner })
reverseEngineerCurriculum({ db })
```

## 3. What already teaches

Every source file carries a trilingual header plus a **BEGINNER COURSE** block
(`education.comment_policy`), and `docs/GLOSSARY.md` models the trilingual concept
table. Phase 6 orders that material; it does not invent it.

## 4. Acceptance criteria (exit gate)

- [ ] `genesis course build` writes `documentation/courses/**` with the 8-section anatomy.
- [ ] Every exercise ships a machine-checkable solution (`node --test`).
- [ ] Every narrative section exists in es, en and pt from `{es,en,pt}` fields.
- [ ] The reverse-engineering mode cites the decision/error ids it learned from.

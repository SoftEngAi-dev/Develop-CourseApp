# How it was built: knowledge-layer
_Cómo se construyó: knowledge-layer · Como foi construído: knowledge-layer_

> Generated 2026-09-13T18:07:17.241Z from build `BLD-00001`. Anatomy: title · objective · concepts · implementation · explanation · tutorial · exercise · solution.

## 1. Objective
SQLite + FTS5 capture, processors, knowledge graph, retrieval and context engine (Phases 0-2)

## 2. Concepts
- **layer:knowledge** — every build belongs to exactly one of the eleven layers (manifest.layers)
- **decision:DEC-00001** — the build follows this Decision Trace
- **decision:DEC-00002** — the build follows this Decision Trace
- **decision:DEC-00003** — the build follows this Decision Trace
- **decision:DEC-00004** — the build follows this Decision Trace
- **verification** — the build is proven by 6 test file(s)

## 3. Implementation (real code)
From `knowledge/db/index.js` (first lines):

```javascript
/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/db/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: abre la base de datos SQLite del conocimiento, ejecuta
 *     las migraciones SQL y ofrece ayudantes seguros para consultar
 *     (all/get/run/tx) e indexar entidades en FTS5.
 *     POR QUÉ EXISTE (DEC-00002): usamos `node:sqlite`, integrado en Node 22.
 *     Cero dependencias npm, cero compilación nativa, funciona offline. El
 *     esquema es SQL portable: mañana puede migrar a PostgreSQL sin rediseño.
 *
 * 🇬🇧 EN — WHAT IT DOES: opens the SQLite knowledge database, runs the SQL
 *     migrations and offers safe query helpers (all/get/run/tx) plus entity
 *     indexing into FTS5.
 *     WHY IT EXISTS (DEC-00002): we use `node:sqlite`, built into Node 22.
 *     Zero npm dependencies, zero native compilation, works offline. The schema
 *     is portable SQL: it can migrate to PostgreSQL later without a redesign.
 *
 * 🇧🇷 PT — O QUE FAZ: abre o banco SQLite do conhecimento, executa as migrações
 *     SQL e oferece auxiliares seguros de consulta (all/get/run/tx) e indexação
 *     de entidades no FTS5.
 *     POR QUE EXISTE (DEC-00002): usamos `node:sqlite`, embutido no Node 22.
 *     Zero dependências npm, zero compilação nativa, funciona offline. O schema
 *     é SQL portável: pode migrar para PostgreSQL depois sem redesenho.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • ¿Qué es una migración? ES/EN/PT: un archivo SQL numerado que describe un
 *     cambio de esquema (0001_init.sql, 0002_add_x.sql). La base guarda cuáles
 *     ya aplicó en la tabla `schema_meta`, así al arrancar solo ejecuta los
 *     pendientes. Sin migraciones, cada desarrollador tendría un esquema distinto.
 *     A migration is a numbered SQL file; the DB records which ones ran.
 *   • Prepared statement ES/EN/PT: `db.prepare('SELECT * FROM t WHERE id = ?')`
 *     compila la consulta UNA vez y la reutiliza con distintos valores. Es más
 *     rápido y, sobre todo, evita SQL INJECTION: los `?` nunca se interpretan
 *     como código SQL. NUNCA hagas `"WHERE id = '" + entrada + "'"`.
 *     Prepared statements are faster and prevent SQL injection. Never concatenate.
 *   • ⚠️ node:sqlite solo acepta: null, number, bigint, string y Uint8Array.
 *     Un `undefined` o un `true` lanzan excepción. Por eso `sanitizeParams()`
 *     convierte undefined→null y boolean→1/0. Este es el error nº1 al empezar.
 *     node:sqlite accepts only null/number/bigint/string/Uint8Array: we convert.
 *   • Transacción ES/EN/PT: `BEGIN ... COMMIT` agrupa varias escrituras: o se
```

## 4. Explanation
Problems this build actually hit, and the fixes that actually worked:
1. ❗ FTS5 external-content tables silently return nothing when the content table is written without triggers
   ✅ migrations install the FTS triggers; tests assert search() finds seeded rows

## 5. Tutorial
1. read the build objective: "SQLite + FTS5 capture, processors, knowledge graph, retrieval and context engine (Phases 0-2)"
2. open the 9 file(s) it produced, starting with knowledge/db/index.js
3. run its verification: node --disable-warning=ExperimentalWarning --test tests/db.test.js
4. read the problems it hit and the fixes that worked (explanation section below)
5. solve the exercise and compare with the solution

## 6. Exercise
Write a node:test proving that knowledge/db/index.js exists and is non-empty, and that the build suite (tests/db.test.js) passes.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('knowledge-layer works', () => {
  // TODO: assert the file exists and has bytes
  // TODO: (advanced) run its test file with execFileSync and assert exit 0
});
```

## 7. Solution (runnable, real answer code)
The solution uses fs.statSync to prove existence AND size: an empty file is not an implementation. The second assert runs the build real suite.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('knowledge-layer works', () => {
  const stat = fs.statSync('knowledge/db/index.js');
  assert.ok(stat.size > 0, 'the implementation is not empty');
  execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', 'tests/db.test.js'], { stdio: 'pipe' });
});
```

## 8. Self-check
- Copy the solution into a temp file inside `tests/` and run `node --disable-warning=ExperimentalWarning --test <file>`.
- It must pass. If it fails, re-read sections 3 and 4 — the failure is a real behaviour of this build.

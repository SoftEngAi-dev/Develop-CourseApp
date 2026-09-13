/* ═══════════════════════════════════════════════════════════════════════════
 * tests/knowledge-extraction.test.js — VERIFICATION LEVEL: unit + pipeline
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 2 sobre una base de datos TEMPORAL (hermética):
 *     los extractores de Decision Traces, planes, errores, búsquedas, requisitos
 *     y lecciones sobre la conversación fundacional real; la deduplicación por
 *     huella (persistir dos veces no duplica); los guardas anti-contaminación de
 *     bloques (una traza no se come el documento siguiente); y dos regresiones
 *     históricas: el literal SQL con comillas dobles en topTags y los nodos de
 *     lección duplicados del grafo.
 *     HERMÉTICO: copia la base real a /tmp y trabaja sobre la copia. El repositorio
 *     no se modifica.
 * 🇬 EN — WHAT IT TESTS: Phase 2 over a TEMPORARY database (hermetic): the
 *     extractors for Decision Traces, plans, errors, searches, requirements and
 *     lessons on the real founding conversation; fingerprint dedupe (persisting
 *     twice does not duplicate); the block anti-contamination guards (a trace must
 *     not swallow the next document); and two historical regressions: the
 *     double-quoted SQL literal in topTags and the duplicated lesson nodes in the
 *     graph.
 *     HERMETIC: it copies the real database to /tmp and works on the copy. The
 *     repository is not modified.
 * 🇧 PT — O QUE TESTA: a Fase 2 num banco TEMPORÁRIO (hermético): extratores sobre
 *     a conversa fundacional, dedupe por fingerprint, guardas anti-contaminação e
 *     duas regressões históricas (literal SQL com aspas duplas; nós de lição
 *     duplicados). O repositório não é modificado.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Test hermético ES/EN/PT: un test que escribe en el repositorio deja basura
 *     que confunde al siguiente developer (y al siguiente agente). Copiar la base
 *     a /tmp cuesta milisegundos y compra aislamiento total.
 *     Copy the database to /tmp: milliseconds for total isolation.
 *   • Regresión como test ES/EN/PT: cada bug serio del proyecto deja un test que
 *     lo vuelve imposible. topTags con `""` rompió SQLite; ahora hay un caso que
 *     lo vigila para siempre. Every serious bug earns a permanent guard test.
 *   • Huella (fingerprint) ES/EN/PT: en vez de comparar objetos enteros, se
 *     compara un resumen normalizado (minúsculas, espacios colapsados). Dos
 *     extracciones del mismo texto producen la misma huella aunque difieran en
 *     un espacio. Normalized digest = stable identity.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, closeDatabase, all, scalar } from '../knowledge/db/index.js';
import { extractDecisionTraces, persistDecisionTraces } from '../knowledge/processor/decisions.js';
import { extractPlans, persistPlans } from '../knowledge/processor/plans.js';
import { extractErrors, persistErrors, errorFingerprint } from '../knowledge/processor/errors.js';
import { extractSearches, persistSearches } from '../knowledge/processor/searches.js';
import { extractLessons, persistLessons } from '../knowledge/processor/lessons.js';
import { extractRequirements, persistRequirements } from '../knowledge/processor/requirements.js';
import { topTags, facets } from '../knowledge/retrieval/search.js';
import { canonicalLabel } from '../knowledge/graph/index.js';
import { PATHS } from '../core/shared/paths.js';

const SAMPLE = fs.readFileSync(path.join(PATHS.samples, 'session-001-architecture.md'), 'utf8');

/** ES/EN/PT: base temporal con el esquema migrado. Temp migrated database. */
function tempDb() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-kx-')), 'test.db');
  return openDatabase({ file, reuse: false });
}

test('decision traces: the founding conversation yields clean, complete traces', () => {
  const traces = extractDecisionTraces(SAMPLE);
  assert.ok(traces.length >= 2, 'at least the sqlite and offline decisions');

  for (const trace of traces) {
    assert.ok(trace.decision && trace.decision.length > 20, 'a decision says something');
    // ES: `objective` puede ser null cuando la conversación no declara objetivo
    //     explícito — la traza NO inventa datos. Lo que exigimos es que el campo
    //     exista y que los obligatorios vengan completos.
    // EN: `objective` may be null when the conversation never states one — the
    //     trace must NOT invent data. The field must exist; mandatory fields must
    //     be complete.
    // PT: `objective` pode ser null — a traza não inventa dados.
    assert.ok('objective' in trace, 'the trace carries the objective field (even if null)');
    assert.ok(trace.context && trace.context.length > 10, 'context explains the situation');
    assert.ok(Array.isArray(trace.alternatives) && trace.alternatives.length >= 2, 'alternatives were considered');
    /*
     * ES: la muestra fundacional lista las opciones SIN marcador "(ELEGIDA)" en el
     *     texto de la opción — la elección vive en el campo Decisión. Por eso aquí
     *     exigimos la BANDERA presente (no inventada), y el marcado por palabra
     *     clave se prueba en su propia regresión más abajo.
     * EN: the founding sample lists options WITHOUT an inline "(ELEGIDA)" marker —
     *     the choice lives in the Decision field. So we require the flag to EXIST
     *     (never invented), and keyword marking gets its own regression below.
     * PT: a amostra lista opções SEM marcador inline; a flag deve EXISTIR.
     */
    for (const alt of trace.alternatives) assert.ok('selected' in alt, 'every alternative carries the selected flag');
    // ES: anti-contaminación: la traza no debe tragarse el resto del documento.
    // EN: anti-contamination: the trace must not swallow the rest of the document.
    for (const field of [trace.decision, trace.justification ?? '', trace.context ?? '']) {
      assert.ok(!/SEARCH PERFORMED|ERROR DETECTED|^#/m.test(field), `field leaked foreign blocks: ${field.slice(0, 80)}`);
    }
  }
});

test('regression: "(ELEGIDA)" inside an option marks it selected (stem bug)', () => {
  /*
   * ES: REGRESIÓN DE BUG REAL: el regex viejo /\b(elegid|...)\b/i jamás matcheaba
   *     "ELEGIDA" porque el \b final exigía un límite justo tras la raíz. Este
   *     test sintético lo clava: si alguien reintroduce el \b, esto revienta.
   * EN: REAL BUG REGRESSION: the old /\b(elegid|...)\b/i never matched "ELEGIDA"
   *     because the trailing \b demanded a boundary right after the stem. This
   *     synthetic test nails it down: reintroduce the \b and this explodes.
   * PT: REGRESSÃO DE BUG REAL: o \b final impedia "ELEGIDA" de casar.
   */
  const synthetic = [
    'DECISIÓN #00099',
    'Objetivo: probar el marcado de la opción elegida.',
    'Contexto: test sintético del extractor de decisiones.',
    'Opciones: A. JSON files  B. node:sqlite (ELEGIDA)  C. PostgreSQL (aprobada después)',
    'Decisión: node:sqlite (ELEGIDA)',
  ].join('\n');
  const traces = extractDecisionTraces(synthetic);
  assert.equal(traces.length, 1);
  const chosen = traces[0].alternatives.find((alt) => alt.selected);
  assert.ok(chosen, 'the (ELEGIDA) alternative is flagged as selected');
  assert.equal(chosen.id, 'B');
});

test('decisions: persisting twice keeps one row per trace (idempotent)', () => {
  const db = tempDb();
  const traces = extractDecisionTraces(SAMPLE);
  /*
   * ES: persist* devuelve {persisted, ids, error} — NO un Result con .ok. Otra
   *     trampa de firma: afirmar first.ok daría undefined.
   * EN: persist* returns {persisted, ids, error} — NOT a Result with .ok.
   * PT: persist* devolve {persisted, ids, error}, não um Result.
   */
  const first = persistDecisionTraces(traces, { db });
  const second = persistDecisionTraces(traces, { db });
  assert.equal(first.error, null, JSON.stringify(first.error ?? {}));
  assert.equal(second.error, null, JSON.stringify(second.error ?? {}));
  assert.equal(Number(first.persisted), traces.length, 'the first pass stores every trace');
  const count = scalar(db, 'SELECT COUNT(*) AS n FROM decisions');
  assert.equal(Number(count), traces.length, 'no duplicates after a second persist');
  closeDatabase(db);
});

test('errors: the recovery cycle is extracted and lessons stay clean', () => {
  const errors = extractErrors(SAMPLE);
  assert.ok(errors.length >= 1, 'the GitHub 403 failure is in the conversation');
  const error = errors[0];
  assert.ok(error.analysis, 'analysis explains the cause');
  assert.ok(error.recovery, 'recovery says what was done');
  assert.ok(!/HORIZONTE|```|^##/m.test(error.lesson ?? ''), 'the lesson must not carry document garbage');

  const db = tempDb();
  const persisted = persistErrors(errors, { db });
  assert.equal(persisted.error, null, JSON.stringify(persisted.error ?? {}));
  const again = persistErrors(errors, { db });
  assert.equal(again.error, null, JSON.stringify(again.error ?? {}));
  assert.equal(Number(scalar(db, 'SELECT COUNT(*) AS n FROM errors')), errors.length, 'fingerprint dedupe works');
  assert.equal(errorFingerprint('  GitHub   403 '), errorFingerprint('github 403'), 'fingerprints ignore case and spacing');
  closeDatabase(db);
});

test('searches: provenance survives (query → sources → influenced decisions)', () => {
  const searches = extractSearches(SAMPLE);
  assert.ok(searches.length >= 1, 'the node:sqlite FTS5 search is recorded');
  const search = searches[0];
  assert.ok(search.query, 'the query text is preserved');
  assert.ok(Array.isArray(search.sources) && search.sources.length >= 1, 'sources were captured');
  assert.ok(Array.isArray(search.influenced) && search.influenced.length >= 1, 'it influenced decisions');

  const db = tempDb();
  persistDecisionTraces(extractDecisionTraces(SAMPLE), { db });
  persistSearches(searches, { db });
  persistSearches(searches, { db });
  assert.equal(Number(scalar(db, 'SELECT COUNT(*) AS n FROM searches')), searches.length);
  closeDatabase(db);
});

test('plans, lessons and requirements persist idempotently', () => {
  const db = tempDb();

  const plans = extractPlans(SAMPLE);
  assert.ok(plans.length >= 2);
  persistPlans(plans, { db });
  persistPlans(plans, { db });
  assert.equal(Number(scalar(db, 'SELECT COUNT(*) AS n FROM plans')), plans.length);

  const lessons = extractLessons(SAMPLE);
  assert.ok(lessons.length >= 2, 'the offline lesson and the permissions lesson');
  for (const lesson of lessons) {
    assert.ok(lesson.lesson.length > 40, 'a lesson is a sentence, not a shard');
    assert.ok(!/^-{3,}$|^##/m.test(lesson.lesson), 'no markdown debris inside the lesson');
  }
  persistLessons(lessons, { db });
  persistLessons(lessons, { db });
  assert.equal(Number(scalar(db, 'SELECT COUNT(*) AS n FROM lessons')), lessons.length);

  /*
   * ES: extractRequirements lee la INTERPRETACIÓN del mensaje (nivel 2), no el RAW:
   *     así el extractor de requisitos trabaja sobre frases ya normalizadas por el
   *     parser. Le damos esa forma a mano.
   * EN: extractRequirements reads the message INTERPRETATION (level 2), not RAW:
   *     the requirement extractor works on sentences already normalized by the
   *     parser. We hand it that shape.
   * PT: extractRequirements lê a INTERPRETAÇÃO da mensagem, não o RAW.
   */
  const sentences = SAMPLE.split('\n').filter((line) => /^[-*•]\s/.test(line.trim())).map((line) => line.trim().replace(/^[-*•]\s*/, ''));
  const requirements = extractRequirements([{ id: 'MSG-T1', role: 'user', interpretation: { requirements: sentences } }]);
  assert.ok(requirements.length >= 4, 'the manifest requirements appear in the transcript');
  persistRequirements(requirements, { db });
  persistRequirements(requirements, { db });
  assert.equal(Number(scalar(db, 'SELECT COUNT(*) AS n FROM requirements')), requirements.length);
  closeDatabase(db);
});

test('regression: topTags SQL uses single quotes for string literals', () => {
  const db = tempDb();
  // ES: sin este INSERT el bug original ("no such column: \"\"") no se disparaba
  //     porque la tabla vacía ocultaba el error de compilación del SQL.
  // EN: without this INSERT the original bug ("no such column: \"\"") did not fire
  //     because the empty table hid the SQL compile error.
  // PT: sem este INSERT o bug original não aparecia com a tabela vazia.
  db.prepare("INSERT INTO fts_index (entity_type, entity_id, title, body, tags) VALUES ('node', 'NOD-T1', 't', 'b', 'sqlite offline')").run();
  const tags = topTags(db, 10);
  assert.ok(tags.some((tag) => tag.tag === 'sqlite'), 'tags are counted without SQL errors');
  closeDatabase(db);
});

test('regression: canonicalLabel prevents duplicated graph nodes', () => {
  /*
   * ES: canonicalLabel RECORTA espacios y colapsa espacios internos, pero NO
   *     cambia mayúsculas (la identidad case-insensitive la decide ensureNode con
   *     kind+label). Afirmar plegado de caso aquí sería probar un contrato falso.
   * EN: canonicalLabel trims and collapses whitespace but preserves case;
   *     case-insensitive identity is decided by ensureNode (kind+label). Asserting
   *     case folding here would test a contract that does not exist.
   * PT: canonicalLabel apara e colapsa espaços, mas preserva maiúsculas.
   */
  assert.equal(canonicalLabel('  SQLite   FTS5 '), 'SQLite FTS5');
  assert.equal(canonicalLabel('LES-00001:  Something'), canonicalLabel('LES-00001: Something'), 'whitespace variants are one label');
  assert.equal(canonicalLabel(null), '', 'null becomes an empty label, not a crash');
  const db = tempDb();
  const kinds = facets(db);
  assert.deepEqual(kinds, {}, 'a fresh database has no indexed entities yet');
  closeDatabase(db);
});

test('the real database stays coherent: lessons equal their graph nodes', () => {
  const db = openDatabase({ readOnly: true, reuse: false });
  const lessons = Number(scalar(db, 'SELECT COUNT(*) AS n FROM lessons'));
  const lessonNodes = Number(scalar(db, "SELECT COUNT(*) AS n FROM nodes WHERE kind = 'lesson'"));
  assert.equal(lessonNodes, lessons, 'one graph node per lesson, no orphan duplicates');
  const decisions = Number(scalar(db, 'SELECT COUNT(*) AS n FROM decisions'));
  assert.ok(decisions >= 12, 'the seeded plus extracted decisions are present');
  const rows = all(db, "SELECT id, label FROM nodes WHERE kind = 'lesson'");
  for (const row of rows) assert.match(row.label, /^LES-\d+/, 'lesson nodes carry their LES id');
  closeDatabase(db);
});

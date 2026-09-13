/* ═══════════════════════════════════════════════════════════════════════════
 * tests/retrieval-context.test.js — VERIFICATION LEVEL: integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la mitad "usar el conocimiento" de la Fase 2 sobre la base
 *     REAL (solo lectura): búsqueda FTS5 insensible a diacríticos y trilingüe,
 *     facets y top tags, timeline agrupado por día, `whyDidWeChoose` con su cadena
 *     de procedencia, y el Context Engine completo: buildSessionContext debe
 *     traer estado + tarea + checkpoint + decisiones relevantes + intentos
 *     fallidos + restricciones + archivos, y sus dos renderizados (texto y
 *     Markdown para pegar en un chat) deben contener las secciones prometidas.
 * 🇬 EN — WHAT IT TESTS: the "use the knowledge" half of Phase 2 over the REAL
 *     database (read-only): diacritic-insensitive trilingual FTS5 search, facets
 *     and top tags, timeline grouped by day, `whyDidWeChoose` with its provenance
 *     chain, and the full Context Engine: buildSessionContext must bring state +
 *     task + checkpoint + relevant decisions + failed attempts + constraints +
 *     files, and its two renderings (text and Markdown to paste into a chat) must
 *     contain the promised sections.
 * 🇧 PT — O QUE TESTA: a metade "usar o conhecimento" da Fase 2 sobre o banco
 *     REAL (somente leitura): busca FTS5 trilíngue sem diacríticos, facets,
 *     timeline por dia, whyDidWeChoose com procedência e o Context Engine completo
 *     com seus dois renderizados.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Solo lectura en tests ES/EN/PT: abrir la base con `readOnly: true` hace
 *     IMPOSIBLE que un test rompa el conocimiento. Si el test necesita escribir,
 *     que use una copia temporal (ver knowledge-extraction.test.js).
 *     Read-only handles make data-breaking tests impossible.
 *   • FTS5 y diacríticos ES/EN/PT: el tokenizador `unicode61 remove_diacritics 2`
 *     guarda "decision" aunque escribas "decisión". Sin eso, cada idioma viviría
 *     en su propio índice y el proyecto trilingüe se rompería por el acento.
 *     The tokenizer folds accents so the three languages share one index.
 *   • bm25 ES/EN/PT: el ranking de FTS5: no cuenta solo coincidencias, pesa qué
 *     tan raras son las palabras que coinciden. "sqlite" en un texto sobre queso
 *     puntúa más que "the". Rarity-aware ranking.
 *   • Context Engine como contrato ES/EN/PT: `genesis resume` y la vista #/context
 *     consumen ESTO. Si buildSessionContext pierde una sección, el agente arranca
 *     ciego. Por eso el test enumera las secciones una a una.
 *     If the context loses a section, the agent boots blind: enumerate them all.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, closeDatabase } from '../knowledge/db/index.js';
import { search, searchMessages, timeline, whyDidWeChoose, facets, topTags } from '../knowledge/retrieval/search.js';
import { buildSessionContext, renderSessionContext, renderContextMarkdown, findRelatedNodes } from '../knowledge/retrieval/context.js';

const db = openDatabase({ readOnly: true, reuse: false });
test.after(() => closeDatabase(db));

test('FTS5 search is diacritic-insensitive across the three languages', () => {
  const plain = search('decision', { db, limit: 10 });
  const accented = search('decisión', { db, limit: 10 });

  assert.ok(plain.results.length >= 1, 'plain English finds decisions');
  assert.equal(plain.engine, 'fts5', 'the FTS5 engine is the one answering');
  assert.deepEqual(
    accented.results.map((hit) => hit.id),
    plain.results.map((hit) => hit.id),
    'es and en must hit the same rows (remove_diacritics 2)',
  );

  // ES: segunda pareja de prueba con una palabra que SÍ existe en los datos en
  //     su forma acentuada ("búsqueda") y en su forma plegada ("busqueda").
  // EN: second pair using a word that exists in the data in accented form
  //     ("búsqueda") and proves the folded query ("busqueda") hits the same rows.
  // PT: segundo par com palavra que existe acentuada nos dados.
  const folded = search('busqueda', { db, limit: 10 });
  const original = search('búsqueda', { db, limit: 10 });
  assert.ok(folded.results.length >= 1, 'the folded Spanish query still finds rows');
  assert.deepEqual(folded.results.map((hit) => hit.id), original.results.map((hit) => hit.id));

  for (const hit of plain.results) {
    assert.ok(hit.snippet, 'every hit carries a snippet');
    assert.ok(hit.type, 'every hit says what entity type it is');
  }
});

test('search filters by entity type and reports facets', () => {
  const onlyDecisions = search('sqlite', { db, types: ['decision'], limit: 10 });
  assert.ok(onlyDecisions.results.every((hit) => hit.type === 'decision'));

  const all = facets(db);
  assert.ok(all.decision >= 12, 'facets count the seeded decisions');
  assert.ok(all.node >= 70, 'the graph nodes are indexed too');

  const tags = topTags(db, 10);
  assert.ok(tags.length >= 3, 'the tag cloud has substance');
  assert.ok(tags[0].n >= tags[tags.length - 1].n, 'tags come sorted by frequency');
});

test('message search reaches the RAW conversation', () => {
  const hits = searchMessages('offline', { db, limit: 5 });
  assert.equal(hits.engine, 'fts5', 'messages are indexed with FTS5 too');
  assert.ok(hits.results.length >= 1, 'the founding conversation discussed offline');
  assert.ok(hits.results[0].snippet, 'message hits carry a snippet');
  assert.ok(hits.results[0].message_id.startsWith('MSG-'), 'each hit points at a RAW message');
});

test('timeline groups every stored event by day, chronologically', () => {
  const data = timeline({ db, limit: 500 });
  assert.ok(data.count >= 10, 'the project has observable history');
  assert.ok(data.days.length >= 1);
  for (const day of data.days) {
    assert.match(day, /^\d{4}-\d{2}-\d{2}$/, 'day keys are ISO dates');
    assert.ok(data.by_day[day].length >= 1);
  }
  const types = new Set(data.events.map((event) => event.type));
  assert.ok(types.has('DECISION_MADE') || types.has('KNOWLEDGE_EXTRACTED'), 'real work left real events');
});

test('whyDidWeChoose links decisions to their searches and sources', () => {
  const answer = whyDidWeChoose('sqlite', { db });
  assert.ok(answer.count >= 1, 'the database choice is explainable');
  const chain = answer.chains[0];
  assert.ok(chain.decision.id.startsWith('DEC-'), 'the chain starts at a Decision Trace');
  assert.ok(chain.searches.length >= 1, 'the trace was informed by a search');
  assert.ok(chain.sources.length >= 1, 'the search carried sources');
});

test('Context Engine assembles every section the architecture promises', () => {
  const context = buildSessionContext({ db });
  assert.equal(context.ok ?? true, true);
  const value = context.value ?? context;

  assert.ok(value.progress, 'progress is present');
  assert.ok(value.current_phase, 'current phase is present');
  assert.ok(value.current_task, 'current task is present');
  assert.ok(value.last_checkpoint !== undefined, 'last checkpoint is present (even if null)');
  assert.ok(Array.isArray(value.relevant_decisions), 'relevant decisions are present');
  assert.ok(Array.isArray(value.failed_attempts), 'failed attempts are present');
  assert.ok(value.known_constraints, 'known constraints are present');
  assert.ok(Array.isArray(value.required_files), 'required files are present');
  assert.ok(value.next_recommended_action, 'a next action is recommended');
  assert.ok(Array.isArray(value.roadmap_remaining), 'the remaining roadmap is present');
});

test('the rendered context (text and Markdown) keeps its promises', () => {
  const context = buildSessionContext({ db });
  const value = context.value ?? context;

  const text = renderSessionContext(value);
  assert.match(text, /PROJECT/i);
  assert.match(text, /DECISION/i);
  assert.match(text, /NEXT/i);

  const markdown = renderContextMarkdown(value);
  assert.match(markdown, /^#/m, 'markdown has headings');
  assert.match(markdown, /checkpoint/i);
  assert.ok(markdown.length > 400, 'the paste-into-chat version is substantial');
});

test('findRelatedNodes walks the graph from a known hub', () => {
  /*
   * ES: la firma es findRelatedNodes(db, query, limit=5) y devuelve un ARRAY de
   *     nodos puntuados. Un objeto de opciones aquí terminaría en .slice(NaN) y
   *     devolvería [] — trampa de firma documentada.
   * EN: the signature takes a NUMBER limit and returns an ARRAY of scored nodes.
   * PT: a assinatura recebe um limite NUMÉRICO e devolve um ARRAY.
   */
  const nodes = findRelatedNodes(db, 'sqlite', 8);
  assert.ok(Array.isArray(nodes));
  assert.ok(nodes.length >= 1, 'sqlite is a hub in the knowledge graph');
  assert.ok(nodes[0].label, 'related nodes carry their label');
});

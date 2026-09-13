/* ═══════════════════════════════════════════════════════════════════════════
 * tests/capture-parser.test.js — VERIFICATION LEVEL: unit + integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 1 sin tocar el RAW del repositorio: detección de
 *     idioma trilingüe, extracción de requisitos/restricciones/incógnitas,
 *     referencias a entidades (DEC-xxxx…), bloques de código y enlaces, y la
 *     idempotencia de captura por hash SHA-256 (re-ingerir la sesión fundacional
 *     responde "duplicated" y NO escribe un solo archivo nuevo).
 * 🇬 EN — WHAT IT TESTS: Phase 1 without touching the repository's RAW: trilingual
 *     language detection, requirement/constraint/unknown extraction, entity
 *     references (DEC-xxxx…), code blocks and links, and capture idempotency by
 *     SHA-256 hash (re-ingesting the founding session answers "duplicated" and
 *     writes NOT A SINGLE new file).
 * 🇧🇷 PT — O QUE TESTA: a Fase 1 sem tocar o RAW do repositório: detecção de
 *     idioma trilíngue, extrações, referências de entidades e idempotência de
 *     captura por hash SHA-256 (re-ingerir não escreve nenhum arquivo novo).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Detección de idioma por marcadores ES/EN/PT: contar palabras funcionales
 *     ("debe", "must", "deve") es más barato y más explicable que un modelo. Si
 *     el recorte es ambiguo, la confianza baja y se dice: sin teatro de precisión.
 *     Counting function words is cheap and explainable; low confidence is reported.
 *   • Hash como identidad ES/EN/PT: el id de lo capturado no es un contador: es el
 *     hash del contenido. Dos textos idénticos SON la misma captura, aunque lleguen
 *     por caminos distintos. Content hash = identity, not a counter.
 *   • RAW append-only ES/EN/PT: el nivel 1 nunca se edita ni se borra. La única
 *     operación es añadir. Por eso re-ingerir no puede "actualizar": o es nuevo o
 *     es duplicado. RAW only grows; re-ingest is new-or-duplicate, never update.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectLanguage, normalizeText, extractRequirements, extractConstraints, extractUnknowns, extractEntityRefs, extractCodeBlocks, extractLinks, extractHeadings, extractTechnicalTerms } from '../core/capture/message-parser.js';
import { ingestSession, listSessions, findByHash, hashText } from '../core/capture/index.js';
import { PATHS } from '../core/shared/paths.js';

test('language detection ranks es / en / pt correctly', () => {
  const es = detectLanguage('El sistema debe guardar cada decisión con su justificación y sus alternativas.');
  assert.equal(es.language, 'es');
  assert.ok(es.confidence > 0.5, `confidence should be meaningful, got ${es.confidence}`);

  const en = detectLanguage('The engine must store every decision with its justification and alternatives.');
  assert.equal(en.language, 'en');

  const pt = detectLanguage('O sistema deve guardar cada decisão com sua justificativa e alternativas.');
  assert.equal(pt.language, 'pt');

  const und = detectLanguage('SQLITE FTS5 JSON 42');
  assert.equal(und.language, 'und', 'no function words means undetermined, not a guess');
  assert.equal(und.confidence, 0);
});

test('requirement, constraint and unknown extraction follow the keyword contract', () => {
  const text = [
    '- The core must run offline with zero npm dependencies',
    '- El console debe funcionar sin conexión',
    '- O núcleo deve executar offline',
    '- we should buy a nicer font someday',
    'nunca reescribir archivos enteros',
    'never rewrite whole files',
    'who approves the new rules when the engine runs offline?',
    'cómo decidimos el formato de los eventos?',
  ].join('\n');

  const requirements = extractRequirements(text);
  assert.ok(requirements.length >= 3, 'the three languages must be caught');
  assert.ok(requirements.some((r) => /zero npm dependencies/.test(r)));

  const constraints = extractConstraints(text);
  assert.ok(constraints.some((c) => /never rewrite whole files/i.test(c)), 'never/nuca lines are constraints');

  const unknowns = extractUnknowns(text);
  assert.ok(unknowns.length >= 1, 'open questions become unknowns');
});

test('entity references and technical terms feed the graph', () => {
  const text = 'Ver DEC-00002 y DEC-00012; la tarea TSK-00011 sigue bloqueada. Usamos sqlite con fts5 y un event bus.';
  assert.deepEqual(extractEntityRefs(text).sort(), ['DEC-00002', 'DEC-00012', 'TSK-00011']);
  const terms = extractTechnicalTerms(text);
  assert.ok(terms.includes('sqlite'));
  assert.ok(terms.includes('fts5'));
  assert.ok(terms.includes('event bus'));
});

test('code blocks, links and headings are extracted with their metadata', () => {
  const text = [
    '# Título',
    '## Subtítulo',
    '```js',
    'const x = 1;',
    '```',
    'mira https://example.com/docs y listo',
  ].join('\n');
  const blocks = extractCodeBlocks(text);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].language ?? blocks[0].lang, 'js');
  assert.match(blocks[0].code ?? blocks[0].content, /const x = 1/);
  assert.ok(extractLinks(text).some((link) => String(link).includes('example.com')));
  assert.ok(extractHeadings(text).length >= 2);
});

test('capture idempotency: re-ingesting the founding session writes nothing new', () => {
  const sample = path.join(PATHS.samples, 'session-001-architecture.md');
  const text = fs.readFileSync(sample, 'utf8');

  const sessionsBefore = listSessions().length;
  const rawFilesBefore = fs.readdirSync(PATHS.rawSessions).filter((name) => name.endsWith('.json')).length;
  const messageDirsBefore = fs.readdirSync(PATHS.rawMessages).length;

  const again = ingestSession({ text, title: 'Session 001 — Genesis architecture definition' });
  assert.equal(again.ok, true);
  assert.equal(again.value.duplicated, true, 'same content must be detected as duplicate by hash');

  assert.equal(listSessions().length, sessionsBefore);
  assert.equal(fs.readdirSync(PATHS.rawSessions).filter((name) => name.endsWith('.json')).length, rawFilesBefore);
  assert.equal(fs.readdirSync(PATHS.rawMessages).length, messageDirsBefore);

  /*
   * ES: el hash guardado es hashText(normalizeText(text)) — la captura hashea el
   *     texto NORMALIZADO, no el crudo. Hashear el crudo daría null y parecería
   *     que el índice está roto cuando el roto es el test.
   * EN: the stored hash covers the NORMALIZED text, not the raw one. Hashing the
   *     raw text would return null and look like a broken index.
   * PT: o hash guardado cobre o texto NORMALIZADO, não o bruto.
   */
  const found = findByHash(hashText(normalizeText(text)));
  assert.ok(found, 'the hash index must locate the existing capture');
  assert.equal(found.id, again.value.session.id, 'and it points at the original session');
});

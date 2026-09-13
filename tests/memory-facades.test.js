/* ═══════════════════════════════════════════════════════════════════════════
 * tests/memory-facades.test.js — the agent's single door, under test
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: que las cuatro fachadas de memoria (proyecto, sesión,
 *     decisiones, lecciones) y el agregador responden con Result {ok, value},
 *     que leen datos REALES de las Fases 0-2 y que fallan de forma útil cuando
 *     falta un argumento o no existe el id pedido.
 *     POR QUÉ IMPORTA: la Fase 5 (agente) se construirá ENCIMA de estas fachadas.
 *     Si una fachada cambia de forma sin aviso, el agente fallará en runtime con
 *     errores raros. Estos tests fijan el contrato hoy.
 *
 * 🇬 EN — WHAT IT TESTS: that the four memory façades (project, session,
 *     decisions, lessons) and the aggregator answer with Result {ok, value}, that
 *     they read REAL data from Phases 0-2 and that they fail usefully when an
 *     argument is missing or the requested id does not exist.
 *     WHY IT MATTERS: Phase 5 (the agent) will be built ON TOP of these façades.
 *     If a façade changes shape without warning, the agent will fail at runtime
 *     with strange errors. These tests pin the contract today.
 *
 * 🇧🇷 PT — O QUE TESTA: que as quatro fachadas de memória e o agregador respondem
 *     com Result {ok, value}, leem dados REAIS das Fases 0-2 e falham de forma
 *     útil quando falta argumento ou o id não existe. A Fase 5 será construída
 *     SOBRE elas; estes testes fixam o contrato hoje.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Probar el contrato, no la implementación ES/EN/PT: estos tests no miran
 *     CÓMO se lee SQLite; miran QUÉ forma tiene la respuesta. Eso permite
 *     reescribir el interior sin romper a quien llama. Test the contract, not the
 *     internals.
 *   • Casos de error como ciudadanos ES/EN/PT: un test que solo prueba el camino
 *     feliz deja la mitad del comportamiento sin cubrir. Aquí se prueba también
 *     el `recallDecision('DEC-99999')` → not_found con mensaje legible.
 *     Error paths deserve tests too.
 *   • Sin fixtures inventados ES/EN/PT: se usa la base real del repositorio (que
 *     `npm run pipeline` mantiene). Si el test necesitara datos falsos, estaría
 *     probando un mundo que no existe. Use the real, pipeline-maintained base.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  memorySnapshot, recall, recallForPrompt,
  projectMemory, renderProjectMemory,
  sessionMemory, latestSessionMemory, listSessionMemory,
  decisionMemory, recallDecision, activeDecisions,
  lessonMemory, pendingRules, repeatedFailures,
} from '../memory/index.js';
import { closeDatabase } from '../knowledge/db/index.js';

test.after(() => closeDatabase());

test('projectMemory answers with identity, state, roadmap and policies', () => {
  const result = projectMemory();
  assert.equal(result.ok, true);
  assert.equal(result.value.identity.id, 'genesis');
  assert.ok(result.value.state.progress_percent >= 0);
  assert.ok(Array.isArray(result.value.roadmap.phases));
  assert.ok(result.value.roadmap.phases.length >= 8, 'the roadmap has 8 phases');
  assert.ok(result.value.policies.length >= 10, 'policies must be readable');
  assert.ok(result.value.anti_goals.length >= 3, 'anti-goals are part of project memory');
});

test('projectMemory compact shape renders without losing the central rule', () => {
  const result = projectMemory({ compact: true });
  assert.equal(result.ok, true);
  const text = renderProjectMemory(result, 'en');
  assert.match(text, /CENTRAL RULE: Nothing happens without leaving an observable project event\./);
  // ES: el progreso real puede tener decimales (47.5%). Aceptar \d+% y \d+.\d+%.
  // EN: real progress may carry decimals (47.5%). Accept both shapes.
  // PT: o progresso real pode ter decimais. Aceitamos os dois formatos.
  assert.match(text, /PROGRESS: \d+(?:\.\d+)?%/);
});

test('session memory exposes RAW messages plus their interpretation and production', () => {
  const index = listSessionMemory();
  assert.equal(index.ok, true);
  assert.ok(index.value.count >= 1, 'the repo ships at least the founding session');

  const latest = latestSessionMemory();
  assert.equal(latest.ok, true);
  const memory = latest.value;
  assert.ok(memory.messages.length >= 1);
  const first = memory.messages[0];
  assert.ok(first.content.length > 0, 'RAW content must survive verbatim');
  assert.ok('interpretation' in first, 'every message carries its interpretation');
  assert.ok(memory.totals.decisions >= 1, 'the founding session produced decisions');
});

test('sessionMemory refuses to run without a session id', () => {
  const result = sessionMemory(null);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'missing_argument');
});

test('decision memory returns explainable traces with provenance', () => {
  const memory = decisionMemory({ withProvenance: true });
  assert.equal(memory.ok, true);
  assert.ok(memory.value.count >= 11, 'the seeded decision set must be visible');
  const decision = memory.value.decisions.find((item) => item.id === 'DEC-00002');
  assert.ok(decision, 'DEC-00002 must exist');
  assert.ok(decision.alternatives.length >= 2, 'a trace lists its alternatives');
  assert.ok(decision.rendered.en.includes('DECISION TRACE DEC-00002'));
  assert.ok('provenance' in decision, 'withProvenance must attach the chain');
});

test('recallDecision explains unknown ids instead of returning undefined', () => {
  const result = recallDecision('DEC-99999');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'not_found');
  assert.match(result.error.message, /DEC-99999/);
});

test('active decisions exclude superseded and rejected ones', () => {
  const all = decisionMemory();
  const active = activeDecisions();
  assert.equal(active.ok, true);
  assert.ok(active.value.count <= all.value.count);
  for (const decision of active.value.decisions) {
    assert.ok(!['superseded', 'rejected', 'deprecated'].includes(decision.status));
  }
});

test('lesson memory closes the loop: lesson, origin error and candidate rules', () => {
  const memory = lessonMemory();
  assert.equal(memory.ok, true);
  assert.ok(memory.value.lessons.length >= 2, 'the two real lessons must be visible');
  assert.deepEqual(memory.value.cycle, ['ERROR', 'ANALYSIS', 'RECOVERY', 'LESSON', 'RULE CREATED', 'PRECHECK NEXT TIME']);
  const withRule = memory.value.lessons.find((lesson) => lesson.future_rule);
  assert.ok(withRule, 'at least one lesson proposed a rule');

  const pending = pendingRules();
  assert.equal(pending.ok, true);
  assert.ok(pending.value.rules.length >= 1);

  const repeated = repeatedFailures({ minOccurrences: 2 });
  assert.equal(repeated.ok, true);
  assert.ok(Array.isArray(repeated.value.groups));
});

test('recall searches across every memory and answers grouped', () => {
  const result = recall('sqlite');
  assert.equal(result.ok, true);
  assert.ok(result.value.total >= 1, 'the founding session discussed sqlite');
  assert.ok(result.value.results[0].snippet !== undefined);

  const empty = recall('   ');
  assert.equal(empty.ok, false);
  assert.equal(empty.error.code, 'missing_argument');
});

test('the prompt snapshot gives an agent everything in one page', () => {
  const result = recallForPrompt({ language: 'es' });
  assert.equal(result.ok, true);
  assert.match(result.value.project, /PROYECTO|PROJECT/);
  assert.ok(Array.isArray(result.value.decisions));
  assert.ok(Array.isArray(result.value.lessons));
  assert.ok(Array.isArray(result.value.open_blocks));
});

test('memorySnapshot composes the four memories without losing errors', () => {
  const snapshot = memorySnapshot({ compact: true });
  assert.equal(snapshot.ok, true);
  assert.ok(snapshot.value.project, 'project memory present');
  assert.ok(snapshot.value.session, 'session memory present');
  assert.ok(snapshot.value.decisions, 'decision memory present');
  assert.ok(snapshot.value.lessons, 'lesson memory present');
  assert.ok(snapshot.value.rendered.length > 40, 'rendered one-page memory present');
});

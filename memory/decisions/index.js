/* ═══════════════════════════════════════════════════════════════════════════
 * memory/decisions/index.js — DECISION MEMORY façade
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: responde "¿por qué el proyecto es como es?" Devuelve las
 *     Decision Traces (DEC-00003) con su cadena de procedencia: qué búsqueda las
 *     originó, qué fuentes se consultaron, qué consecuencias tuvieron.
 *     POR QUÉ EXISTE: DEC-00003 prohíbe guardar el razonamiento privado de un
 *     modelo. Lo que sí se guarda —y esto es lo valioso— es la traza explicable:
 *     objetivo, contexto, restricciones, alternativas, decisión, justificación,
 *     consecuencia y estado. Esta fachada es la única puerta a esa traza.
 *     ESTADO: IMPLEMENTADA (solo lectura; reutiliza Fases 2 + retrieval).
 *
 * 🇬🇧 EN — WHAT IT DOES: answers "why is the project the way it is?" Returns the
 *     Decision Traces (DEC-00003) with their provenance chain: which search
 *     originated them, which sources were consulted, which consequences followed.
 *     WHY IT EXISTS: DEC-00003 forbids storing a model's private reasoning. What
 *     IS stored —and this is the valuable part— is the explainable trace:
 *     objective, context, constraints, alternatives, decision, justification,
 *     consequence, status. This façade is the only door to that trace.
 *     STATUS: IMPLEMENTED (read-only; reuses Phase 2 + retrieval).
 *
 * 🇧🇷 PT — O QUE FAZ: responde "por que o projeto é como é?" Devolve as Trilhas
 *     de Decisão (DEC-00003) com sua cadeia de procedência.
 *     POR QUE EXISTE: DEC-00003 proíbe guardar o raciocínio privado do modelo.
 *     O que se guarda é a trilha explicável. ESTADO: IMPLEMENTADA (somente leitura).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Trazabilidad / traceability ES/EN/PT: poder ir de un archivo del proyecto
 *     hacia atrás hasta la conversación donde se decidió. Sin ella, cada cambio
 *     es un acto de fe. Traceability = walking back from code to the decision.
 *   • Por qué `status` en una decisión ES/EN/PT: las decisiones NO son eternas.
 *     `proposed → approved → implemented → superseded → rejected`. Guardar el
 *     estado evita tratar como vigente algo que ya se revocó.
 *     Decisions have a lifecycle; storing status prevents treating a revoked
 *     decision as current.
 *   • Alternativas rechazadas ES/EN/PT: la parte más útil de una traza no es la
 *     opción elegida, sino las descartadas y POR QUÉ. Eso es lo que impide que
 *     alguien vuelva a proponer lo mismo seis meses después.
 *     The rejected alternatives are the most useful part of a trace.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail } from '../../core/shared/result.js';
import { openDatabase, all, fromJson } from '../../knowledge/db/index.js';
import { loadDecision, renderDecisionTrace } from '../../knowledge/processor/decisions.js';
import { provenanceChain } from '../../knowledge/processor/searches.js';
import { whyDidWeChoose } from '../../knowledge/retrieval/search.js';

/**
 * ES: memoria de decisiones completa o filtrada.
 * EN: full or filtered decision memory.
 * PT: memória de decisões completa ou filtrada.
 *
 * @param {object} [options]
 * @param {object} [options.db]
 * @param {string} [options.status] filtra por estado (approved, implemented…)
 * @param {string} [options.layer] filtra por capa (0..10 o su id)
 * @param {boolean} [options.withProvenance=false] añade búsqueda/fuentes por decisión
 * @param {string} [options.language='en'] idioma del texto renderizado
 */
export function decisionMemory(options = {}) {
  const { db = openDatabase(), status = null, layer = null, withProvenance = false, language = 'en' } = options;

  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (layer) { where.push('layer = ?'); params.push(layer); }
  const sql = `SELECT * FROM decisions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`;
  const rows = all(db, sql, params);

  const decisions = rows.map((row) => {
    const decision = {
      ...row,
      constraints: fromJson(row.constraints_json, []),
      alternatives: fromJson(row.alternatives_json, []),
      related: fromJson(row.related_json, []),
      rendered: { [language]: renderDecisionTrace(row, language) },
    };
    if (withProvenance) decision.provenance = provenanceChain(db, row.id);
    return decision;
  });

  return ok({
    kind: 'decision-memory',
    count: decisions.length,
    by_status: decisions.reduce((acc, decision) => { acc[decision.status ?? 'unknown'] = (acc[decision.status ?? 'unknown'] ?? 0) + 1; return acc; }, {}),
    by_layer: decisions.reduce((acc, decision) => { acc[decision.layer ?? 'unknown'] = (acc[decision.layer ?? 'unknown'] ?? 0) + 1; return acc; }, {}),
    decisions,
  });
}

/**
 * ES: una decisión con su traza renderizada y su procedencia.
 * EN: one decision with its rendered trace and provenance.
 * PT: uma decisão com sua trilha renderizada e procedência.
 */
export function recallDecision(decisionId, options = {}) {
  const { db = openDatabase(), language = 'en' } = options;
  /*
   * ES: CONTRATOS MIXTOS — deuda técnica honesta. `loadDecision()` devuelve un
   *     objeto plano (o `null`), mientras que el resto del proyecto devuelve
   *     Result `{ok, value|error}`. Asumir `.ok` aquí producía un fallo con el
   *     mensaje literal "undefined": el peor tipo de error, porque no dice nada.
   *     Lo detectamos con `if (!decision)`. Unificar los dos contratos queda
   *     registrado como tarea de la Fase 3 (Documentation Engine) en docs/CONVENTIONS.md.
   * EN: MIXED CONTRACTS — honest technical debt. `loadDecision()` returns a plain
   *     object (or `null`) while the rest of the project returns Result
   *     `{ok, value|error}`. Assuming `.ok` here produced a failure whose message
   *     was literally "undefined": the worst kind of error, because it says
   *     nothing. We check `if (!decision)` instead. Unifying both contracts is
   *     logged as a Phase 3 task in docs/CONVENTIONS.md.
   * PT: CONTRATOS MISTOS — dívida técnica honesta. `loadDecision()` devolve objeto
   *     simples (ou `null`); o resto devolve Result. Assumir `.ok` gerava um erro
   *     com a mensagem literal "undefined".
   */
  const decision = loadDecision(db, decisionId);
  if (!decision) {
    return fail(`Decision ${decisionId} not found in the knowledge base`, {
      code: 'not_found',
      interruptionType: 'ambiguity',
      recoverable: true,
      details: { decisionId },
    });
  }
  return ok({
    kind: 'decision-recall',
    decision,
    rendered: { [language]: renderDecisionTrace(decision, language) },
    provenance: provenanceChain(db, decisionId),
  });
}

/**
 * ES: "¿por qué elegimos X?" — búsqueda semántica sobre las trazas.
 * EN: "why did we choose X?" — semantic-ish search over the traces.
 * PT: "por que escolhemos X?" — busca sobre as trilhas.
 */
export function recallWhy(term, options = {}) {
  const { db = openDatabase() } = options;
  if (!term) return fail('recallWhy requires a term', { code: 'missing_argument' });
  // ES: firma real = whyDidWeChoose(term, { db }) — el término va primero.
  // EN: real signature = whyDidWeChoose(term, { db }) — the term comes first.
  // PT: assinatura real = whyDidWeChoose(term, { db }).
  return ok({ kind: 'why-recall', ...whyDidWeChoose(String(term), { db }) });
}

/** ES/EN/PT: decisiones que siguen vigentes (no superseded/rejected). */
export function activeDecisions(options = {}) {
  const memory = decisionMemory(options);
  if (!memory.ok) return memory;
  const active = memory.value.decisions.filter((decision) => !['superseded', 'rejected', 'deprecated'].includes(decision.status));
  return ok({ kind: 'decision-memory', scope: 'active', count: active.length, decisions: active });
}

export default { decisionMemory, recallDecision, recallWhy, activeDecisions };

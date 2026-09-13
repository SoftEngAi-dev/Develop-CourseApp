/* ═══════════════════════════════════════════════════════════════════════════
 * memory/lessons/index.js — LESSON MEMORY façade (EVOLVE)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: responde "¿qué aprendimos y qué NO debemos repetir?"
 *     Reúne lecciones, los errores que las produjeron y las reglas derivadas.
 *     POR QUÉ EXISTE: es la diferencia entre un sistema con memoria y un sistema
 *     que APRENDE. Memoria = recordar el error. Aprendizaje = generar una regla
 *     que se comprueba ANTES de la próxima acción. El ciclo completo de la
 *     sección 24 es: ERROR → ANÁLISIS → RECUPERACIÓN → LECCIÓN → REGLA →
 *     PRECHECK. Esta fachada expone los cuatro primeros; el precheck vive en
 *     control/policies.json (Fase 7).
 *     ESTADO: IMPLEMENTADA (solo lectura sobre la Fase 2).
 *
 * 🇬🇧 EN — WHAT IT DOES: answers "what did we learn and what must we NOT repeat?"
 *     Gathers lessons, the errors that produced them and the derived rules.
 *     WHY IT EXISTS: it is the difference between a system with memory and a
 *     system that LEARNS. Memory = remembering the error. Learning = producing a
 *     rule checked BEFORE the next action. The full cycle of section 24 is:
 *     ERROR → ANALYSIS → RECOVERY → LESSON → RULE → PRECHECK. This façade exposes
 *     the first four; the precheck lives in control/policies.json (Phase 7).
 *     STATUS: IMPLEMENTED (read-only over Phase 2).
 *
 * 🇧🇷 PT — O QUE FAZ: responde "o que aprendemos e o que NÃO devemos repetir?"
 *     POR QUE EXISTE: é a diferença entre um sistema com memória e um sistema que
 *     APRENDE. Memória = lembrar o erro. Aprendizagem = gerar uma regra verificada
 *     ANTES da próxima ação. ESTADO: IMPLEMENTADA (somente leitura).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Error vs fallo vs lección ES/EN/PT: el ERROR es el hecho observable
 *     ("FTS5 devolvió formato inválido"). El ANÁLISIS es la causa ("borramos una
 *     tabla sombra de FTS"). La LECCIÓN es la generalización ("nunca borrar
 *     tablas sombra; usar rebuild"). Solo la tercera sirve para el futuro.
 *     Only the generalized lesson is useful for the future.
 *   • Regla ejecutable ES/EN/PT: una lección que no se convierte en comprobación
 *     es literatura. `future_rule` guarda la clave de la política que se creará:
 *     `core.zero_dependencies=true`. A lesson without a check is literature.
 *   • Gravedad (severity) ES/EN/PT: no todos los errores importan igual.
 *     Clasificarlos permite priorizar: critical bloquea, low se registra.
 *     Severity lets the system prioritise instead of treating everything alike.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok } from '../../core/shared/result.js';
import { openDatabase, all } from '../../knowledge/db/index.js';
import { lessonsByLayer, proposedRules } from '../../knowledge/processor/lessons.js';
import { openErrors, errorHistogram } from '../../knowledge/processor/errors.js';
import { readJson } from '../../core/shared/json.js';
import { PATHS } from '../../core/shared/paths.js';

/**
 * ES: memoria de aprendizaje: lecciones + errores + reglas propuestas + reglas ya activas.
 * EN: learning memory: lessons + errors + proposed rules + already active rules.
 * PT: memória de aprendizagem: lições + erros + regras propostas + regras ativas.
 *
 * @param {object} [options]
 * @param {object} [options.db]
 * @param {boolean} [options.onlyUnresolved=false] solo errores aún abiertos
 */
export function lessonMemory(options = {}) {
  const { db = openDatabase(), onlyUnresolved = false } = options;

  const lessons = all(db, 'SELECT * FROM lessons ORDER BY created_at DESC');
  const errors = onlyUnresolved ? openErrors(db) : all(db, 'SELECT * FROM errors ORDER BY ts DESC');
  const policies = readJson(PATHS.policies, { rules: [] });

  // ES: unimos cada lección con el error que la produjo (lessons.source_id).
  // EN: we join each lesson with the error that produced it (lessons.source_id).
  // PT: unimos cada lição ao erro que a produziu.
  const errorById = new Map(errors.map((error) => [error.id, error]));

  return ok({
    kind: 'lesson-memory',
    totals: {
      lessons: lessons.length,
      errors: errors.length,
      unresolved_errors: errors.filter((error) => !error.resolved).length,
      proposed_rules: proposedRules(db).length,
      active_policies: (policies.rules ?? []).length,
    },
    lessons: lessons.map((lesson) => ({
      ...lesson,
      origin_error: lesson.source_type === 'error' && lesson.source_id ? errorById.get(lesson.source_id) ?? null : null,
      rule_active: Boolean((policies.rules ?? []).some((rule) => (rule.id ?? rule.key ?? '') === lesson.future_rule)),
    })),
    errors,
    by_layer: lessonsByLayer(db),
    histogram: errorHistogram(db),
    proposed_rules: proposedRules(db),
    active_policies: policies.rules ?? [],
    /*
     * ES: el ciclo de aprendizaje en una sola línea legible, para que cualquier
     *     agente (o humano) entienda qué se espera de él.
     * EN: the learning cycle in one readable line, so any agent (or human)
     *     understands what is expected of it.
     * PT: o ciclo de aprendizagem numa linha legível.
     */
    cycle: ['ERROR', 'ANALYSIS', 'RECOVERY', 'LESSON', 'RULE CREATED', 'PRECHECK NEXT TIME'],
  });
}

/** ES/EN/PT: reglas que el sistema debería añadir a control/policies.json (Fase 7). */
export function pendingRules(options = {}) {
  const { db = openDatabase() } = options;
  const policies = readJson(PATHS.policies, { rules: [] });
  const existing = new Set((policies.rules ?? []).map((rule) => rule.id ?? rule.key ?? rule.rule ?? ''));
  return ok({
    kind: 'pending-rules',
    count: proposedRules(db).filter((rule) => !existing.has(rule.key ?? rule.id ?? '')).length,
    rules: proposedRules(db).filter((rule) => !existing.has(rule.key ?? rule.id ?? '')),
  });
}

/** ES/EN/PT: errores repetidos — la señal más fuerte de que falta una regla. */
export function repeatedFailures(options = {}) {
  const { db = openDatabase(), minOccurrences = 2 } = options;
  const rows = all(db, 'SELECT layer, COUNT(*) AS n, GROUP_CONCAT(id) AS ids FROM errors GROUP BY layer HAVING n >= ? ORDER BY n DESC', [minOccurrences]);
  return ok({ kind: 'repeated-failures', min_occurrences: minOccurrences, count: rows.length, groups: rows.map((row) => ({ layer: row.layer, occurrences: Number(row.n), error_ids: String(row.ids ?? '').split(',') })) });
}

export default { lessonMemory, pendingRules, repeatedFailures };

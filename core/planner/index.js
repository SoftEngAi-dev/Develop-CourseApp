/* ═══════════════════════════════════════════════════════════════════════════
 * core/planner/index.js — PHASE 5 · PLANNER (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: convertir UNA decisión en pasos ordenados, cada uno con su
 *     criterio de aceptación y su punto de retorno. La diferencia entre "voy a
 *     arreglar la base de datos" y un plan real es que el plan real se puede
 *     verificar paso a paso y deshacer paso a paso.
 *     ESTADO: ESQUELETO (DEC-00009). Firma real, `notImplemented(...)`.
 *     QUÉ SÍ EXISTE: la tabla `plans` ya guarda 4 planes EXTRAÍDOS de la
 *     conversación fundacional (knowledge/processor/plans.js). Es decir: el
 *     formato de plan ya está probado con datos reales; falta el generador.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: turn ONE decision into ordered steps, each with its
 *     acceptance criterion and its rollback point. The difference between "I will
 *     fix the database" and a real plan is that a real plan can be verified step
 *     by step and undone step by step.
 *     STATUS: SKELETON (DEC-00009). Real signature, `notImplemented(...)`.
 *     WHAT ALREADY EXISTS: the `plans` table already stores 4 plans EXTRACTED
 *     from the founding conversation (knowledge/processor/plans.js). The plan
 *     format is proven with real data; the generator is what is missing.
 *
 * 🇧🇷 PT — O QUE FARÁ: transformar UMA decisão em passos ordenados, cada um com
 *     critério de aceite e ponto de rollback. ESTADO: ESQUELETO (DEC-00009).
 *     O QUE JÁ EXISTE: a tabela `plans` guarda 4 planos extraídos da conversa
 *     fundacional; falta o gerador.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Criterio de aceptación ES/EN/PT: una frase que se puede comprobar con un
 *     comando. "Debe ser rápido" no es un criterio; "`genesis status` responde en
 *     menos de 500 ms" sí lo es. Si no se puede medir, no se puede verificar.
 *     An acceptance criterion must be checkable by a command, not a feeling.
 *   • Plan vs tarea ES/EN/PT: la TAREA es el compromiso (está en control/tasks.json
 *     con su máquina de 13 estados). El PLAN es la receta temporal para cumplirla.
 *     Una tarea puede tener muchos planes a lo largo del tiempo (intentos).
 *     A task is the commitment; a plan is one attempt's recipe.
 *   • Por qué el plan se guarda en la base ES/EN/PT: un plan que solo vive en la
 *     cabeza del agente no deja rastro, y sin rastro no hay aprendizaje ni
 *     auditoría. Regla central: nada ocurre sin evento observable.
 *     A plan that only lives in the agent's head leaves no trace.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/planner/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: anatomía de un paso de plan. Anatomy of one plan step. */
export const STEP_SHAPE = Object.freeze({
  order: 'integer, 1-based',
  action: 'verb + object ("add unique index on nodes.label")',
  target: 'file, table or route affected',
  acceptance: 'command or assertion that proves the step worked',
  reversible: 'boolean — can this step be undone alone?',
  rollback_to: 'checkpoint id to restore if the step fails',
  emits: 'event types this step must emit',
});

/** ES: genera un plan para una decisión/tarea concreta. */
export function createPlan(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'generate an ordered, verifiable plan for one decision or task',
    available: 'the plan format is already stored and queryable: knowledge/processor/plans.js → extractPlans / persistPlans; 4 real plans exist; `genesis tasks` prints them.',
    step_shape: STEP_SHAPE,
    details_requested: Object.keys(options),
  });
}

/** ES: valida que un plan sea ejecutable (pasos ordenados, criterios, reversibilidad). */
export function validatePlan(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'reject plans without acceptance criteria or without rollback points',
    available: 'core/validation/schema.js validates control-plane JSON today; the same approach applies to plans.',
    details_requested: Object.keys(options),
  });
}

/** ES: re-planifica tras un fallo (la recuperación cambia el plan, no lo ignora). */
export function replanAfterFailure(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'produce a new plan after an interruption, keeping the lessons of the failed one',
    available: 'core/recovery/index.js (skeleton) declares the interruption side; real interruptions are already stored (INT-00001) and visible with `genesis status`.',
    details_requested: Object.keys(options),
  });
}

export default { STEP_SHAPE, createPlan, validatePlan, replanAfterFailure };

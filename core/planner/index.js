/* ═══════════════════════════════════════════════════════════════════════════
 * core/planner/index.js — PHASE 5 · PLANNER (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: convierte un objetivo en un plan de pasos VERIFICABLES.
 *     Cada paso declara qué hace, sobre qué target, cómo se prueba que funcionó
 *     (acceptance), si es reversible y qué eventos debe emitir. validatePlan()
 *     rechaza planes malformados ANTES de que el executor los toque: un plan que
 *     no se puede verificar no se ejecuta. replanAfterFailure() inserta pasos de
 *     recuperación cuando algo falla (no borra el plan: lo enmienda).
 *     Los planes se persisten en la tabla `plans` (misma forma que los extraídos
 *     de conversaciones por knowledge/processor/plans.js).
 *
 * 🇬🇧 EN — WHAT IT DOES: turns a goal into a plan of VERIFIABLE steps. Each step
 *     declares its action, target, acceptance check, reversibility and the events
 *     it must emit. validatePlan() rejects malformed plans BEFORE the executor
 *     touches them: a plan that cannot be verified does not run.
 *     replanAfterFailure() amends (never rewrites) a plan with recovery steps.
 *
 * 🇧🇷 PT — O QUE FAZ: transforma um objetivo num plano de passos VERIFICÁVEIS.
 *     validatePlan() rejeita planos malformados ANTES da execução;
 *     replanAfterFailure() emenda o plano com passos de recuperação.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Plan = contrato, no deseo ES/EN/PT: un paso sin acceptance es una frase
 *     motivacional. "Regenerar docs" no es un paso; "regenerar docs Y que
 *     verifyDocumentation() devuelva consistent:true" sí lo es. El campo
 *     acceptance es lo que convierte la lista en un plan.
 *     A step without an acceptance check is a wish, not a plan.
 *   • TOOL_WHITELIST ES/EN/PT: los pasos solo pueden referenciar herramientas
 *     internas conocidas (docs.generate, tests.run, checkpoint.create…). El
 *     planner rechaza cualquier otra: el agente NUNCA ejecuta código arbitrario.
 *     Steps may only reference known internal tools: the agent never runs
 *     arbitrary code. Safety by construction, not by hope.
 *   • Enmendar vs reescribir ES/EN/PT: replanAfterFailure INSERTA pasos y marca
 *     el fallido (status 'failed'); nunca tira el plan a la basura. Así la
 *     historia completa queda auditable (POL-0002: patch, no rewrite).
 *     Replanning amends the plan so the full history stays auditable.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail, attempt } from '../shared/result.js';
import { nextId, ID_PREFIX } from '../shared/ids.js';
import { all, run, toJson } from '../../knowledge/db/index.js';
import { EVENT_TYPES } from '../event-bus/event-types.js';

/** ES/EN/PT: anatomía de un paso de plan (sección 20 del spec). Plan step anatomy. */
export const STEP_SHAPE = Object.freeze({
  order: 'integer, 1-based',
  action: 'verb + object ("add unique index on nodes.label")',
  target: 'file, table or route affected',
  acceptance: 'command or assertion that proves the step worked',
  reversible: 'boolean — can this step be undone alone?',
  rollback_to: 'checkpoint id to restore if the step fails',
  emits: 'event types this step must emit',
});

/*
 * ES: whitelist de herramientas internas. Cada nombre mapea a código REAL del
 *     proyecto (ver core/executor/index.js). Nada fuera de esta lista se ejecuta.
 * EN: internal tool whitelist. Each name maps to REAL project code (see
 *     core/executor/index.js). Nothing outside this list ever runs.
 * PT: whitelist de ferramentas internas. Nada fora dela é executado.
 */
export const TOOL_WHITELIST = Object.freeze([
  'docs.generate',
  'docs.verify',
  'tests.run',
  'checkpoint.create',
  'state.reconcile',
  'rules.promote',
  'courses.generate',
  'snapshot.export',
  'db.stats',
]);

/**
 * ES: crea un plan para un objetivo. Si no se pasan steps, usa los del objetivo
 *     (createPlan deriva pasos por defecto verificables para cada tool).
 * EN: creates a plan for a goal. Without explicit steps, derives verifiable
 *     default steps from the goal's tool.
 * PT: cria um plano para um objetivo, com passos verificáveis.
 *
 * @param {{ objective?: string, goal?: string, steps?: object[], task?: string|null, layer?: string|null, sessionId?: string|null, bus?: object, db?: object, persist?: boolean }} [options]
 * @returns {import('../shared/result.js').Result}
 */
export function createPlan(options = {}) {
  const {
    objective = null, goal = null, steps = null, task = null, layer = null,
    sessionId = null, bus = null, persist = false,
  } = options;

  return attempt(() => {
    const finalObjective = objective ?? goal;
    if (!finalObjective) throw new Error('createPlan requires an objective (or goal)');

    const derived = Array.isArray(steps) && steps.length ? steps : defaultStepsFor(finalObjective);
    const plan = {
      id: nextId(ID_PREFIX.plan, existingPlanIds(options.db ?? null), 5),
      objective: finalObjective,
      task,
      layer,
      session_id: sessionId,
      steps: derived.map((step, index) => normalizeStep(step, index)),
      status: 'proposed',
      created_at: new Date().toISOString(),
    };

    const validation = validatePlan({ plan });
    if (!validation.ok) throw new Error(validation.error.message);

    if (persist && options.db) persistPlan(options.db, plan);
    bus?.emit('PLAN_CREATED', { id: plan.id, objective: plan.objective, steps: plan.steps.length }, { layer: layer ?? 'agents' });
    return plan;
  }, { code: 'plan_creation_failed', layer: 'agents', interruptionType: 'ambiguity' });
}

/**
 * ES: valida la FORMA del plan: steps 1-based consecutivos, tools whitelistados,
 *     acceptance no vacío, emits ⊆ taxonomía cerrada de eventos.
 * EN: validates plan SHAPE: consecutive 1-based steps, whitelisted tools,
 *     non-empty acceptance, emits ⊆ the closed event taxonomy.
 * PT: valida a FORMA do plano.
 */
export function validatePlan(options = {}) {
  const plan = options.plan ?? options;
  if (!plan || typeof plan !== 'object') return fail('validatePlan requires a plan object', { code: 'plan_missing' });
  if (!plan.objective || typeof plan.objective !== 'string') return fail('plan.objective must be a non-empty string', { code: 'plan_objective_missing' });
  if (!Array.isArray(plan.steps) || !plan.steps.length) return fail('plan.steps must be a non-empty array', { code: 'plan_steps_missing' });

  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    const at = `step ${i + 1}`;
    if (step.order !== i + 1) return fail(`${at}: order must be 1-based and consecutive (got ${step.order})`, { code: 'plan_step_order' });
    if (!step.tool || !TOOL_WHITELIST.includes(step.tool)) return fail(`${at}: tool "${step.tool ?? '—'}" is not in the whitelist`, { code: 'plan_tool_not_allowed' });
    if (!step.action || typeof step.action !== 'string') return fail(`${at}: action is required`, { code: 'plan_step_action' });
    if (!step.acceptance || typeof step.acceptance !== 'string') return fail(`${at}: acceptance is required — a step you cannot verify is a wish`, { code: 'plan_step_acceptance' });
    if (typeof step.reversible !== 'boolean') return fail(`${at}: reversible must be a boolean`, { code: 'plan_step_reversible' });
    for (const eventType of step.emits ?? []) {
      if (!EVENT_TYPES.includes(eventType)) return fail(`${at}: emits unknown event type "${eventType}"`, { code: 'plan_step_event' });
    }
  }
  return ok({ valid: true, steps: plan.steps.length });
}

/**
 * ES: enmienda un plan tras un fallo: marca el paso fallido, inserta un paso de
 *     recuperación (checkpoint.create / rollback sugerido) y devuelve el plan
 *     nuevo. El plan original NO se modifica (auditoría).
 * EN: amends a plan after a failure: marks the failed step, inserts a recovery
 *     step and returns a NEW plan. The original is never modified (auditability).
 * PT: emenda um plano após falha, sem modificar o original.
 */
export function replanAfterFailure(options = {}) {
  const { plan = null, failedStep = null, reason = null, bus = null } = options;
  return attempt(() => {
    if (!plan) throw new Error('replanAfterFailure requires the failed plan');
    const failedOrder = Number(failedStep ?? plan.steps?.find((s) => s.status === 'failed')?.order ?? 1);

    const amended = (plan.steps ?? []).map((step) => (step.order === failedOrder
      ? { ...step, status: 'failed', failure_reason: reason ?? 'unspecified' }
      : { ...step }));

    const recoveryStep = normalizeStep({
      tool: 'checkpoint.create',
      action: `create a checkpoint before recovering from the failure at step ${failedOrder}`,
      target: 'control/checkpoints',
      acceptance: 'a new CHK-xxxxx exists and loadCheckpoint() can read it back',
      reversible: true,
      emits: ['CHECKPOINT_CREATED'],
    }, amended.length);
    amended.push({ ...recoveryStep, status: 'pending', inserted_by: 'replanAfterFailure', after_failure_of: failedOrder });

    const replanned = {
      ...plan,
      id: `${plan.id}-R1`,
      steps: amended.map((step, index) => ({ ...step, order: index + 1 })),
      status: 'replanned',
      replanned_at: new Date().toISOString(),
      replan_reason: reason ?? 'step failure',
    };
    bus?.emit('PLAN_CREATED', { id: replanned.id, kind: 'replan', after: plan.id, reason: replanned.replan_reason }, { layer: 'agents' });
    return replanned;
  }, { code: 'replan_failed', layer: 'agents' });
}

/** ES/EN/PT: normaliza un paso a la forma canónica. Normalizes one step. */
function normalizeStep(step, index) {
  return {
    order: index + 1,
    tool: step.tool ?? null,
    action: step.action ?? '',
    target: step.target ?? null,
    acceptance: step.acceptance ?? '',
    reversible: Boolean(step.reversible ?? true),
    rollback_to: step.rollback_to ?? null,
    emits: Array.isArray(step.emits) ? step.emits : ['TOOL_EXECUTED'],
    status: step.status ?? 'pending',
    ...(step.inserted_by ? { inserted_by: step.inserted_by, after_failure_of: step.after_failure_of ?? null } : {}),
  };
}

/** ES/EN/PT: pasos por defecto verificables para objetivos conocidos. */
function defaultStepsFor(objective) {
  const text = String(objective).toLowerCase();
  if (text.includes('documentation') || text.includes('docs')) {
    return [{
      tool: 'docs.generate', action: 'regenerate the full documentation set', target: 'documentation/generated',
      acceptance: 'verifyDocumentation() returns consistent: true', reversible: true, emits: ['BUILD_COMPLETED'],
    }];
  }
  if (text.includes('rule') || text.includes('promote')) {
    return [{
      tool: 'rules.promote', action: 'promote pending lesson rules into policies', target: 'control/policies.json',
      acceptance: 'pendingRules() count decreases or stays zero; policies.json parses', reversible: true, emits: ['STATE_UPDATED'],
    }];
  }
  if (text.includes('health') || text.includes('verify')) {
    return [
      { tool: 'tests.run', action: 'run the verification suite', target: 'tests/', acceptance: 'fail count is 0', reversible: true, emits: ['TEST_PASSED'] },
      { tool: 'docs.verify', action: 'check documentation drift', target: 'documentation/generated', acceptance: 'verifyDocumentation() returns consistent: true', reversible: true, emits: ['TOOL_EXECUTED'] },
    ];
  }
  return [{
    tool: 'db.stats', action: 'collect database statistics as a baseline observation', target: 'data/indexes/genesis.db',
    acceptance: 'dbStats() returns without error', reversible: true, emits: ['TOOL_EXECUTED'],
  }];
}

/** ES/EN/PT: ids existentes de planes (para nextId). Existing plan ids. */
function existingPlanIds(db) {
  if (!db) return [];
  try { return all(db, 'SELECT id FROM plans').map((row) => row.id); } catch { return []; }
}

/** ES/EN/PT: persiste el plan en la tabla plans (misma forma que los extraídos). */
export function persistPlan(db, plan) {
  run(db, `INSERT INTO plans (id, session_id, task, layer, objective, steps_json, dependencies_json, risks_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET objective = excluded.objective, steps_json = excluded.steps_json, status = excluded.status`,
  [plan.id, plan.session_id ?? null, plan.task ?? null, plan.layer ?? null, plan.objective, toJson(plan.steps), toJson([]), toJson([]), plan.status ?? 'proposed', plan.created_at ?? new Date().toISOString()]);
  return plan.id;
}

export default { STEP_SHAPE, TOOL_WHITELIST, createPlan, validatePlan, replanAfterFailure, persistPlan };

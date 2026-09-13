/* ═══════════════════════════════════════════════════════════════════════════
 * core/agent/index.js — PHASE 5 · AGENT LOOP (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: el bucle autónomo de 7 etapas del spec, en orden POL-0006:
 *       1 observe       → hechos nuevos desde la última corrida (eventos,
 *                         estado, drift de docs, reglas pendientes)
 *       2 contextualize → SESSION CONTEXT completo (Context Engine, Fase 2)
 *       3 reason        → elige objetivo con política determinista y deja la
 *                         justificación PÚBLICA en forma de Decision Trace
 *                         (DEC-00003: nunca razonamiento privado)
 *       4 plan          → planner.createPlan: pasos verificables whitelistados
 *       5 execute       → executor.executePlan (dry-run por defecto; checkpoint
 *                         automático antes de mutar — POL-0003)
 *       6 verify        → verifyPolicies + verifyReversibility (+ tests si corre
 *                         de verdad)
 *       7 learn         → agent-state.json actualizado (historial acotado),
 *                         contadores, y si algo falló: interrupción tipada +
 *                         sugerencia de recuperación + lección
 *     runAgentTurn() encadena las 7 con manejo de interrupciones. El agente es
 *     DETERMINISTA y de cero dependencias: misma observación → misma decisión.
 *     No hay modelo de lenguaje dentro: los modelos externos entran como
 *     adaptadores (DEC-00009, orchestrator.registerAdapter).
 *
 * 🇬🇧 EN — WHAT IT DOES: the spec's autonomous 7-stage loop in POL-0006 order:
 *     observe → contextualize → reason → plan → execute → verify → learn.
 *     Reasoning is a deterministic policy whose justification is PUBLIC (a
 *     Decision Trace, never private model reasoning — DEC-00003). Execution is
 *     dry-run by default with automatic checkpoint before mutations. Failures
 *     become typed interruptions with recovery suggestions and lessons. The
 *     agent is DETERMINISTIC and zero-dependency: same observation → same
 *     decision. Language models plug in as adapters, never inside the core.
 *
 * 🇧🇷 PT — O QUE FAZ: o loop autônomo de 7 estágios: observe → contextualize →
 *     reason → plan → execute → verify → learn. Determinístico, zero dependências,
 *     dry-run por padrão, checkpoint antes de mutar, falhas viram interrupções
 *     tipadas com sugestão de recuperação e lição.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Agente ≠ magia ES/EN/PT: un agente es un while con reglas. Aquí las reglas
 *     son explícitas (reason(): drift → regenerar docs; reglas pendientes →
 *     promover; si no → verificar salud). Lo "autónomo" es que nadie le dicta el
 *     paso a paso: él observa y decide. An agent is a while-loop with explicit
 *     rules; autonomy means nobody dictates the steps.
 *   • dry-run por defecto ES/EN/PT: la primera corrida SIEMPRE mira y no toca.
 *     Ejecutar de verdad es una decisión explícita (`genesis agent --run`).
 *     The first run always looks and never touches.
 *   • Historial acotado ES/EN/PT: agent-state.json guarda las últimas 50
 *     corridas (history.slice(-50)). Sin cota, el archivo de estado crecería
 *     para siempre y "leer el estado" sería más caro que trabajar.
 *     Bounded history: an unbounded state file eventually eats the agent.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import { ok, fail, attempt } from '../shared/result.js';
import { PATHS } from '../shared/paths.js';
import { readJson, writeJson } from '../shared/json.js';
import { EventBus } from '../event-bus/index.js';
import { loadState, loadTasks, summarize, reconcile } from '../state/index.js';
import { buildSessionContext } from '../../knowledge/retrieval/context.js';
import { verifyDocumentation } from '../../documentation/engine/index.js';
import { pendingRules } from '../../memory/lessons/index.js';
import { createPlan, persistPlan } from '../planner/index.js';
import { executePlan } from '../executor/index.js';
import { verifyPolicies, verifyReversibility } from '../verifier/index.js';
import { raiseInterruption, suggestRecovery } from '../recovery/index.js';

/** ES/EN/PT: el bucle, en el orden que exige POL-0006. The loop, POL-0006 order. */
export const AGENT_LOOP = Object.freeze(['observe', 'contextualize', 'reason', 'plan', 'execute', 'verify', 'learn']);

/** ES/EN/PT: estado del agente en control/agent-state.json. */
export function agentState(options = {}) {
  const file = options.agentStateFile ?? PATHS.agentState;
  return readJson(file, { status: 'idle', last_run: null, history: [] });
}

/** ES/EN/PT: guarda el estado del agente (status/last_run/history acotado). */
export function saveAgentState(patch = {}, options = {}) {
  const file = options.agentStateFile ?? PATHS.agentState;
  const current = agentState({ agentStateFile: file });
  const next = { ...current, ...patch };
  if (Array.isArray(next.history)) next.history = next.history.slice(-50);
  writeJson(file, next);
  return next;
}

/**
 * Etapa 1 — OBSERVE: hechos nuevos, sin interpretar.
 * Stage 1 — OBSERVE: fresh facts, no interpretation.
 * Estágio 1 — OBSERVE: fatos novos, sem interpretação.
 */
export function observe(options = {}) {
  const { db = null, bus = null } = options;
  return attempt(() => {
    const state = agentState(options);
    const sinceRun = state.last_run?.started_at ?? null;
    const events = EventBus.loadFromDisk({ limit: 2000 });
    const newEvents = sinceRun ? events.filter((event) => (event.ts ?? '') > sinceRun) : events.slice(-50);

    const summary = summarize(loadState().value ?? {}, loadTasks().value ?? { tasks: [] });
    const drift = db ? verifyDocumentation({ db }) : { ok: true, value: { consistent: true, drift: [] } };
    const rules = db ? pendingRules({ db }) : { ok: true, value: { count: 0, rules: [] } };

    return {
      observed_at: new Date().toISOString(),
      events_since_last_run: newEvents.length,
      event_types: [...new Set(newEvents.map((event) => event.type))].slice(0, 12),
      progress_percent: summary.progress_percent ?? 0,
      current_task: summary.current_task?.id ?? null,
      open_blocks: (summary.open_blocks ?? []).map((block) => ({ id: block.id, type: block.type, waiting_on: block.waiting_on })),
      docs_consistent: drift.ok ? drift.value.consistent : null,
      docs_drift: drift.ok ? drift.value.drift : [],
      pending_rules: rules.ok ? rules.value.count : 0,
      tests_present: fs.existsSync(PATHS.tests),
    };
  }, { code: 'observe_failed', layer: 'agents' });
}

/**
 * Etapa 2 — CONTEXTUALIZE: memoria ANTES de razonar (POL-0006).
 * Stage 2 — CONTEXTUALIZE: memory BEFORE reasoning.
 * Estágio 2 — CONTEXTUALIZE: memória ANTES de raciocinar.
 */
export function contextualize(options = {}) {
  const { db = null, bus = null, query = null } = options;
  return attempt(() => {
    const context = buildSessionContext({ ...(db ? { db } : {}), bus, query });
    if (!context.ok) throw new Error(context.error.message);
    return context.value;
  }, { code: 'contextualize_failed', layer: 'agents' });
}

/**
 * Etapa 3 — REASON: política determinista con justificación PÚBLICA en forma de
 * Decision Trace (DEC-00003 prohíbe guardar razonamiento privado de modelo).
 * Stage 3 — REASON: deterministic policy with a PUBLIC Decision-Trace-shaped
 * justification (DEC-00003 forbids storing private model reasoning).
 * Estágio 3 — REASON: política determinista com justificativa PÚBLICA.
 */
export function reason(options = {}) {
  const { observation = null, context = null, goal = null, bus = null } = options;
  return attempt(() => {
    if (goal) {
      return publishRationale({
        objective: ` pursue the explicit goal given by the operator: "${goal}"`,
        context: 'the operator passed an explicit --goal; operator intent outranks the policy',
        alternatives: [{ option: 'explicit operator goal', selected: true }, { option: 'autonomous policy', selected: false }],
        decision: goal,
        justification: 'explicit human instruction',
      }, bus);
    }
    const facts = observation ?? {};

    // ES: política de prioridad — primero lo que está roto, después lo que
    //     mejora, al final la salud. Orden estable = decisiones reproducibles.
    // EN: priority policy — broken things first, improvements next, health last.
    //     Stable order = reproducible decisions.
    // PT: política de prioridade — primeiro o quebrado, depois melhorias, saúde.
    const waitingUser = (facts.open_blocks ?? []).find((block) => block.waiting_on === 'user');
    if (waitingUser) {
      return publishRationale({
        objective: 'decide what to do while a block waits on the user',
        context: `block ${waitingUser.id} (${waitingUser.type}) waits on a human; the system cannot resolve it alone`,
        alternatives: [
          { option: 'retry the blocked operation in a loop', selected: false },
          { option: 'observe and verify health without touching the blocked path', selected: true },
        ],
        decision: 'verify project health',
        justification: 'retrying what a human must unblock burns budget and repeats the failure (lesson LES-00001: verify permissions before promising)',
      }, bus);
    }
    if (facts.docs_consistent === false) {
      return publishRationale({
        objective: 'decide the next action given documentation drift',
        context: `verifyDocumentation reports drift: ${(facts.docs_drift ?? []).join('; ').slice(0, 200)}`,
        alternatives: [
          { option: 'hand-edit the docs', selected: false },
          { option: 'regenerate the documentation set from the database', selected: true },
        ],
        decision: 'regenerate documentation',
        justification: 'docs are generated artifacts (Phase 3): the database is the source of truth, so regeneration — not editing — removes drift',
      }, bus);
    }
    if ((facts.pending_rules ?? 0) > 0) {
      return publishRationale({
        objective: 'decide what to do with pending lesson rules',
        context: `${facts.pending_rules} rule(s) proposed by lessons are not yet policies`,
        alternatives: [
          { option: 'leave them as proposals forever', selected: false },
          { option: 'promote them into control/policies.json', selected: true },
        ],
        decision: 'promote pending rules',
        justification: 'Phase 7 exit criterion: an error must produce a lesson AND a rule that prevents the same failure; unpromoted rules prevent nothing',
      }, bus);
    }
    return publishRationale({
      objective: 'decide the default action when nothing is broken',
      context: `progress ${facts.progress_percent ?? '?'}%, task ${facts.current_task ?? '—'}, no drift, no pending rules`,
      alternatives: [
        { option: 'do nothing', selected: false },
        { option: 'run the health verification (tests + docs drift)', selected: true },
      ],
      decision: 'verify project health',
      justification: 'the cheapest way to keep the "everything works" claim honest is to re-prove it every turn',
    }, bus);
  }, { code: 'reason_failed', layer: 'agents', interruptionType: 'ambiguity' });
}

/** ES/EN/PT: hace pública la justificación (evento) y la devuelve como traza. */
function publishRationale(rationale, bus) {
  const trace = {
    kind: 'agent-rationale',
    objective: rationale.objective,
    context: rationale.context,
    alternatives: rationale.alternatives,
    decision: rationale.decision,
    justification: rationale.justification,
    decided_at: new Date().toISOString(),
  };
  bus?.emit('DECISION_MADE', { kind: 'agent-rationale', decision: trace.decision, justification: trace.justification }, { layer: 'agents' });
  return trace;
}

/** Etapa 4 — PLAN: pasos verificables. Stage 4 — PLAN. Estágio 4 — PLAN. */
export function plan(options = {}) {
  const { rationale = null, db = null, bus = null, persist = false, task = null } = options;
  const objective = rationale?.decision ?? options.objective ?? 'verify project health';
  return createPlan({ objective, task, layer: 'agents', bus, persist, db: persist ? db : null });
}

/** Etapa 5 — EXECUTE: protocolo de mutación. Stage 5 — EXECUTE. Estágio 5. */
export async function execute(options = {}) {
  const { plan: thePlan = null, db = null, bus = null, dryRun = true } = options;
  return executePlan({ plan: thePlan, db, bus, dryRun, checkpointFirst: !dryRun });
}

/** Etapa 6 — VERIFY: compuertas. Stage 6 — VERIFY. Estágio 6 — VERIFY. */
export function verify(options = {}) {
  const { db = null, bus = null } = options;
  return attempt(() => {
    const policies = verifyPolicies({ bus });
    const reversibility = verifyReversibility({});
    const docs = db ? verifyDocumentation({ db }) : { ok: true, value: { consistent: true } };
    return {
      policies: policies.ok ? policies.value : { verified: false, error: policies.error.message },
      reversibility: reversibility.ok ? reversibility.value : { reversible: false, error: reversibility.error.message },
      docs_consistent: docs.ok ? docs.value.consistent : null,
    };
  }, { code: 'verify_failed', layer: 'verification' });
}

/** Etapa 7 — LEARN: historial + lecciones. Stage 7 — LEARN. Estágio 7 — LEARN. */
export function learn(options = {}) {
  const { turn = null, db = null, bus = null } = options;
  return attempt(() => {
    const state = agentState(options);
    const entry = {
      turn: turn?.turn ?? (state.history?.length ?? 0) + 1,
      started_at: turn?.started_at ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
      goal: turn?.goal ?? null,
      status: turn?.status ?? 'unknown',
      dry_run: Boolean(turn?.dry_run),
      stages_completed: turn?.stages_completed ?? [],
    };
    saveAgentState({
      status: 'idle',
      last_run: entry,
      history: [...(state.history ?? []), entry],
    }, options);
    if (db && entry.status === 'completed' && !entry.dry_run) {
      try { reconcile({ bus }); } catch { /* learning never crashes the turn */ }
    }
    return entry;
  }, { code: 'learn_failed', layer: 'learning-evolution' });
}

/**
 * ES: UNA vuelta completa del bucle (7 etapas) con manejo de interrupciones.
 *     dryRun=true (default): observa, contextualiza, razona, planifica y
 *     verifica SIN mutar. dryRun=false: ejecuta con checkpoint previo.
 * EN: ONE full turn of the loop (7 stages) with interruption handling.
 *     dryRun=true (default): observe→plan→verify WITHOUT mutating.
 *     dryRun=false: executes with a checkpoint first.
 * PT: UMA volta completa do loop (7 estágios) com tratamento de interrupções.
 *
 * @param {{ dryRun?: boolean, goal?: string|null, db?: object|null, bus?: object|null, turn?: number, budgets?: object, agentStateFile?: string }} [options]
 */
export async function runAgentTurn(options = {}) {
  const { dryRun = true, goal = null, bus = null, turn = 1 } = options;
  const db = options.db ?? null;
  const started = new Date().toISOString();
  const stages = [];
  const mark = (stage, result) => { stages.push({ stage, ok: result?.ok !== false, detail: result?.ok === false ? result.error?.message : undefined }); };

  saveAgentState({ status: 'running' }, options);

  /*
   * ES: `guard` marca la etapa y, si el Result falló, lanza con la etapa ya
   *     pegada al error — así el reporte dice EXACTAMENTE dónde se rompió.
   * EN: `guard` marks the stage and, when the Result failed, throws with the
   *     stage already attached — the report says EXACTLY where it broke.
   * PT: `guard` marca o estágio e lança com o estágio anexado ao erro.
   */
  const guard = (stage, result) => {
    mark(stage, result);
    if (!result.ok) {
      const error = new Error(result.error.message);
      error.stage = stage;
      error.code = result.error.code;
      error.interruptionType = result.error.interruptionType ?? 'failed';
      throw error;
    }
    return result.value;
  };

  try {
    // 1 — OBSERVE
    const facts = guard('observe', observe({ db, bus, ...options }));

    // 2 — CONTEXTUALIZE
    const context = guard('contextualize', contextualize({ db, bus }));

    // 3 — REASON
    const rationale = guard('reason', reason({ observation: facts, context, goal, bus }));

    // 4 — PLAN
    const thePlan = guard('plan', plan({ rationale, db, bus, persist: !dryRun }));

    // 5 — EXECUTE
    const execution = guard('execute', await execute({ plan: thePlan, db, bus, dryRun }));

    /*
     * ES: si el plan se ejecutó DE VERDAD y fue persistido, su status pasa a
     *     'executed': el registro debe reflejar la realidad (auditoría honesta).
     * EN: when the plan really ran and was persisted, its status becomes
     *     'executed': the record must reflect reality (honest auditability).
     * PT: se o plano realmente rodou e foi persistido, o status vira 'executed'.
     */
    if (!dryRun && db && execution.mode === 'executed') {
      try { persistPlan(db, { ...thePlan, status: 'executed' }); } catch { /* audit never breaks the turn */ }
    }

    // 6 — VERIFY
    const verification = guard('verify', verify({ db, bus }));

    const report = {
      turn, started_at: started, finished_at: new Date().toISOString(),
      dry_run: dryRun, status: 'completed', goal: rationale.decision,
      rationale, plan: thePlan,
      execution, verification,
      stages_completed: stages.filter((stage) => stage.ok).map((stage) => stage.stage),
    };
    /*
     * ES: OJO al orden del spread: {...options, turn: report}. Si fuera al revés,
     *     options.turn (el NÚMERO de turno) pisaría report (el OBJETO) y learn()
     *     guardaría status 'unknown'. En JS el último spread gana.
     * EN: mind the spread order: {...options, turn: report}. Reversed,
     *     options.turn (the NUMBER) would clobber report (the OBJECT) and learn()
     *     would store status 'unknown'. In JS the last spread wins.
     * PT: atenção à ordem do spread: o último vence. Invertido, options.turn
     *     (NÚMERO) sobrescreveria report (OBJETO) e o histórico diria 'unknown'.
     */
    learn({ ...options, turn: report, db, bus });
    bus?.emit('BUILD_COMPLETED', { kind: 'agent-turn', turn, dry_run: dryRun, goal: report.goal }, { layer: 'agents' });
    return ok(report);
  } catch (error) {
    /*
     * ES: falló una etapa → interrupción tipada + sugerencia de recuperación.
     *     El fallo NO se traga: queda en state.blocks, en la tabla interruptions
     *     (si hay db) y en el historial del agente.
     * EN: a stage failed → typed interruption + recovery suggestion. The failure
     *     is never swallowed.
     * PT: uma etapa falhou → interrupção tipada + sugestão de recuperação.
     */
    const interruption = raiseInterruption({
      type: error.interruptionType ?? 'failed',
      layer: 'agents',
      reason: `agent turn ${turn} failed at stage "${error.stage ?? 'unknown'}": ${error.message}`,
      impact: dryRun ? 'low' : 'medium',
      recoverable: true,
      waitingOn: (error.interruptionType === 'security_stop') ? 'user' : 'system',
      bus, db,
      stateFile: options.stateFile ?? null,
    });
    const suggestion = interruption.ok ? suggestRecovery({ interruption: interruption.value }) : null;
    const report = {
      turn, started_at: started, finished_at: new Date().toISOString(),
      dry_run: dryRun, status: 'failed', failed_stage: error.stage ?? 'unknown',
      error: error.message, stages_completed: stages.filter((stage) => stage.ok).map((stage) => stage.stage),
      interruption: interruption.ok ? interruption.value : interruption.error,
      recovery_suggestion: suggestion?.ok ? suggestion.value : null,
    };
    learn({ ...options, turn: report, db, bus });
    return ok(report);
  }
}

export default {
  AGENT_LOOP, agentState, saveAgentState, observe, contextualize, reason,
  plan, execute, verify, learn, runAgentTurn,
};

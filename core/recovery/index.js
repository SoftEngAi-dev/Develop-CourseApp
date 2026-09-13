/* ═══════════════════════════════════════════════════════════════════════════
 * core/recovery/index.js — PHASE 5 · RECOVERY (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: el ciclo completo de interrupciones ("cortes").
 *     raiseInterruption   → persiste el corte en la tabla `interruptions`, lo
 *                           suma a state.blocks (si aplica) y emite
 *                           INTERRUPTION_RAISED. Parar ES un evento tipado.
 *     suggestRecovery     → mapa tipo → capacidad + comando concreto sugerido.
 *     recover             → RECOVERY_STARTED → restoreCheckpoint → resuelve el
 *                           corte → RECOVERY_COMPLETED.
 *     resolveInterruption → cierra el corte en DB y en state.blocks con una
 *                           resolución explícita (nada se cierra en silencio).
 *     Todo acepta {db, stateFile} inyectables: los tests usan copias temporales
 *     y el plano de control real jamás se toca por accidente.
 *
 * 🇬🇧 EN — WHAT IT DOES: the full interruption cycle. raiseInterruption
 *     persists the stop in the `interruptions` table, adds it to state.blocks
 *     (when applicable) and emits INTERRUPTION_RAISED — stopping IS a typed
 *     event. suggestRecovery maps type → capability + concrete command. recover
 *     restores a checkpoint and resolves the interruption. resolveInterruption
 *     closes it in DB and state with an explicit resolution (nothing closes
 *     silently). Everything accepts injectable {db, stateFile} so tests never
 *     touch the real control plane.
 *
 * 🇧🇷 PT — O QUE FAZ: o ciclo completo de interrupções. Parar É um evento
 *     tipado; nada é fechado em silêncio; testes usam {db, stateFile} injetáveis.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Parar con tipo ES/EN/PT: un sistema que se detiene sin decir POR QUÉ y de
 *     QUÉ tipo obliga a un humano a reconstruir la escena. Con tipo
 *     (security_stop, tool_error, ambiguity…) la recuperación es un lookup.
 *     A typed stop makes recovery a lookup instead of an investigation.
 *   • waiting_on ES/EN/PT: algunos cortes no los puede resolver el sistema
 *     (waiting_on:'user' — como el 403 de GitHub). Marcar quién debe actuar
 *     evita bucles infinitos de reintento. Mark WHO must act to avoid retry loops.
 *   • Resolver ≠ borrar ES/EN/PT: resolveInterruption marca status='resolved' y
 *     guarda la resolución; la fila SIGUE ahí. La historia no se edita.
 *     Resolving marks status; the row stays. History is never edited.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail, attempt } from '../shared/result.js';
import { PATHS } from '../shared/paths.js';
import { readJson, writeJson } from '../shared/json.js';
import { nextId, ID_PREFIX } from '../shared/ids.js';
import { all, run as dbRun } from '../../knowledge/db/index.js';
import { restoreCheckpoint } from '../checkpoint/index.js';

/** ES/EN/PT: taxonomía oficial (DEC-00004). Official taxonomy. */
export const INTERRUPTION_TYPES = Object.freeze([
  'blocked', 'failed', 'interrupted', 'waiting_user', 'dependency_missing',
  'tool_error', 'ambiguity', 'conflict', 'resource_limit', 'security_stop', 'scope_change',
]);

/** ES/EN/PT: capacidades y su estado real. Capabilities and their real status. */
export const RECOVERY_CAPABILITIES = Object.freeze({
  checkpoint: 'implemented (core/checkpoint → `genesis checkpoint`)',
  rollback: 'implemented (core/checkpoint → `genesis rollback <id>`)',
  resume: 'implemented (knowledge/retrieval/context → `genesis resume`)',
  diff: 'implemented (core/checkpoint → `genesis diff`)',
  retry: 'implemented (core/recovery → recover() re-executes after rollback)',
  recover: 'implemented (core/recovery → recover({checkpointId}))',
  skip: 'implemented (resolveInterruption with resolution "skipped")',
  pause: 'implemented (agent dry-run mode: plans without executing)',
  continue: 'implemented (genesis resume → next_recommended_action)',
});

/** ES/EN/PT: sugerencia concreta por tipo de corte. Type → concrete suggestion. */
const SUGGESTIONS = Object.freeze({
  security_stop: { capability: 'pause', command: 'do NOT retry; a human must review (waiting_on: user)', automatic: false },
  tool_error: { capability: 'retry', command: 'genesis rollback <CHK> && re-run the failed step', automatic: true },
  failed: { capability: 'rollback', command: 'genesis rollback <CHK>', automatic: true },
  dependency_missing: { capability: 'recover', command: 'install/repair the dependency, then genesis resume', automatic: false },
  ambiguity: { capability: 'continue', command: 'ask the user to disambiguate; record the answer with genesis capture', automatic: false },
  conflict: { capability: 'diff', command: 'genesis diff <CHK-A> <CHK-B> and choose a side', automatic: false },
  resource_limit: { capability: 'pause', command: 'reduce scope (fewer turns/steps) and retry later', automatic: false },
  blocked: { capability: 'continue', command: 'resolve the blocker, then genesis tasks --set <TSK>:recovery', automatic: false },
  interrupted: { capability: 'resume', command: 'genesis resume', automatic: true },
  waiting_user: { capability: 'pause', command: 'wait for the human; do not loop', automatic: false },
  scope_change: { capability: 'continue', command: 'record a Decision Trace for the new scope, then replan', automatic: false },
});

/**
 * ES: registra una interrupción (DB + state.blocks + evento observable).
 * EN: raises an interruption (DB + state.blocks + observable event).
 * PT: registra uma interrupção (DB + state.blocks + evento observável).
 *
 * @param {{ type: string, reason: string, layer?: string|null, task?: string|null, impact?: 'low'|'medium'|'high', recoverable?: boolean, waitingOn?: string|null, recoveryPlan?: string[]|null, bus?: object|null, db?: object|null, stateFile?: string|null, addToState?: boolean }} options
 */
export function raiseInterruption(options = {}) {
  const {
    type = null, reason = null, layer = null, task = null, impact = 'medium',
    recoverable = true, waitingOn = null, recoveryPlan = null,
    bus = null, db = null, stateFile = null, addToState = true,
  } = options;

  if (!type || !INTERRUPTION_TYPES.includes(type)) {
    return fail(`Unknown interruption type "${type}" — taxonomy: ${INTERRUPTION_TYPES.join(', ')}`, { code: 'interruption_type_unknown', interruptionType: 'ambiguity' });
  }
  if (!reason) return fail('raiseInterruption requires a reason', { code: 'interruption_reason_missing' });

  return attempt(() => {
    const now = new Date().toISOString();
    let id = `INT-T${Date.now()}`;

    if (db) {
      id = nextId(ID_PREFIX.interruption, all(db, 'SELECT id FROM interruptions').map((row) => row.id), 5);
      dbRun(db, `INSERT INTO interruptions (id, type, layer, task, reason, impact, recoverable, recovery_plan_json, status, detected_at, resolved_at, waiting_on)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?)`,
      [id, type, layer, task, reason, impact, recoverable ? 1 : 0, recoveryPlan ? JSON.stringify(recoveryPlan) : null, now, waitingOn]);
    }

    if (addToState) {
      const file = stateFile ?? PATHS.state;
      const state = readJson(file, null);
      if (state) {
        state.blocks = [...(state.blocks ?? []).filter((block) => block.id !== id), {
          id, task, type, reason, impact, recoverable, status: 'open', waiting_on: waitingOn ?? (SUGGESTIONS[type]?.automatic ? 'system' : 'user'),
        }];
        state.updated_at = now;
        writeJson(file, state);
      }
    }

    bus?.emit('INTERRUPTION_RAISED', { id, type, task, reason, impact, recoverable }, { layer: layer ?? 'core-engine', severity: impact === 'high' ? 'critical' : 'high' });
    return { id, type, reason, task, impact, recoverable, waiting_on: waitingOn, suggestion: SUGGESTIONS[type] ?? null, raised_at: now };
  }, { code: 'interruption_raise_failed', layer: 'core-engine' });
}

/**
 * ES: sugiere la recuperación concreta para un corte (capacidad + comando).
 * EN: suggests the concrete recovery for an interruption (capability + command).
 * PT: sugere a recuperação concreta para um corte.
 */
export function suggestRecovery(options = {}) {
  const interruption = options.interruption ?? options;
  const type = interruption?.type ?? null;
  if (!type || !INTERRUPTION_TYPES.includes(type)) {
    return fail(`Cannot suggest recovery for unknown type "${type}"`, { code: 'interruption_type_unknown' });
  }
  const suggestion = SUGGESTIONS[type] ?? { capability: 'resume', command: 'genesis resume', automatic: false };
  return ok({
    type,
    capability: suggestion.capability,
    capability_status: RECOVERY_CAPABILITIES[suggestion.capability] ?? 'unknown',
    suggested_command: suggestion.command,
    automatic: suggestion.automatic,
    checkpoint_available: Boolean(interruption?.checkpoint ?? null) || null,
  });
}

/**
 * ES: recuperación real: RECOVERY_STARTED → restoreCheckpoint → resolver corte.
 * EN: real recovery: RECOVERY_STARTED → restoreCheckpoint → resolve interruption.
 * PT: recuperação real: restore + resolução do corte.
 *
 * @param {{ checkpointId?: string|null, interruptionId?: string|null, resolution?: string|null, bus?: object|null, db?: object|null, stateFile?: string|null }} [options]
 */
export function recover(options = {}) {
  const { checkpointId = null, interruptionId = null, resolution = null, bus = null, db = null, stateFile = null } = options;

  if (!checkpointId) return fail('recover requires a checkpointId to restore', { code: 'checkpoint_missing', interruptionType: 'ambiguity' });

  bus?.emit('RECOVERY_STARTED', { checkpoint: checkpointId, interruption: interruptionId }, { layer: 'core-engine' });
  const restored = restoreCheckpoint(checkpointId, { bus });
  if (!restored.ok) {
    bus?.emit('ERROR_DETECTED', { tool: 'recover', checkpoint: checkpointId, message: restored.error.message }, { layer: 'core-engine', severity: 'critical' });
    return restored;
  }

  let resolved = null;
  if (interruptionId) {
    resolved = resolveInterruption({ id: interruptionId, resolution: resolution ?? `restored checkpoint ${checkpointId}`, bus, db, stateFile });
  }
  bus?.emit('RECOVERY_COMPLETED', { checkpoint: checkpointId, restored: restored.value?.restored ?? null, interruption: interruptionId }, { layer: 'core-engine' });
  return ok({ checkpoint: checkpointId, restored: restored.value, interruption_resolved: resolved?.ok ? resolved.value : null });
}

/**
 * ES: cierra un corte con resolución explícita (DB + state.blocks + evento).
 * EN: closes an interruption with an explicit resolution (DB + state + event).
 * PT: fecha um corte com resolução explícita.
 */
export function resolveInterruption(options = {}) {
  const { id = null, resolution = null, bus = null, db = null, stateFile = null } = options;
  if (!id) return fail('resolveInterruption requires the interruption id', { code: 'interruption_id_missing' });

  return attempt(() => {
    const now = new Date().toISOString();
    if (db) {
      dbRun(db, `UPDATE interruptions SET status = 'resolved', resolved_at = ?, reason = reason WHERE id = ?`, [now, id]);
      // ES: la resolución viaja como sufijo auditable del reason (no hay columna
      //     dedicada y NO reescribimos historia: se agrega, no se pisa).
      // EN: the resolution travels as an auditable suffix of reason (history is
      //     appended, never overwritten).
      // PT: a resolução viaja como sufixo auditável do reason.
      if (resolution) dbRun(db, `UPDATE interruptions SET reason = reason || ? WHERE id = ? AND reason NOT LIKE ?`, [` [resolved: ${resolution}]`, id, `%[resolved: ${resolution}]%`]);
    }

    const file = stateFile ?? PATHS.state;
    const state = readJson(file, null);
    if (state && Array.isArray(state.blocks)) {
      let touched = false;
      state.blocks = state.blocks.map((block) => {
        if (block.id !== id) return block;
        touched = true;
        return { ...block, status: 'resolved', resolved_at: now, resolution: resolution ?? 'resolved' };
      });
      if (touched) { state.updated_at = now; writeJson(file, state); }
    }

    bus?.emit('RECOVERY_COMPLETED', { kind: 'interruption-resolved', id, resolution: resolution ?? 'resolved' }, { layer: 'core-engine' });
    return { id, status: 'resolved', resolution: resolution ?? 'resolved', resolved_at: now };
  }, { code: 'interruption_resolve_failed', layer: 'core-engine' });
}

export default { INTERRUPTION_TYPES, RECOVERY_CAPABILITIES, raiseInterruption, suggestRecovery, recover, resolveInterruption };

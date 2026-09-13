/* ═══════════════════════════════════════════════════════════════════════════
 * core/recovery/index.js — PHASE 5 · RECOVERY ENGINE (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: convertir cada interrupción ("corte") en un dato con tipo,
 *     causa, impacto y recuperación posible — y ejecutar esa recuperación.
 *     Taxonomía de 11 tipos (DEC-00004, declarada en control/manifest.json →
 *     recovery.interruption_types):
 *       blocked · failed · interrupted · waiting_user · dependency_missing ·
 *       tool_error · ambiguity · conflict · resource_limit · security_stop ·
 *       scope_change
 *     Capacidades de recuperación (8): checkpoint · rollback · resume · retry ·
 *     recover · skip · pause · continue.
 *     ESTADO: ESQUELETO (DEC-00009). Hoy están implementadas 4 de las 8
 *     capacidades, de forma manual desde la CLI: checkpoint, rollback, resume y diff.
 *     PRUEBA REAL YA GUARDADA: INT-00001 · security_stop · "GitHub integration
 *     token cannot create repositories (HTTP 403)" bloqueando TSK-00011. Ese
 *     corte se registró, se clasificó, se marcó `waiting_on: user` y aparece en
 *     `genesis status` y en el dashboard. No se perdió: eso es recuperación.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: turn every interruption ("corte") into data with a
 *     type, cause, impact and possible recovery — and then execute that recovery.
 *     11-type taxonomy (DEC-00004): blocked, failed, interrupted, waiting_user,
 *     dependency_missing, tool_error, ambiguity, conflict, resource_limit,
 *     security_stop, scope_change. 8 capabilities: checkpoint, rollback, resume,
 *     retry, recover, skip, pause, continue.
 *     STATUS: SKELETON (DEC-00009). 4 of the 8 capabilities are implemented today,
 *     manually from the CLI: checkpoint, rollback, resume and diff.
 *     REAL STORED PROOF: INT-00001 · security_stop · "GitHub integration token
 *     cannot create repositories (HTTP 403)" blocking TSK-00011. It was recorded,
 *     classified, marked `waiting_on: user` and shows in `genesis status` and the
 *     dashboard. It was not lost: that is recovery.
 *
 * 🇧🇷 PT — O QUE FARÁ: transformar cada interrupção ("corte") em dado com tipo,
 *     causa, impacto e recuperação — e executá-la. 11 tipos (DEC-00004) e 8
 *     capacidades. ESTADO: ESQUELETO; hoje 4 de 8 funcionam via CLI.
 *     PROVA REAL: INT-00001 · security_stop · GitHub 403 bloqueando TSK-00011.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Por qué tipar los cortes ES/EN/PT: "falló" no permite actuar. "dependency_
 *     missing" sugiere instalar o sustituir; "waiting_user" sugiere preguntar;
 *     "security_stop" sugiere NO insistir. El tipo DETERMINA la recuperación.
 *     Typing an interruption is what makes automatic recovery possible.
 *   • `recoverable: false` ES/EN/PT: hay cortes que el sistema NO debe intentar
 *     arreglar solo (borrar datos, gastar dinero, tocar credenciales). Marcarlos
 *     explícitamente evita bucles infinitos de reintento. Some failures must
 *     never be auto-retried; say so explicitly.
 *   • waiting_on ES/EN/PT: cuando la recuperación depende de un humano, se guarda
 *     QUIÉN debe actuar. Un bloqueo sin dueño es un bloqueo eterno.
 *     A block without an owner is a forever block.
 *   • Reintentar con backoff ES/EN/PT: reintentar inmediatamente el mismo fallo
 *     suele reproducirlo. Esperar un poco más cada vez (1s, 2s, 4s…) con tope de
 *     intentos es la práctica estándar. Exponential backoff with a retry cap.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/recovery/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: taxonomía oficial (DEC-00004). Official taxonomy. */
export const INTERRUPTION_TYPES = Object.freeze([
  'blocked', 'failed', 'interrupted', 'waiting_user', 'dependency_missing',
  'tool_error', 'ambiguity', 'conflict', 'resource_limit', 'security_stop', 'scope_change',
]);

/** ES/EN/PT: capacidades y su estado real hoy. Capabilities and their real status. */
export const RECOVERY_CAPABILITIES = Object.freeze({
  checkpoint: 'implemented (core/checkpoint → `genesis checkpoint`)',
  rollback: 'implemented (core/checkpoint → `genesis rollback <id>`)',
  resume: 'implemented (knowledge/retrieval/context → `genesis resume`)',
  diff: 'implemented (core/checkpoint → `genesis diff`)',
  retry: 'skeleton',
  recover: 'skeleton',
  skip: 'skeleton',
  pause: 'skeleton',
  continue: 'skeleton',
});

/** ES: registra una interrupción con su tipo, causa e impacto. */
export function raiseInterruption(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'record a typed interruption event and link it to the affected task',
    available: 'the mechanism exists and is in use: core/event-bus → INTERRUPTION_RAISED; the `interruptions` table stores INT-00001; `genesis status` lists open blocks.',
    types: INTERRUPTION_TYPES,
    details_requested: Object.keys(options),
  });
}

/** ES: elige la mejor recuperación para un tipo de interrupción. */
export function suggestRecovery(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'map an interruption type to the best recovery capability, using past lessons',
    available: 'memory/lessons/index.js → lessonMemory() / repeatedFailures() already surfaces what worked before; the `errors` table stores analysis + recovery for every recorded failure.',
    details_requested: Object.keys(options),
  });
}

/** ES: ejecuta la recuperación (rollback, retry, skip, pause…). */
export function recover(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'execute a recovery action automatically (rollback, retry with backoff, skip, pause)',
    available: 'manual equivalents work today: `genesis rollback <checkpoint>`, `genesis process --force` (retry the pipeline), `genesis resume` (continue with full context).',
    capabilities: RECOVERY_CAPABILITIES,
    details_requested: Object.keys(options),
  });
}

/** ES: marca una interrupción como resuelta y emite RECOVERY_COMPLETED. */
export function resolveInterruption(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'close an interruption with its resolution and emit RECOVERY_COMPLETED',
    available: 'core/event-bus/event-types.js already defines RECOVERY_COMPLETED; the `interruptions` table has a `status` column.',
    details_requested: Object.keys(options),
  });
}

export default { INTERRUPTION_TYPES, RECOVERY_CAPABILITIES, raiseInterruption, suggestRecovery, recover, resolveInterruption };

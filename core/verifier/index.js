/* ═══════════════════════════════════════════════════════════════════════════
 * core/verifier/index.js — PHASE 5 · VERIFICATION GATES (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: decidir si un cambio PUEDE entrar. Cuatro niveles de
 *     verificación declarados en control/manifest.json → verification.levels:
 *       unit · integration · pipeline · mutation-safety
 *     Cada nivel es una puerta: si una falla, el cambio no se confirma y se
 *     dispara el rollback. Verificar no es "probar que funciona", es "impedir
 *     que entre lo que no funciona".
 *     ESTADO: ESQUELETO (DEC-00009).
 *     QUÉ SÍ EXISTE: piezas sueltas ya operativas — core/validation/schema.js
 *     (valida el plano de control), tests/ con `node --test`, `genesis doctor`
 *     (diagnóstico del entorno: node, sqlite, FTS5, rutas, permisos).
 *
 * 🇬🇧 EN — WHAT IT WILL DO: decide whether a change MAY enter. Four verification
 *     levels declared in control/manifest.json → verification.levels:
 *       unit · integration · pipeline · mutation-safety
 *     Each level is a gate: if one fails, the change is not committed and rollback
 *     fires. Verifying is not "proving it works", it is "preventing what does not
 *     work from entering".
 *     STATUS: SKELETON (DEC-00009).
 *     WHAT ALREADY EXISTS: working pieces — core/validation/schema.js (validates
 *     the control plane), tests/ with `node --test`, `genesis doctor` (environment
 *     diagnosis: node, sqlite, FTS5, paths, permissions).
 *
 * 🇧🇷 PT — O QUE FARÁ: decidir se uma mudança PODE entrar. Quatro níveis:
 *     unit · integration · pipeline · mutation-safety. ESTADO: ESQUELETO (DEC-00009).
 *     O QUE JÁ EXISTE: core/validation/schema.js, tests/ com `node --test`, `genesis doctor`.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Pirámide de tests ES/EN/PT: muchos tests UNITARIOS (rápidos, aislados),
 *     menos de INTEGRACIÓN (varios módulos juntos), pocos de PIPELINE (flujo
 *     completo) y alguno de MUTATION-SAFETY (¿el cambio se puede deshacer?).
 *     Invertir la pirámide = suite lenta que nadie ejecuta.
 *     Many fast unit tests, few slow end-to-end tests: the test pyramid.
 *   • Puerta (gate) ES/EN/PT: una comprobación BINARIA con consecuencia. No es un
 *     aviso: si falla, bloquea. Un "warning" que nadie lee no es una puerta.
 *     A gate is binary and has consequences; a warning nobody reads is not a gate.
 *   • Por qué mutation-safety es un nivel propio ES/EN/PT: en este proyecto el
 *     riesgo no es solo "código roto", es "código que no se puede deshacer".
 *     Un cambio correcto pero irreversible es peor que un cambio incorrecto
 *     reversible. Reversibility is verified as its own level.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/verifier/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: los 4 niveles declarados en el manifiesto. The 4 declared levels. */
export const VERIFICATION_LEVELS = Object.freeze(['unit', 'integration', 'pipeline', 'mutation-safety']);

/** ES: ejecuta TODAS las puertas y devuelve veredicto + informe por nivel. */
export function verifyChange(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run every verification gate on a pending change and return a pass/fail verdict per level',
    available: '`npm test` runs `node --disable-warning=ExperimentalWarning --test tests/`; `genesis doctor` checks the environment; core/validation/schema.js validates control-plane JSON.',
    levels: VERIFICATION_LEVELS,
    details_requested: Object.keys(options),
  });
}

/** ES: comprueba los criterios de aceptación de una tarea concreta. */
export function verifyAcceptance(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'check a task acceptance criteria one by one and report which are met',
    available: 'every task in control/tasks.json already carries an `acceptance` field; `genesis tasks` prints them.',
    details_requested: Object.keys(options),
  });
}

/** ES: verifica las políticas operativas (POL-0001..POL-0010) contra el estado actual. */
export function verifyPolicies(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'detect policy violations (e.g. a new npm dependency in the core, a rewritten file)',
    available: 'control/policies.json holds 10 rules; `genesis doctor` already probes the zero-dependency and offline requirements in practice.',
    details_requested: Object.keys(options),
  });
}

/** ES: nivel mutation-safety — ¿se puede deshacer este cambio con lo que tenemos? */
export function verifyReversibility(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'refuse changes that cannot be rolled back with the existing checkpoints',
    available: 'core/checkpoint/index.js → createCheckpoint / diffCheckpoints / restoreCheckpoint already provide the mechanism; `genesis checkpoints` lists them.',
    details_requested: Object.keys(options),
  });
}

export default { VERIFICATION_LEVELS, verifyChange, verifyAcceptance, verifyPolicies, verifyReversibility };

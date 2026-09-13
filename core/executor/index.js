/* ═══════════════════════════════════════════════════════════════════════════
 * core/executor/index.js — PHASE 5 · EXECUTOR & MUTATION PROTOCOL (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: aplicar cambios al proyecto siguiendo el protocolo de
 *     mutación de POL-0002:
 *       READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT
 *     Es el módulo más delicado del sistema: es el único que ESCRIBE sobre el
 *     proyecto real (nivel 4). Por eso nunca actúa sin checkpoint previo y nunca
 *     reescribe un archivo entero cuando basta un parche.
 *     ESTADO: ESQUELETO (DEC-00009).
 *     QUÉ SÍ EXISTE: la red de seguridad sobre la que se apoyará ya funciona —
 *     core/checkpoint/index.js crea snapshots, calcula diffs y restaura
 *     (`genesis checkpoint | checkpoints | diff | rollback`), probado con
 *     CHK-00001.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: apply changes to the project following the mutation
 *     protocol of POL-0002:
 *       READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT
 *     It is the most delicate module in the system: the only one that WRITES to
 *     the real project (level 4). That is why it never acts without a previous
 *     checkpoint and never rewrites a whole file when a patch is enough.
 *     STATUS: SKELETON (DEC-00009).
 *     WHAT ALREADY EXISTS: the safety net it will rely on already works —
 *     core/checkpoint/index.js creates snapshots, computes diffs and restores
 *     (`genesis checkpoint | checkpoints | diff | rollback`), proven with CHK-00001.
 *
 * 🇧🇷 PT — O QUE FARÁ: aplicar mudanças seguindo o protocolo de mutação POL-0002:
 *       READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT
 *     É o módulo mais delicado: o único que ESCREVE no projeto real (nível 4).
 *     ESTADO: ESQUELETO (DEC-00009). A rede de segurança (core/checkpoint) já funciona.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Por qué UNDERSTAND antes de DIFF ES/EN/PT: comparar texto línea a línea
 *     produce parches frágiles (un espacio de más y falla). Entender la
 *     ESTRUCTURA (AST de JS, tabla SQL, objeto JSON) permite parches semánticos.
 *     Diffing text is brittle; diffing structure is robust.
 *   • Parche mínimo ES/EN/PT: cuanto más grande es un cambio, más difícil es
 *     revisarlo, probarlo y deshacerlo. La regla "el parche más pequeño posible"
 *     no es estética: es lo que hace que `git bisect` y el rollback funcionen.
 *     The smallest possible patch is what makes review and rollback possible.
 *   • Snapshot antes, no después ES/EN/PT: un checkpoint creado DESPUÉS del cambio
 *     no sirve para volver atrás. El orden importa tanto como la existencia.
 *     A checkpoint taken after the change cannot undo it: order matters.
 *   • VERIFY es parte del cambio ES/EN/PT: un cambio no verificado no está
 *     "terminado", está "escrito". COMMIT solo ocurre si VERIFY pasa.
 *     An unverified change is written, not finished.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/executor/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: las 7 etapas del protocolo, en orden obligatorio (POL-0002). */
export const MUTATION_PROTOCOL = Object.freeze(['READ', 'UNDERSTAND', 'DIFF', 'PLAN', 'PATCH', 'VERIFY', 'COMMIT']);

/** ES: ejecuta un plan completo con checkpoint, diff, patch, verificación y commit. */
export function executePlan(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'execute a plan through the 7-stage mutation protocol with automatic checkpoint and rollback',
    available: 'the safety net works today: core/checkpoint/index.js → createCheckpoint / diffCheckpoints / restoreCheckpoint; `genesis checkpoint`, `genesis diff`, `genesis rollback <id>`.',
    protocol: MUTATION_PROTOCOL,
    details_requested: Object.keys(options),
  });
}

/** ES: aplica UN parche mínimo a UN archivo (nunca reescribe el archivo entero). */
export function applyPatch(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'apply one minimal patch to one file (anti-goal: never rewrite whole files)',
    available: 'nothing writes to level 4 automatically today; all changes are human/agent-driven through git, which is exactly why POL-0002 exists.',
    details_requested: Object.keys(options),
  });
}

/** ES: ejecuta un comando del proyecto (tests, build) capturando salida y código. */
export function runCommand(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run a project command (tests, build, scripts) capturing stdout, stderr, exit code and duration as events',
    available: 'the declared runner already exists in control/manifest.json → verification.runner: `node --test tests/`; `npm test` runs it.',
    details_requested: Object.keys(options),
  });
}

/** ES: registra un artefacto producido (archivo, informe, build) en la base. */
export function recordArtifact(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'store a produced artifact (file, report, build) with its hash and origin',
    available: 'the `artifacts`, `actions` and `builds` tables already exist in the schema (0001_init.sql) and are counted by `genesis status`.',
    details_requested: Object.keys(options),
  });
}

export default { MUTATION_PROTOCOL, executePlan, applyPatch, runCommand, recordArtifact };

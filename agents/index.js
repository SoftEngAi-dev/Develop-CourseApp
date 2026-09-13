/* ═══════════════════════════════════════════════════════════════════════════
 * agents/index.js — AGENT ROLE REGISTRY (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: declarar los ROLES de agente del proyecto (quién hace qué,
 *     con qué permisos y qué debe verificar). No es el motor: el motor vive en
 *     core/agent. Aquí vive el CENSO — la lista de roles, sus límites y sus
 *     responsabilidades — para que dos agentes no intenten lo mismo y para que un
 *     rol peligroso (borrar, gastar, tocar credenciales) quede explícitamente
 *     restringido.
 *     ESTADO: ESQUELETO (DEC-00009). control/manifest.json → agents es un array
 *     vacío esperando estas definiciones.
 *     QUÉ SÍ EXISTE: el único "agente" real hoy es la persona que ejecuta la CLI;
 *     sus límites están escritos como políticas (control/policies.json) y como
 *     anti-goals (vision.anti_goals).
 *
 * 🇬🇧 EN — WHAT IT WILL DO: declare the project's agent ROLES (who does what, with
 *     which permissions and which verification duties). This is not the engine:
 *     the engine lives in core/agent. This is the CENSUS — the list of roles,
 *     their limits and responsibilities — so two agents do not attempt the same
 *     thing and so a dangerous role (delete, spend, touch credentials) stays
 *     explicitly restricted.
 *     STATUS: SKELETON (DEC-00009). control/manifest.json → agents is an empty
 *     array waiting for these definitions.
 *     WHAT ALREADY EXISTS: the only real "agent" today is the human running the
 *     CLI; its limits are written as policies (control/policies.json) and
 *     anti-goals (vision.anti_goals).
 *
 * 🇧🇷 PT — O QUE FARÁ: declarar os PAPÉIS de agente do projeto (quem faz o quê,
 *     com quais permissões e deveres de verificação). Não é o motor (esse vive em
 *     core/agent); é o CENSO. ESTADO: ESQUELETO (DEC-00009).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Principio de mínimo privilegio ES/EN/PT: cada rol recibe SOLO los permisos
 *     que necesita. Un rol que puede borrar datos "por si acaso" los borrará
 *     algún día. Least privilege: give each role only what it needs.
 *   • Rol vs instancia ES/EN/PT: el ROL es la definición ("verifier: ejecuta tests
 *     y no escribe código"). La INSTANCIA es una ejecución concreta con su estado.
 *     Separarlos permite tener 3 instancias del mismo rol sin duplicar reglas.
 *     A role is the definition; an instance is one run of it.
 *   • Por qué declarar roles en JSON/JS y no en prosa ES/EN/PT: un rol declarado
 *     como dato se puede validar, listar y comparar. Un rol descrito en un
 *     documento se desactualiza en silencio. Roles as data can be validated.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../core/shared/stub.js';

const MODULE = 'agents/index.js';
const SPEC = 'agents/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/**
 * ES/EN/PT: roles previstos. Uno por etapa crítica del bucle + dos transversales.
 * Planned roles: one per critical loop stage plus two cross-cutting ones.
 */
export const PLANNED_ROLES = Object.freeze([
  { id: 'contextualizer', duty: 'load project + session + decision + lesson memory before any reasoning', may_write: false },
  { id: 'planner', duty: 'turn one decision into ordered, verifiable, reversible steps', may_write: false },
  { id: 'executor', duty: 'apply minimal patches through the mutation protocol', may_write: true, requires: 'checkpoint before, verify after' },
  { id: 'verifier', duty: 'run the 4 verification levels and refuse what does not pass', may_write: false },
  { id: 'recoverer', duty: 'classify interruptions and execute recovery capabilities', may_write: true, requires: 'human approval for security_stop and scope_change' },
  { id: 'documenter', duty: 'regenerate documentation from the knowledge base', may_write: true, scope: 'documentation/generated only' },
  { id: 'librarian', duty: 'keep the glossary, the trilingual content model and the knowledge graph consistent', may_write: true, scope: 'knowledge base only' },
]);

/** ES: registra un rol con sus permisos y obligaciones. */
export function registerRole(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'register an agent role with least-privilege permissions and verification duties',
    available: 'the planned census is already readable in this file (PLANNED_ROLES) and will be copied into control/manifest.json → agents when Phase 5 starts.',
    roles: PLANNED_ROLES,
    details_requested: Object.keys(options),
  });
}

/** ES: lista roles activos y sus instancias en ejecución. */
export function listRoles(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'list active roles and their running instances',
    available: 'control/agent-state.json records the single current agent status (`idle` today) and `genesis status` prints it.',
    details_requested: Object.keys(options),
  });
}

/** ES: comprueba si un rol puede ejecutar una acción (mínimo privilegio). */
export function authorize(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'authorize or refuse an action for a role, emitting a security_stop interruption on refusal',
    available: 'the refusal mechanism already exists: INTERRUPTION_RAISED with type `security_stop` (see INT-00001 stored in the database).',
    details_requested: Object.keys(options),
  });
}

export default { PLANNED_ROLES, registerRole, listRoles, authorize };

/* ═══════════════════════════════════════════════════════════════════════════
 * skills/index.js — PHASE 7 · AUTONOMOUS EVOLUTION (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: cerrar el ciclo de aprendizaje. Hoy el sistema ya llega
 *     hasta LECCIÓN y REGLA PROPUESTA; la Fase 7 convierte esas reglas en
 *     PRECHECKS ejecutables y en HABILIDADES (skills) reutilizables:
 *       LESSON → RULE → PRECHECK → SKILL → OPTIMIZATION → ARCHITECTURE EVOLUTION
 *     Diferencia clave: una regla que solo se escribe es literatura; una regla
 *     que se comprueba ANTES de cada acción cambia el comportamiento del sistema.
 *     Ahí está la frontera entre "recordar" y "aprender".
 *     ESTADO: ESQUELETO (DEC-00009).
 *     QUÉ SÍ EXISTE: 2 lecciones reales y 2 reglas candidatas ya parseadas con
 *     clave, valor y nivel de aplicación:
 *       – core.zero_dependencies = true          (hard)
 *       – infra.verify_permissions_before_promising = true (hard)
 *     Ambas nacen de fallos reales (ruptura offline y GitHub 403) y están a la
 *     espera de aprobación humana para entrar en control/policies.json.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: close the learning loop. Today the system already
 *     reaches LESSON and PROPOSED RULE; Phase 7 turns those rules into executable
 *     PRECHECKS and reusable SKILLS:
 *       LESSON → RULE → PRECHECK → SKILL → OPTIMIZATION → ARCHITECTURE EVOLUTION
 *     Key difference: a rule that is only written down is literature; a rule
 *     checked BEFORE every action changes the system's behaviour. That is the
 *     boundary between "remembering" and "learning".
 *     STATUS: SKELETON (DEC-00009).
 *     WHAT ALREADY EXISTS: 2 real lessons and 2 candidate rules already parsed
 *     with key, value and enforcement level:
 *       – core.zero_dependencies = true          (hard)
 *       – infra.verify_permissions_before_promising = true (hard)
 *     Both come from real failures (offline breakage and the GitHub 403) and wait
 *     for human approval before entering control/policies.json.
 *
 * 🇧🇷 PT — O QUE FARÁ: fechar o ciclo de aprendizagem. Hoje o sistema chega até
 *     LIÇÃO e REGRA PROPOSTA; a Fase 7 as transforma em PRECHECKS executáveis e
 *     SKILLS reutilizáveis. Uma regra apenas escrita é literatura; uma regra
 *     verificada ANTES de cada ação muda o comportamento. ESTADO: ESQUELETO.
 *     O QUE JÁ EXISTE: 2 lições reais e 2 regras candidatas (core.zero_dependencies,
 *     infra.verify_permissions_before_promising).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Skill (habilidad) ES/EN/PT: un procedimiento guardado que el sistema sabe
 *     ejecutar solo: nombre, cuándo aplica, pasos, verificación y ejemplos de
 *     fracaso. Es la versión reutilizable de "ya lo hicimos una vez".
 *     A skill is a stored, re-runnable procedure with its own verification.
 *   • Precheck ES/EN/PT: comprobación ANTES de actuar, no después. "¿Hay
 *     dependencias npm en el núcleo?" se responde en milisegundos y evita horas.
 *     Cheapest checks first, before the expensive action.
 *   • Evolución de arquitectura ES/EN/PT: cuando una métrica empeora de forma
 *     sostenida, el sistema PROPONE un cambio de arquitectura como Decision Trace
 *     nueva. Propone: no lo aplica solo. La evolución autónoma sin aprobación
 *     humana es el camino más rápido a un proyecto incomprensible.
 *     The system proposes architectural change as a new Decision Trace; it never
 *     applies it alone.
 *   • Por qué las reglas nacen de fallos ES/EN/PT: una regla inventada "por si
 *     acaso" suele ser ruido. Una regla nacida de un error real tiene evidencia,
 *     dueño y fecha. Rules born from real failures carry evidence.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../core/shared/stub.js';

const MODULE = 'skills/index.js';
const SPEC = 'skills/SPEC.md';
const PHASE = 'phase-7';
const TASK = 'TSK-00010';

/** ES/EN/PT: ciclo completo de evolución. Full evolution cycle. */
export const EVOLUTION_CYCLE = Object.freeze([
  'LESSON', 'RULE', 'PRECHECK', 'SKILL', 'OPTIMIZATION', 'ARCHITECTURE EVOLUTION',
]);

/** ES: registra una habilidad reutilizable (nombre, disparador, pasos, verificación). */
export function registerSkill(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'register a reusable skill: trigger, steps, verification, failure examples',
    available: 'control/manifest.json → skills is an empty array waiting for entries; the human-executable equivalent of a skill already exists as CLI commands (`genesis capture`, `genesis process`, `genesis checkpoint`).',
    cycle: EVOLUTION_CYCLE,
    details_requested: Object.keys(options),
  });
}

/** ES: promueve reglas candidatas a políticas activas (con aprobación humana). */
export function promoteRules(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'turn proposed rules into active policies in control/policies.json after human approval',
    available: 'ALREADY WORKING up to the proposal: memory/lessons → pendingRules() lists candidates with key/value/enforcement; 2 real candidates exist today; control/policies.json holds 10 active rules.',
    details_requested: Object.keys(options),
  });
}

/** ES: instala PRECHECKS: comprobaciones automáticas antes de cada mutación. */
export function installPrechecks(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run every hard rule as a precheck before a mutation and block it on violation',
    available: 'the gate mechanism is declared in core/verifier → verifyPolicies(); `genesis doctor` already performs the zero-dependency and offline probes by hand.',
    details_requested: Object.keys(options),
  });
}

/** ES: métricas de evolución (¿aprende el sistema? ¿se repiten los fallos?). */
export function evolutionMetrics(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'measure learning: repeated failures over time, rules enforced, lessons applied, time-to-recover',
    available: 'the raw numbers exist: memory/lessons → lessonMemory().totals / repeatedFailures() / histogram, plus `genesis status` counters.',
    details_requested: Object.keys(options),
  });
}

/** ES: propone cambios de arquitectura como nuevas Decision Traces. */
export function proposeArchitectureEvolution(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'propose an architecture change as a new Decision Trace (never applied without approval)',
    available: 'the output format is already in production use: 11 Decision Traces in control/decisions.json + the `decisions` table, rendered by `genesis decisions`.',
    details_requested: Object.keys(options),
  });
}

export default { EVOLUTION_CYCLE, registerSkill, promoteRules, installPrechecks, evolutionMetrics, proposeArchitectureEvolution };

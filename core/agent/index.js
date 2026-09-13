/* ═══════════════════════════════════════════════════════════════════════════
 * core/agent/index.js — PHASE 5 · AUTONOMOUS AGENT (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: ejecutar el bucle del agente declarado en
 *     control/manifest.json → architecture.agent_loop:
 *       observe → contextualize → reason → plan → execute → verify → learn
 *     POL-0006 obliga a que `contextualize` vaya ANTES de `reason`: primero
 *     "¿qué sabemos ya?" y solo después "¿qué debo hacer?". Sin ese orden el
 *     agente repite trabajo, contradice decisiones aprobadas y re-propone
 *     alternativas ya rechazadas.
 *     ESTADO: ESQUELETO. Cada etapa tiene su función con firma real y devuelve
 *     `notImplemented(...)`.
 *     QUÉ SÍ EXISTE YA (y el agente usará sin cambios):
 *       – contextualize → knowledge/retrieval/context.js + memory/index.js
 *       – observe       → core/event-bus (eventos) + core/capture (sesiones)
 *       – plan/execute  → checkpoint + mutation protocol (ver core/executor)
 *       – verify        → core/validation/schema.js + tests/
 *       – learn         → memory/lessons + control/policies.json
 *
 * 🇬🇧 EN — WHAT IT WILL DO: run the agent loop declared in
 *     control/manifest.json → architecture.agent_loop:
 *       observe → contextualize → reason → plan → execute → verify → learn
 *     POL-0006 requires `contextualize` BEFORE `reason`: first "what do we
 *     already know?", only then "what must I do?". Without that order the agent
 *     repeats work, contradicts approved decisions and re-proposes alternatives
 *     that were already rejected.
 *     STATUS: SKELETON. Every stage has its real signature and returns
 *     `notImplemented(...)`.
 *     WHAT ALREADY EXISTS (the agent will use it unchanged):
 *       – contextualize → knowledge/retrieval/context.js + memory/index.js
 *       – observe       → core/event-bus (events) + core/capture (sessions)
 *       – plan/execute  → checkpoints + mutation protocol (see core/executor)
 *       – verify        → core/validation/schema.js + tests/
 *       – learn         → memory/lessons + control/policies.json
 *
 * 🇧🇷 PT — O QUE FARÁ: executar o loop do agente declarado em
 *     control/manifest.json → architecture.agent_loop:
 *       observe → contextualize → reason → plan → execute → verify → learn
 *     POL-0006 exige `contextualize` ANTES de `reason`. ESTADO: ESQUELETO.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Qué es un "agente" aquí ES/EN/PT: NO es un modelo de lenguaje. Es un bucle
 *     con estado: lee el mundo (observe), carga memoria (contextualize), decide
 *     (reason), escribe un plan (plan), aplica cambios pequeños (execute),
 *     comprueba (verify) y guarda la lección (learn). El LLM es UNA pieza
 *     opcional dentro de `reason`, no el sistema.
 *     An agent is a stateful loop; the LLM is one optional piece inside `reason`.
 *   • Por qué las etapas son funciones separadas ES/EN/PT: para poder probar cada
 *     una y para poder SUSTITUIR una. `reason` puede usar un LLM hoy y un motor
 *     de reglas mañana sin tocar las otras seis. Interfaces, not monoliths.
 *   • Adaptadores externos (anti-goal) ES/EN/PT: LangGraph, CrewAI, AutoGen, n8n,
 *     Dify, Flowise y Langflow son ADAPTADORES opcionales (mcp/, automation/).
 *     Ninguno entra en el núcleo: si el núcleo dependiera de ellos, dejaría de
 *     funcionar offline, que es el requisito nº1 (POL-0001).
 *     External orchestrators are optional adapters, never core dependencies.
 *   • Interrupciones como ciudadanas ES/EN/PT: cuando una etapa no puede seguir,
 *     NO se lanza una excepción genérica: se emite un Interruption Event con uno
 *     de los 11 tipos de DEC-00004 (blocked, failed, waiting_user, ambiguity…).
 *     Así "el agente se paró" deja de ser un misterio y pasa a ser un dato.
 *     Stopping is an event with a typed cause, not a mystery.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/agent/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: el bucle, en el orden que exige POL-0006. The loop, in POL-0006 order. */
export const AGENT_LOOP = Object.freeze(['observe', 'contextualize', 'reason', 'plan', 'execute', 'verify', 'learn']);

/** ES/EN/PT: estado del agente. Hoy: `control/agent-state.json` (idle). */
export function agentState() {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'read/write the agent runtime state machine (idle → running → waiting_user → blocked)',
    available: 'control/agent-state.json already exists and is read by `genesis status`; core/state/index.js manages the TASK state machine (13 states).',
  });
}

/** Etapa 1 — OBSERVE: qué cambió en el mundo del proyecto. */
export function observe(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'collect new observable facts (events, files, sessions, test results) since the last run',
    available: 'core/event-bus/index.js → EventBus.loadFromDisk() returns every event; core/capture/index.js → listSessions(); `genesis events` and `genesis timeline` print them.',
    details_requested: Object.keys(options),
  });
}

/** Etapa 2 — CONTEXTUALIZE: cargar memoria ANTES de razonar (POL-0006). */
export function contextualize(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'assemble the working context (project + session + decisions + lessons + constraints + files)',
    available: 'ALREADY WORKING: knowledge/retrieval/context.js → buildSessionContext() / renderSessionContext() / renderContextMarkdown(), and memory/index.js → memorySnapshot() / recallForPrompt(). Run `genesis resume` to see it.',
    details_requested: Object.keys(options),
  });
}

/** Etapa 3 — REASON: elegir el siguiente paso con la traza de decisión. */
export function reason(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'choose the next step and record WHY as a Decision Trace (never as private model reasoning — DEC-00003)',
    available: 'the output format already exists: knowledge/processor/decisions.js → renderDecisionTrace(); 11 real traces are in control/decisions.json and in the `decisions` table.',
    details_requested: Object.keys(options),
  });
}

/** Etapa 4 — PLAN: convertir la decisión en pasos verificables. */
export function plan(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'produce a step-by-step plan with acceptance criteria and rollback points',
    available: 'core/planner/index.js (skeleton) declares the same contract; plans already extracted from conversations live in the `plans` table (4 rows) and are printed by `genesis tasks`.',
    details_requested: Object.keys(options),
  });
}

/** Etapa 5 — EXECUTE: aplicar el plan con el protocolo de mutación. */
export function execute(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'apply the plan through the mutation protocol READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT (POL-0002)',
    available: 'core/executor/index.js (skeleton) declares the protocol; the safety net it relies on ALREADY works: core/checkpoint/index.js → createCheckpoint / diffCheckpoints / restoreCheckpoint (`genesis checkpoint|diff|rollback`).',
    details_requested: Object.keys(options),
  });
}

/** Etapa 6 — VERIFY: comprobar que el cambio cumplió lo prometido. */
export function verify(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run the verification gates (schema, tests, policies, acceptance criteria) and decide pass/rollback',
    available: 'core/verifier/index.js (skeleton); working pieces today: core/validation/schema.js, the `node --test tests/` runner declared in control/manifest.json → verification.runner, and `genesis doctor`.',
    details_requested: Object.keys(options),
  });
}

/** Etapa 7 — LEARN: convertir el resultado en lección y, si toca, en regla. */
export function learn(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'store the lesson, propose the rule and register the precheck for next time (ERROR → ANALYSIS → RECOVERY → LESSON → RULE → PRECHECK)',
    available: 'ALREADY WORKING up to the rule: memory/lessons/index.js → lessonMemory() / pendingRules() / repeatedFailures(); 2 real lessons and 2 proposed rules exist in the database; rules become enforceable in Phase 7 (skills/).',
    details_requested: Object.keys(options),
  });
}

/** ES/EN/PT: una vuelta completa del bucle. One full turn of the loop. */
export function runAgentTurn(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run one complete agent turn (all 7 stages) with checkpointing and interruption handling',
    available: 'the human-driven equivalent already works end to end: `genesis resume` (context) → decide → `genesis checkpoint` → change → `node --test tests/` (verify) → `genesis capture` + `genesis process` (learn).',
    loop: AGENT_LOOP,
    details_requested: Object.keys(options),
  });
}

export default {
  AGENT_LOOP, agentState, observe, contextualize, reason,
  plan, execute, verify, learn, runAgentTurn,
};

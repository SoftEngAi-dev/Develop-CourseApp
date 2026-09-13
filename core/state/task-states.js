/* ═══════════════════════════════════════════════════════════════════════════
 * core/state/task-states.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: define la MÁQUINA DE ESTADOS de una tarea y las reglas de
 *     transición legales (sección 23 de la arquitectura).
 *     POR QUÉ EXISTE: sin estas reglas, una tarea puede pasar de "discovered" a
 *     "completed" sin haberse verificado nunca. El progreso del proyecto sería
 *     una mentira. La máquina de estados hace que el progreso sea confiable:
 *     solo existen tres caminos válidos —
 *       feliz:    discovered → planned → ready → running → verifying → completed
 *       bloqueo:  running → blocked → recovery → running
 *       fallo:    running → failed → analysis → replan → retry
 *
 * 🇬🇧 EN — WHAT IT DOES: defines the STATE MACHINE of a task and the legal
 *     transition rules (architecture section 23).
 *     WHY IT EXISTS: without these rules a task could jump from "discovered" to
 *     "completed" without ever being verified. Project progress would be a lie.
 *     The state machine makes progress trustworthy: only three valid paths
 *     exist — happy path, blocked path and failed path.
 *
 * 🇧🇷 PT — O QUE FAZ: define a MÁQUINA DE ESTADOS de uma tarefa e as regras de
 *     transição legais (seção 23 da arquitetura).
 *     POR QUE EXISTE: sem essas regras, uma tarefa pode saltar de "discovered"
 *     para "completed" sem nunca ter sido verificada. O progresso do projeto
 *     seria uma mentira. A máquina de estados torna o progresso confiável.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Máquina de estados finitos (FSM) ES/EN/PT: modelo donde algo puede estar
 *     en UNO de varios estados, y solo puede moverse por flechas permitidas.
 *     Un semáforo es una FSM: verde→amarillo→rojo→verde. Nunca verde→rojo
 *     directamente... bueno, en algunos países sí, y por eso hay accidentes.
 *     A finite state machine allows only declared transitions.
 *   • Estados terminales ES/EN/PT: estados de los que ya no se sale
 *     (`completed`, `skipped`). Detectarlos evita bucles infinitos.
 *     Terminal states have no outgoing transitions; detecting them avoids loops.
 *   • `Object.freeze` sobre un mapa de transiciones ES/EN/PT: congela las
 *     reglas para que ningún módulo "se conceda" un atajo en tiempo de ejecución.
 *     Freezing the rules prevents any module from granting itself a shortcut.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { TASK_STATES, TASK_TRANSITIONS } from '../event-bus/event-types.js';

export { TASK_STATES, TASK_TRANSITIONS };

/** ES/EN/PT: estados sin salida. Terminal states. */
export const TERMINAL_STATES = Object.freeze(
  Object.entries(TASK_TRANSITIONS).filter(([, next]) => next.length === 0).map(([state]) => state),
);

/** ES/EN/PT: ¿existe el estado? Does the state exist? */
export function isTaskState(state) {
  return TASK_STATES.includes(state) || state === 'interrupted';
}

/**
 * ES: ¿es legal pasar de `from` a `to`?
 * EN: is moving from `from` to `to` legal?
 * PT: é legal passar de `from` para `to`?
 */
export function canTransition(from, to) {
  if (!isTaskState(from) || !isTaskState(to)) return false;
  if (from === to) return true; // ES: quedarse igual siempre es legal | EN: staying put is always legal
  const allowed = TASK_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/** ES/EN/PT: siguientes estados posibles. Next possible states. */
export function nextStates(from) {
  return [...(TASK_TRANSITIONS[from] ?? [])];
}

/** ES/EN/PT: ¿la tarea terminó para siempre? Is the task finished forever? */
export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

/** ES/EN/PT: ¿la tarea necesita intervención humana? Does the task need a human? */
export function needsAttention(state) {
  return ['blocked', 'failed', 'analysis', 'interrupted'].includes(state);
}

/** ES/EN/PT: ¿la tarea está en curso? Is the task actively progressing? */
export function isActive(state) {
  return ['running', 'verifying', 'recovery', 'retry', 'replan'].includes(state);
}

/**
 * ES: describe los tres caminos de la máquina de estados (para docs y curso).
 * EN: describes the three paths of the state machine (for docs and the course).
 * PT: descreve os três caminhos da máquina de estados (para docs e o curso).
 */
export function describeStateMachine() {
  return {
    happy_path: ['discovered', 'planned', 'ready', 'running', 'verifying', 'completed'],
    blocked_path: ['running', 'blocked', 'recovery', 'running'],
    failed_path: ['running', 'failed', 'analysis', 'replan', 'retry'],
    terminal_states: TERMINAL_STATES,
    transitions: TASK_TRANSITIONS,
  };
}

export default { TASK_STATES, TASK_TRANSITIONS, TERMINAL_STATES, isTaskState, canTransition, nextStates, isTerminal, needsAttention, isActive, describeStateMachine };

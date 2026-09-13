/* ═══════════════════════════════════════════════════════════════════════════
 * core/event-bus/event-types.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: declara el VOCABULARIO oficial de eventos del proyecto:
 *     los 19 tipos de evento del sistema, los 11 tipos de interrupción, las 11
 *     capas de construcción y los estados de tarea. Nada más: son constantes.
 *     POR QUÉ EXISTE: si cada módulo inventa nombres de evento ("user_msg",
 *     "UserMessage", "message-received"), el historial se vuelve imposible de
 *     consultar. Un vocabulario cerrado y congelado garantiza que
 *     `genesis search --type SESSION_STARTED` funcione siempre igual.
 *
 * 🇬🇧 EN — WHAT IT DOES: declares the project's official event VOCABULARY:
 *     the 19 system event types, the 11 interruption types, the 11 build layers
 *     and the task states. Nothing else: they are constants.
 *     WHY IT EXISTS: if every module invents event names ("user_msg",
 *     "UserMessage", "message-received"), the history becomes impossible to
 *     query. A closed, frozen vocabulary guarantees that
 *     `genesis search --type SESSION_STARTED` always behaves the same.
 *
 * 🇧🇷 PT — O QUE FAZ: declara o VOCABULÁRIO oficial de eventos do projeto:
 *     os 19 tipos de evento do sistema, os 11 tipos de interrupção, as 11
 *     camadas de construção e os estados de tarefa. Nada mais: são constantes.
 *     POR QUE EXISTE: se cada módulo inventa nomes de evento, o histórico se
 *     torna impossível de consultar. Um vocabulário fechado e congelado
 *     garante que `genesis search --type SESSION_STARTED` funcione sempre igual.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • `Object.freeze([...])` ES/EN/PT: congela el array: nadie puede añadir,
 *     quitar ni cambiar elementos. Es la forma de decir "esto es una
 *     constante del sistema, no una configuración".
 *     Freezes the array so nobody can mutate it. Congela o array.
 *   • `new Set(array)` ES/EN/PT: crea un conjunto sin duplicados cuya búsqueda
 *     `set.has(x)` es O(1) (instantánea), mientras `array.includes(x)` es O(n)
 *     (recorre todo). Con miles de eventos por segundo, importa.
 *     A Set gives O(1) lookups; an array gives O(n). With many events it matters.
 *   • SCREAMING_SNAKE_CASE ES/EN/PT: los eventos usan MAYÚSCULAS_CON_GUIONES
 *     porque son "hechos históricos inmutables", no variables. Es una
 *     convención de legibilidad: al ver el nombre sabes que es un evento.
 *     Upper case names signal "immutable historical fact".
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ES: los 19 eventos del ciclo de vida del proyecto (sección 21 de la arquitectura).
 * EN: the 19 project lifecycle events (architecture section 21).
 * PT: os 19 eventos do ciclo de vida do projeto (seção 21 da arquitetura).
 */
export const EVENT_TYPES = Object.freeze([
  'SESSION_STARTED',
  'MESSAGE_RECEIVED',
  'PLAN_CREATED',
  'DECISION_MADE',
  'SEARCH_PERFORMED',
  'TOOL_EXECUTED',
  'FILE_CHANGED',
  'BUILD_STARTED',
  'BUILD_COMPLETED',
  'TEST_STARTED',
  'TEST_FAILED',
  'TEST_PASSED',
  'ERROR_DETECTED',
  'RECOVERY_STARTED',
  'RECOVERY_COMPLETED',
  'LESSON_CREATED',
  'CHECKPOINT_CREATED',
  'SESSION_ENDED',
  // ES: añadido por el sistema (no estaba en la lista original) para el Context Engine.
  // EN: added by the system (not in the original list) for the Context Engine.
  // PT: adicionado pelo sistema (não estava na lista original) para o Context Engine.
  'CONTEXT_BUILT',
  'STATE_UPDATED',
  'INTERRUPTION_RAISED',
  'KNOWLEDGE_EXTRACTED',
]);

/** ES/EN/PT: taxonomía de interrupciones ("cortes"), sección 6. Interruption taxonomy ("cortes"). */
export const INTERRUPTION_TYPES = Object.freeze([
  'blocked',
  'failed',
  'interrupted',
  'waiting_user',
  'dependency_missing',
  'tool_error',
  'ambiguity',
  'conflict',
  'resource_limit',
  'security_stop',
  'scope_change',
]);

/** ES/EN/PT: las 11 capas de construcción, sección 5. The 11 build layers. */
export const LAYERS = Object.freeze([
  { layer: 0, id: 'vision' },
  { layer: 1, id: 'requirements' },
  { layer: 2, id: 'architecture' },
  { layer: 3, id: 'infrastructure' },
  { layer: 4, id: 'core-engine' },
  { layer: 5, id: 'application' },
  { layer: 6, id: 'agents' },
  { layer: 7, id: 'automation' },
  { layer: 8, id: 'verification' },
  { layer: 9, id: 'documentation' },
  { layer: 10, id: 'learning-evolution' },
]);

/** ES/EN/PT: máquina de estados de una tarea, sección 23. Task state machine, section 23. */
export const TASK_STATES = Object.freeze([
  'discovered',
  'planned',
  'ready',
  'running',
  'verifying',
  'completed',
  'blocked',
  'recovery',
  'failed',
  'analysis',
  'replan',
  'retry',
  'skipped',
]);

/**
 * ES: transiciones permitidas. Si una transición no está aquí, es ilegal:
 *     el sistema la rechaza y emite un ERROR_DETECTED. Esto impide que una
 *     tarea "salte" de discovered a completed sin pasar por verificación.
 * EN: allowed transitions. If a transition is not here, it is illegal: the
 *     system rejects it and emits ERROR_DETECTED. This prevents a task from
 *     jumping from discovered to completed without verification.
 * PT: transições permitidas. Se uma transição não está aqui, é ilegal: o
 *     sistema a rejeita e emite ERROR_DETECTED. Isso impede que uma tarefa
 *     "salte" de discovered para completed sem verificação.
 */
export const TASK_TRANSITIONS = Object.freeze({
  discovered: ['planned', 'skipped'],
  planned: ['ready', 'blocked', 'skipped'],
  ready: ['running', 'blocked', 'skipped'],
  running: ['verifying', 'blocked', 'failed', 'interrupted'],
  verifying: ['completed', 'failed', 'blocked'],
  completed: [],
  blocked: ['recovery', 'ready', 'analysis', 'skipped'],
  recovery: ['running', 'ready', 'failed'],
  failed: ['analysis', 'retry', 'replan', 'skipped'],
  analysis: ['replan', 'retry', 'blocked'],
  replan: ['planned', 'ready'],
  retry: ['running', 'failed'],
  skipped: [],
  interrupted: ['recovery', 'failed', 'ready'],
});

/** ES/EN/PT: impacto de una interrupción. Interruption impact levels. */
export const IMPACT_LEVELS = Object.freeze(['none', 'low', 'medium', 'high', 'critical']);

/** ES/EN/PT: niveles de log. Log levels ordered by verbosity. */
export const LOG_LEVELS = Object.freeze(['silent', 'error', 'warn', 'info', 'debug']);

const EVENT_TYPE_SET = new Set(EVENT_TYPES);
const INTERRUPTION_SET = new Set(INTERRUPTION_TYPES);
const LAYER_SET = new Set(LAYERS.map((l) => l.id));

export function isEventType(type) { return EVENT_TYPE_SET.has(type); }
export function isInterruptionType(type) { return INTERRUPTION_SET.has(type); }
export function isLayer(id) { return LAYER_SET.has(id); }

/** ES/EN/PT: nombre de capa a partir del número. Layer id from layer number. */
export function layerId(layerNumber) {
  const found = LAYERS.find((l) => l.layer === layerNumber);
  return found ? found.id : null;
}

export default { EVENT_TYPES, INTERRUPTION_TYPES, LAYERS, TASK_STATES, TASK_TRANSITIONS, IMPACT_LEVELS, LOG_LEVELS, isEventType, isInterruptionType, isLayer, layerId };

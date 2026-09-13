/* ═══════════════════════════════════════════════════════════════════════════
 * automation/index.js — AUTOMATION / TRIGGER LAYER (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: ejecutar flujos cuando algo ocurre, sin que nadie lo pida:
 *     "al capturar una sesión → procesarla → regenerar documentación → avisar si
 *     aparece un error crítico". Es la capa que convierte el sistema en algo que
 *     ocurre SOLO, y el punto de enganche de herramientas de flujos externas
 *     (n8n, Dify, Flowise, Langflow) — como adaptadores, nunca como dependencia.
 *     ESTADO: ESQUELETO (DEC-00009).
 *     QUÉ SÍ EXISTE: el disparador real ya funciona — el Event Bus. Todo lo que
 *     pasa emite un evento tipado y queda escrito en data/raw/events. Una
 *     automatización no es más que un suscriptor de esos eventos con una acción.
 *     `genesis demo` y `genesis process` ya encadenan pasos manualmente.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: run flows when something happens, without being asked:
 *     "on session captured → process it → regenerate documentation → warn if a
 *     critical error appears". This is the layer that makes the system happen BY
 *     ITSELF, and the hook point for external flow tools (n8n, Dify, Flowise,
 *     Langflow) — as adapters, never as a dependency.
 *     STATUS: SKELETON (DEC-00009).
 *     WHAT ALREADY EXISTS: the real trigger already works — the Event Bus.
 *     Everything that happens emits a typed event written to data/raw/events. An
 *     automation is just a subscriber to those events with an action attached.
 *     `genesis demo` and `genesis process` already chain steps manually.
 *
 * 🇧🇷 PT — O QUE FARÁ: executar fluxos quando algo acontece, sem ninguém pedir.
 *     É a camada que faz o sistema acontecer SOZINHO e o ponto de engate de
 *     ferramentas externas (n8n, Dify, Flowise, Langflow) como adaptadores.
 *     ESTADO: ESQUELETO (DEC-00009). O disparador real já existe: o Event Bus.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Disparador (trigger) ES/EN/PT: la condición que inicia el flujo. Puede ser
 *     un EVENTO ("se capturó una sesión"), un CAMBIO ("este archivo cambió") o un
 *     TIEMPO ("cada noche"). Los tres se reducen a "algo observable ocurrió".
 *     Triggers are events, changes or time — all of them observable facts.
 *   • Suscriptor vs sondeo ES/EN/PT: SUSCRIBIRSE (el bus te avisa) gasta menos y
 *     reacciona antes que SONDEAR (preguntar cada segundo si pasó algo). El Event
 *     Bus existe precisamente para poder suscribirse. Subscribe, do not poll.
 *   • Idempotencia en automatizaciones ES/EN/PT: un flujo automático se ejecuta
 *     muchas veces (reintentos, reinicios). Si ejecutarlo dos veces duplica datos,
 *     la automatización es una bomba de relojería. Por eso el pipeline completo es
 *     idempotente (DEC-00007) ANTES de automatizarlo.
 *     Automation must be idempotent; that is why the pipeline was made
 *     idempotent first (DEC-00007).
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../core/shared/stub.js';

const MODULE = 'automation/index.js';
const SPEC = 'automation/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: flujos previstos, en orden de utilidad. Planned flows, by usefulness. */
export const PLANNED_FLOWS = Object.freeze([
  { id: 'capture-then-process', trigger: 'SESSION_ENDED', action: 'process the session and rebuild the knowledge graph' },
  { id: 'process-then-document', trigger: 'KNOWLEDGE_EXTRACTED', action: 'regenerate documentation/generated (Phase 3)' },
  { id: 'error-then-lesson', trigger: 'ERROR_DETECTED', action: 'record analysis, recovery and the lesson; propose a rule' },
  { id: 'critical-then-stop', trigger: 'ERROR_DETECTED (severity=critical)', action: 'raise a security_stop interruption and wait for a human' },
  { id: 'decision-then-notify', trigger: 'DECISION_MADE', action: 'notify the affected tasks and update state' },
  { id: 'nightly-then-report', trigger: 'schedule: daily', action: 'produce a progress report from the timeline and metrics' },
]);

/** ES: registra un flujo (disparador → condición → acción → verificación). */
export function registerFlow(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'register an automated flow: trigger, condition, action, verification, failure behaviour',
    available: 'the trigger side already works: core/event-bus → EventBus with 19 typed events (SESSION_STARTED, KNOWLEDGE_EXTRACTED, ERROR_DETECTED, DECISION_MADE, INTERRUPTION_RAISED…). The manual equivalent of every planned flow is a CLI command.',
    flows: PLANNED_FLOWS,
    details_requested: Object.keys(options),
  });
}

/** ES: suscribe una acción al Event Bus de forma persistente. */
export function subscribe(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'persist a subscription so it survives restarts (today subscriptions live only in memory)',
    available: 'in-process subscription works today: core/event-bus/index.js → bus.on(type, handler); every event is also appended to data/raw/events/*.jsonl and can be replayed.',
    details_requested: Object.keys(options),
  });
}

/** ES: conecta un orquestador de flujos externo (n8n/Dify/Flowise/Langflow) vía webhook. */
export function connectExternalFlowTool(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'bridge an external flow tool through webhooks over the core HTTP API',
    available: 'POST /api/capture and POST /api/process already accept external calls with CORS enabled; that is the whole bridge an external tool needs.',
    details_requested: Object.keys(options),
  });
}

export default { PLANNED_FLOWS, registerFlow, subscribe, connectExternalFlowTool };

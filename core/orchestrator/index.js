/* ═══════════════════════════════════════════════════════════════════════════
 * core/orchestrator/index.js — PHASE 5 · ORCHESTRATOR (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: coordinar VARIAS vueltas del agente y varios agentes sin
 *     que se pisen: presupuestos (vueltas, tiempo, archivos tocados), orden de
 *     ejecución, bloqueos por recurso y parada limpia.
 *     La diferencia entre `core/agent` y `core/orchestrator`: el agente decide
 *     QUÉ hacer en una vuelta; el orquestador decide CUÁNTO, CUÁNDO y QUIÉN.
 *     ESTADO: ESQUELETO (DEC-00009).
 *     NOTA DE ARQUITECTURA: los orquestadores externos (LangGraph, CrewAI,
 *     AutoGen, n8n, Dify, Flowise, Langflow) se enchufarán AQUÍ como adaptadores
 *     opcionales, nunca dentro del núcleo (anti-goal declarado en
 *     control/manifest.json → vision.anti_goals y POL-0001).
 *
 * 🇬🇧 EN — WHAT IT WILL DO: coordinate SEVERAL agent turns and several agents
 *     without them stepping on each other: budgets (turns, wall time, files
 *     touched), execution order, resource locks and clean shutdown.
 *     The difference between `core/agent` and `core/orchestrator`: the agent
 *     decides WHAT to do in one turn; the orchestrator decides HOW MUCH, WHEN
 *     and WHO.
 *     STATUS: SKELETON (DEC-00009).
 *     ARCHITECTURE NOTE: external orchestrators (LangGraph, CrewAI, AutoGen, n8n,
 *     Dify, Flowise, Langflow) will plug in HERE as optional adapters, never
 *     inside the core (declared anti-goal in control/manifest.json →
 *     vision.anti_goals and POL-0001).
 *
 * 🇧🇷 PT — O QUE FARÁ: coordenar VÁRIAS voltas do agente e vários agentes sem
 *     que se atropelem: orçamentos, ordem de execução, travas por recurso e
 *     parada limpa. O agente decide O QUÊ; o orquestrador decide QUANTO, QUANDO
 *     e QUEM. ESTADO: ESQUELETO (DEC-00009). Orquestradores externos entram aqui
 *     como adaptadores opcionais (POL-0001).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Presupuesto (budget) ES/EN/PT: sin límite, un bucle autónomo puede girar
 *     para siempre gastando tiempo, tokens y discos. Un presupuesto convierte
 *     "confía en mí" en "como mucho N vueltas y lo reporto". Budgets turn blind
 *     trust into a bounded, reportable run.
 *   • Concurrencia vs paralelismo ES/EN/PT: dos agentes que escriben el MISMO
 *     archivo no son paralelos, son un conflicto. El orquestador serializa por
 *     recurso (archivo, tabla, ruta) y paraleliza lo independiente.
 *     Serialize by resource, parallelize what is independent.
 *   • Parada limpia (graceful shutdown) ES/EN/PT: al recibir SIGINT/SIGTERM hay
 *     que terminar la vuelta, guardar el checkpoint y cerrar la base. Matar el
 *     proceso a medias corrompe WAL de SQLite. core/api/server.js ya lo hace.
 *     Finish the turn, checkpoint, close the DB: never kill mid-write.
 *   • Por qué un adaptador y no una dependencia ES/EN/PT: si el núcleo importa
 *     LangGraph, sin LangGraph no hay núcleo. Si LangGraph se conecta POR FUERA
 *     a la misma API HTTP, el núcleo sigue funcionando offline con node_modules
 *     vacío. Dependency direction decides whether offline survives.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../shared/stub.js';

const MODULE = 'core/orchestrator/index.js';
const SPEC = 'core/agent/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: presupuestos por defecto previstos. Planned default budgets. */
export const DEFAULT_BUDGETS = Object.freeze({
  max_turns: 5,
  max_wall_time_ms: 300000,
  max_files_touched: 10,
  max_consecutive_failures: 2,
  require_checkpoint_before_mutation: true,
  require_human_approval_for: ['security_stop', 'scope_change', 'resource_limit'],
});

/** ES: ejecuta N vueltas del agente respetando presupuestos y bloqueos. */
export function runWorkflow(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'run N agent turns with budgets, resource locks and clean shutdown',
    available: 'one manual turn already works end to end: `genesis resume` → decide → `genesis checkpoint` → change → `npm test` → `genesis capture` + `genesis process`.',
    budgets: DEFAULT_BUDGETS,
    details_requested: Object.keys(options),
  });
}

/** ES: registra un adaptador externo (LangGraph, CrewAI, n8n, MCP…) SIN tocar el núcleo. */
export function registerAdapter(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'register an external orchestrator/agent adapter through the HTTP API only',
    available: 'the seam already exists and is stable: 31 HTTP routes (see `genesis routes` or /api/routes); mcp/ and automation/ hold the adapter skeletons. control/manifest.json → mcp.status = "adapter-layer-planned".',
    details_requested: Object.keys(options),
  });
}

/** ES: control de concurrencia — qué recurso está en uso y por quién. */
export function acquireLock(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'lock a resource (file, table, route) for the duration of a mutation',
    available: 'today the equivalent is human discipline plus POL-0002: one mutation at a time, checkpoint before, verify after.',
    details_requested: Object.keys(options),
  });
}

export default { DEFAULT_BUDGETS, runWorkflow, registerAdapter, acquireLock };

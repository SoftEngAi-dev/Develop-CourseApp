/* ═══════════════════════════════════════════════════════════════════════════
 * core/orchestrator/index.js — PHASE 5 · ORCHESTRATOR (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: corre N vueltas del agente respetando PRESUPUESTOS y un
 *     LOCK de archivo. Los presupuestos no son decorativos: max_turns limita
 *     vueltas, max_wall_time_ms corta por tiempo, max_consecutive_failures
 *     detiene la racha (dos fallos seguidos → parar y pedir recovery, nunca
 *     "reintentar a ver si suena"), y require_checkpoint_before_mutation exige
 *     foto antes de tocar nada. acquireLock evita que DOS agentes muten el
 *     proyecto a la vez (lock con PID; locks viejos >1h se consideran stale y se
 *     toman). registerAdapter recuerda que los frameworks externos
 *     (LangGraph, n8n…) entran SOLO como adaptadores (DEC-00009): se registran
 *     en agent-state.json, jamás se importan en el core.
 *
 * 🇬🇧 EN — WHAT IT DOES: runs N agent turns respecting BUDGETS and a file LOCK.
 *     Budgets are enforced: max_turns, wall-clock cut-off, consecutive-failure
 *     stop (two failures in a row → stop and ask for recovery, never blind
 *     retries) and checkpoint-before-mutation. acquireLock prevents TWO agents
 *     mutating the project at once (PID lock; locks older than 1h are stale and
 *     taken over). registerAdapter records that external frameworks enter ONLY
 *     as adapters (DEC-00009): registered in agent-state.json, never imported
 *     into the core.
 *
 * 🇧🇷 PT — O QUE FAZ: roda N voltas do agente respeitando ORÇAMENTOS e um LOCK
 *     de arquivo. Dois agentes nunca mutam o projeto ao mesmo tempo. Frameworks
 *     externos entram SOMENTE como adaptadores.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Presupuestos = frenos ES/EN/PT: un agente sin límite de vueltas ni de
 *     tiempo es un bucle con iniciativa. Los frenos se declaran ANTES de arrancar
 *     (DEFAULT_BUDGETS) y el orquestador los aplica en cada vuelta.
 *     Budgets are brakes declared before starting, applied on every turn.
 *   • Lock con PID ES/EN/PT: data/agent.lock guarda {pid, since}. Si existe y es
 *     reciente → otro agente trabaja: no se entra. Si es viejo (>1 h) → stale: se
 *     toma el lock. Sin bases de datos ni servicios: un archivo y fechas.
 *     A lock is just a file with a PID and a timestamp.
 *   • Fallos consecutivos ES/EN/PT: un fallo aislado puede ser ruido; DOS seguidos
 *     son un patrón. El orquestador para y sugiere recovery en vez de quemar
 *     presupuesto reintentando. Two consecutive failures are a pattern: stop.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, attempt } from '../shared/result.js';
import { PATHS } from '../shared/paths.js';
import { ensureDir, readJson, writeJson } from '../shared/json.js';

/** ES/EN/PT: presupuestos por defecto. Planned default budgets. */
export const DEFAULT_BUDGETS = Object.freeze({
  max_turns: 5,
  max_wall_time_ms: 300000,
  max_files_touched: 10,
  max_consecutive_failures: 2,
  require_checkpoint_before_mutation: true,
  require_human_approval_for: ['security_stop', 'scope_change', 'resource_limit'],
});

/** ES/EN/PT: frameworks externos — SOLO adaptadores (DEC-00009). */
const KNOWN_ADAPTERS = Object.freeze(['MCP servers', 'LangGraph', 'CrewAI', 'AutoGen', 'n8n', 'Dify', 'Flowise', 'Langflow']);

/** ES/EN/PT: ruta del lock (inyectable para tests). Lock path. */
function lockFile(name) {
  return path.join(PATHS.indexes, `${name}.lock`);
}

/**
 * ES: adquiere el lock del agente. Devuelve fail si hay otro agente activo.
 * EN: acquires the agent lock. Fails when another agent is active.
 * PT: adquire o lock do agente; falha se outro agente estiver ativo.
 *
 * @param {{ name?: string, staleAfterMs?: number, file?: string|null }} [options]
 */
export function acquireLock(options = {}) {
  const { name = 'agent', staleAfterMs = 3600000 } = options;
  const file = options.file ?? lockFile(name);
  return attempt(() => {
    ensureDir(path.dirname(file));
    if (fs.existsSync(file)) {
      const existing = readJson(file, null);
      const age = existing?.since ? Date.now() - Date.parse(existing.since) : Infinity;
      if (Number.isFinite(age) && age < staleAfterMs) {
        throw Object.assign(new Error(`another agent holds the lock (pid ${existing?.pid ?? '?'}, since ${existing?.since})`), { code: 'lock_held' });
      }
      // ES: lock stale (proceso muerto o viejo) → se toma, dejando evidencia.
      // EN: stale lock (dead/old process) → taken over, leaving evidence.
      // PT: lock velho → tomado, deixando evidência.
    }
    const lock = { pid: process.pid, since: new Date().toISOString(), name };
    writeJson(file, lock);
    return lock;
  }, { code: 'lock_acquire_failed', layer: 'automation' });
}

/** ES/EN/PT: libera el lock (solo si lo tiene este proceso). Release if owned. */
export function releaseLock(options = {}) {
  const { name = 'agent' } = options;
  const file = options.file ?? lockFile(name);
  return attempt(() => {
    const existing = readJson(file, null);
    if (existing && existing.pid !== process.pid) return { released: false, reason: 'lock owned by another pid' };
    if (fs.existsSync(file)) fs.rmSync(file);
    return { released: true };
  }, { code: 'lock_release_failed', layer: 'automation' });
}

/**
 * ES: registra un adaptador externo (models/orchestrators) en agent-state.json.
 *     El core NUNCA los importa: son clientes de la API (DEC-00009).
 * EN: registers an external adapter (models/orchestrators) in agent-state.json.
 *     The core NEVER imports them: they are API clients (DEC-00009).
 * PT: registra um adaptador externo; o core NUNCA os importa.
 */
export function registerAdapter(options = {}) {
  const { name = null, kind = 'orchestrators', endpoint = null, agentStateFile = null } = options;
  if (!name) return fail('registerAdapter requires a name', { code: 'adapter_name_missing' });
  if (!['models', 'orchestrators'].includes(kind)) return fail(`adapter kind must be "models" or "orchestrators" (got "${kind}")`, { code: 'adapter_kind_unknown' });

  return attempt(() => {
    const file = agentStateFile ?? PATHS.agentState;
    const state = readJson(file, {});
    state.adapters = state.adapters ?? { models: [], orchestrators: [] };
    state.adapters[kind] = state.adapters[kind] ?? [];
    const known = KNOWN_ADAPTERS.some((framework) => name.toLowerCase().includes(framework.toLowerCase().split(' ')[0]));
    const entry = { name, kind, endpoint, known_framework: known, registered_at: new Date().toISOString(), rule: 'adapter-only: talks to the core through the HTTP API, never imported by it' };
    state.adapters[kind] = [...state.adapters[kind].filter((item) => item.name !== name), entry];
    writeJson(file, state);
    return entry;
  }, { code: 'adapter_registration_failed', layer: 'automation' });
}

/**
 * ES: corre N vueltas del agente con presupuestos y lock. `agent` es inyectable
 *     (por defecto el real de core/agent) para poder probar con un agente falso.
 * EN: runs N agent turns with budgets and lock. `agent` is injectable (defaults
 *     to the real core/agent) so tests can pass a fake one.
 * PT: roda N voltas do agente com orçamentos e lock; `agent` é injetável.
 *
 * @param {{ turns?: number, budgets?: object, agent?: object|null, bus?: object, db?: object, dryRun?: boolean, goal?: string|null, lockName?: string }} [options]
 */
export async function runWorkflow(options = {}) {
  const { turns = 1, bus = null, db = null, dryRun = true, goal = null, lockName = 'agent' } = options;
  const budgets = { ...DEFAULT_BUDGETS, ...(options.budgets ?? {}) };

  const lock = acquireLock({ name: lockName, file: options.lockFile ?? null });
  if (!lock.ok) return lock;

  try {
    const agent = options.agent ?? (await import('../agent/index.js')).default;
    const effectiveTurns = Math.max(1, Math.min(Number(turns) || 1, budgets.max_turns));
    const startedAt = Date.now();
    const reports = [];
    let consecutiveFailures = 0;

    for (let turn = 1; turn <= effectiveTurns; turn += 1) {
      if (Date.now() - startedAt > budgets.max_wall_time_ms) {
        bus?.emit('ERROR_DETECTED', { tool: 'orchestrator', message: `wall-time budget exhausted after ${reports.length} turn(s)` }, { layer: 'automation', severity: 'medium' });
        break;
      }
      const report = await agent.runAgentTurn({ bus, db, dryRun, goal, budgets, turn });
      reports.push(report.ok ? report.value : { turn, ok: false, error: report.error });
      consecutiveFailures = report.ok && report.value.status !== 'failed' ? 0 : consecutiveFailures + 1;
      if (consecutiveFailures >= budgets.max_consecutive_failures) {
        bus?.emit('ERROR_DETECTED', { tool: 'orchestrator', message: `${consecutiveFailures} consecutive failed turns — stopping (budget max_consecutive_failures)` }, { layer: 'automation', severity: 'high' });
        break;
      }
    }

    return ok({
      kind: 'workflow-report',
      turns_requested: Number(turns) || 1,
      turns_allowed: budgets.max_turns,
      turns_executed: reports.length,
      dry_run: dryRun,
      wall_time_ms: Date.now() - startedAt,
      reports,
    });
  } finally {
    releaseLock({ name: lockName, file: options.lockFile ?? null });
  }
}

export default { DEFAULT_BUDGETS, runWorkflow, registerAdapter, acquireLock, releaseLock };

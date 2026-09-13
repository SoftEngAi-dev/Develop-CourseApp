/* ═══════════════════════════════════════════════════════════════════════════
 * core/api/routes.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: define TODAS las rutas HTTP de la API del conocimiento y
 *     las funciones que las atienden. Es un simple array de
 *     { method, pattern, handler }.
 *     POR QUÉ EXISTE (DEC-00005): esta API es LA COSTURA del sistema. Tres
 *     interfaces la consumen: el console offline (apps/console), la app Next.js
 *     (apps/web) y cualquier script o agente futuro. Si la API es el contrato,
 *     puedes cambiar de interfaz sin tocar el motor, y puedes funcionar sin
 *     node_modules porque el servidor usa solo `node:http`.
 *
 * 🇬🇧 EN — WHAT IT DOES: defines EVERY HTTP route of the knowledge API and the
 *     functions serving them. It is a simple array of { method, pattern, handler }.
 *     WHY IT EXISTS (DEC-00005): this API is THE SEAM of the system. Three
 *     interfaces consume it: the offline console (apps/console), the Next.js app
 *     (apps/web) and any future script or agent. With the API as the contract you
 *     can swap interfaces without touching the engine, and you can run with no
 *     node_modules because the server only uses `node:http`.
 *
 * 🇧🇷 PT — O QUE FAZ: define TODAS as rotas HTTP da API do conhecimento e as
 *     funções que as atendem. É um simples array de { method, pattern, handler }.
 *     POR QUE EXISTE (DEC-00005): esta API é A COSTURA do sistema. Três
 *     interfaces a consomem: o console offline (apps/console), o app Next.js
 *     (apps/web) e qualquer script ou agente futuro. Com a API como contrato,
 *     você troca de interface sem tocar no motor, e roda sem node_modules porque
 *     o servidor usa apenas `node:http`.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • REST ES/EN/PT: convención donde la URL nombra un RECURSO (/api/decisions)
 *     y el método HTTP nombra la ACCIÓN (GET = leer, POST = crear/ejecutar).
 *     No necesitas inventar verbos en la URL como /getDecisions.
 *     REST: the URL names a resource, the HTTP method names the action.
 *   • Patrón con dos puntos `/api/decisions/:id` ES/EN/PT: el `:id` es un
 *     comodín. `matchRoute` lo convierte en regex y extrae `params.id`. Es la
 *     misma idea que usan Express y Next.js, escrita en 20 líneas.
 *     `:id` is a placeholder turned into a regex capture group.
 *   • Código de estado HTTP ES/EN/PT: 200 = ok, 201 = creado, 400 = tu petición
 *     está mal, 404 = no existe, 500 = el servidor falló. Devolver el código
 *     correcto es la mitad de una buena API: el cliente puede reaccionar sin
 *     leer el mensaje.
 *     Returning the right status code is half of a good API.
 *   • `?query=string` ES/EN/PT: parámetros de consulta. Se parsean con
 *     `new URL(req.url, 'http://x').searchParams.get('q')`. Siempre strings:
 *     convierte a número tú y valida el rango (un `limit=999999` tumbaría el servidor).
 *     Query params are always strings: convert and clamp them yourself.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { PATHS, toProjectRelative } from '../shared/paths.js';
import { readJson } from '../shared/json.js';
import { openDatabase, dbStats, fromJson, all } from '../../knowledge/db/index.js';
import { loadManifest, describeManifest } from '../manifest/index.js';
import { loadState, loadTasks, loadRoadmap, reconcile, summarize, transitionTask } from '../state/index.js';
import { createCheckpoint, listCheckpoints, latestCheckpoint, restoreCheckpoint, diffCheckpoints } from '../checkpoint/index.js';
import { ingestSession, listSessions, loadSession, loadRawMessages, captureStats } from '../capture/index.js';
import { processAll, processSession, processingSummary, recentEntities } from '../../knowledge/processor/index.js';
import { search, searchMessages, timeline, whyDidWeChoose, facets, topTags } from '../../knowledge/retrieval/search.js';
import { buildSessionContext, renderSessionContext, renderContextMarkdown } from '../../knowledge/retrieval/context.js';
import { exportGraph, graphStats, nodeProfile, subgraph } from '../../knowledge/graph/index.js';
import { EventBus } from '../event-bus/index.js';
import { renderDecisionTrace, loadDecision } from '../../knowledge/processor/decisions.js';

/** ES/EN/PT: convierte un patrón "/api/x/:id" en regex + nombres de parámetro. */
export function compilePattern(pattern) {
  const names = [];
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${source}/?$`), names };
}

/** ES/EN/PT: comprueba si una URL encaja en una ruta y extrae params. */
export function matchRoute(route, method, pathname) {
  if (route.method !== method && route.method !== 'ANY') return null;
  const { regex, names } = route.compiled ?? compilePattern(route.pattern);
  const match = regex.exec(pathname);
  if (!match) return null;
  const params = {};
  names.forEach((name, index) => { params[name] = decodeURIComponent(match[index + 1]); });
  return { params };
}

/** ES/EN/PT: límite numérico seguro para parámetros de consulta. Safe numeric clamp. */
function clampInt(value, fallback, min = 1, max = 500) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * ES: definición de rutas. Cada handler devuelve { status?, body } o { text }.
 * EN: route definitions. Each handler returns { status?, body } or { text }.
 * PT: definição de rotas. Cada handler devolve { status?, body } ou { text }.
 */
export function createRoutes(context = {}) {
  const { bus = null, db = () => openDatabase() } = context;

  const route = (method, pattern, handler, description = '') => ({ method, pattern, handler, description });

  return [
    /* ── Salud y metadatos / Health & metadata ───────────────────────────── */
    route('GET', '/api/health', () => ({
      body: {
        ok: true,
        service: 'genesis-knowledge-api',
        version: readJson(PATHS.manifest, {})?.project?.version ?? '0.0.0',
        node: process.version,
        sqlite: (() => { try { return db().prepare('select sqlite_version() AS v').get().v; } catch { return null; } })(),
        dependencies: 0,
        offline_capable: true,
        ts: new Date().toISOString(),
      },
    }), 'Health check: proves the engine runs with zero npm dependencies.'),

    route('GET', '/api/stats', () => {
      const database = db();
      const state = loadState().value ?? {};
      return {
        body: {
          state: summarize(state, loadTasks().value ?? {}),
          database: dbStats(database),
          processing: processingSummary(database),
          capture: captureStats(),
          graph: graphStats(database),
          events_on_disk: EventBus.loadFromDisk({}).length,
          facets: facets(database),
          top_tags: topTags(database, 24),
        },
      };
    }, 'Aggregated counters for the dashboard.'),

    /* ── Plano de control / Control plane ────────────────────────────────── */
    route('GET', '/api/manifest', () => {
      const result = loadManifest();
      return result.ok ? { body: result.value } : { status: 500, body: { error: result.error } };
    }, 'The Project Manifest: the executable central contract.'),

    route('GET', '/api/manifest/summary', () => {
      const result = loadManifest();
      return result.ok ? { body: describeManifest(result.value) } : { status: 500, body: { error: result.error } };
    }, 'Compact manifest summary.'),

    route('GET', '/api/state', () => ({ body: loadState().value ?? {} }), 'Project state (level 5 CONTROL).'),

    route('GET', '/api/roadmap', () => ({ body: loadRoadmap().value ?? {} }), 'The 8 phases and their weights.'),

    route('GET', '/api/policies', () => ({ body: readJson(PATHS.policies, { rules: [] }) }), 'Operational rules, born from lessons.'),

    route('GET', '/api/tasks', () => ({ body: loadTasks().value ?? { tasks: [] } }), 'Tasks with their state machine position.'),

    route('POST', '/api/tasks/:id/transition', (req) => {
      const result = transitionTask(req.params.id, req.body?.status ?? '', { bus, reason: req.body?.reason ?? 'api transition' });
      if (!result.ok) return { status: 409, body: { error: result.error } };
      reconcile({ bus });
      return { body: result.value };
    }, 'Moves a task through the legal state machine (rejects illegal jumps).'),

    route('GET', '/api/decisions', () => {
      const rows = all(db(), 'SELECT * FROM decisions ORDER BY id ASC');
      return { body: { count: rows.length, decisions: rows.map((row) => ({ ...row, constraints: fromJson(row.constraints_json, []), alternatives: fromJson(row.alternatives_json, []), related: fromJson(row.related_json, []) })) } };
    }, 'Every Decision Trace.'),

    route('GET', '/api/decisions/:id', (req) => {
      const decision = loadDecision(db(), req.params.id);
      if (!decision) return { status: 404, body: { error: { message: `Decision ${req.params.id} not found` } } };
      return { body: { ...decision, rendered: { en: renderDecisionTrace(decision, 'en'), es: renderDecisionTrace(decision, 'es'), pt: renderDecisionTrace(decision, 'pt') } } };
    }, 'One Decision Trace, rendered in three languages.'),

    route('GET', '/api/decisions/:id/provenance', (req) => {
      const chain = whyDidWeChoose(req.params.id, { db: db(), limit: 3 });
      return { body: chain };
    }, 'DECISION → SEARCHES → SOURCES → IMPLEMENTATION chain.'),

    route('GET', '/api/requirements', () => ({ body: { requirements: all(db(), 'SELECT * FROM requirements ORDER BY id'), changes: all(db(), 'SELECT * FROM requirement_changes ORDER BY ts DESC LIMIT 50') } }), 'Requirements and their change history.'),

    /* ── Captura / Capture ───────────────────────────────────────────────── */
    route('GET', '/api/sessions', () => ({ body: { count: listSessions().length, sessions: listSessions() } }), 'Captured sessions (RAW level).'),

    route('GET', '/api/sessions/:id', (req) => {
      const result = loadSession(req.params.id);
      if (!result.ok) return { status: 404, body: { error: result.error } };
      const messages = loadRawMessages(req.params.id);
      const rows = all(db(), `SELECT id, idx, role, intent, intent_confidence, language, language_confidence,
                                     chars, words, lines, code_blocks, requirements_json, constraints_json,
                                     unknowns_json, headings_json, entities_json, terms_json, links_json,
                                     secondary_intents, interpreted_by
                              FROM messages WHERE session_id = ? ORDER BY idx`, [req.params.id]);
      /*
       * ES: las columnas *_json se guardan como TEXT (SQLite no tiene tipo JSON
       *     real). La API las devuelve YA parseadas: el navegador no debería
       *     conocer cómo se almacena nada. Esa es la frontera entre nivel 2
       *     (procesado) y la capa de aplicación.
       * EN: *_json columns are stored as TEXT (SQLite has no real JSON type).
       *     The API returns them ALREADY parsed: the browser should not know how
       *     anything is stored. That is the boundary between level 2 (processed)
       *     and the application layer.
       * PT: colunas *_json são TEXT; a API as devolve JÁ parseadas.
       */
      const processed = rows.map((row) => ({
        ...row,
        requirements: fromJson(row.requirements_json, []),
        constraints: fromJson(row.constraints_json, []),
        unknowns: fromJson(row.unknowns_json, []),
        headings: fromJson(row.headings_json, []),
        entities: fromJson(row.entities_json, []),
        terms: fromJson(row.terms_json, []),
        links: fromJson(row.links_json, []),
        secondary_intents: fromJson(row.secondary_intents, []),
      }));
      return { body: { session: result.value, raw_messages: messages, processed_messages: processed } };
    }, 'One session: raw messages plus their interpretation.'),

    route('POST', '/api/capture', async (req) => {
      const text = req.body?.text ?? null;
      if (!text) return { status: 400, body: { error: { message: 'Body must contain { text }' } } };
      const ingested = ingestSession({ text, title: req.body?.title ?? null, source: req.body?.source ?? 'api', bus });
      if (!ingested.ok) return { status: 400, body: { error: ingested.error } };
      if (!ingested.value.duplicated) {
        processSession(ingested.value.session.id, { db: db(), bus });
      }
      return { status: 201, body: ingested.value };
    }, 'Captures a conversation into RAW and processes it immediately.'),

    route('POST', '/api/process', () => {
      const result = processAll({ db: db(), bus, force: Boolean(context.force) });
      return result.ok ? { body: result.value } : { status: 500, body: { error: result.error } };
    }, 'Runs the full knowledge pipeline.'),

    /* ── Conocimiento / Knowledge ────────────────────────────────────────── */
    route('GET', '/api/search', (req) => {
      const q = req.query.get('q') ?? req.query.get('query') ?? '';
      if (!q.trim()) return { status: 400, body: { error: { message: 'Missing ?q=' } } };
      const types = req.query.get('type') ? String(req.query.get('type')).split(',').filter(Boolean) : null;
      const limit = clampInt(req.query.get('limit'), 20, 1, 200);
      const mode = ['or', 'and', 'phrase'].includes(req.query.get('mode')) ? req.query.get('mode') : 'or';
      const results = search(q, { db: db(), types, limit, mode });
      if (req.query.get('messages') === 'true') results.messages = searchMessages(q, { db: db(), limit: Math.min(limit, 50) });
      return { body: results };
    }, 'Full-text search across every knowledge entity (FTS5 + LIKE fallback).'),

    route('GET', '/api/timeline', (req) => {
      const limit = clampInt(req.query.get('limit'), 200, 1, 2000);
      return { body: timeline({ db: db(), limit, sessionId: req.query.get('session'), layer: req.query.get('layer') }) };
    }, 'Chronological event timeline (section 10).'),

    route('GET', '/api/events', (req) => {
      const limit = clampInt(req.query.get('limit'), 100, 1, 2000);
      const events = EventBus.loadFromDisk({ limit, type: req.query.get('type') ?? undefined, since: req.query.get('since') ?? undefined });
      return { body: { count: events.length, events: events.slice(-limit).reverse() } };
    }, 'Events read from the RAW JSONL sink.'),

    route('GET', '/api/graph', (req) => {
      const limit = clampInt(req.query.get('limit'), 200, 5, 800);
      return { body: exportGraph(db(), limit) };
    }, 'Knowledge graph nodes and edges for visualization.'),

    route('GET', '/api/graph/node/:id', (req) => {
      const profile = nodeProfile(db(), req.params.id);
      if (!profile) return { status: 404, body: { error: { message: `Node ${req.params.id} not found` } } };
      return { body: profile };
    }, 'Full node profile: what it is, why it exists, problems, lessons, code, sessions, sources.'),

    route('GET', '/api/graph/subgraph/:id', (req) => {
      const depth = clampInt(req.query.get('depth'), 2, 1, 4);
      return { body: subgraph(db(), req.params.id, depth) };
    }, 'Subgraph around a node up to N hops.'),

    route('GET', '/api/context', (req) => {
      const format = req.query.get('format') ?? 'json';
      const result = buildSessionContext({ db: db(), bus, query: req.query.get('q') ?? req.query.get('query') ?? null, taskId: req.query.get('task') ?? null });
      if (!result.ok) return { status: 500, body: { error: result.error } };
      if (format === 'text') return { text: renderSessionContext(result.value, { language: req.query.get('lang') ?? 'en', compact: req.query.get('compact') === 'true' }) };
      if (format === 'md' || format === 'markdown') return { text: renderContextMarkdown(result.value), contentType: 'text/markdown; charset=utf-8' };
      return { body: result.value };
    }, 'THE CONTEXT ENGINE: rebuilds everything a new session needs to know.'),

    route('GET', '/api/lessons', () => ({ body: { lessons: all(db(), 'SELECT * FROM lessons ORDER BY created_at DESC'), errors: all(db(), 'SELECT * FROM errors ORDER BY ts DESC LIMIT 50') } }), 'Lessons and the errors that produced them (EVOLVE mode).'),

    route('GET', '/api/interruptions', () => ({ body: { interruptions: all(db(), 'SELECT * FROM interruptions ORDER BY detected_at DESC') } }), 'Interruption events ("cortes").'),

    /* ── Checkpoints / Recovery ──────────────────────────────────────────── */
    route('GET', '/api/checkpoints', () => ({ body: { count: listCheckpoints().length, latest: latestCheckpoint(), checkpoints: listCheckpoints() } }), 'Checkpoint list.'),

    route('POST', '/api/checkpoints', (req) => {
      const result = createCheckpoint({ label: req.body?.label ?? 'api-checkpoint', note: req.body?.note ?? null, bus });
      return result.ok ? { status: 201, body: result.value } : { status: 500, body: { error: result.error } };
    }, 'Creates a snapshot of the control plane.'),

    route('POST', '/api/checkpoints/:id/restore', (req) => {
      const result = restoreCheckpoint(req.params.id, { bus });
      return result.ok ? { body: result.value } : { status: 409, body: { error: result.error } };
    }, 'Restores a checkpoint (rollback).'),

    route('GET', '/api/checkpoints/diff', (req) => {
      const from = req.query.get('from');
      const to = req.query.get('to');
      if (!from || !to) return { status: 400, body: { error: { message: 'Missing ?from= and ?to=' } } };
      const result = diffCheckpoints(from, to);
      return result.ok ? { body: result.value } : { status: 404, body: { error: result.error } };
    }, 'Diff between two checkpoints.'),

    /* ── Recientes / Recent entities ─────────────────────────────────────── */
    route('GET', '/api/recent', (req) => ({ body: recentEntities(db(), clampInt(req.query.get('limit'), 5, 1, 50)) }), 'Latest entities of every type, for the dashboard.'),
  ].map((entry) => ({ ...entry, compiled: compilePattern(entry.pattern) }));
}

/** ES/EN/PT: lista legible de rutas para `genesis routes` y la página /api. */
export function describeRoutes(routes) {
  return routes.map((entry) => ({ method: entry.method, pattern: entry.pattern, description: entry.description }));
}

export default { createRoutes, compilePattern, matchRoute, describeRoutes };

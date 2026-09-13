/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: el orquestador del PROCESADO. Toma todo el material
 *     capturado y lo pasa por los extractores (decisiones, planes, errores,
 *     búsquedas, requisitos, lecciones), guarda los resultados en SQLite,
 *     construye el grafo de conocimiento y escribe un resumen en
 *     data/processed/summary.json. Es lo que ejecuta `genesis process`.
 *     POR QUÉ EXISTE: sin un orquestador, cada extractor sería una isla y
 *     alguien tendría que acordarse de llamarlos en orden. Aquí el orden es
 *     código: RAW → interpretado → entidades → grafo → resumen.
 *
 * 🇬🇧 EN — WHAT IT DOES: the PROCESSING orchestrator. It takes all captured
 *     material and runs it through the extractors (decisions, plans, errors,
 *     searches, requirements, lessons), stores the results in SQLite, builds the
 *     knowledge graph and writes a summary to data/processed/summary.json.
 *     This is what `genesis process` runs.
 *     WHY IT EXISTS: without an orchestrator each extractor would be an island
 *     and somebody would have to remember to call them in order. Here the order
 *     is code: RAW → interpreted → entities → graph → summary.
 *
 * 🇧🇷 PT — O QUE FAZ: o orquestrador do PROCESSAMENTO. Pega todo o material
 *     capturado e o passa pelos extratores (decisões, planos, erros, buscas,
 *     requisitos, lições), guarda os resultados no SQLite, constrói o grafo de
 *     conhecimento e escreve um resumo em data/processed/summary.json. É o que
 *     `genesis process` executa.
 *     POR QUE EXISTE: sem um orquestrador, cada extrator seria uma ilha e alguém
 *     teria que lembrar de chamá-los em ordem. Aqui a ordem é código.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Orquestador ES/EN/PT: módulo que NO hace el trabajo, solo decide quién lo
 *     hace y en qué orden. Separar "orquestar" de "ejecutar" permite cambiar un
 *     extractor sin tocar los demás.
 *     An orchestrator does not do the work; it decides who does it and in what order.
 *   • Reprocesamiento completo ES/EN/PT: `reprocess()` borra los datos derivados
 *     y los vuelve a generar desde RAW. Es la prueba de fuego de que tu nivel RAW
 *     es de verdad la fuente: si al reprocesar pierdes algo, ese algo no estaba
 *     en RAW y debes corregirlo.
 *     reprocess() is the acid test that RAW really is the source of truth.
 *   • Contadores en el resumen ES/EN/PT: devolver cuántas entidades de cada tipo
 *     se crearon no es cosmético: si un día `decisions: 0` cuando antes eran 11,
 *     sabes que el extractor se rompió aunque no haya lanzado ningún error.
 *     Returning per-type counts reveals silent extractor breakage.
 * ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { PATHS, toProjectRelative } from '../../core/shared/paths.js';
import { readJson, writeJson } from '../../core/shared/json.js';
import { ok, fail } from '../../core/shared/result.js';
import { listSessions, loadSession, loadRawMessages } from '../../core/capture/index.js';
import { parseMessage } from '../../core/capture/message-parser.js';
import { openDatabase, dbStats, truncateData, all } from '../db/index.js';
import { ingestAll, ingestSession, ingestControlPlane, ingestEvents } from '../ingestion/index.js';
import { extractDecisionTraces, persistDecisionTraces } from './decisions.js';
import { extractPlans, persistPlans } from './plans.js';
import { extractErrors, persistErrors } from './errors.js';
import { extractSearches, persistSearches } from './searches.js';
import { extractRequirements, persistRequirements } from './requirements.js';
import { extractLessons, persistLessons } from './lessons.js';
import { buildKnowledgeGraph } from '../graph/index.js';

/**
 * ES: procesa el texto de UNA sesión: interpreta mensajes y extrae todas las
 *     entidades. Devuelve contadores por tipo.
 * EN: processes the text of ONE session: interprets messages and extracts every
 *     entity. Returns counters by type.
 * PT: processa o texto de UMA sessão: interpreta mensagens e extrai todas as
 *     entidades. Devolve contadores por tipo.
 */
export function processSession(sessionId, options = {}) {
  const { bus = null, force = false } = options;
  const db = options.db ?? openDatabase();

  const loaded = loadSession(sessionId);
  if (!loaded.ok) return loaded;
  const session = loaded.value;

  const rawMessages = loadRawMessages(sessionId);
  if (!rawMessages.length) {
    return fail(`Session ${sessionId} has no raw messages`, { code: 'no_raw_messages', interruptionType: 'dependency_missing' });
  }

  // ES: paso 1 — interpretación determinista de cada mensaje.
  // EN: step 1 — deterministic interpretation of each message.
  // PT: passo 1 — interpretação determinística de cada mensagem.
  const ingested = ingestSession(sessionId, { db, bus, force });
  if (!ingested.ok) return ingested;

  const parsed = rawMessages.map((raw) => parseMessage(raw.content ?? '', {
    id: raw.id, session_id: sessionId, index: raw.index ?? 0, role: raw.role ?? 'user', ts: raw.ts ?? session.started_at,
  }));

  // ES: paso 2 — extraemos entidades del texto completo de la sesión.
  //     Trabajar sobre el texto completo (no mensaje a mensaje) permite detectar
  //     bloques que ocupan varios mensajes.
  // EN: step 2 — we extract entities from the session's full text. Working on the
  //     full text (not message by message) detects blocks spanning several messages.
  // PT: passo 2 — extraímos entidades do texto completo da sessão. Trabalhar
  //     sobre o texto inteiro detecta blocos que ocupam várias mensagens.
  // ES: ⚠️ BUG REAL CORREGIDO: antes concatenábamos "ASSISTANT: <contenido>" en
  //     UNA sola línea. Cuando el contenido empezaba con una cabecera
  //     ("DECISIÓN #00005"), esa cabecera dejaba de estar al inicio de línea y el
  //     regex `^...` no la veía: se perdían decisiones y los campos de dos bloques
  //     se fusionaban en uno solo. El marcador de rol va en SU PROPIA línea, igual
  //     que en la transcripción original.
  // EN: ⚠️ REAL BUG FIXED: we used to concatenate "ASSISTANT: <content>" on ONE
  //     line. When the content began with a header ("DECISIÓN #00005"), that
  //     header was no longer at the start of a line and the `^...` regex missed it:
  //     decisions were lost and the fields of two blocks merged into one. The role
  //     marker now goes on ITS OWN line, exactly like the original transcript.
  // PT: ⚠️ BUG REAL CORRIGIDO: antes concatenávamos "ASSISTANT: <conteúdo>" em UMA
  //     só linha. Quando o conteúdo começava com um cabeçalho ("DECISÃO #00005"),
  //     ele deixava de estar no início da linha e o regex `^...` não o via:
  //     decisões se perdiam e campos de dois blocos se fundiam. O marcador de papel
  //     vai agora na SUA PRÓPRIA linha, como na transcrição original.
  const fullText = parsed.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join('\n\n');

  const decisionTraces = extractDecisionTraces(fullText);
  const plans = extractPlans(fullText);
  const errors = extractErrors(fullText);
  const searches = extractSearches(fullText);
  const requirements = extractRequirements(parsed);
  const lessons = extractLessons(fullText);

  const decisions = persistDecisionTraces(decisionTraces, { db, bus, sessionId, layer: 'core-engine' });
  const plansResult = persistPlans(plans, { db, bus, sessionId, layer: 'requirements' });
  const errorsResult = persistErrors(errors, { db, bus, sessionId, layer: 'verification' });
  const searchesResult = persistSearches(searches, { db, bus, sessionId });
  const requirementsResult = persistRequirements(requirements, { db, bus, sessionId });
  const lessonsResult = persistLessons(lessons, { db, bus, sourceType: 'session', sourceId: sessionId, layer: 'learning-evolution' });

  const summary = {
    session_id: sessionId,
    processed_at: new Date().toISOString(),
    messages: parsed.length,
    language: ingested.value.language ?? null,
    extracted: {
      decisions: decisions.persisted,
      plans: plansResult.persisted,
      errors: errorsResult.persisted,
      searches: searchesResult.persisted,
      requirements: requirementsResult.persisted,
      lessons: lessonsResult.persisted,
      requirement_changes: requirementsResult.changes?.length ?? 0,
      proposed_rules: lessonsResult.proposed_rules?.length ?? 0,
    },
    ids: {
      decisions: decisions.ids,
      plans: plansResult.ids,
      errors: errorsResult.ids,
      searches: searchesResult.ids,
      requirements: requirementsResult.ids,
      lessons: lessonsResult.ids,
    },
    proposed_rules: lessonsResult.proposed_rules ?? [],
  };

  // ES: espejo JSON del procesado, revisable en Git sin abrir la base.
  // EN: JSON mirror of the processing, reviewable in Git without opening the DB.
  // PT: espelho JSON do processamento, revisável no Git sem abrir o banco.
  writeJson(path.join(PATHS.processed, 'sessions', `${sessionId}.summary.json`), summary);

  bus?.emit('KNOWLEDGE_EXTRACTED', { kind: 'session-entities', id: sessionId, ...summary.extracted }, { layer: 'knowledge' });

  return ok(summary);
}

/**
 * ES: procesa TODO: ingesta RAW + plano de control + eventos, luego cada sesión,
 *     luego el grafo, y escribe el resumen global.
 * EN: processes EVERYTHING: RAW ingestion + control plane + events, then each
 *     session, then the graph, and writes the global summary.
 * PT: processa TUDO: ingestão RAW + plano de controle + eventos, depois cada
 *     sessão, depois o grafo, e escreve o resumo global.
 */
export function processAll(options = {}) {
  const { bus = null, force = false } = options;
  const db = options.db ?? openDatabase();

  const started = Date.now();
  const ingestion = ingestAll({ db, bus, force });
  if (!ingestion.ok) return ingestion;

  const sessions = [];
  const failures = [];
  for (const meta of listSessions()) {
    const result = processSession(meta.id, { db, bus, force });
    if (result.ok) sessions.push(result.value);
    else failures.push({ session: meta.id, error: result.error });
  }

  // ES: `fresh: true` porque el grafo (nivel 3 KNOWLEDGE) es 100% derivado de las
  //     tablas procesadas (nivel 2). Reconstruirlo desde cero en cada pasada
  //     garantiza que nunca queden nodos/aristas huérfanos de versiones anteriores
  //     de los extractores, y que el resultado sea idéntico pase lo que pase antes.
  // EN: `fresh: true` because the graph (level 3 KNOWLEDGE) is 100% derived from
  //     the processed tables (level 2). Rebuilding it from scratch on every pass
  //     guarantees no orphan nodes/edges from previous extractor versions remain,
  //     and that the result is identical regardless of what happened before.
  // PT: `fresh: true` porque o grafo (nível 3) é 100% derivado das tabelas
  //     processadas (nível 2). Reconstruir do zero a cada passada garante que não
  //     sobrem nós/arestas órfãos de versões anteriores dos extratores.
  const graph = buildKnowledgeGraph({ db, bus, fresh: true });

  const totals = {
    decisions: 0, plans: 0, errors: 0, searches: 0, requirements: 0, lessons: 0,
    requirement_changes: 0, proposed_rules: 0, messages: 0,
  };
  for (const session of sessions) {
    totals.messages += session.messages ?? 0;
    for (const key of Object.keys(totals)) {
      if (key === 'messages') continue;
      totals[key] += session.extracted?.[key] ?? 0;
    }
  }

  const summary = {
    processed_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    sessions_processed: sessions.length,
    sessions_failed: failures.length,
    failures,
    totals,
    ingestion: {
      control: ingestion.value.control,
      events: ingestion.value.events,
      sessions_ingested: (ingestion.value.sessions ?? []).length,
    },
    graph: graph.ok ? graph.value : { error: graph.error },
    database: dbStats(db),
    proposed_rules: sessions.flatMap((s) => s.proposed_rules ?? []),
  };

  writeJson(path.join(PATHS.processed, 'summary.json'), summary);
  bus?.emit('KNOWLEDGE_EXTRACTED', { kind: 'full-processing', ...totals, sessions: sessions.length }, { layer: 'knowledge' });

  return ok(summary);
}

/**
 * ES: procesa un texto suelto (sin sesión capturada). Útil para pegar una
 *     conversación directamente por consola: `genesis learn --file notes.md`.
 * EN: processes loose text (with no captured session). Useful to paste a
 *     conversation straight from the console: `genesis learn --file notes.md`.
 * PT: processa um texto solto (sem sessão capturada). Útil para colar uma
 *     conversa direto no console: `genesis learn --file notes.md`.
 */
export function processText(text, options = {}) {
  const { bus = null, sessionId = null, source = 'inline-text' } = options;
  const db = options.db ?? openDatabase();

  const decisionTraces = extractDecisionTraces(text);
  const plans = extractPlans(text);
  const errors = extractErrors(text);
  const searches = extractSearches(text);
  const lessons = extractLessons(text);
  const message = parseMessage(text, { role: 'user', session_id: sessionId });
  const requirements = extractRequirements([message]);

  return ok({
    source,
    processed_at: new Date().toISOString(),
    decisions: persistDecisionTraces(decisionTraces, { db, bus, sessionId }).persisted,
    plans: persistPlans(plans, { db, bus, sessionId }).persisted,
    errors: persistErrors(errors, { db, bus, sessionId }).persisted,
    searches: persistSearches(searches, { db, bus, sessionId }).persisted,
    requirements: persistRequirements(requirements, { db, bus, sessionId }).persisted,
    lessons: persistLessons(lessons, { db, bus, sourceType: source }).persisted,
  });
}

/**
 * ES: reprocesa TODO desde cero: borra datos derivados y los regenera desde RAW.
 *     Es la garantía de que RAW es la única fuente de verdad (DEC-00001).
 * EN: reprocesses EVERYTHING from scratch: deletes derived data and regenerates
 *     it from RAW. This is the guarantee that RAW is the only source of truth.
 * PT: reprocessa TUDO do zero: apaga os dados derivados e os regenera a partir
 *     do RAW. É a garantia de que o RAW é a única fonte de verdade.
 */
export function reprocess(options = {}) {
  const { bus = null } = options;
  const db = options.db ?? openDatabase();
  const cleared = truncateData(db);
  bus?.emit('FILE_CHANGED', { kind: 'database_truncated', tables: cleared.ok ? cleared.value : 0 }, { layer: 'knowledge' });
  return processAll({ ...options, db, bus, force: true });
}

/** ES/EN/PT: resumen de lo que hay en la base, para `genesis status`. */
export function processingSummary(db) {
  const count = (table) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0);
  return {
    sessions: count('sessions'),
    messages: count('messages'),
    decisions: count('decisions'),
    plans: count('plans'),
    actions: count('actions'),
    searches: count('searches'),
    errors: count('errors'),
    interruptions: count('interruptions'),
    requirements: count('requirements'),
    requirement_changes: count('requirement_changes'),
    lessons: count('lessons'),
    builds: count('builds'),
    artifacts: count('artifacts'),
    dependencies: count('dependencies'),
    nodes: count('nodes'),
    edges: count('edges'),
    events: count('events'),
    tasks: count('tasks'),
    indexed_entities: count('fts_index'),
    indexed_messages: count('fts_messages'),
  };
}

/** ES/EN/PT: últimas entidades creadas de cada tipo (para el dashboard). */
export function recentEntities(db, limit = 5) {
  return {
    decisions: all(db, 'SELECT id, decision, status, layer, created_at FROM decisions ORDER BY created_at DESC, id DESC LIMIT ?', [limit]),
    lessons: all(db, 'SELECT id, lesson, future_rule, created_at FROM lessons ORDER BY created_at DESC LIMIT ?', [limit]),
    errors: all(db, 'SELECT id, message, severity, resolved, ts FROM errors ORDER BY ts DESC LIMIT ?', [limit]),
    searches: all(db, 'SELECT id, query, reason, ts FROM searches ORDER BY ts DESC LIMIT ?', [limit]),
    plans: all(db, 'SELECT id, objective, status, created_at FROM plans ORDER BY created_at DESC LIMIT ?', [limit]),
    requirements: all(db, 'SELECT id, title, priority, status FROM requirements ORDER BY updated_at DESC LIMIT ?', [limit]),
  };
}

export default { processSession, processAll, processText, reprocess, processingSummary, recentEntities };

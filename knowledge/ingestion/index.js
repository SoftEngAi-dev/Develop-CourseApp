/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/ingestion/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: mueve la información del nivel RAW al nivel PROCESADO y la
 *     guarda en SQLite. Cuatro ingestas distintas:
 *       1. ingestSession   → mensajes crudos ⇒ mensajes interpretados + FTS
 *       2. ingestControl   → manifest/tasks/roadmap/decisions ⇒ tablas + FTS
 *       3. ingestEvents    → JSONL de eventos ⇒ tabla events consultable
 *       4. ingestAll       → las tres anteriores, en orden
 *     POR QUÉ EXISTE: separa "guardar" de "entender". El RAW nunca se toca; el
 *     PROCESADO se puede borrar y regenerar completo con `genesis process`.
 *     Eso significa que un bug en el análisis NUNCA destruye la historia.
 *
 * 🇬🇧 EN — WHAT IT DOES: moves information from the RAW level to the PROCESSED
 *     level and stores it in SQLite. Four different ingestions:
 *       1. ingestSession   → raw messages ⇒ interpreted messages + FTS
 *       2. ingestControl   → manifest/tasks/roadmap/decisions ⇒ tables + FTS
 *       3. ingestEvents    → event JSONL ⇒ a queryable events table
 *       4. ingestAll       → all three, in order
 *     WHY IT EXISTS: it separates "storing" from "understanding". RAW is never
 *     touched; PROCESSED can be deleted and fully regenerated with
 *     `genesis process`. A bug in the analysis can therefore NEVER destroy history.
 *
 * 🇧🇷 PT — O QUE FAZ: move a informação do nível RAW para o PROCESSED e a guarda
 *     no SQLite. Quatro ingestões distintas: sessões, plano de controle,
 *     eventos e todas elas em ordem.
 *     POR QUE EXISTE: separa "guardar" de "entender". O RAW nunca é tocado; o
 *     PROCESSED pode ser apagado e regenerado com `genesis process`. Um bug na
 *     análise NUNCA destrói a história.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Pipeline ETL ES/EN/PT: Extract (sacar datos de su origen), Transform
 *     (darles forma útil), Load (guardarlos donde se consultan rápido). Este
 *     archivo es la "L" de Load. ETL is Extract-Transform-Load; this is Load.
 *   • Reprocesable ES/EN/PT: una buena regla de diseño es que todo lo derivado
 *     se pueda borrar y volver a generar desde la fuente. Si no puedes, ese
 *     dato deja de ser "derivado" y se convierte en fuente: cuídalo igual.
 *     Derived data must be regenerable from its source; if not, it IS a source.
 *   • Transacción por sesión ES/EN/PT: envolvemos cada sesión en una
 *     transacción para que un fallo a mitad no deje 37 mensajes sí y 12 no.
 *     Per-session transactions avoid half-ingested sessions.
 *   • `?.` y `??` ES/EN/PT: `a?.b` no revienta si `a` es null; `a ?? b` usa `b`
 *     solo si `a` es null/undefined (a diferencia de `||`, que también salta
 *     con 0 o "" — por eso `??` es más correcto para números y textos vacíos).
 *     `??` falls back only on null/undefined, unlike `||` which also catches 0 and "".
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { PATHS, toProjectRelative } from '../../core/shared/paths.js';
import { readJson, writeJson, ensureDir } from '../../core/shared/json.js';
import { ok, fail, attempt } from '../../core/shared/result.js';
import { loadSession, loadRawMessages, listSessions } from '../../core/capture/index.js';
import { parseMessage } from '../../core/capture/message-parser.js';
import { loadManifest } from '../../core/manifest/index.js';
import { loadTasks, loadRoadmap } from '../../core/state/index.js';
import { EventBus } from '../../core/event-bus/index.js';
import { openDatabase, run, get, all, tx, upsert, toJson, indexEntity, indexMessage, dbStats } from '../db/index.js';

/**
 * ES: procesa UNA sesión RAW: interpreta cada mensaje y lo guarda en la base.
 * EN: processes ONE RAW session: interprets each message and stores it in the DB.
 * PT: processa UMA sessão RAW: interpreta cada mensagem e a guarda no banco.
 *
 * @param {string} sessionId
 * @param {{ db?: object, bus?: object, force?: boolean }} [options]
 */
export function ingestSession(sessionId, options = {}) {
  const { bus = null, force = false } = options;
  const db = options.db ?? openDatabase();

  const loaded = loadSession(sessionId);
  if (!loaded.ok) return loaded;
  const session = loaded.value;

  const already = get(db, 'SELECT processed_at FROM sessions WHERE id = ?', [sessionId]);
  if (already?.processed_at && !force) {
    return ok({ session_id: sessionId, skipped: true, reason: 'already processed (use --force)' });
  }

  const rawMessages = loadRawMessages(sessionId);
  if (!rawMessages.length) {
    return fail(`Session ${sessionId} has no raw messages on disk`, {
      code: 'no_raw_messages', interruptionType: 'dependency_missing', layer: 'knowledge', task: sessionId,
    });
  }

  const result = tx(db, (handle) => {
    upsert(handle, 'sessions', {
      id: session.id,
      title: session.title ?? null,
      source: session.source ?? null,
      format: session.format ?? null,
      started_at: session.started_at ?? null,
      ended_at: session.ended_at ?? null,
      captured_at: session.captured_at ?? null,
      message_count: rawMessages.length,
      chars: session.chars ?? null,
      language: null,
      raw_hash: session.raw_hash ?? null,
      processed_at: new Date().toISOString(),
      file: toProjectRelative(session._file ?? path.join(PATHS.rawSessions, session.id)),
    });

    const processed = [];
    const languageVotes = new Map();

    for (const raw of rawMessages) {
      const parsed = parseMessage(raw.content ?? '', {
        id: raw.id,
        session_id: sessionId,
        index: raw.index ?? 0,
        role: raw.role ?? 'user',
        ts: raw.ts ?? session.started_at ?? new Date().toISOString(),
      });

      languageVotes.set(parsed.language, (languageVotes.get(parsed.language) ?? 0) + 1);

      run(handle, `INSERT INTO messages (
          id, session_id, idx, role, ts, content, language, language_confidence,
          intent, intent_confidence, secondary_intents, chars, words, lines,
          requirements_json, constraints_json, unknowns_json, headings_json,
          entities_json, terms_json, links_json, code_blocks, json_blocks, interpreted_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content, language = excluded.language, intent = excluded.intent,
          intent_confidence = excluded.intent_confidence, secondary_intents = excluded.secondary_intents,
          chars = excluded.chars, words = excluded.words, lines = excluded.lines,
          requirements_json = excluded.requirements_json, constraints_json = excluded.constraints_json,
          unknowns_json = excluded.unknowns_json, headings_json = excluded.headings_json,
          entities_json = excluded.entities_json, terms_json = excluded.terms_json,
          links_json = excluded.links_json, code_blocks = excluded.code_blocks,
          json_blocks = excluded.json_blocks, interpreted_by = excluded.interpreted_by`,
        [
          parsed.id, sessionId, parsed.index, parsed.role, parsed.ts, parsed.content,
          parsed.language, parsed.language_confidence, parsed.intent, parsed.intent_confidence,
          toJson(parsed.secondary_intents), parsed.stats.chars, parsed.stats.words, parsed.stats.lines,
          toJson(parsed.interpretation.requirements), toJson(parsed.interpretation.constraints),
          toJson(parsed.interpretation.unknowns), toJson(parsed.interpretation.headings),
          toJson(parsed.interpretation.entities), toJson(parsed.interpretation.technical_terms),
          toJson(parsed.interpretation.links), parsed.interpretation.code_blocks.length,
          parsed.interpretation.json_blocks, parsed.interpretation.interpreter,
        ]);

      indexMessage(handle, { id: parsed.id, session_id: sessionId, role: parsed.role, intent: parsed.intent, content: parsed.content });
      indexEntity(handle, {
        entityType: 'message',
        entityId: parsed.id,
        title: `${parsed.role} · ${parsed.intent} · ${sessionId}`,
        body: parsed.content,
        tags: [parsed.role, parsed.intent, parsed.language, ...parsed.interpretation.technical_terms],
      });

      processed.push(parsed);
    }

    const dominantLanguage = [...languageVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'und';
    run(handle, 'UPDATE sessions SET language = ?, message_count = ? WHERE id = ?', [dominantLanguage, processed.length, sessionId]);

    // ES: espejo legible en el nivel PROCESSED (JSON revisable en Git).
    // EN: readable mirror in the PROCESSED level (JSON reviewable in Git).
    // PT: espelho legível no nível PROCESSED (JSON revisável no Git).
    const processedFile = path.join(PATHS.processed, 'messages', `${sessionId}.json`);
    ensureDir(path.dirname(processedFile));
    writeJson(processedFile, {
      session_id: sessionId,
      processed_at: new Date().toISOString(),
      language: dominantLanguage,
      message_count: processed.length,
      interpreter: 'core/capture/message-parser (deterministic, offline)',
      messages: processed,
    });

    return { session_id: sessionId, messages: processed.length, language: dominantLanguage, processed_file: toProjectRelative(processedFile) };
  });

  if (!result.ok) return result;

  bus?.emit('KNOWLEDGE_EXTRACTED', { kind: 'session', id: sessionId, messages: result.value.messages, language: result.value.language }, { layer: 'knowledge' });
  return ok({ ...result.value, skipped: false });
}

/**
 * ES: ingiere el PLANO DE CONTROL completo (manifest, tasks, roadmap, decisions)
 *     dentro de la base, para que todo sea consultable con una sola búsqueda.
 * EN: ingests the whole CONTROL PLANE (manifest, tasks, roadmap, decisions) into
 *     the database so everything is queryable with a single search.
 * PT: ingere o PLANO DE CONTROLE completo (manifest, tasks, roadmap, decisions)
 *     no banco, para que tudo seja consultável com uma única busca.
 */
export function ingestControlPlane(options = {}) {
  const { bus = null } = options;
  const db = options.db ?? openDatabase();
  const now = new Date().toISOString();
  const counts = { requirements: 0, tasks: 0, decisions: 0, policies: 0 };

  const manifestResult = loadManifest();
  const tasksResult = loadTasks();
  const roadmapResult = loadRoadmap();
  const decisions = readJson(PATHS.decisions, { decisions: [] })?.decisions ?? [];
  const policies = readJson(PATHS.policies, { rules: [] })?.rules ?? [];

  const result = tx(db, (handle) => {
    // ES: requisitos desde el manifest. Requirements from the manifest.
    if (manifestResult.ok) {
      for (const requirement of manifestResult.value.requirements ?? []) {
        upsert(handle, 'requirements', {
          id: requirement.id,
          layer: requirement.layer ?? null,
          title: requirement.title ?? requirement.id,
          priority: requirement.priority ?? 'medium',
          status: requirement.status ?? 'discovered',
          acceptance: requirement.acceptance ?? null,
          source_id: 'control/manifest.json',
          session_id: null,
          created_at: now,
          updated_at: now,
        });
        indexEntity(handle, {
          entityType: 'requirement', entityId: requirement.id,
          title: `${requirement.id} · ${requirement.title ?? ''}`,
          body: `${requirement.acceptance ?? ''} ${requirement.priority ?? ''} ${requirement.status ?? ''}`,
          tags: ['requirement', requirement.layer, requirement.priority, requirement.status],
        });
        counts.requirements += 1;
      }
    }

    // ES: tareas desde control/tasks.json. Tasks from control/tasks.json.
    if (tasksResult.ok) {
      for (const task of tasksResult.value.tasks ?? []) {
        upsert(handle, 'tasks', {
          id: task.id,
          phase: task.phase ?? null,
          layer: task.layer ?? null,
          title: task.title ?? task.id,
          status: task.status ?? 'discovered',
          progress: Number(task.progress) || 0,
          created_at: task.created_at ?? now,
          completed_at: task.completed_at ?? null,
          updated_at: task.updated_at ?? now,
        });
        indexEntity(handle, {
          entityType: 'task', entityId: task.id,
          title: `${task.id} · ${task.title ?? ''}`,
          body: `${task.acceptance ?? ''} ${(task.artifacts ?? []).join(' ')} ${task.phase ?? ''}`,
          tags: ['task', task.status, task.phase, task.layer],
        });
        counts.tasks += 1;
      }
    }

    // ES: Decision Traces desde control/decisions.json. Decision Traces.
    for (const decision of decisions) {
      const objective = typeof decision.objective === 'string'
        ? { es: decision.objective, en: decision.objective, pt: decision.objective }
        : decision.objective ?? {};
      upsert(handle, 'decisions', {
        id: decision.id,
        layer: decision.layer ?? null,
        status: decision.status ?? 'proposed',
        objective_es: objective.es ?? null,
        objective_en: objective.en ?? null,
        objective_pt: objective.pt ?? null,
        context: decision.context ?? null,
        constraints_json: toJson(decision.constraints ?? []),
        alternatives_json: toJson(decision.alternatives ?? []),
        decision: decision.decision ?? decision.id,
        justification: decision.justification ?? null,
        consequence: decision.consequence ?? null,
        related_json: toJson(decision.related ?? []),
        evidence: decision.evidence ?? null,
        session_id: decision.session_id ?? null,
        created_at: decision.created_at ?? now,
      });
      indexEntity(handle, {
        entityType: 'decision', entityId: decision.id,
        title: `${decision.id} · ${decision.decision ?? ''}`.slice(0, 400),
        body: [objective.en ?? objective.es, decision.context, decision.justification, decision.consequence, decision.evidence,
          (decision.alternatives ?? []).map((a) => `${a.id ?? ''} ${a.option ?? ''} ${a.rejected_because ?? ''}`).join(' ')].filter(Boolean).join('\n'),
        tags: ['decision', decision.layer, decision.status, ...(decision.related ?? [])],
      });
      counts.decisions += 1;
    }

    // ES: políticas (reglas operativas). Policies (operational rules).
    for (const policy of policies) {
      indexEntity(handle, {
        entityType: 'policy', entityId: policy.id,
        title: `${policy.id} · ${policy.key ?? ''}`,
        body: `${policy.statement ?? ''} ${policy.enforcement ?? ''} ${policy.origin ?? ''}`,
        tags: ['policy', policy.enforcement, policy.origin],
      });
      counts.policies += 1;
    }

    // ES: fases del roadmap como entidades buscables. Roadmap phases as searchable entities.
    if (roadmapResult.ok) {
      for (const phase of roadmapResult.value.phases ?? []) {
        indexEntity(handle, {
          entityType: 'phase', entityId: phase.id,
          title: `${phase.id} · ${phase.name ?? ''}`,
          body: `${(phase.deliverables ?? []).join('\n')} ${phase.exit_criteria ?? ''}`,
          tags: ['phase', phase.status, `weight:${phase.weight ?? 0}`],
        });
      }
    }

    return counts;
  });

  if (!result.ok) return result;
  bus?.emit('KNOWLEDGE_EXTRACTED', { kind: 'control-plane', ...result.value }, { layer: 'knowledge' });
  return ok({ ...result.value, skipped: false });
}

/**
 * ES: copia los eventos del JSONL (RAW) a la tabla events (PROCESSED) para que
 *     el timeline y las métricas se consulten en SQL, no recorriendo archivos.
 * EN: copies events from the JSONL (RAW) into the events table (PROCESSED) so the
 *     timeline and metrics are queried in SQL instead of scanning files.
 * PT: copia os eventos do JSONL (RAW) para a tabela events (PROCESSED) para que
 *     o timeline e as métricas sejam consultados em SQL, não percorrendo arquivos.
 */
export function ingestEvents(options = {}) {
  const { bus = null, limit = null } = options;
  const db = options.db ?? openDatabase();
  const events = EventBus.loadFromDisk(limit ? { limit } : {});

  const result = tx(db, (handle) => {
    let inserted = 0;
    for (const event of events) {
      upsert(handle, 'events', {
        id: event.id,
        type: event.type,
        ts: event.ts,
        layer: event.layer ?? null,
        task: event.task ?? null,
        actor: event.actor ?? null,
        severity: event.severity ?? null,
        session_id: event.session_id ?? null,
        payload_json: toJson(event.payload ?? {}),
      });
      inserted += 1;
    }
    return { events: inserted, types: [...new Set(events.map((e) => e.type))].length };
  });

  if (!result.ok) return result;
  return ok(result.value);
}

/**
 * ES: ingesta completa = sesiones + plano de control + eventos. Es lo que ejecuta
 *     `genesis process`. Devuelve un resumen con todo lo que ocurrió.
 * EN: full ingestion = sessions + control plane + events. This is what
 *     `genesis process` runs. Returns a summary of everything that happened.
 * PT: ingestão completa = sessões + plano de controle + eventos. É o que
 *     `genesis process` executa. Devolve um resumo de tudo o que aconteceu.
 */
export function ingestAll(options = {}) {
  const { bus = null, force = false } = options;
  const db = options.db ?? openDatabase();
  const summary = { sessions: [], control: null, events: null, errors: [], stats: null };

  for (const meta of listSessions()) {
    const result = ingestSession(meta.id, { db, bus, force });
    if (result.ok) summary.sessions.push(result.value);
    else summary.errors.push({ session: meta.id, error: result.error });
  }

  const control = ingestControlPlane({ db, bus });
  summary.control = control.ok ? control.value : { error: control.error };

  const events = ingestEvents({ db, bus });
  summary.events = events.ok ? events.value : { error: events.error };

  summary.stats = dbStats(db);
  return ok(summary);
}

export default { ingestSession, ingestControlPlane, ingestEvents, ingestAll };

/* ═══════════════════════════════════════════════════════════════════════════
 * memory/session/index.js — SESSION MEMORY façade
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: responde "¿qué pasó en esta conversación?" — mensajes RAW,
 *     su interpretación (intención, idioma, términos, requisitos) y lo que esa
 *     sesión produjo (decisiones, búsquedas, planes, errores, lecciones).
 *     POR QUÉ EXISTE: la memoria de proyecto dice DÓNDE estamos; la de sesión
 *     dice QUÉ ACABA DE PASAR. El agente necesita ambas y las necesita
 *     separadas: mezclarlas es lo que produce respuestas que confunden "el
 *     proyecto decidió X hace un mes" con "el usuario pidió X hace un minuto".
 *     ESTADO: IMPLEMENTADA (solo lectura sobre las Fases 1-2).
 *
 * 🇬🇧 EN — WHAT IT DOES: answers "what happened in this conversation?" — RAW
 *     messages, their interpretation (intent, language, terms, requirements) and
 *     what that session produced (decisions, searches, plans, errors, lessons).
 *     WHY IT EXISTS: project memory says WHERE we are; session memory says WHAT
 *     JUST HAPPENED. The agent needs both, separately: mixing them is what
 *     produces answers confusing "the project decided X a month ago" with "the
 *     user asked for X a minute ago".
 *     STATUS: IMPLEMENTED (read-only over Phases 1-2).
 *
 * 🇧🇷 PT — O QUE FAZ: responde "o que aconteceu nesta conversa?" — mensagens RAW,
 *     sua interpretação e o que a sessão produziu.
 *     POR QUE EXISTE: memória de projeto diz ONDE estamos; memória de sessão diz
 *     O QUE ACABOU DE ACONTECER. O agente precisa das duas, separadas.
 *     ESTADO: IMPLEMENTADA (somente leitura).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Nivel 1 vs nivel 2 ES/EN/PT: el mensaje RAW (nivel 1) es lo que el humano
 *     escribió, byte por byte, y NUNCA se modifica. Su interpretación (nivel 2)
 *     es derivada y se puede recalcular. Guardarlas separadas permite corregir
 *     el intérprete sin perder la fuente. Raw is immutable; interpretation is
 *     derived and can always be recomputed.
 *   • `WHERE session_id = ?` ES/EN/PT: el `?` es un parámetro vinculado
 *     (prepared statement). NUNCA concatenes texto dentro del SQL: es la puerta
 *     de la inyección SQL. Always bind parameters; never concatenate SQL.
 *   • Map para unir listas ES/EN/PT: para juntar mensajes RAW con su
 *     interpretación construimos un `Map` por id. Buscar en un Map es O(1);
 *     buscar con `.find()` dentro de un bucle es O(n²) y se nota enseguida.
 *     A Map lookup is O(1); a nested .find() is O(n²).
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail } from '../../core/shared/result.js';
import { openDatabase, all, fromJson } from '../../knowledge/db/index.js';
import { listSessions, loadSession, loadRawMessages } from '../../core/capture/index.js';

/** ES/EN/PT: sesiones disponibles (índice ligero, sin contenido). */
export function listSessionMemory() {
  return ok({ kind: 'session-memory-index', count: listSessions().length, sessions: listSessions() });
}

/**
 * ES: memoria completa de una sesión.
 * EN: full memory of one session.
 * PT: memória completa de uma sessão.
 *
 * @param {string} sessionId
 * @param {object} [options]
 * @param {object} [options.db] manejador de base ya abierto (para pruebas)
 * @param {number} [options.messageLimit=200] tope de mensajes devueltos
 * @returns {{ok:true,value:object}|{ok:false,error:object}}
 */
export function sessionMemory(sessionId, options = {}) {
  const { db = openDatabase(), messageLimit = 200 } = options;
  if (!sessionId) return fail('sessionMemory requires a sessionId', { code: 'missing_argument' });

  const meta = loadSession(sessionId);
  if (!meta.ok) return fail(meta.error);

  const raw = loadRawMessages(sessionId).slice(0, messageLimit);
  const processed = all(db, `SELECT * FROM messages WHERE session_id = ? ORDER BY idx LIMIT ?`, [sessionId, messageLimit]);
  const interpretationById = new Map(processed.map((row) => [row.id, row]));

  const produced = {
    decisions: all(db, 'SELECT id, decision, status, layer FROM decisions WHERE session_id = ? ORDER BY id', [sessionId]),
    searches: all(db, 'SELECT id, query, reason, selected FROM searches WHERE session_id = ? ORDER BY id', [sessionId]),
    plans: all(db, 'SELECT id, objective, status FROM plans WHERE session_id = ? ORDER BY id', [sessionId]),
    errors: all(db, 'SELECT id, message, severity, resolved, lesson FROM errors WHERE session_id = ? ORDER BY ts', [sessionId]),
    requirements: all(db, 'SELECT id, title, priority, status, layer FROM requirements WHERE session_id = ? ORDER BY id', [sessionId]),
    lessons: all(db, "SELECT id, lesson, future_rule FROM lessons WHERE source_id IN (SELECT id FROM errors WHERE session_id = ?) ORDER BY id", [sessionId]),
  };

  return ok({
    kind: 'session-memory',
    session: meta.value,
    messages: raw.map((message) => {
      const parsed = interpretationById.get(message.id) ?? {};
      return {
        id: message.id,
        index: message.index ?? parsed.idx ?? null,
        role: message.role,
        ts: message.ts ?? null,
        content: message.content,
        chars: message.chars ?? parsed.chars ?? null,
        raw_hash: message.hash ?? null,
        interpretation: {
          intent: parsed.intent ?? null,
          intent_confidence: parsed.intent_confidence ?? null,
          secondary_intents: fromJson(parsed.secondary_intents, []),
          language: parsed.language ?? null,
          language_confidence: parsed.language_confidence ?? null,
          words: parsed.words ?? null,
          lines: parsed.lines ?? null,
          code_blocks: parsed.code_blocks ?? 0,
          terms: fromJson(parsed.terms_json, []),
          entities: fromJson(parsed.entities_json, []),
          requirements: fromJson(parsed.requirements_json, []),
          constraints: fromJson(parsed.constraints_json, []),
          unknowns: fromJson(parsed.unknowns_json, []),
          headings: fromJson(parsed.headings_json, []),
          links: fromJson(parsed.links_json, []),
          interpreted_by: parsed.interpreted_by ?? null,
        },
      };
    }),
    produced,
    totals: {
      messages: raw.length,
      decisions: produced.decisions.length,
      searches: produced.searches.length,
      plans: produced.plans.length,
      errors: produced.errors.length,
      requirements: produced.requirements.length,
      lessons: produced.lessons.length,
    },
  });
}

/**
 * ES: memoria de la sesión MÁS RECIENTE (lo que el agente necesita al arrancar).
 * EN: memory of the MOST RECENT session (what the agent needs on startup).
 * PT: memória da sessão MAIS RECENTE.
 */
export function latestSessionMemory(options = {}) {
  const sessions = listSessions();
  const last = sessions[sessions.length - 1];
  if (!last) return fail('No captured session yet. Run: genesis demo', { code: 'no_sessions' });
  return sessionMemory(last.id, options);
}

export default { listSessionMemory, sessionMemory, latestSessionMemory };

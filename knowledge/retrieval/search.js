/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/retrieval/search.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: la capa de BÚSQUEDA del conocimiento. Ofrece:
 *       • search()          → búsqueda full-text (FTS5) en TODAS las entidades
 *       • searchMessages()  → búsqueda dentro de las conversaciones
 *       • timeline()        → vista cronológica de eventos (sección 10)
 *       • whyDidWeChoose()  → cadena de proveniencia de una decisión (sección 15)
 *     POR QUÉ EXISTE: de nada sirve guardar conocimiento si no se puede
 *     encontrar. La pregunta real de una sesión nueva nunca es "dame todo",
 *     es "¿qué sabemos de SQLite?" o "¿por qué elegimos este stack?".
 *
 * 🇬🇧 EN — WHAT IT DOES: the knowledge SEARCH layer. It offers:
 *       • search()          → full-text search (FTS5) across ALL entities
 *       • searchMessages()  → search inside conversations
 *       • timeline()        → chronological event view (section 10)
 *       • whyDidWeChoose()  → provenance chain of a decision (section 15)
 *     WHY IT EXISTS: storing knowledge is useless if it cannot be found. A new
 *     session never asks "give me everything"; it asks "what do we know about
 *     SQLite?" or "why did we choose this stack?".
 *
 * 🇧🇷 PT — O QUE FAZ: a camada de BUSCA do conhecimento. Oferece:
 *       • search()          → busca full-text (FTS5) em TODAS as entidades
 *       • searchMessages()  → busca dentro das conversas
 *       • timeline()        → visão cronológica de eventos (seção 10)
 *       • whyDidWeChoose()  → cadeia de proveniência de uma decisão (seção 15)
 *     POR QUE EXISTE: de nada serve guardar conhecimento se ele não puder ser
 *     encontrado. A pergunta real de uma sessão nova nunca é "me dê tudo", é
 *     "o que sabemos sobre SQLite?" ou "por que escolhemos este stack?".
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • FTS5 MATCH ES/EN/PT: `WHERE fts_index MATCH 'sqlite OR postgres'` busca
 *     palabras, no substrings. Soporta operadores: OR, AND, NOT, "frase exacta",
 *     y `token*` para prefijos. Es mucho más rápido que LIKE '%texto%' porque
 *     usa un índice invertido (palabra → filas donde aparece).
 *     FTS5 MATCH searches words using an inverted index; far faster than LIKE.
 *   • ⚠️ Peligro real: si el usuario escribe algo que FTS5 interpreta como
 *     operador (por ejemplo `C++`, `"sin cerrar`, `a AND`), la consulta LANZA un
 *     error de sintaxis. Por eso `toFtsQuery()` desarma el texto: extrae solo
 *     palabras alfanuméricas y las une con OR. Nunca pases texto crudo a MATCH.
 *     Never pass raw user text to MATCH: sanitize it into tokens first.
 *   • bm25 ES/EN/PT: función de relevancia. Devuelve números NEGATIVOS: cuanto
 *     más negativo, MÁS relevante. Por eso se ordena ASC (ascendente) y no DESC,
 *     que es lo contrario de lo que la intuición sugiere.
 *     bm25 returns negative scores: more negative = more relevant, so ORDER BY ASC.
 *   • snippet() ES/EN/PT: función de FTS5 que devuelve el fragmento del texto
 *     donde apareció la coincidencia, con marcadores alrededor. Mucho más útil
 *     que mostrar el documento entero.
 *     snippet() returns the matching fragment with markers around the hit.
 *   • Fallback LIKE ES/EN/PT: si FTS no encuentra nada (o falla), buscamos con
 *     LIKE '%texto%'. Es más lento pero nunca devuelve "0 resultados" por un
 *     problema de sintaxis. Redundancia defensiva.
 *     Defensive fallback: if FTS finds nothing, retry with LIKE.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, all, get, fromJson } from '../db/index.js';

/**
 * ES: convierte texto humano en una consulta FTS5 segura.
 *     "¿por qué elegimos SQLite?" → "por OR que OR elegimos OR sqlite*"
 * EN: turns human text into a safe FTS5 query.
 *     "why did we choose SQLite?" → "why OR did OR we OR choose OR sqlite*"
 * PT: converte texto humano numa consulta FTS5 segura.
 *     "por que escolhemos SQLite?" → "por OR que OR escolhemos OR sqlite*"
 *
 * @param {string} text
 * @param {{ mode?: 'or'|'and'|'phrase', prefix?: boolean, maxTokens?: number }} [options]
 * @returns {string|null} FTS5 query or null if nothing usable
 */
export function toFtsQuery(text, options = {}) {
  const { mode = 'or', prefix = true, maxTokens = 24 } = options;
  // ES: \p{L} = cualquier letra de cualquier alfabeto; \p{N} = cualquier dígito.
  //     La bandera /u activa el modo Unicode, imprescindible en un proyecto trilingüe.
  // EN: \p{L} = any letter of any alphabet; \p{N} = any digit. The /u flag
  //     enables Unicode mode, essential in a trilingual project.
  // PT: \p{L} = qualquer letra de qualquer alfabeto; \p{N} = qualquer dígito.
  //     A flag /u ativa o modo Unicode, essencial num projeto trilíngue.
  const tokens = [...new Set(
    (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? [])
      .filter((token) => !STOPWORDS.has(token))
      .slice(0, maxTokens),
  )];
  if (!tokens.length) {
    const fallback = (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? []).slice(0, maxTokens);
    if (!fallback.length) return null;
    return fallback.map((token) => (prefix ? `"${token}"*` : `"${token}"`)).join(mode === 'and' ? ' AND ' : ' OR ');
  }
  const joiner = mode === 'and' ? ' AND ' : ' OR ';
  if (mode === 'phrase') return `"${tokens.join(' ')}"`;
  return tokens.map((token) => (prefix ? `${token}*` : token)).join(joiner);
}

/** ES/EN/PT: palabras vacías trilingües que no aportan en una búsqueda. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'which', 'why', 'how', 'when', 'where', 'who',
  'was', 'were', 'been', 'are', 'has', 'have', 'had', 'will', 'would', 'should', 'could', 'can', 'did', 'does',
  'el', 'la', 'los', 'las', 'que', 'qué', 'por', 'para', 'con', 'una', 'uno', 'del', 'los', 'como', 'más', 'mas',
  'este', 'esta', 'ser', 'son', 'fue', 'han', 'hay', 'sus', 'entre', 'sobre', 'hasta', 'desde', 'todo', 'todos',
  'de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'os', 'as', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com',
  'se', 'es', 'ao', 'aos', 'pelo', 'pela', 'como', 'mais', 'mas', 'foi', 'ser', 'sao', 'são', 'tem', 'ha',
]);

/**
 * ES: búsqueda full-text en TODAS las entidades del conocimiento.
 * EN: full-text search across ALL knowledge entities.
 * PT: busca full-text em TODAS as entidades do conhecimento.
 *
 * @param {string} query texto humano / human text / texto humano
 * @param {{ db?: object, types?: string[], limit?: number, offset?: number, mode?: 'or'|'and'|'phrase' }} [options]
 */
export function search(query, options = {}) {
  const { types = null, limit = 20, offset = 0, mode = 'or' } = options;
  const db = options.db ?? openDatabase();

  const ftsQuery = toFtsQuery(query, { mode });
  const wanted = Array.isArray(types) && types.length ? types : null;

  if (ftsQuery) {
    try {
      const typeFilter = wanted ? `AND entity_type IN (${wanted.map(() => '?').join(',')})` : '';
      const params = [ftsQuery, ...(wanted ?? []), limit, offset];
      const rows = all(db, `
        SELECT entity_type, entity_id, title,
               snippet(fts_index, 3, '[[', ']]', ' … ', 22) AS snippet,
               bm25(fts_index) AS score
        FROM fts_index
        WHERE fts_index MATCH ? ${typeFilter}
        ORDER BY score ASC
        LIMIT ? OFFSET ?`, params);

      if (rows.length) return decorate(db, rows, query, 'fts5');
    } catch {
      // ES: consulta FTS inválida → caemos al LIKE. Invalid FTS query → fall back to LIKE.
      // PT: consulta FTS inválida → caímos no LIKE.
    }
  }

  // ES: respaldo LIKE sobre los campos de texto principales.
  // EN: LIKE fallback over the main text columns.
  // PT: fallback LIKE sobre as principais colunas de texto.
  const like = `%${String(query ?? '').replace(/[%_]/g, ' ').slice(0, 120)}%`;
  const typeFilter = wanted ? `AND entity_type IN (${wanted.map(() => '?').join(',')})` : '';
  const rows = all(db, `
    SELECT entity_type, entity_id, title, substr(body, 1, 320) AS snippet, 0 AS score
    FROM fts_index
    WHERE (title LIKE ? OR body LIKE ? OR tags LIKE ?) ${typeFilter}
    LIMIT ? OFFSET ?`, [like, like, like, ...(wanted ?? []), limit, offset]);

  return decorate(db, rows, query, 'like');
}

/** @internal ES/EN/PT: añade ruta/fecha/entidad completa a cada resultado. */
function decorate(db, rows, query, engine) {
  const results = rows.map((row, index) => {
    const entity = loadEntity(db, row.entity_type, row.entity_id);
    return {
      rank: index + 1,
      type: row.entity_type,
      id: row.entity_id,
      title: row.title ?? null,
      snippet: cleanSnippet(row.snippet ?? ''),
      score: row.score === null || row.score === undefined ? null : Math.round(Number(row.score) * 10000) / 10000,
      entity,
    };
  });
  return { query, engine, count: results.length, results };
}

/** ES/EN/PT: limpia marcadores y colapsa espacios. Cleans markers and collapses whitespace. */
export function cleanSnippet(snippet) {
  return String(snippet ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * ES: carga la entidad completa según su tipo (para mostrar el detalle).
 * EN: loads the complete entity by type (to display the detail).
 * PT: carrega a entidade completa conforme o tipo (para mostrar o detalhe).
 */
export function loadEntity(db, type, id) {
  const table = {
    message: 'messages', decision: 'decisions', plan: 'plans', action: 'actions', search: 'searches',
    error: 'errors', requirement: 'requirements', lesson: 'lessons', build: 'builds', artifact: 'artifacts',
    node: 'nodes', task: 'tasks', event: 'events', policy: null, phase: null,
  }[type];
  if (!table) return null;
  const row = get(db, `SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return null;
  // ES: devolvemos los JSON ya parseados para que la UI no tenga que hacerlo.
  // EN: we return JSON already parsed so the UI does not have to do it.
  // PT: devolvemos os JSON já parseados para que a UI não precise fazer isso.
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (key.endsWith('_json')) {
      const clean = key.replace(/_json$/, '');
      out[clean] = fromJson(out[key], null);
      delete out[key];
    }
  }
  return out;
}

/**
 * ES: búsqueda exclusiva dentro de mensajes de conversación.
 * EN: search restricted to conversation messages.
 * PT: busca restrita a mensagens de conversa.
 */
export function searchMessages(query, options = {}) {
  const { sessionId = null, limit = 25, role = null, intent = null } = options;
  const db = options.db ?? openDatabase();
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return { query, count: 0, results: [], engine: 'none' };

  const filters = [];
  const params = [ftsQuery];
  if (sessionId) { filters.push('session_id = ?'); params.push(sessionId); }
  if (role) { filters.push('role = ?'); params.push(role); }
  if (intent) { filters.push('intent = ?'); params.push(intent); }
  const where = filters.length ? `AND ${filters.join(' AND ')}` : '';

  try {
    const rows = all(db, `
      SELECT message_id, session_id, role, intent,
             snippet(fts_messages, 4, '[[', ']]', ' … ', 26) AS snippet,
             bm25(fts_messages) AS score
      FROM fts_messages
      WHERE fts_messages MATCH ? ${where}
      ORDER BY score ASC LIMIT ?`, [...params, limit]);
    return { query, engine: 'fts5', count: rows.length, results: rows.map((row, index) => ({ rank: index + 1, ...row, snippet: cleanSnippet(row.snippet) })) };
  } catch {
    const like = `%${String(query).slice(0, 120)}%`;
    const rows = all(db, `SELECT id AS message_id, session_id, role, intent, substr(content,1,320) AS snippet
                          FROM messages WHERE content LIKE ? ${where.replace(/session_id|role|intent/g, (m) => m)} LIMIT ?`, [like, ...params.slice(1), limit]);
    return { query, engine: 'like', count: rows.length, results: rows.map((row, index) => ({ rank: index + 1, ...row, score: null })) };
  }
}

/**
 * ES: TIMELINE cronológico de eventos (sección 10). Sin esto, la historia del
 *     proyecto es un montón de archivos; con esto, es una línea de tiempo.
 * EN: chronological event TIMELINE (section 10). Without it project history is a
 *     pile of files; with it, it is a timeline.
 * PT: TIMELINE cronológico de eventos (seção 10). Sem isso, a história do
 *     projeto é um monte de arquivos; com isso, é uma linha do tempo.
 */
export function timeline(options = {}) {
  const { db = null, sessionId = null, types = null, limit = 200, since = null, until = null, layer = null } = options;
  const handle = db ?? openDatabase();
  const filters = [];
  const params = [];
  if (sessionId) { filters.push('session_id = ?'); params.push(sessionId); }
  if (layer) { filters.push('layer = ?'); params.push(layer); }
  if (Array.isArray(types) && types.length) { filters.push(`type IN (${types.map(() => '?').join(',')})`); params.push(...types); }
  if (since) { filters.push('ts >= ?'); params.push(since); }
  if (until) { filters.push('ts <= ?'); params.push(until); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = all(handle, `SELECT id, type, ts, layer, task, actor, severity, session_id, payload_json
                            FROM events ${where} ORDER BY ts ASC, id ASC LIMIT ?`, [...params, limit]);
  const events = rows.map((row) => ({ ...row, payload: fromJson(row.payload_json, {}) }));

  // ES: agrupamos por día para que la vista sea navegable.
  // EN: we group by day so the view is navigable.
  // PT: agrupamos por dia para que a visão seja navegável.
  const byDay = {};
  for (const event of events) {
    const day = String(event.ts ?? '').slice(0, 10) || 'unknown';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(event);
  }
  return { count: events.length, days: Object.keys(byDay).sort(), by_day: byDay, events };
}

/**
 * ES: responde "¿por qué elegimos X?" (sección 15) encadenando:
 *     DECISION → SEARCHES → SOURCES → IMPLEMENTATION → RESULT.
 * EN: answers "why did we choose X?" (section 15) by chaining:
 *     DECISION → SEARCHES → SOURCES → IMPLEMENTATION → RESULT.
 * PT: responde "por que escolhemos X?" (seção 15) encadeando:
 *     DECISION → SEARCHES → SOURCES → IMPLEMENTATION → RESULT.
 */
export function whyDidWeChoose(term, options = {}) {
  const { limit = 6 } = options;
  const db = options.db ?? openDatabase();
  const found = search(term, { db, types: ['decision'], limit });

  const chains = [];
  for (const hit of found.results) {
    const decision = hit.entity;
    if (!decision) continue;
    const haystack = `${decision.decision ?? ''} ${decision.justification ?? ''} ${decision.objective_en ?? ''}`.toLowerCase();
    const relatedSearches = all(db, 'SELECT * FROM searches').filter((row) => {
      const influenced = fromJson(row.influenced_json, []) ?? [];
      const text = `${row.query ?? ''} ${row.why ?? ''} ${row.reason ?? ''}`.toLowerCase();
      return influenced.includes(decision.id) || text.includes(term.toLowerCase());
    });
    const sources = [...new Set(relatedSearches.flatMap((row) => fromJson(row.sources_json, []) ?? []))];
    const implementation = all(db, `SELECT id, action, tool, result, status, ts FROM actions WHERE lower(action) LIKE ? OR lower(result) LIKE ? LIMIT 10`, [`%${haystack.split(' ')[0] ?? term}%`, `%${term.toLowerCase()}%`]);
    const lessons = all(db, 'SELECT id, lesson FROM lessons WHERE lower(lesson) LIKE ? LIMIT 5', [`%${String(term).toLowerCase()}%`]);

    chains.push({
      term,
      decision: { id: decision.id, decision: decision.decision, status: decision.status, justification: decision.justification, consequence: decision.consequence, layer: decision.layer, alternatives: fromJson(decision.alternatives, []) },
      searches: relatedSearches.map((row) => ({ id: row.id, query: row.query, reason: row.reason, selected: row.selected, why: row.why })),
      sources,
      implementation,
      lessons,
    });
  }
  return { term, count: chains.length, chains };
}

/** ES/EN/PT: recuentos por tipo de entidad, para facetar la interfaz. Counts per entity type for UI facets. */
export function facets(db) {
  return Object.fromEntries(
    all(db, 'SELECT entity_type, COUNT(*) AS n FROM fts_index GROUP BY entity_type ORDER BY n DESC')
      .map((row) => [row.entity_type, Number(row.n)]),
  );
}

/** ES/EN/PT: palabras más frecuentes del conocimiento (nube de tags). */
export function topTags(db, limit = 30) {
  /*
   * ES: OJO con las comillas en SQL. En SQLite, "texto" (comillas DOBLES) es un
   *     IDENTIFICADOR (nombre de columna/tabla); 'texto' (comillas simples) es un
   *     LITERAL de cadena. Escribir `tags <> ""` hace que SQLite busque una
   *     columna llamada "" y falle con "no such column". Regla: cadenas → simples.
   * EN: mind SQL quoting. In SQLite, "text" (DOUBLE quotes) is an IDENTIFIER
   *     (a column/table name); 'text' (single quotes) is a string LITERAL.
   *     Writing `tags <> ""` makes SQLite look for a column named "" and fail
   *     with "no such column". Rule: strings use single quotes.
   * PT: cuidado com aspas no SQL. Aspas DUPLAS = identificador; aspas simples =
   *     literal de string. Regra: strings usam aspas simples.
   */
  const rows = all(db, "SELECT tags FROM fts_index WHERE tags IS NOT NULL AND tags <> ''");
  const counts = new Map();
  for (const row of rows) {
    for (const tag of String(row.tags ?? '').split(/\s+/)) {
      const clean = tag.trim().toLowerCase();
      if (clean.length < 3 || STOPWORDS.has(clean)) continue;
      counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, n]) => ({ tag, n }));
}

export default { toFtsQuery, search, searchMessages, timeline, whyDidWeChoose, facets, topTags, loadEntity, cleanSnippet, STOPWORDS };

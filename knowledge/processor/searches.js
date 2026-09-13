/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/searches.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: convierte cada BÚSQUEDA en un evento documentado
 *     (sección 15 de la arquitectura):
 *         SEARCH-00931
 *         Query:    "best open source agent orchestration..."
 *         Reason:   Architecture research
 *         Sources:  ...
 *         Selected: ...
 *         Why:      ...
 *         Influenced decisions: DEC-044, DEC-045
 *     POR QUÉ EXISTE: sin esto, la pregunta "¿por qué elegimos LangGraph?" es
 *     imposible de responder. Con esto, se puede navegar
 *     DECISION → SEARCHES → SOURCES → COMPARISON → IMPLEMENTATION → RESULT.
 *     La búsqueda deja de ser un paso invisible y se vuelve evidencia auditable.
 *
 * 🇬🇧 EN — WHAT IT DOES: turns every SEARCH into a documented event
 *     (architecture section 15): query, reason, sources, selection, why and the
 *     decisions it influenced.
 *     WHY IT EXISTS: without it, the question "why did we choose LangGraph?" is
 *     unanswerable. With it you can navigate DECISION → SEARCHES → SOURCES →
 *     COMPARISON → IMPLEMENTATION → RESULT. Searching stops being an invisible
 *     step and becomes auditable evidence.
 *
 * 🇧🇷 PT — O QUE FAZ: converte cada BUSCA em um evento documentado (seção 15):
 *     query, motivo, fontes, seleção, porquê e as decisões que influenciou.
 *     POR QUE EXISTE: sem isso, a pergunta "por que escolhemos LangGraph?" é
 *     impossível de responder. Com isso, navega-se
 *     DECISION → SEARCHES → SOURCES → COMPARISON → IMPLEMENTATION → RESULT.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Proveniencia ES/EN/PT: palabra técnica para "de dónde salió este dato".
 *     En ciencia de datos y en auditoría es obligatoria: una conclusión sin
 *     proveniencia es una opinión. Aquí la proveniencia es la tabla `searches`
 *     más su campo `influenced_json`.
 *     Provenance = "where did this data come from". Without it, a conclusion is an opinion.
 *   • Relación muchos-a-muchos ES/EN/PT: una búsqueda puede influir en varias
 *     decisiones y una decisión puede apoyarse en varias búsquedas. Eso no se
 *     modela con una columna, sino con una lista (aquí JSON) o una tabla de
 *     enlace. A search can influence many decisions and vice versa.
 *   • Cita de fuentes ES/EN/PT: guardamos la URL tal cual y el motivo de la
 *     selección. Si la fuente desaparece, al menos queda constancia de qué se
 *     consultó y por qué se prefirió.
 *     Store the URL and the reason it was preferred, even if the source dies.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, toJson, indexEntity } from '../db/index.js';
import { normalizeText, extractLinks } from '../../core/capture/message-parser.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

const SEARCH_LABELS = Object.freeze({
  query: ['query', 'búsqueda', 'busqueda', 'busca', 'search', 'término', 'term', 'pregunta'],
  reason: ['reason', 'razón', 'razon', 'motivo', 'why searching', 'propósito', 'purpose', 'objetivo'],
  sources: ['sources', 'fuentes', 'fontes', 'results', 'resultados', 'links', 'references', 'referencias'],
  selected: ['selected', 'seleccionado', 'seleção', 'seleccion', 'chosen', 'elegido', 'pick', 'escogido'],
  why: ['why', 'por qué', 'por que', 'justification', 'justificación', 'razón de selección', 'reason selected'],
  influenced: ['influenced decisions', 'influenced', 'decisiones influenciadas', 'affects', 'afecta', 'fed into', 'derived decisions'],
});

const HEADER_RE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:search|b[uú]squeda|busca)\s*(?:#?\s*(?:SRC|SEARCH)?[-\s]?\d{1,6})?\s*(?:\*\*)?\s*:?\s*(?<rest>.*)$/gim;

function labelOf(line) {
  const match = /^\s*(?:[-*•>#]+\s*)?(?:\*\*)?([a-záéíóúñüàâãçõ ]{3,26})(?:\*\*)?\s*[:\-—]\s*(?<value>.*)$/i.exec(line);
  if (!match) return null;
  const key = match[1].toLowerCase().trim();
  for (const [field, labels] of Object.entries(SEARCH_LABELS)) {
    if (labels.includes(key)) return { field, value: match.groups.value.replace(/\*\*/g, '').trim() };
  }
  return null;
}

/**
 * ES: extrae búsquedas documentadas de un texto.
 * EN: extracts documented searches from a text.
 * PT: extrai buscas documentadas de um texto.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function extractSearches(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const found = [];
  let current = null;

  const flush = () => {
    if (current?.query) found.push(current);
    current = null;
  };

  for (const line of lines) {
    const headerMatch = new RegExp(HEADER_RE.source, 'im').exec(line);
    const labelled = labelOf(line);

    // ES: "SEARCH-00001" encaja a la vez como cabecera y como campo `query`
    //     (porque "search" está en la lista de sinónimos de query y el guion
    //     actúa de separador). La cabecera GANA cuando lo que sigue es un número
    //     o está vacío; si no, ganarían los dígitos y perderíamos la búsqueda real.
    //     Bug real detectado en la sesión de prueba y corregido.
    // EN: "SEARCH-00001" matches both as a header and as a `query` field (because
    //     "search" is a query synonym and the dash acts as separator). The header
    //     WINS when what follows is a number or empty; otherwise the digits would
    //     win and we would lose the real search. Real bug found and fixed.
    // PT: "SEARCH-00001" encaixa ao mesmo tempo como cabeçalho e como campo
    //     `query`. O cabeçalho VENCE quando o que segue é um número ou está vazio;
    //     senão, os dígitos venceriam e perderíamos a busca real. Bug real corrigido.
    const labelledValue = String(labelled?.value ?? '').trim();
    const headerWins = Boolean(headerMatch) && (!labelled || labelledValue === '' || /^\d{1,6}$/.test(labelledValue));

    if (headerWins) {
      // ES: cabecera de búsqueda nueva ("SEARCH-00931" o "### Búsqueda").
      // EN: header of a new search ("SEARCH-00931" or "### Search").
      // PT: cabeçalho de uma nova busca ("SEARCH-00931" ou "### Busca").
      flush();
      // ES: el ID numérico puede estar en la línea completa ("SEARCH-00001"),
      //     no solo en el resto capturado.
      // EN: the numeric ID may live in the whole line ("SEARCH-00001"), not only
      //     in the captured rest.
      // PT: o ID numérico pode estar na linha inteira ("SEARCH-00001"), não só no
      //     resto capturado.
      const digits = /\d{1,6}/.exec(headerMatch.groups?.rest ?? '')?.[0] ?? /\d{1,6}/.exec(line)?.[0] ?? null;
      const inlineQuery = String(headerMatch.groups?.rest ?? '').replace(/^["']|["']$/g, '').trim();
      current = {
        id: digits ? `${ID_PREFIX.search}-${String(digits).padStart(5, '0')}` : null,
        query: inlineQuery && !/^\d{1,6}$/.test(inlineQuery) ? inlineQuery : null,
        reason: null, sources: [], selected: null, why: null, influenced: [],
      };
      continue;
    }

    if (labelled?.field === 'query') {
      if (current?.query && current.query !== labelled.value) flush();
      current = current ?? { id: null, query: null, reason: null, sources: [], selected: null, why: null, influenced: [] };
      current.query = labelled.value.replace(/^["']|["']$/g, '').trim();
      continue;
    }

    if (current && labelled) {
      if (labelled.field === 'sources') {
        current.sources = [...new Set([...current.sources, ...extractLinks(labelled.value), ...labelled.value.split(/[,;|\n]/).map((s) => s.trim()).filter((s) => s.length > 3)])];
      } else if (labelled.field === 'influenced') {
        const refs = labelled.value.match(/\b(?:DEC|DECISION)-?\d{2,6}\b/gi) ?? [];
        current.influenced = [...new Set([...current.influenced, ...refs.map((r) => {
          const digits = /\d+/.exec(r)[0];
          return `DEC-${digits.padStart(5, '0')}`;
        })])];
      } else {
        current[labelled.field] = labelled.value;
      }
      continue;
    }

    if (current && line.trim() && !/^\s*(?:#{1,6}|```)/.test(line)) {
      // ES: cualquier URL suelta dentro del bloque cuenta como fuente.
      // EN: any loose URL inside the block counts as a source.
      // PT: qualquer URL solta dentro do bloco conta como fonte.
      const links = extractLinks(line);
      if (links.length) current.sources = [...new Set([...current.sources, ...links])];
    }
  }
  flush();

  return found.filter((item) => item.query && item.query.length > 2);
}

/**
 * ES: guarda búsquedas y las vincula con las decisiones que influenciaron.
 * EN: stores searches and links them with the decisions they influenced.
 * PT: guarda buscas e as vincula com as decisões que influenciaram.
 */
export function persistSearches(searches, options = {}) {
  const { bus = null, sessionId = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(searches) || !searches.length) return { persisted: 0, ids: [] };

  // ES: ⚠️ IDEMPOTENCIA CORREGIDA: antes, si la búsqueda traía un ID explícito ya
  //     existente (SRC-00001), se acuñaba uno nuevo (SRC-00002) y la misma búsqueda
  //     quedaba duplicada en cada reprocesado. Ahora: si trae ID, se ACTUALIZA ese
  //     registro (el SQL ya lleva ON CONFLICT DO UPDATE); si no trae ID, buscamos
  //     una búsqueda previa con la misma query normalizada.
  // EN: ⚠️ IDEMPOTENCY FIXED: previously, when a search carried an explicit ID that
  //     already existed (SRC-00001), a new one was minted (SRC-00002) and the same
  //     search was duplicated on every reprocess. Now: with an ID we UPDATE that row
  //     (the SQL already has ON CONFLICT DO UPDATE); without an ID we look for a
  //     previous search with the same normalized query.
  // PT: ⚠️ IDEMPOTÊNCIA CORRIGIDA: antes, se a busca trazia um ID explícito já
  //     existente, era cunhado um novo e a mesma busca ficava duplicada a cada
  //     reprocessamento. Agora: com ID, ATUALIZAMOS aquele registro; sem ID,
  //     procuramos uma busca anterior com a mesma query normalizada.
  const existingRows = db.prepare('SELECT id, query FROM searches').all();
  const existing = existingRows.map((r) => r.id);
  const normalizeQuery = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ids = [];
  const now = new Date().toISOString();

  const result = tx(db, (handle) => {
    for (const search of searches) {
      let id = search.id ?? null;
      if (!id) {
        const sameQuery = existingRows.find((row) => normalizeQuery(row.query) === normalizeQuery(search.query));
        id = sameQuery?.id ?? null;
      }
      if (!id) {
        id = nextId(ID_PREFIX.search, existing);
        while (existing.includes(id)) id = nextId(ID_PREFIX.search, [...existing, id]);
      }
      if (!existing.includes(id)) { existing.push(id); existingRows.push({ id, query: search.query }); }
      ids.push(id);

      handle.prepare(`INSERT INTO searches (id, session_id, query, reason, sources_json, selected, why, influenced_json, ts)
                      VALUES (?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET query = excluded.query, sources_json = excluded.sources_json, selected = excluded.selected, influenced_json = excluded.influenced_json`).run(
        id, sessionId, String(search.query).slice(0, 1000), search.reason ?? null, toJson(search.sources ?? []),
        search.selected ?? null, search.why ?? null, toJson(search.influenced ?? []), now,
      );

      indexEntity(handle, {
        entityType: 'search', entityId: id,
        title: `${id} · ${String(search.query).slice(0, 160)}`,
        body: [search.query, search.reason, search.selected, search.why, (search.sources ?? []).join(' '), (search.influenced ?? []).join(' ')].filter(Boolean).join('\n'),
        tags: ['search', sessionId, ...(search.influenced ?? [])],
      });

      bus?.emit('SEARCH_PERFORMED', {
        id, query: String(search.query).slice(0, 240), reason: search.reason ?? null,
        sources: (search.sources ?? []).length, influenced: search.influenced ?? [],
      }, { layer: 'knowledge' });
    }
    return ids.length;
  });

  return { persisted: result.ok ? result.value : 0, ids, error: result.ok ? null : result.error };
}

/**
 * ES: la cadena de proveniencia de una decisión (sección 15):
 *     DECISION → SEARCHES → SOURCES → IMPLEMENTATION → RESULT.
 * EN: the provenance chain of a decision (section 15).
 * PT: a cadeia de proveniência de uma decisão (seção 15).
 */
export function provenanceChain(db, decisionId) {
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
  if (!decision) return null;

  const searches = db.prepare('SELECT * FROM searches').all()
    .filter((row) => {
      const influenced = JSON.parse(row.influenced_json ?? '[]');
      const query = `${row.query ?? ''} ${row.why ?? ''} ${row.reason ?? ''}`.toLowerCase();
      const decisionText = `${decision.decision ?? ''} ${decision.justification ?? ''}`.toLowerCase();
      return influenced.includes(decisionId) || (decisionText.length > 12 && query.length > 12 && decisionText.split(/\s+/).some((word) => word.length > 6 && query.includes(word)));
    });

  return {
    decision: { id: decision.id, decision: decision.decision, status: decision.status, justification: decision.justification },
    searches: searches.map((row) => ({
      id: row.id,
      query: row.query,
      reason: row.reason,
      sources: JSON.parse(row.sources_json ?? '[]'),
      selected: row.selected,
      why: row.why,
    })),
    sources: [...new Set(searches.flatMap((row) => JSON.parse(row.sources_json ?? '[]')))],
    related_actions: db.prepare('SELECT * FROM actions WHERE task = ? OR action LIKE ?').all(decision.layer ?? '', `%${String(decision.decision ?? '').split(' ')[0] ?? ''}%`).slice(0, 10),
  };
}

export default { extractSearches, persistSearches, provenanceChain };

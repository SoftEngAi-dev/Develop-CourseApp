/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/decisions.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: detecta DECISIONES dentro de texto libre y las convierte
 *     en Decision Traces estructurados. Reconoce el formato humano que usamos
 *     en las conversaciones:
 *         DECISIÓN #00421
 *         Objetivo:  Crear persistencia...
 *         Contexto:  El sistema debe sobrevivir...
 *         Opciones:  A. JSON  B. SQLite  C. PostgreSQL
 *         Decisión:  SQLite + archivos JSON
 *         Motivo:    Menor complejidad inicial...
 *         Consecuencia: Puede evolucionar a PostgreSQL
 *         Estado:    APROBADO
 *     Acepta las etiquetas en español, inglés y portugués.
 *     POR QUÉ EXISTE (DEC-00003): no guardamos el razonamiento privado del
 *     modelo; guardamos la decisión explicable. Este módulo es el que convierte
 *     prosa en estructura consultable, y el que hace posible responder
 *     "¿por qué elegimos LangGraph?" navegando decisión → búsquedas → fuentes.
 *
 * 🇬🇧 EN — WHAT IT DOES: detects DECISIONS inside free text and turns them into
 *     structured Decision Traces. It recognizes the human format used in the
 *     conversations (DECISION #00421 / Objective / Context / Options / Decision /
 *     Reason / Consequence / Status) and accepts the labels in Spanish, English
 *     and Portuguese.
 *     WHY IT EXISTS (DEC-00003): we do not store a model's private reasoning; we
 *     store the explainable decision. This module turns prose into queryable
 *     structure, making "why did we choose X?" answerable.
 *
 * 🇧🇷 PT — O QUE FAZ: detecta DECISÕES dentro de texto livre e as converte em
 *     Decision Traces estruturados. Reconhece o formato humano usado nas
 *     conversas (DECISÃO #00421 / Objetivo / Contexto / Opções / Decisão /
 *     Motivo / Consequência / Status) e aceita os rótulos em espanhol, inglês e
 *     português.
 *     POR QUE EXISTE (DEC-00003): não guardamos o raciocínio privado do modelo;
 *     guardamos a decisão explicável.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Parsing de texto ES/EN/PT: "parsear" es convertir texto en datos. La
 *     técnica aquí es un "parser de secciones": buscamos etiquetas conocidas y
 *     guardamos todo lo que hay entre una etiqueta y la siguiente. Es la misma
 *     idea que un lector de archivos .ini o de cabeceras HTTP.
 *     Parsing = turning text into data; here, a section parser keyed by labels.
 *   • Expresión regular con grupos nombrados ES/EN/PT:
 *     `/^(?<label>Objetivo|Objective)\s*:\s*(?<value>.+)$/im`
 *       ^ = inicio de línea (con /m), (?<name>...) = grupo con nombre,
 *       \s* = cero o más espacios, .+ = uno o más caracteres cualesquiera,
 *       /i = ignora mayúsculas, /m = "^" significa inicio de CADA línea.
 *     Luego `match.groups.label` te da el grupo por su nombre. Mucho más legible
 *     que recordar si era el grupo 1 o el 2.
 *     Named groups make regexes readable: match.groups.label.
 *   • Normalización de estado ES/EN/PT: "APROBADO", "approved", "Aprovado" son
 *     el mismo estado. Los pasamos todos a minúscula y los mapeamos a un
 *     vocabulario cerrado. Sin esto tendrías 6 estados que significan lo mismo.
 *     Map synonyms onto a closed vocabulary; otherwise you get 6 equal states.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, run, tx, toJson, fromJson, indexEntity } from '../db/index.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

// ES/EN/PT: identidad. Mantiene el bucle legible y permite filtrar aquí en el futuro.
// Identity helper: keeps the loop readable and allows filtering here later.
function traits(traces) { return traces; }
import { normalizeText } from '../../core/capture/message-parser.js';

/** ES/EN/PT: sinónimos trilingües de cada campo del Decision Trace. */
const FIELD_LABELS = Object.freeze({
  objective: ['objetivo', 'objective', 'goal', 'meta', 'objetivo'],
  context: ['contexto', 'context', 'situación', 'situacion', 'contexto utilizado'],
  constraints: ['restricciones', 'constraints', 'limitaciones', 'restricoes', 'limitações'],
  alternatives: ['opciones', 'options', 'alternativas', 'alternatives', 'candidatos'],
  decision: ['decisión', 'decision', 'decisao', 'elegimos', 'we choose', 'escolha'],
  justification: ['motivo', 'reason', 'justificación', 'justification', 'justificativa', 'por qué', 'why', 'porque'],
  consequence: ['consecuencia', 'consequence', 'impacto', 'impact', 'resultado esperado'],
  status: ['estado', 'status', 'state', 'situación'],
  action: ['acción', 'action', 'acao'],
  result: ['resultado', 'result', 'output'],
  verification: ['verificación', 'verification', 'verificacao', 'prueba', 'test'],
  learning: ['aprendizaje', 'learning', 'lesson', 'lección', 'licao'],
});

const STATUS_MAP = Object.freeze({
  aprobado: 'approved', approved: 'approved', aprovad: 'approved', aceptado: 'approved', accepted: 'approved',
  propuesto: 'proposed', proposed: 'proposed', pendiente: 'proposed', pending: 'proposed',
  rechazado: 'rejected', rejected: 'rejected', descartado: 'rejected', declined: 'rejected',
  bloqueado: 'blocked', blocked: 'blocked',
  superseded: 'superseded', sustituido: 'superseded', superada: 'superseded',
});

function buildLabelRegex() {
  const all = [];
  for (const [field, labels] of Object.entries(FIELD_LABELS)) {
    for (const label of labels) all.push({ field, label });
  }
  const alternatives = all.map((entry) => `${entry.label}`).join('|');
  return new RegExp(`^\\s*(?:[-*•#>]+\\s*)?(?:\\*\\*)?(${alternatives})(?:\\*\\*)?\\s*[:\\-—]\\s*(.*)$`, 'im');
}

const LABEL_LOOKUP = (() => {
  const map = new Map();
  for (const [field, labels] of Object.entries(FIELD_LABELS)) {
    for (const label of labels) map.set(label.toLowerCase(), field);
  }
  return map;
})();

/** ES/EN/PT: normaliza un estado a vocabulario cerrado. Normalizes status to a closed vocabulary. */
export function normalizeStatus(value) {
  const key = String(value ?? '').toLowerCase().replace(/[^a-záéíóúñüàâãçõ]/g, '').trim();
  for (const [pattern, canonical] of Object.entries(STATUS_MAP)) {
    if (key.startsWith(pattern)) return canonical;
  }
  return 'proposed';
}

/**
 * ES: parsea las "Opciones: A. JSON B. SQLite" en una lista estructurada.
 * EN: parses "Options: A. JSON B. SQLite" into a structured list.
 * PT: faz o parse de "Opções: A. JSON B. SQLite" numa lista estruturada.
 */
export function parseAlternatives(text) {
  if (!text) return [];
  // ES: primero cortamos por saltos de línea / punto y coma / barra / doble espacio.
  // EN: first we cut by newlines / semicolons / pipes / double spaces.
  // PT: primeiro cortamos por quebras de linha / ponto e vírgula / barra / espaço duplo.
  let inline = String(text).split(/\s{2,}|\n|;|\|/).map((part) => part.trim()).filter(Boolean);

  // ES: y dentro de cada trozo, volvemos a cortar antes de cada letra+ punto
  //     ("A. JSON B. SQLite" -> ["A. JSON", "B. SQLite"]). El lookahead (?=...)
  //     mira sin consumir, así la letra no se pierde.
  // EN: inside each chunk we cut again before every letter+dot
  //     ("A. JSON B. SQLite" -> ["A. JSON", "B. SQLite"]). The lookahead (?=...)
  //     inspects without consuming, so the letter is not lost.
  // PT: dentro de cada trecho, cortamos de novo antes de cada letra+ponto.
  //     O lookahead (?=...) inspeciona sem consumir, então a letra não se perde.
  const resplit = [];
  for (const chunk of inline) {
    const parts = chunk.split(/(?=(?:^|\s)[A-Z][.)]\s)/).map((p) => p.trim()).filter(Boolean);
    resplit.push(...(parts.length ? parts : [chunk]));
  }
  inline = resplit;

  const out = [];
  for (const chunk of inline) {
    // ES: "A. JSON" o "A) JSON" o "(A) JSON" o simplemente "JSON"
    const match = /^[\(\[]?(?<id>[A-Z])[.)\]]?\s*[:\-]?\s*(?<option>.+)$/.exec(chunk);
    if (match && match.groups.option) {
      /*
       * ES: ⚠️ BUG CORREGIDO POR LA SUITE DE VERIFICACIÓN: antes usábamos
       *     /\b(elegid|...)\b/ — el \b final exige un límite de palabra justo
       *     después de "elegid", pero "ELEGIDA" sigue con "a" (otra letra) y NUNCA
       *     matcheaba. Ahora comparamos por RAÍZ (stem), sin \b final: "elegid"
       *     atrapa elegida/elegido/ELEGIDA, "aprobado" atrapa aprobada, etc.
       * EN: BUG FIXED BY THE VERIFICATION SUITE: the old /\b(elegid|...)\b/ could
       *     never match "ELEGIDA" because \b requires a word boundary right after
       *     the stem. We now match stems without a trailing \b.
       * PT: BUG CORRIGIDO PELA SUÍTE: o \b final impedia "ELEGIDA" de casar;
       *     agora comparamos pela raiz, sem \b final.
       */
      out.push({ id: match.groups.id, option: match.groups.option.trim(), selected: /(elegid|select|chosen|aprobado|aprovado|✓|✅)/i.test(match.groups.option) });
    } else if (chunk.length > 1) {
      out.push({ id: null, option: chunk, selected: false });
    }
  }
  return out;
}

/** ES/EN/PT: convierte una lista textual en array (por comas, saltos o viñetas). */
export function parseList(text) {
  if (!text) return [];
  return String(text)
    .split(/\n|\s{2,}|;|,|\|/)
    .map((part) => part.replace(/^\s*(?:[-*•\d.]+)\s*/, '').trim())
    .filter((part) => part.length > 2);
}

/**
 * ES: busca bloques de decisión en un texto. Un bloque empieza con una cabecera
 *     reconocible ("DECISIÓN #00421", "Decision:", "DEC-00007", "### Decisión")
 *     y termina en la siguiente cabecera o al final del texto.
 * EN: finds decision blocks in a text. A block starts with a recognizable header
 *     ("DECISIÓN #00421", "Decision:", "DEC-00007", "### Decisión") and ends at
 *     the next header or at the end of the text.
 * PT: procura blocos de decisão num texto. Um bloco começa com um cabeçalho
 *     reconhecível e termina no próximo cabeçalho ou no fim do texto.
 *
 * @param {string} text
 * @returns {object[]} Decision Trace drafts
 */
export function extractDecisionTraces(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // ES: cabecera de bloque. Aceptamos SOLO si (a) es un título markdown,
  //     (b) trae un número/ID explícito ("DECISIÓN #00421", "DEC-00007"),
  //     (c) dice "Decision Trace", o (d) es la etiqueta sola sin contenido
  //     ("Decisión:"). Si no, la línea es un CAMPO del bloque anterior
  //     ("Decisión: SQLite + JSON") y NO debe abrir un bloque nuevo: si la
  //     aceptáramos, partiríamos cada trace en pedazos vacíos.
  // EN: block header. We accept ONLY if (a) it is a markdown title, (b) it
  //     carries an explicit number/ID ("DECISIÓN #00421", "DEC-00007"),
  //     (c) it says "Decision Trace", or (d) it is the bare label with no
  //     content ("Decisión:"). Otherwise the line is a FIELD of the previous
  //     block ("Decisión: SQLite + JSON") and must NOT open a new block: if we
  //     accepted it, we would slice every trace into empty pieces.
  // PT: cabeçalho de bloco. Aceitamos SOMENTE se (a) for título markdown,
  //     (b) trouxer número/ID explícito, (c) disser "Decision Trace" ou
  //     (d) for o rótulo sozinho sem conteúdo. Caso contrário, a linha é um
  //     CAMPO do bloco anterior e NÃO deve abrir um bloco novo.
  const headerRe = /^(?<hashes>#{1,6}\s+)?(?<stars>\*\*\s*)?(?<label>decision\s+trace|decisi[oó]n|decis[aã]o|decision)\s*(?<num>#?\s*(?:[A-Z]{2,4}[-\s]?)?\d{1,6}\b)?\s*(?:\*\*)?\s*(?<colon>:?)\s*(?<rest>.*)$/gim;
  const headers = [];
  let match;
  while ((match = headerRe.exec(normalized)) !== null) {
    const groups = match.groups ?? {};
    const label = String(groups.label ?? '').toLowerCase().replace(/\s+/g, ' ');
    const rest = String(groups.rest ?? '').trim();
    const isHeading = Boolean(groups.hashes);
    const hasId = Boolean(groups.num);
    const isBareLabel = groups.colon === ':' && rest === '';
    const isTracePhrase = label === 'decision trace';

    if (!isHeading && !hasId && !isBareLabel && !isTracePhrase) continue;

    const digits = /\d{1,6}/.exec(groups.num ?? '')?.[0] ?? null;
    headers.push({
      index: match.index,
      end: headerRe.lastIndex,
      inlineTitle: rest,
      full: match[0],
      explicitId: digits ? `DEC-${String(digits).padStart(5, '0')}` : null,
    });
  }

  // ES: también aceptamos IDs sueltos tipo "DEC-00007" como inicio de bloque.
  // EN: we also accept loose IDs like "DEC-00007" as a block start.
  // PT: também aceitamos IDs soltos como "DEC-00007" como início de bloco.
  const idRe = /^\s*\b(?<id>DEC-\d{2,6})\b\s*$/gm;
  while ((match = idRe.exec(normalized)) !== null) {
    headers.push({ index: match.index, end: idRe.lastIndex, inlineTitle: '', explicitId: match.groups.id });
  }

  if (!headers.length) return [];
  headers.sort((a, b) => a.index - b.index);

  const labelRegex = buildLabelRegex();
  const traces = [];

  headers.forEach((header, position) => {
    const start = header.end;
    const stop = headers[position + 1]?.index ?? normalized.length;
    const block = normalized.slice(start, stop);
    if (block.trim().length < 12) return;

    const fields = {};
    const lines = block.split('\n');
    let currentField = null;
    // ES: `closed` impide seguir añadiendo texto a un campo después de una línea
    //     en blanco. Sin esto, el campo "justificación" se tragaba párrafos enteros
    //     de otras secciones.
    // EN: `closed` stops appending text to a field after a blank line. Without it
    //     the "justification" field swallowed whole paragraphs from other sections.
    // PT: `closed` impede continuar acrescentando texto a um campo depois de uma
    //     linha em branco. Sem isso, o campo "justificativa" engolia parágrafos
    //     inteiros de outras seções.
    let closed = false;

    // ES: ⚠️ BUG REAL CORREGIDO — TERMINADOR DE BLOQUE. Un bloque de decisión
    //     terminaba solo al encontrar la SIGUIENTE cabecera de decisión. Todo lo
    //     que hubiera en medio (bloques SEARCH, mensajes USER, errores...) se
    //     acumulaba como "continuación" del último campo, contaminando el
    //     Decision Trace: la justificación de DEC-00002 acabó conteniendo
    //     "Influenced decisions: DEC-00002..." y el mensaje siguiente del usuario.
    //     Ahora el bloque también termina en cualquier marcador extranjero.
    // EN: ⚠️ REAL BUG FIXED — BLOCK TERMINATOR. A decision block used to end only at
    //     the NEXT decision header. Everything in between (SEARCH blocks, USER
    //     messages, errors...) accumulated as "continuation" of the last field,
    //     contaminating the Decision Trace: DEC-00002's justification ended up
    //     containing "Influenced decisions: DEC-00002..." and the next user message.
    //     Now the block also ends at any foreign marker.
    // PT: ⚠️ BUG REAL CORRIGIDO — TERMINADOR DE BLOCO. Um bloco de decisão terminava
    //     apenas ao encontrar o PRÓXIMO cabeçalho de decisão. Tudo no meio (blocos
    //     SEARCH, mensagens USER, erros...) se acumulava como "continuação" do
    //     último campo, contaminando o Decision Trace. Agora o bloco também termina
    //     em qualquer marcador estranho.
    const FOREIGN = /^\s*(?:#{1,6}\s|```|(?:user|usuario|usuário|assistant|ia|ai|agent|agente|system|sistema|tool|herramienta)\s*[:\-—]|(?:search|b[uú]squeda|busca)(?:-?\s*\d{1,6})?\s*(?:[:\-—]|$)|(?:error|err|analysis|an[aá]lisis|recovery|recuperaci[oó]n|soluci[oó]n)\s*[:\-—]|[-*_]{3,}\s*$)/i;

    for (const line of lines) {
      if (FOREIGN.test(line)) break;
      if (!line.trim()) { closed = true; continue; }
      // ES: cada línea se prueba contra TODAS las etiquetas conocidas.
      // EN: each line is tested against ALL known labels.
      // PT: cada linha é testada contra TODOS os rótulos conhecidos.
      const single = new RegExp(labelRegex.source, 'i').exec(line);
      if (single) {
        currentField = LABEL_LOOKUP.get(String(single[1]).toLowerCase()) ?? null;
        const value = (single[2] ?? '').replace(/\*\*/g, '').trim();
        if (currentField) fields[currentField] = value;
        // ES: una etiqueta nueva reabre la acumulación de continuación.
        // EN: a new label re-opens continuation accumulation.
        // PT: um rótulo novo reabre o acúmulo de continuação.
        closed = false;
        continue;
      }
      const trimmed = line.trim();
      if (currentField && trimmed && !closed && (fields[currentField] ?? '').length < 1200) {
        fields[currentField] = `${fields[currentField] ?? ''}\n${trimmed}`.trim();
      }
    }

    const decisionText = (fields.decision ?? header.inlineTitle ?? '').trim();
    if (!decisionText && !fields.objective) return;

    const explicitId = header.explicitId ?? /(?:\b(?:DEC|DECISION)-?#?\s*(\d{2,6})\b)/i.exec(header.full)?.[1] ?? null;

    traces.push({
      // ES: `explicitId` ya puede venir formateado ("DEC-00002") o ser solo dígitos
      //     ("00002"). Normalizamos sin duplicar el prefijo — bug real corregido.
      // EN: `explicitId` may already be formatted ("DEC-00002") or be digits only
      //     ("00002"). We normalize without duplicating the prefix — real bug fixed.
      // PT: `explicitId` já pode vir formatado ("DEC-00002") ou ser só dígitos.
      //     Normalizamos sem duplicar o prefixo — bug real corrigido.
      id: explicitId
        ? (/^DEC-\d+$/.test(explicitId) ? explicitId : `DEC-${String(explicitId).replace(/\D/g, '').padStart(5, '0')}`)
        : null,
      objective: (fields.objective ?? '').trim() || null,
      context: (fields.context ?? '').trim() || null,
      constraints: parseList(fields.constraints),
      alternatives: parseAlternatives(fields.alternatives),
      decision: decisionText || null,
      justification: (fields.justification ?? '').trim() || null,
      consequence: (fields.consequence ?? '').trim() || null,
      status: normalizeStatus(fields.status),
      action: (fields.action ?? '').trim() || null,
      result: (fields.result ?? '').trim() || null,
      verification: (fields.verification ?? '').trim() || null,
      learning: (fields.learning ?? '').trim() || null,
      source_excerpt: block.trim().slice(0, 1200),
      fields_detected: Object.keys(fields),
    });
  });

  // ES: deduplicamos por texto de decisión (mismo bloque citado dos veces).
  // EN: deduplicate by decision text (the same block quoted twice).
  // PT: deduplicamos pelo texto da decisão (mesmo bloco citado duas vezes).
  const seen = new Set();
  return traces.filter((trace) => {
    const key = `${trace.decision ?? ''}|${trace.objective ?? ''}`.toLowerCase().slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * ES: guarda Decision Traces en la base, asignando IDs si no traen uno.
 * EN: stores Decision Traces in the database, assigning IDs when they lack one.
 * PT: guarda Decision Traces no banco, atribuindo IDs quando não têm um.
 *
 * @param {object[]} traces
 * @param {{ db?: object, bus?: object, sessionId?: string, layer?: string, existingIds?: string[] }} [options]
 */
export function persistDecisionTraces(traces, options = {}) {
  const { bus = null, sessionId = null, layer = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(traces) || !traces.length) return { persisted: 0, ids: [] };

  const existing = options.existingIds ?? db.prepare('SELECT id FROM decisions').all().map((r) => r.id);
  let nextNumber = existing.reduce((max, id) => {
    const n = Number.parseInt(/(\d+)$/.exec(id)?.[1] ?? '0', 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const ids = [];
  const result = tx(db, (handle) => {
    for (const trace of traits(traces)) {
      // ES: si el trace trae un ID que YA existe, lo actualizamos (el SQL lleva
      //     ON CONFLICT DO UPDATE). Antes se acuñaba un ID nuevo y la misma
      //     decisión aparecía dos veces: bug real corregido.
      // EN: if the trace carries an ID that ALREADY exists, we update it (the SQL
      //     has ON CONFLICT DO UPDATE). Previously a new ID was minted and the
      //     same decision appeared twice: real bug fixed.
      // PT: se o trace traz um ID que JÁ existe, atualizamos (o SQL tem
      //     ON CONFLICT DO UPDATE). Antes era cunhado um ID novo e a mesma
      //     decisão aparecia duas vezes: bug real corrigido.
      let id = trace.id;
      if (!id) {
        nextNumber += 1;
        id = `${ID_PREFIX.decision}-${String(nextNumber).padStart(5, '0')}`;
        while (existing.includes(id)) {
          nextNumber += 1;
          id = `${ID_PREFIX.decision}-${String(nextNumber).padStart(5, '0')}`;
        }
      }
      if (!existing.includes(id)) existing.push(id);
      ids.push(id);

      handle.prepare(`INSERT INTO decisions (
          id, layer, status, objective_es, objective_en, objective_pt, context,
          constraints_json, alternatives_json, decision, justification, consequence,
          related_json, evidence, session_id, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status, context = excluded.context,
          constraints_json = excluded.constraints_json, alternatives_json = excluded.alternatives_json,
          decision = excluded.decision, justification = excluded.justification,
          consequence = excluded.consequence, session_id = excluded.session_id`).run(
        id,
        trace.layer ?? layer ?? null,
        trace.status ?? 'proposed',
        trace.objective ?? null,
        trace.objective ?? null,
        trace.objective ?? null,
        trace.context ?? null,
        toJson(trace.constraints ?? []),
        toJson(trace.alternatives ?? []),
        trace.decision ?? id,
        trace.justification ?? null,
        trace.consequence ?? null,
        toJson(trace.related ?? []),
        trace.source_excerpt ?? null,
        sessionId ?? trace.session_id ?? null,
        trace.created_at ?? new Date().toISOString(),
      );

      indexEntity(handle, {
        entityType: 'decision',
        entityId: id,
        title: `${id} · ${trace.decision ?? trace.objective ?? ''}`.slice(0, 400),
        body: [trace.objective, trace.context, trace.justification, trace.consequence,
          (trace.alternatives ?? []).map((a) => `${a.id ?? ''} ${a.option ?? ''}`).join(' ')].filter(Boolean).join('\n'),
        tags: ['decision', trace.status, layer, ...(trace.related ?? [])],
      });

      bus?.emit('DECISION_MADE', {
        id,
        decision: (trace.decision ?? '').slice(0, 300),
        status: trace.status ?? 'proposed',
        alternatives: (trace.alternatives ?? []).length,
        layer: trace.layer ?? layer,
      }, { layer: layer ?? 'core-engine' });
    }
    return ids.length;
  });

  return { persisted: result.ok ? result.value : 0, ids, error: result.ok ? null : result.error };
}

/**
 * ES: lee una decisión de la base y la devuelve con los JSON ya parseados.
 * EN: reads a decision from the DB and returns it with the JSON already parsed.
 * PT: lê uma decisão do banco e a devolve com os JSON já parseados.
 */
export function loadDecision(db, id) {
  const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    constraints: fromJson(row.constraints_json, []),
    alternatives: fromJson(row.alternatives_json, []),
    related: fromJson(row.related_json, []),
  };
}

/**
 * ES: renderiza un Decision Trace en el formato humano de la sección 4.
 * EN: renders a Decision Trace in the human format from section 4.
 * PT: renderiza um Decision Trace no formato humano da seção 4.
 */
export function renderDecisionTrace(decision, language = 'en') {
  const objective = decision[`objective_${language}`] ?? decision.objective_en ?? decision.objective_es ?? '—';
  const alternatives = (decision.alternatives ?? [])
    .map((alt) => `${alt.id ?? '•'}. ${alt.option}${alt.selected ? '  ← SELECTED' : alt.rejected_because ? `  (rejected: ${alt.rejected_because})` : ''}`)
    .join('\n');
  return [
    `DECISION TRACE ${decision.id}`,
    ``,
    `Objective:`,
    objective,
    ``,
    `Context:`,
    decision.context ?? '—',
    ``,
    `Constraints:`,
    (decision.constraints ?? []).map((c) => `- ${c}`).join('\n') || '—',
    ``,
    `Alternatives considered:`,
    alternatives || '—',
    ``,
    `Decision:`,
    decision.decision ?? '—',
    ``,
    `Justification:`,
    decision.justification ?? '—',
    ``,
    `Consequence:`,
    decision.consequence ?? '—',
    ``,
    `Status: ${(decision.status ?? 'proposed').toUpperCase()}`,
  ].join('\n');
}

export default { FIELD_LABELS, normalizeStatus, parseAlternatives, parseList, extractDecisionTraces, persistDecisionTraces, loadDecision, renderDecisionTrace };

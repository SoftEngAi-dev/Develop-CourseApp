/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/ids.js  +  core/shared/time.js  (conceptualmente hermanados)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: genera identificadores estables y legibles para cada
 *     entidad del sistema: SES-00001 (sesiones), MSG-00042 (mensajes),
 *     DEC-00003 (decisiones), INT-00001 (interrupciones), CHK-... (checkpoints),
 *     BLD-... (construcciones), LES-... (lecciones), EVT-... (eventos).
 *     POR QUÉ EXISTE: el requisito central es trazabilidad. Para poder decir
 *     "la decisión DEC-00003 se tomó en la sesión SES-00001 y generó la
 *     lección LES-00002" necesitamos IDs predecibles, ordenables y cortos.
 *     Un UUID (550e8400-e29b-...) es único pero ilegible e imposible de
 *     citar en una conversación humana.
 *
 * 🇬🇧 EN — WHAT IT DOES: generates stable, human-readable identifiers for
 *     every entity: SES-00001 (sessions), MSG-00042 (messages), DEC-00003
 *     (decisions), INT-00001 (interruptions), CHK-... (checkpoints), BLD-...
 *     (builds), LES-... (lessons), EVT-... (events).
 *     WHY IT EXISTS: the central requirement is traceability. To say "decision
 *     DEC-00003 was made in session SES-00001 and produced lesson LES-00002"
 *     we need predictable, sortable, short IDs. A UUID is unique but
 *     unreadable and impossible to quote in a human conversation.
 *
 * 🇧🇷 PT — O QUE FAZ: gera identificadores estáveis e legíveis para cada
 *     entidade: SES-00001 (sessões), MSG-00042 (mensagens), DEC-00003
 *     (decisões), INT-00001 (interrupções), CHK-..., BLD-..., LES-..., EVT-...
 *     POR QUE EXISTE: o requisito central é rastreabilidade. Para dizer "a
 *     decisão DEC-00003 foi tomada na sessão SES-00001" precisamos de IDs
 *     previsíveis, ordenáveis e curtos. Um UUID é único, mas ilegível.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • `String(n).padStart(5, '0')` ES/EN/PT: convierte el número 42 en el
 *     texto "00042". Rellenar con ceros a la izquierda hace que al ordenar
 *     alfabéticamente el resultado siga siendo numérico ("00010" < "0009"
 *     sería FALSO sin ceros: "10" < "9" es falso en texto... cuidado).
 *     Pads with leading zeros so alphabetical order matches numeric order.
 *   • Un `Map` ES/EN/PT: diccionario clave→valor. `map.get(k)` lee,
 *     `map.set(k,v)` escribe. Es más rápido que buscar en un array cada vez.
 *     A key→value dictionary, faster than scanning an array.
 *   • `Date.now()` devuelve milisegundos desde 1970-01-01 (Unix epoch).
 *     `new Date().toISOString()` devuelve "2026-09-13T15:04:05.123Z".
 *     La "Z" final significa zona horaria UTC (tiempo universal).
 *     Milliseconds since 1970; ISO string ends in Z meaning UTC.
 *   • ¿Por qué UTC y no hora local? Porque si guardas hora local, al mover el
 *     proyecto a otro país el historial queda desordenado. UTC es único para
 *     todos; la interfaz lo convierte a la hora del usuario al mostrarlo.
 *     Why UTC? Local times reorder history across timezones; UTC never does.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ES/EN/PT: prefijos canónicos del proyecto. Canonical project prefixes. */
export const ID_PREFIX = Object.freeze({
  session: 'SES',
  message: 'MSG',
  decision: 'DEC',
  interruption: 'INT',
  checkpoint: 'CHK',
  build: 'BLD',
  lesson: 'LES',
  event: 'EVT',
  task: 'TSK',
  requirement: 'REQ',
  plan: 'PLN',
  action: 'ACT',
  error: 'ERR',
  search: 'SRC',
  artifact: 'ART',
  concept: 'CPT',
  technology: 'TEC',
  node: 'NOD',
  edge: 'EDG',
  policy: 'POL',
});

/**
 * ES: formatea un número con ceros a la izquierda y lo une a un prefijo.
 * EN: pads a number with leading zeros and joins it to a prefix.
 * PT: formata um número com zeros à esquerda e o une a um prefixo.
 *
 * @param {string} prefix e.g. "DEC"
 * @param {number} n e.g. 42
 * @param {number} [width=5]
 * @returns {string} e.g. "DEC-00042"
 */
export function formatId(prefix, n, width = 5) {
  return `${prefix}-${String(Math.max(0, Math.trunc(n))).padStart(width, '0')}`;
}

/**
 * ES: dado un array de IDs existentes ("DEC-00001", "DEC-00007"), devuelve el
 *     siguiente libre. Tolera IDs con otro formato (los ignora).
 * EN: given existing IDs ("DEC-00001", "DEC-00007"), returns the next free one.
 *     Tolerates IDs in other formats (ignores them).
 * PT: dado um array de IDs existentes, devolve o próximo livre. Tolera IDs em
 *     outro formato (os ignora).
 *
 * @param {string} prefix
 * @param {string[]} existingIds
 * @param {number} [width=5]
 */
export function nextId(prefix, existingIds = [], width = 5) {
  let max = 0;
  // ES: ⚠️ COHERENCIA CORREGIDA: inferimos la anchura de los IDs que YA existen.
  //     El manifest usa REQ-0001 (4 dígitos) y el generador por defecto producía
  //     REQ-00011 (5 dígitos), así que convivían dos numeraciones distintas para
  //     la misma entidad. Ahora la anchura se hereda del proyecto real.
  // EN: ⚠️ CONSISTENCY FIXED: we infer the width from the IDs that ALREADY exist.
  //     The manifest uses REQ-0001 (4 digits) while the default generator produced
  //     REQ-00011 (5 digits), so two numbering schemes coexisted for the same
  //     entity. Now the width is inherited from the real project.
  // PT: ⚠️ CONSISTÊNCIA CORRIGIDA: inferimos a largura dos IDs que JÁ existem.
  //     O manifest usa REQ-0001 (4 dígitos) e o gerador padrão produzia REQ-00011
  //     (5 dígitos), então conviviam duas numerações para a mesma entidade.
  let detectedWidth = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existingIds) {
    if (typeof id !== 'string') continue;
    const match = re.exec(id.trim());
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
    if (match[1].length > detectedWidth) detectedWidth = match[1].length;
  }
  return formatId(prefix, max + 1, detectedWidth > 0 ? Math.max(detectedWidth, String(max + 1).length) : width);
}

/**
 * ES: crea un generador con memoria: cada llamada devuelve el ID siguiente.
 *     Útil dentro de un proceso que crea muchas entidades seguidas.
 * EN: creates a stateful generator: each call returns the next ID. Useful
 *     inside a process that creates many entities in a row.
 * PT: cria um gerador com memória: cada chamada devolve o próximo ID. Útil
 *     dentro de um processo que cria muitas entidades em sequência.
 *
 * @param {string} prefix
 * @param {number} [start=1]
 * @param {number} [width=5]
 */
export function createIdGenerator(prefix, start = 1, width = 5) {
  let counter = start;
  return {
    next() {
      return formatId(prefix, counter++, width);
    },
    peek() {
      return formatId(prefix, counter, width);
    },
    get value() {
      return counter;
    },
  };
}

/**
 * ES: ID de evento único y ordenable en el tiempo: EVT-20260913T150405Z-0007.
 *     Combina marca temporal + contador, así dos eventos del mismo milisegundo
 *     nunca chocan y el orden alfabético coincide con el orden cronológico.
 * EN: unique, time-sortable event id: EVT-20260913T150405Z-0007. Combines a
 *     timestamp plus a counter, so two events in the same millisecond never
 *     collide and alphabetical order matches chronological order.
 * PT: ID de evento único e ordenável no tempo: EVT-20260913T150405Z-0007.
 *     Combina timestamp + contador, então dois eventos no mesmo milissegundo
 *     nunca colidem e a ordem alfabética coincide com a cronológica.
 *
 * @param {number} [sequence] monotonic counter
 */
export function eventId(sequence = 0) {
  const compact = compactTimestamp(new Date());
  return `${ID_PREFIX.event}-${compact}-${String(sequence).padStart(4, '0')}`;
}

/** ES/EN/PT: "2026-09-13T15:04:05.123Z" -> "20260913T150405Z". Compact, filesystem-safe timestamp. */
export function compactTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** ES/EN/PT: nombre de archivo seguro (sin "/", "\", ":", espacios raros). Filesystem-safe slug. */
export function safeSlug(value, maxLength = 60) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // ES: quita tildes: "decisión" -> "decision" | EN: strips accents | PT: remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength) || 'untitled';
}

export default { ID_PREFIX, formatId, nextId, createIdGenerator, eventId, compactTimestamp, safeSlug };

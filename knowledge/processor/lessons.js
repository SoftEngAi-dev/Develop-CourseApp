/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/lessons.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: extrae LECCIONES del texto (sección 3.G) y las convierte
 *     en reglas candidatas para control/policies.json. Reconoce patrones como:
 *         LESSON: Check package compatibility before installation.
 *         RULE CREATED: dependency.preflight=true
 *         LECCIÓN 034: ...
 *         APRENDIZAJE: ...
 *     POR QUÉ EXISTE: es el cierre del bucle de aprendizaje (sección 24). Sin
 *     este módulo, un error se arregla y se olvida. Con él, el error produce
 *     una lección, la lección produce una regla, y la regla produce un precheck
 *     que evita que el error vuelva a ocurrir. Eso es APRENDIZAJE OPERATIVO,
 *     no memoria: el sistema se comporta distinto la próxima vez.
 *
 * 🇬🇧 EN — WHAT IT DOES: extracts LESSONS from text (section 3.G) and turns them
 *     into candidate rules for control/policies.json. It recognizes patterns
 *     like "LESSON: ...", "RULE CREATED: key=value", "APRENDIZAJE: ...".
 *     WHY IT EXISTS: it closes the learning loop (section 24). Without it an
 *     error is fixed and forgotten. With it, an error produces a lesson, the
 *     lesson produces a rule, and the rule produces a precheck that prevents the
 *     error from happening again. That is OPERATIONAL LEARNING, not memory: the
 *     system behaves differently next time.
 *
 * 🇧🇷 PT — O QUE FAZ: extrai LIÇÕES do texto (seção 3.G) e as converte em
 *     regras candidatas para control/policies.json. Reconhece padrões como
 *     "LESSON: ...", "RULE CREATED: key=value", "APRENDIZAJE: ...".
 *     POR QUE EXISTE: fecha o ciclo de aprendizagem (seção 24). Sem ele, um erro
 *     é corrigido e esquecido. Com ele, o erro produz uma lição, a lição produz
 *     uma regra e a regra produz um precheck que evita que o erro se repita.
 *     Isso é APRENDIZADO OPERACIONAL, não memória.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Regla vs Lección ES/EN/PT: la lección es conocimiento en lenguaje humano
 *     ("revisa la compatibilidad antes de instalar"); la regla es conocimiento
 *     ejecutable (`dependency.preflight=true`). Solo la regla puede cambiar el
 *     comportamiento del programa automáticamente.
 *     A lesson is human knowledge; a rule is executable knowledge.
 *   • Formato clave=valor ES/EN/PT: `namespace.nombre=valor` es la convención
 *     de configuración más simple que existe (Java properties, .env, git config).
 *     El punto actúa como carpeta lógica: `dependency.preflight`.
 *     key=value with dotted namespaces is the simplest configuration convention.
 *   • Propuesta ≠ aplicación ES/EN/PT: este módulo PROPONE reglas; no las
 *     escribe directamente en policies.json. Un humano (o el agente de la Fase 7)
 *     las aprueba. Cambiar políticas automáticamente sin revisión sería
 *     exactamente el tipo de sobreescritura que POL-0002 prohíbe.
 *     This module PROPOSES rules; a human or the Phase-7 agent approves them.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, indexEntity } from '../db/index.js';
import { normalizeText } from '../../core/capture/message-parser.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

const LESSON_RE = /(?:^|\n)\s*(?:[-*•>#]+\s*)?(?:\*\*)?(?:lesson|lecci[oó]n(?:\s*\d+)?|leccion|li[cç][aã]o|aprendizaje|learning|takeaway|moraleja)(?:\*\*)?\s*[:\-—]\s*(?<lesson>[^\n]{8,400})/gi;
const RULE_RE = /(?:^|\n)\s*(?:[-*•>#]+\s*)?(?:\*\*)?(?:rule created|regla creada|regra criada|new rule|nueva regla|future rule|regla futura)(?:\*\*)?\s*[:\-—]?\s*(?<rule>[a-z0-9_.\-]{3,80}\s*=\s*[a-z0-9_.\-"]{1,40}|[^\n]{4,160})/gi;

/**
 * ES: extrae lecciones y reglas de un texto.
 * EN: extracts lessons and rules from a text.
 * PT: extrai lições e regras de um texto.
 *
 * @param {string} text
 * @returns {{ lesson: string, future_rule: string|null }[]}
 */
export function extractLessons(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // ES: ⚠️ BUG REAL CORREGIDO: la versión anterior usaba un solo regex con
  //     `[^\n]{8,400}`, que por definición se detiene en el primer salto de línea.
  //     Las lecciones escritas en dos o tres líneas quedaban truncadas a medias
  //     ("...es una" sin el resto). Ahora escaneamos línea a línea y acumulamos
  //     las líneas de continuación hasta que aparece otra etiqueta o un bloque.
  // EN: ⚠️ REAL BUG FIXED: the previous version used a single regex with
  //     `[^\n]{8,400}`, which by definition stops at the first newline. Lessons
  //     written across two or three lines were truncated halfway. We now scan line
  //     by line and accumulate continuation lines until another label or block.
  // PT: ⚠️ BUG REAL CORRIGIDO: a versão anterior usava um único regex com
  //     `[^\n]{8,400}`, que por definição para na primeira quebra de linha. As
  //     lições escritas em duas ou três linhas ficavam truncadas. Agora varremos
  //     linha a linha e acumulamos as linhas de continuação.
  const LESSON_START = /^\s*(?:[-*•>#]+\s*)?(?:\*\*)?(?:lesson|lecci[oó]n(?:\s*\d+)?|leccion|li[cç][aã]o|aprendizaje|learning|takeaway|moraleja)(?:\*\*)?\s*[:\-—]\s*(.*)$/i;
  const RULE_START = /^\s*(?:[-*•>#]+\s*)?(?:\*\*)?(?:rule created|regla creada|regra criada|new rule|nueva regla|future rule|regla futura)(?:\*\*)?\s*[:\-—]?\s*(.*)$/i;
  // ES: etiquetas que marcan el FIN de una lección (empieza otro campo).
  // EN: labels that mark the END of a lesson (another field begins).
  // PT: rótulos que marcam o FIM de uma lição (outro campo começa).
  const OTHER_LABEL = /^\s*(?:[-*•>#]+\s*)?(?:\*\*)?(?:error|err|analysis|an[aá]lisis|analise|análise|recovery|recuperaci[oó]n|recupera[cç][aã]o|soluci[oó]n|solution|objetivo|objective|contexto|context|restricciones|constraints|opciones|options|alternativas|decisi[oó]n|decision|motivo|reason|consecuencia|consequence|estado|status|query|sources|selected|why|influenced)\b/i;

  const items = [];
  let current = null;

  const flush = () => {
    if (current && current.lesson.trim().length >= 8) items.push(current);
    current = null;
  };

  for (const line of normalized.split('\n')) {
    const lessonMatch = LESSON_START.exec(line);
    if (lessonMatch) {
      flush();
      current = { lesson: lessonMatch[1].replace(/\*\*/g, '').trim(), future_rule: null, closed: false };
      continue;
    }

    const ruleMatch = RULE_START.exec(line);
    if (ruleMatch) {
      const rule = ruleMatch[1].replace(/\*\*/g, '').trim();
      if (current && !current.future_rule) {
        // ES: la regla se empareja con la lección abierta aunque haya una línea en
        //     blanco entre ellas (formato real de nuestras conversaciones).
        // EN: the rule pairs with the open lesson even with a blank line between
        //     them (the real format of our conversations).
        // PT: a regra emparelha com a lição aberta mesmo com uma linha em branco
        //     entre elas (o formato real das nossas conversas).
        current.future_rule = rule;
      } else {
        flush();
        current = { lesson: `Rule observed without an explicit lesson: ${rule}`, future_rule: rule, closed: true };
      }
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();
    if (!trimmed) { current.closed = true; continue; }
    if (OTHER_LABEL.test(line) || /^\s*(?:#{1,6}|```)/.test(line)) { flush(); continue; }
    if (!current.closed && current.lesson.length < 900) current.lesson += ` ${trimmed}`;
  }
  flush();

  const seen = new Set();
  return items
    .map((item) => ({ lesson: item.lesson.replace(/\s+/g, ' ').trim(), future_rule: item.future_rule }))
    .filter((item) => {
      const key = item.lesson.toLowerCase().slice(0, 90);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * ES: guarda lecciones en la base y emite LESSON_CREATED.
 * EN: stores lessons in the DB and emits LESSON_CREATED.
 * PT: guarda lições no banco e emite LESSON_CREATED.
 */
export function persistLessons(lessons, options = {}) {
  const { bus = null, sourceType = 'text', sourceId = null, layer = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(lessons) || !lessons.length) return { persisted: 0, ids: [], proposed_rules: [] };

  const existing = db.prepare('SELECT id, lesson FROM lessons').all();
  const ids = [];
  const proposed = [];
  const now = new Date().toISOString();

  const result = tx(db, (handle) => {
    for (const item of lessons) {
      // ES: no duplicamos una lección ya registrada (comparación por prefijo).
      // EN: we do not duplicate an already registered lesson (prefix comparison).
      // PT: não duplicamos uma lição já registrada (comparação por prefixo).
      const key = String(item.lesson).toLowerCase().slice(0, 80);
      const duplicate = existing.find((row) => String(row.lesson ?? '').toLowerCase().slice(0, 80) === key);
      if (duplicate) continue;

      const id = nextId(ID_PREFIX.lesson, [...existing.map((r) => r.id), ...ids]);
      ids.push(id);
      existing.push({ id, lesson: item.lesson });

      handle.prepare(`INSERT INTO lessons (id, source_type, source_id, lesson, future_rule, layer, created_at) VALUES (?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET lesson = excluded.lesson, future_rule = excluded.future_rule`).run(
        id, sourceType, sourceId, String(item.lesson).slice(0, 2000), item.future_rule ?? null, layer ?? null, now,
      );

      indexEntity(handle, {
        entityType: 'lesson', entityId: id,
        title: `${id} · ${String(item.lesson).slice(0, 160)}`,
        body: `${item.lesson}\nRule: ${item.future_rule ?? '—'}`,
        tags: ['lesson', layer, sourceType],
      });

      if (item.future_rule) {
        proposed.push(parseRule(item.future_rule, id));
      }
      bus?.emit('LESSON_CREATED', { id, lesson: String(item.lesson).slice(0, 240), rule: item.future_rule ?? null }, { layer: 'learning-evolution' });
    }
    return ids.length;
  });

  return { persisted: result.ok ? result.value : 0, ids, proposed_rules: proposed, error: result.ok ? null : result.error };
}

/**
 * ES: convierte "dependency.preflight=true" en una regla estructurada lista
 *     para ser aprobada e insertada en control/policies.json.
 * EN: turns "dependency.preflight=true" into a structured rule ready to be
 *     approved and inserted into control/policies.json.
 * PT: converte "dependency.preflight=true" numa regra estruturada pronta para
 *     ser aprovada e inserida em control/policies.json.
 */
export function parseRule(raw, originLesson = null) {
  const text = String(raw ?? '').trim();
  const match = /^(?<key>[a-z0-9_.\-]+)\s*=\s*(?<value>.+)$/i.exec(text);
  if (!match) {
    return { key: null, value: text, enforcement: 'soft', origin: originLesson, status: 'proposed', needs_human_key: true };
  }
  const rawValue = match.groups.value.trim().replace(/^["']|["']$/g, '');
  let value = rawValue;
  if (/^(true|false)$/i.test(rawValue)) value = rawValue.toLowerCase() === 'true';
  else if (/^-?\d+(\.\d+)?$/.test(rawValue)) value = Number(rawValue);
  else if (rawValue.includes(',')) value = rawValue.split(',').map((part) => part.trim());

  return {
    key: match.groups.key.toLowerCase(),
    value,
    enforcement: /\b(hard|never|always|must)\b/i.test(text) ? 'hard' : 'soft',
    origin: originLesson,
    status: 'proposed',
    statement: text,
  };
}

/** ES/EN/PT: lecciones por capa. Lessons grouped by layer. */
export function lessonsByLayer(db) {
  return Object.fromEntries(
    db.prepare('SELECT layer, COUNT(*) AS n FROM lessons GROUP BY layer ORDER BY n DESC').all()
      .map((row) => [row.layer ?? 'unassigned', Number(row.n)]),
  );
}

/** ES/EN/PT: todas las reglas candidatas pendientes de aprobación. All pending candidate rules. */
export function proposedRules(db) {
  const rows = db.prepare("SELECT id, lesson, future_rule FROM lessons WHERE future_rule IS NOT NULL ORDER BY created_at DESC").all();
  return rows.map((row) => ({ lesson_id: row.id, lesson: row.lesson, ...parseRule(row.future_rule, row.id) }));
}

export default { extractLessons, persistLessons, parseRule, lessonsByLayer, proposedRules };

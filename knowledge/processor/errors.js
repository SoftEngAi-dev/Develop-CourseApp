/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/errors.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: detecta ERRORES en el texto y extrae su ciclo completo de
 *     aprendizaje (sección 24 de la arquitectura):
 *         ERROR:    Dependency conflict.
 *         ANALYSIS: Version mismatch.
 *         RECOVERY: Use compatible version.
 *         LESSON:   Check package compatibility before installation.
 *         RULE CREATED: dependency.preflight=true
 *     También reconoce errores "sueltos": stack traces, `Error:`, códigos de
 *     salida, mensajes HTTP (403/500), excepciones de Node y Python.
 *     POR QUÉ EXISTE: aquí está el corazón del MODO EVOLVE. Un error sin
 *     análisis es solo ruido; un error con análisis + lección + regla se
 *     convierte en aprendizaje OPERATIVO: la próxima ejecución hace un precheck
 *     y evita el mismo fallo. Eso no es memoria, es mejora real.
 *
 * 🇬🇧 EN — WHAT IT DOES: detects ERRORS in text and extracts their full
 *     learning cycle (architecture section 24): ERROR → ANALYSIS → RECOVERY →
 *     LESSON → RULE CREATED. It also recognizes loose errors: stack traces,
 *     `Error:`, exit codes, HTTP messages (403/500), Node and Python exceptions.
 *     WHY IT EXISTS: this is the heart of EVOLVE mode. An error without analysis
 *     is just noise; an error with analysis + lesson + rule becomes OPERATIONAL
 *     learning: the next run performs a precheck and avoids the same failure.
 *     That is not memory, that is real improvement.
 *
 * 🇧🇷 PT — O QUE FAZ: detecta ERROS no texto e extrai seu ciclo completo de
 *     aprendizagem (seção 24): ERROR → ANALYSIS → RECOVERY → LESSON → RULE
 *     CREATED. Também reconhece erros soltos: stack traces, `Error:`, códigos de
 *     saída, mensagens HTTP (403/500), exceções de Node e Python.
 *     POR QUE EXISTE: aqui está o coração do MODO EVOLVE. Um erro sem análise é
 *     só ruído; um erro com análise + lição + regra vira aprendizagem
 *     OPERACIONAL: a próxima execução faz um precheck e evita a mesma falha.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Stack trace ES/EN/PT: la lista de funciones que estaban ejecutándose
 *     cuando algo falló, de la más reciente a la más antigua. Se reconoce por
 *     líneas tipo "at Object.<anonymous> (/ruta/archivo.js:12:5)". Leerlo de
 *     abajo hacia arriba te dice dónde empezó el problema.
 *     A stack trace lists running functions; read it bottom-up to find the origin.
 *   • Código de salida (exit code) ES/EN/PT: 0 = éxito; distinto de 0 = fallo.
 *     Es la convención universal de Unix. `exit_code=1` en un log significa
 *     "el comando falló", aunque no haya mensaje de error visible.
 *     Exit code 0 means success; anything else means failure (Unix convention).
 *   • Deduplicación por huella ES/EN/PT: el mismo error puede aparecer 20 veces
 *     en un log. Creamos una "huella" (primer línea + tipo) y solo guardamos la
 *     primera aparición, incrementando un contador de ocurrencias.
 *     We fingerprint errors so the same failure is stored once, with a counter.
 *   • Severidad ES/EN/PT: info < warning < error < fatal. Permite filtrar: un
 *     warning no debería despertar a nadie a las 3 de la mañana; un fatal sí.
 *     Severity levels let you filter what deserves attention.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, toJson, indexEntity, run } from '../db/index.js';
import { normalizeText } from '../../core/capture/message-parser.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

const CYCLE_LABELS = Object.freeze({
  message: ['error', 'err', 'fallo', 'falló', 'falla', 'excepción', 'exception', 'failure', 'failed'],
  analysis: ['analysis', 'análisis', 'analisis', 'análise', 'cause', 'causa', 'diagnóstico', 'diagnostic'],
  recovery: ['recovery', 'recuperación', 'recuperacion', 'recuperação', 'fix', 'solución', 'solution', 'corrección', 'workaround'],
  lesson: ['lesson', 'lección', 'leccion', 'lição', 'aprendizaje', 'learning', 'takeaway', 'moraleja'],
  rule: ['rule created', 'regla creada', 'regra criada', 'new rule', 'nueva regla', 'policy', 'política', 'future rule', 'regla futura'],
});

const LOOSE_ERROR = /(?:^|\n)\s*(?:[-*>#\s]*)?(?:error|err|excepci[oó]n|exception|traceback|fallo|fall[oó]|failed|failure)\s*[:\-—]\s*(?<message>[^\n]{4,300})/gi;
const HTTP_ERROR = /\b(?<code>[45]\d{2})\b\s*(?<reason>[A-Za-z][A-Za-z ]{2,40})?/g;
const EXIT_CODE = /exit[_ ]?(?:code|status)?\s*[=:]\s*(?<code>\d{1,3})/gi;
// ES: sin el flag /g, porque `.test()` con /g recuerda lastIndex y falla la segunda vez.
// EN: without the /g flag, because `.test()` with /g remembers lastIndex and fails the second time.
// PT: sem a flag /g, porque `.test()` com /g lembra o lastIndex e falha na segunda vez.
const STACK_LINE = /^\s*at\s+[^\n(]+\([^)]*:\d+:\d+\)\s*$/m;

/** ES/EN/PT: huella para deduplicar errores. Fingerprint used to deduplicate errors. */
export function errorFingerprint(message) {
  return String(message ?? '')
    .toLowerCase()
    .replace(/\d+/g, '#')            // ES: los números varían (líneas, puertos) | EN: numbers vary | PT: números variam
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** ES/EN/PT: clasifica la severidad según el contenido. Classifies severity by content. */
export function classifySeverity(message) {
  const text = String(message ?? '').toLowerCase();
  if (/\b(fatal|panic|corrupt|unrecoverable|data loss|security|permission denied|403|401)\b/.test(text)) return 'critical';
  if (/\b(error|exception|failed|traceback|crash)\b/.test(text)) return 'high';
  if (/\b(warning|warn|deprecated|slow|timeout)\b/.test(text)) return 'medium';
  return 'low';
}

/**
 * ES: extrae errores con su ciclo de aprendizaje. Primero busca ciclos
 *     explícitos (ERROR/ANALYSIS/RECOVERY/LESSON/RULE); si no encuentra ninguno,
 *     busca errores sueltos.
 * EN: extracts errors with their learning cycle. First it looks for explicit
 *     cycles (ERROR/ANALYSIS/RECOVERY/LESSON/RULE); if none are found, it looks
 *     for loose errors.
 * PT: extrai erros com seu ciclo de aprendizagem. Primeiro procura ciclos
 *     explícitos; se não encontrar nenhum, procura erros soltos.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function extractErrors(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const labelOf = (line) => {
    const match = /^\s*(?:[-*•>#]+\s*)?(?:\*\*)?([a-záéíóúñüàâãçõ ]{3,20})(?:\*\*)?\s*[:\-—]\s*(.*)$/i.exec(line);
    if (!match) return null;
    const key = match[1].toLowerCase().trim();
    for (const [field, labels] of Object.entries(CYCLE_LABELS)) {
      if (labels.includes(key)) return { field, value: match[2].replace(/\*\*/g, '').trim() };
    }
    return null;
  };

  const cycles = [];
  let current = null;

  // ES: ⚠️ BUG REAL CORREGIDO — TERMINADOR DE CICLO. El parser de errores
  //     acumulaba líneas de continuación sin límite, así que el campo LESSON
  //     acababa conteniendo todo el resto del documento (incluidos los mensajes
  //     siguientes del usuario y del asistente). Es el mismo defecto que ya se
  //     corrigió en decisions.js y lessons.js: un bloque debe terminar en el
  //     primer marcador que no le pertenece.
  // EN: ⚠️ REAL BUG FIXED — CYCLE TERMINATOR. The error parser accumulated
  //     continuation lines without limit, so the LESSON field ended up containing
  //     the whole rest of the document (including the following user and assistant
  //     messages). Same defect already fixed in decisions.js and lessons.js: a
  //     block must end at the first marker that does not belong to it.
  // PT: ⚠️ BUG REAL CORRIGIDO — TERMINADOR DE CICLO. O parser de erros acumulava
  //     linhas de continuação sem limite, então o campo LESSON acabava contendo
  //     todo o resto do documento. Mesmo defeito já corrigido em decisions.js e
  //     lessons.js: um bloco deve terminar no primeiro marcador que não lhe pertence.
  const FOREIGN = /^\s*(?:#{1,6}\s|```|[-*_]{3,}\s*$|(?:user|usuario|usuário|assistant|ia|ai|agent|agente|system|sistema|tool|herramienta)\s*[:\-—]|(?:decisi[oó]n|decision|decis[aã]o|search|b[uú]squeda|busca)(?:-?\s*#?\s*\d{1,6})?\s*(?:[:\-—]|$))/i;

  for (const line of lines) {
    // ES: un marcador extranjero cierra el ciclo actual.
    // EN: a foreign marker closes the current cycle.
    // PT: um marcador estranho fecha o ciclo atual.
    if (current && FOREIGN.test(line)) { cycles.push(current); current = null; continue; }
    const labelled = labelOf(line);
    if (labelled?.field === 'message') {
      if (current?.message) cycles.push(current);
      current = { message: labelled.value, analysis: null, recovery: null, lesson: null, rule_created: null, explicit: true };
      continue;
    }
    if (current && labelled) {
      current[labelled.field === 'rule' ? 'rule_created' : labelled.field] = labelled.value;
      current.closed = false;
      continue;
    }
    // ES: una línea en blanco cierra la acumulación (pero no el ciclo: la regla
    //     RULE CREATED suele venir después de un salto de línea).
    // EN: a blank line closes accumulation (but not the cycle: RULE CREATED usually
    //     comes after a line break).
    // PT: uma linha em branco fecha o acúmulo (mas não o ciclo: RULE CREATED
    //     costuma vir depois de uma quebra de linha).
    if (current && !line.trim()) { current.closed = true; continue; }

    // ES: líneas de continuación del campo actual, solo mientras no esté cerrado.
    // EN: continuation lines of the current field, only while it is not closed.
    // PT: linhas de continuação do campo atual, só enquanto não estiver fechado.
    if (current && line.trim() && !current.closed && !/^\s*(?:#{1,6}|```)/.test(line)) {
      const lastField = current.rule_created !== null ? 'rule_created' : current.lesson !== null ? 'lesson' : current.recovery !== null ? 'recovery' : current.analysis !== null ? 'analysis' : 'message';
      if (current[lastField] && current[lastField].length < 600) current[lastField] += ` ${line.trim()}`;
    }
  }
  if (current?.message) cycles.push(current);

  const out = cycles.map((cycle) => ({
    ...cycle,
    closed: undefined,
    severity: classifySeverity(cycle.message),
    fingerprint: errorFingerprint(cycle.message),
    stack: false,
    http_code: null,
    exit_code: null,
  }));

  // ES: errores sueltos (solo si no encontramos ciclos explícitos en ese trozo).
  // EN: loose errors (only if we found no explicit cycles).
  // PT: erros soltos (somente se não encontramos ciclos explícitos).
  if (!out.length) {
    let match;
    const looseRe = new RegExp(LOOSE_ERROR.source, LOOSE_ERROR.flags);
    while ((match = looseRe.exec(normalized)) !== null) {
      const message = match.groups.message.trim();
      if (message.length < 4) continue;
      out.push({
        message, analysis: null, recovery: null, lesson: null, rule_created: null,
        explicit: false, severity: classifySeverity(message), fingerprint: errorFingerprint(message),
        stack: false, http_code: null, exit_code: null,
      });
    }
  }

  // ES: enriquecemos con códigos HTTP, exit codes y presencia de stack trace.
  // EN: we enrich with HTTP codes, exit codes and stack-trace presence.
  // PT: enriquecemos com códigos HTTP, exit codes e presença de stack trace.
  const httpCodes = [...normalized.matchAll(new RegExp(HTTP_ERROR.source, HTTP_ERROR.flags))].map((m) => m.groups.code);
  const exitCodes = [...normalized.matchAll(new RegExp(EXIT_CODE.source, EXIT_CODE.flags))].map((m) => m.groups.code);
  const hasStack = STACK_LINE.test(normalized);

  for (const item of out) {
    item.http_code = httpCodes.find((code) => item.message.includes(code)) ?? httpCodes[0] ?? null;
    item.exit_code = exitCodes[0] ?? null;
    item.stack = hasStack;
  }

  // ES: deduplicamos por huella y contamos apariciones.
  // EN: deduplicate by fingerprint and count occurrences.
  // PT: deduplicamos por impressão digital e contamos ocorrências.
  const seen = new Map();
  for (const item of out) {
    const previous = seen.get(item.fingerprint);
    if (previous) { previous.occurrences = (previous.occurrences ?? 1) + 1; continue; }
    seen.set(item.fingerprint, { ...item, occurrences: 1 });
  }
  return [...seen.values()];
}

/**
 * ES: guarda errores en la base. Si el error trae LESSON y RULE, crea también la
 *     lección y propone la regla (el bucle de aprendizaje de la sección 24).
 * EN: stores errors in the DB. If the error carries LESSON and RULE, it also
 *     creates the lesson and proposes the rule (section 24's learning loop).
 * PT: guarda erros no banco. Se o erro trouxer LESSON e RULE, cria também a
 *     lição e propõe a regra (o ciclo de aprendizagem da seção 24).
 */
export function persistErrors(errors, options = {}) {
  const { bus = null, sessionId = null, task = null, layer = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(errors) || !errors.length) return { persisted: 0, ids: [], lessons: 0, rules: [] };

  // ES: ⚠️ IDEMPOTENCIA CORREGIDA: el mismo error se duplicaba en cada reprocesado.
  //     Deduplicamos por huella (mensaje normalizado sin números), que es justo la
  //     técnica explicada en la cabecera de este archivo.
  // EN: ⚠️ IDEMPOTENCY FIXED: the same error was duplicated on every reprocess. We
  //     deduplicate by fingerprint (message normalized without numbers), which is
  //     exactly the technique explained in this file's header.
  // PT: ⚠️ IDEMPOTÊNCIA CORRIGIDA: o mesmo erro era duplicado a cada reprocessamento.
  //     Deduplicamos por impressão digital (mensagem normalizada sem números).
  const existingRows = db.prepare('SELECT id, message FROM errors').all();
  const existing = existingRows.map((r) => r.id);
  const existingPrints = new Map(existingRows.map((row) => [errorFingerprint(row.message), row.id]));
  const lessonIds = db.prepare('SELECT id FROM lessons').all().map((r) => r.id);
  const ids = [];
  const proposedRules = [];
  let lessons = 0;
  const now = new Date().toISOString();

  const result = tx(db, (handle) => {
    for (const error of errors) {
      const print = errorFingerprint(error.message);
      let id = existingPrints.get(print) ?? null;
      if (!id) {
        id = nextId(ID_PREFIX.error, existing);
        while (existing.includes(id)) id = nextId(ID_PREFIX.error, [...existing, id]);
        existingPrints.set(print, id);
      }
      if (!existing.includes(id)) existing.push(id);
      ids.push(id);

      handle.prepare(`INSERT INTO errors (id, session_id, task, layer, message, analysis, recovery, lesson, rule_created, severity, resolved, ts)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET analysis = excluded.analysis, recovery = excluded.recovery, lesson = excluded.lesson, rule_created = excluded.rule_created`).run(
        id, sessionId, task, layer, String(error.message ?? '').slice(0, 2000),
        error.analysis ?? null, error.recovery ?? null, error.lesson ?? null, error.rule_created ?? null,
        error.severity ?? 'medium', error.recovery ? 1 : 0, now,
      );

      indexEntity(handle, {
        entityType: 'error', entityId: id,
        title: `${id} · ${String(error.message ?? '').slice(0, 160)}`,
        body: [error.message, error.analysis, error.recovery, error.lesson, error.rule_created].filter(Boolean).join('\n'),
        tags: ['error', error.severity, layer, error.http_code, error.exit_code],
      });

      // ES: ERROR → LESSON → RULE. El bucle completo, automático.
      // EN: ERROR → LESSON → RULE. The complete loop, automatic.
      // PT: ERROR → LESSON → RULE. O ciclo completo, automático.
      // ES: ⚠️ DEDUPLICACIÓN CORREGIDA: antes se creaba una lección nueva en cada
      //     reprocesado aunque el error ya estuviera registrado. Comparamos por el
      //     prefijo normalizado, igual que hace persistLessons().
      // EN: ⚠️ DEDUPLICATION FIXED: a new lesson used to be created on every
      //     reprocess even when the error was already registered. We compare by the
      //     normalized prefix, exactly like persistLessons() does.
      // PT: ⚠️ DEDUPLICAÇÃO CORRIGIDA: antes uma nova lição era criada a cada
      //     reprocessamento mesmo que o erro já estivesse registrado. Comparamos
      //     pelo prefixo normalizado, como faz persistLessons().
      const lessonKey = String(error.lesson ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
      const lessonExists = lessonKey && handle.prepare('SELECT id FROM lessons WHERE lower(substr(lesson,1,80)) = ?').get(lessonKey);
      if (error.lesson && !lessonExists) {
        const lessonId = nextId(ID_PREFIX.lesson, lessonIds);
        lessonIds.push(lessonId);
        handle.prepare(`INSERT INTO lessons (id, source_type, source_id, lesson, future_rule, layer, created_at) VALUES (?,?,?,?,?,?,?)
                        ON CONFLICT(id) DO UPDATE SET lesson = excluded.lesson, future_rule = excluded.future_rule`).run(
          lessonId, 'error', id, String(error.lesson).slice(0, 2000), error.rule_created ?? null, layer ?? null, now,
        );
        indexEntity(handle, {
          entityType: 'lesson', entityId: lessonId,
          title: `${lessonId} · ${String(error.lesson).slice(0, 160)}`,
          body: `${error.lesson}\nRule: ${error.rule_created ?? '—'}\nFrom error: ${error.message}`,
          tags: ['lesson', layer, 'from-error'],
        });
        lessons += 1;
        bus?.emit('LESSON_CREATED', { id: lessonId, source: id, rule: error.rule_created ?? null }, { layer: 'learning-evolution' });
      }
      if (error.rule_created) {
        proposedRules.push({ key: error.rule_created, origin: id, lesson: error.lesson ?? null });
      }

      bus?.emit('ERROR_DETECTED', {
        id, severity: error.severity ?? 'medium', message: String(error.message ?? '').slice(0, 240),
        http_code: error.http_code ?? null, recoverable: Boolean(error.recovery), occurrences: error.occurrences ?? 1,
      }, { layer: layer ?? 'verification', task, severity: error.severity ?? 'medium' });
    }
    return ids.length;
  });

  return { persisted: result.ok ? result.value : 0, ids, lessons, rules: proposedRules, error: result.ok ? null : result.error };
}

/** ES/EN/PT: errores abiertos (sin recuperación registrada). Open errors without recovery. */
export function openErrors(db) {
  return db.prepare('SELECT * FROM errors WHERE resolved = 0 ORDER BY ts DESC').all();
}

/** ES/EN/PT: errores agrupados por severidad. Errors grouped by severity. */
export function errorHistogram(db) {
  const rows = db.prepare('SELECT severity, COUNT(*) AS n FROM errors GROUP BY severity ORDER BY n DESC').all();
  return Object.fromEntries(rows.map((r) => [r.severity ?? 'unknown', Number(r.n)]));
}

export default { errorFingerprint, classifySeverity, extractErrors, persistErrors, openErrors, errorHistogram };

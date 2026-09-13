/* ═══════════════════════════════════════════════════════════════════════════
 * core/capture/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: la CAPTURA DE SESIÓN. Recibe una conversación (archivo o
 *     texto), la divide en mensajes y la guarda en el nivel RAW:
 *       data/raw/sessions/SES-00001-<slug>.json      (la sesión completa, verbatim)
 *       data/raw/messages/SES-00001/MSG-00001.json   (cada mensaje por separado)
 *     Además emite los eventos SESSION_STARTED, MESSAGE_RECEIVED y SESSION_ENDED.
 *     POR QUÉ EXISTE: el nivel RAW no interpreta (DEC-00001). Aquí NO guardamos
 *     "la IA entendió que..."; guardamos lo que se dijo, exactamente, con su
 *     hash de integridad. La interpretación ocurre después, en knowledge/ingestion.
 *     Si el análisis de mañana se equivoca, el RAW sigue intacto y podemos
 *     reprocesar. Esa es la diferencia entre historial y opinión.
 *
 * 🇬🇧 EN — WHAT IT DOES: SESSION CAPTURE. It receives a conversation (file or
 *     text), splits it into messages and stores it in the RAW level:
 *       data/raw/sessions/SES-00001-<slug>.json      (the whole session, verbatim)
 *       data/raw/messages/SES-00001/MSG-00001.json   (each message separately)
 *     It also emits SESSION_STARTED, MESSAGE_RECEIVED and SESSION_ENDED events.
 *     WHY IT EXISTS: the RAW level does not interpret (DEC-00001). Here we do
 *     NOT store "the AI understood that..."; we store what was said, exactly,
 *     with an integrity hash. Interpretation happens later in
 *     knowledge/ingestion. If tomorrow's analysis is wrong, RAW stays intact and
 *     we can reprocess. That is the difference between history and opinion.
 *
 * 🇧🇷 PT — O QUE FAZ: a CAPTURA DE SESSÃO. Recebe uma conversa (arquivo ou
 *     texto), a divide em mensagens e a guarda no nível RAW:
 *       data/raw/sessions/SES-00001-<slug>.json      (a sessão completa, literal)
 *       data/raw/messages/SES-00001/MSG-00001.json   (cada mensagem separadamente)
 *     Também emite os eventos SESSION_STARTED, MESSAGE_RECEIVED e SESSION_ENDED.
 *     POR QUE EXISTE: o nível RAW não interpreta (DEC-00001). Aqui NÃO guardamos
 *     "a IA entendeu que..."; guardamos o que foi dito, exatamente, com hash de
 *     integridade. A interpretação acontece depois, em knowledge/ingestion.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Hash SHA-256 ES/EN/PT: función que convierte cualquier texto en una
 *     huella de 64 caracteres hexadecimales. Misma entrada → misma huella
 *     SIEMPRE; un carácter distinto → huella totalmente distinta. Sirve para
 *     detectar si un archivo histórico fue modificado después. No es cifrado:
 *     no se puede "descifrar", solo comparar.
 *     A SHA-256 hash is a 64-char fingerprint of any text; it detects tampering.
 *   • `node:crypto` ES/EN/PT: módulo integrado de Node. `createHash('sha256')
 *     .update(texto).digest('hex')` produce la huella. Cero dependencias.
 *     Built-in Node module; produces the fingerprint with zero dependencies.
 *   • Idempotencia ES/EN/PT: si ingerimos el MISMO archivo dos veces, no
 *     queremos dos sesiones duplicadas. Comparamos el hash del contenido: si ya
 *     existe una sesión con ese hash, la devolvemos en vez de crear otra.
 *     Idempotency: ingesting the same file twice must not duplicate data.
 *   • append-only ES/EN/PT: el nivel RAW solo AÑADE, nunca modifica ni borra.
 *     Es el mismo principio que los libros contables y que Git.
 *     The RAW level only appends, like accounting books and Git.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS, toProjectRelative } from '../shared/paths.js';
import { readJson, writeJson, ensureDir, readText } from '../shared/json.js';
import { ok, fail, attempt } from '../shared/result.js';
import { nextId, formatId, safeSlug, ID_PREFIX } from '../shared/ids.js';
import { parseTranscript, normalizeText } from './message-parser.js';

/** ES/EN/PT: huella SHA-256 de un texto. SHA-256 fingerprint of a text. */
export function hashText(text) {
  return crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

/** ES/EN/PT: huella corta (12 caracteres), legible en logs. Short 12-char fingerprint for logs. */
export function shortHash(text) {
  return hashText(text).slice(0, 12);
}

function sessionFiles(dir = PATHS.rawSessions) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('.bak') && !name.endsWith('.tmp'));
}

function existingSessionIds(dir = PATHS.rawSessions) {
  return sessionFiles(dir).map((name) => /^(SES-\d+)/.exec(name)?.[1]).filter(Boolean);
}

/**
 * ES: busca una sesión ya ingerida con el mismo hash (idempotencia).
 * EN: finds an already ingested session with the same hash (idempotency).
 * PT: procura uma sessão já ingerida com o mesmo hash (idempotência).
 */
export function findByHash(hash, dir = PATHS.rawSessions) {
  for (const name of sessionFiles(dir)) {
    const data = readJson(path.join(dir, name), null);
    if (data && data.raw_hash === hash) return { ...data, _file: path.join(dir, name) };
  }
  return null;
}

/**
 * ES: ingiere una conversación en el nivel RAW.
 * EN: ingests a conversation into the RAW level.
 * PT: ingere uma conversa no nível RAW.
 *
 * @param {{ text?: string, file?: string, title?: string, source?: string, sessionId?: string, bus?: object, startedAt?: string, force?: boolean }} options
 * @returns {Result<{ session: object, messages: object[], duplicated: boolean }>}
 */
export function ingestSession(options = {}) {
  const {
    text = null,
    file = null,
    title = null,
    source = null,
    sessionId = null,
    bus = null,
    startedAt = null,
    force = false,
  } = options;

  return attempt(() => {
    let rawText = text;
    if (rawText === null && file) {
      if (!fs.existsSync(file)) throw new Error(`Transcript file not found: ${file}`);
      rawText = readText(file);
    }
    if (rawText === null) throw new Error('ingestSession requires either { text } or { file }');

    const normalized = normalizeText(rawText);
    if (!normalized) throw new Error('The transcript is empty: nothing to capture.');

    const rawHash = hashText(normalized);

    // ES: idempotencia — si ya capturamos este contenido exacto, no duplicamos.
    // EN: idempotency — if we already captured this exact content, do not duplicate.
    // PT: idempotência — se já capturamos este conteúdo exato, não duplicamos.
    if (!force) {
      const existing = findByHash(rawHash);
      if (existing) {
        bus?.emit('SESSION_STARTED', { id: existing.id, duplicated: true, reason: 'identical content already captured' }, { layer: 'core-engine' });
        return { session: existing, messages: [], duplicated: true };
      }
    }

    const { format, chunks } = parseTranscript(normalized);
    if (!chunks.length) throw new Error('The transcript produced no messages.');

    const id = sessionId ?? nextId(ID_PREFIX.session, existingSessionIds(), 5);
    const now = new Date().toISOString();
    const derivedTitle = title
      ?? chunks[0].content.split('\n').find((l) => l.trim().length > 3)?.trim().slice(0, 80)
      ?? `Session ${id}`;

    const slug = safeSlug(derivedTitle, 40);
    const sessionFile = path.join(PATHS.rawSessions, `${id}-${slug}.json`);
    const messagesDir = path.join(PATHS.rawMessages, id);
    ensureDir(messagesDir);

    const session = {
      id,
      title: derivedTitle,
      source: source ?? (file ? toProjectRelative(path.resolve(file)) : 'inline-text'),
      format,
      started_at: startedAt ?? now,
      ended_at: now,
      captured_at: now,
      message_count: chunks.length,
      chars: normalized.length,
      raw_hash: rawHash,
      raw_hash_short: shortHash(normalized),
      level: 'raw',
      interpretation: null,
      messages_file: `data/raw/messages/${id}`,
    };

    bus?.emit('SESSION_STARTED', { id, title: derivedTitle, source: session.source, format, message_count: chunks.length }, { layer: 'core-engine' });

    const messages = [];
    chunks.forEach((chunk, index) => {
      const messageId = formatId(ID_PREFIX.message, index + 1, 5);
      const content = normalizeText(chunk.content);
      // ES: el nivel RAW guarda el contenido tal cual. Ni resumen, ni traducción.
      // EN: the RAW level stores the content as-is. No summary, no translation.
      // PT: o nível RAW guarda o conteúdo tal qual. Nem resumo, nem tradução.
      const message = {
        id: messageId,
        session_id: id,
        index: index,
        role: chunk.role ?? 'user',
        ts: chunk.ts ?? now,
        content,
        chars: content.length,
        hash: hashText(content),
        level: 'raw',
      };
      writeJson(path.join(messagesDir, `${messageId}.json`), message);
      messages.push(message);

      bus?.emit('MESSAGE_RECEIVED', {
        id: messageId,
        session_id: id,
        index,
        role: message.role,
        chars: message.chars,
        preview: content.slice(0, 160),
      }, { layer: 'core-engine' });
    });

    // ES: guardamos también el texto verbatim completo: es la fuente histórica.
    // EN: we also store the complete verbatim text: it is the historical source.
    // PT: guardamos também o texto literal completo: é a fonte histórica.
    const verbatimFile = path.join(PATHS.rawSessions, `${id}-verbatim.txt`);
    ensureDir(path.dirname(verbatimFile));
    fs.writeFileSync(verbatimFile, normalized, 'utf8');

    writeJson(sessionFile, session);
    bus?.emit('SESSION_ENDED', { id, message_count: messages.length, file: toProjectRelative(sessionFile) }, { layer: 'core-engine' });

    return { session: { ...session, _file: sessionFile }, messages, duplicated: false };
  }, { code: 'capture_failed', interruptionType: 'tool_error', layer: 'core-engine' });
}

/** ES/EN/PT: lista todas las sesiones capturadas. Lists every captured session. */
export function listSessions(dir = PATHS.rawSessions) {
  return sessionFiles(dir).map((name) => {
    const data = readJson(path.join(dir, name), null);
    if (!data) return null;
    return { id: data.id, title: data.title, source: data.source, format: data.format, message_count: data.message_count, captured_at: data.captured_at, raw_hash_short: data.raw_hash_short, file: name };
  }).filter(Boolean).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** ES/EN/PT: carga una sesión por ID. Loads a session by ID. */
export function loadSession(sessionId, dir = PATHS.rawSessions) {
  const name = sessionFiles(dir).find((n) => n.startsWith(`${sessionId}-`));
  if (!name) return fail(`Session ${sessionId} not found in ${dir}`, { code: 'session_not_found', interruptionType: 'ambiguity', layer: 'core-engine' });
  const data = readJson(path.join(dir, name), null);
  if (!data) return fail(`Session file ${name} is corrupt`, { code: 'session_corrupt', interruptionType: 'failed', recoverable: false });
  return ok({ ...data, _file: path.join(dir, name) });
}

/** ES/EN/PT: carga los mensajes RAW de una sesión. Loads the RAW messages of a session. */
export function loadRawMessages(sessionId) {
  const dir = path.join(PATHS.rawMessages, sessionId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => n.endsWith('.json') && !n.endsWith('.bak') && !n.endsWith('.tmp'))
    .sort()
    .map((n) => readJson(path.join(dir, n), null))
    .filter(Boolean);
}

/** ES/EN/PT: estadísticas globales de captura. Global capture statistics. */
export function captureStats() {
  const sessions = listSessions();
  const totalMessages = sessions.reduce((sum, s) => sum + (Number(s.message_count) || 0), 0);
  return {
    sessions: sessions.length,
    messages: totalMessages,
    formats: Object.fromEntries(sessions.reduce((map, s) => map.set(s.format, (map.get(s.format) ?? 0) + 1), new Map())),
    roles: null,
    first_session: sessions[0]?.id ?? null,
    last_session: sessions[sessions.length - 1]?.id ?? null,
  };
}

export default { hashText, shortHash, ingestSession, listSessions, loadSession, loadRawMessages, captureStats, findByHash };

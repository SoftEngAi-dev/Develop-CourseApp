/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/db/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: abre la base de datos SQLite del conocimiento, ejecuta
 *     las migraciones SQL y ofrece ayudantes seguros para consultar
 *     (all/get/run/tx) e indexar entidades en FTS5.
 *     POR QUÉ EXISTE (DEC-00002): usamos `node:sqlite`, integrado en Node 22.
 *     Cero dependencias npm, cero compilación nativa, funciona offline. El
 *     esquema es SQL portable: mañana puede migrar a PostgreSQL sin rediseño.
 *
 * 🇬🇧 EN — WHAT IT DOES: opens the SQLite knowledge database, runs the SQL
 *     migrations and offers safe query helpers (all/get/run/tx) plus entity
 *     indexing into FTS5.
 *     WHY IT EXISTS (DEC-00002): we use `node:sqlite`, built into Node 22.
 *     Zero npm dependencies, zero native compilation, works offline. The schema
 *     is portable SQL: it can migrate to PostgreSQL later without a redesign.
 *
 * 🇧🇷 PT — O QUE FAZ: abre o banco SQLite do conhecimento, executa as migrações
 *     SQL e oferece auxiliares seguros de consulta (all/get/run/tx) e indexação
 *     de entidades no FTS5.
 *     POR QUE EXISTE (DEC-00002): usamos `node:sqlite`, embutido no Node 22.
 *     Zero dependências npm, zero compilação nativa, funciona offline. O schema
 *     é SQL portável: pode migrar para PostgreSQL depois sem redesenho.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • ¿Qué es una migración? ES/EN/PT: un archivo SQL numerado que describe un
 *     cambio de esquema (0001_init.sql, 0002_add_x.sql). La base guarda cuáles
 *     ya aplicó en la tabla `schema_meta`, así al arrancar solo ejecuta los
 *     pendientes. Sin migraciones, cada desarrollador tendría un esquema distinto.
 *     A migration is a numbered SQL file; the DB records which ones ran.
 *   • Prepared statement ES/EN/PT: `db.prepare('SELECT * FROM t WHERE id = ?')`
 *     compila la consulta UNA vez y la reutiliza con distintos valores. Es más
 *     rápido y, sobre todo, evita SQL INJECTION: los `?` nunca se interpretan
 *     como código SQL. NUNCA hagas `"WHERE id = '" + entrada + "'"`.
 *     Prepared statements are faster and prevent SQL injection. Never concatenate.
 *   • ⚠️ node:sqlite solo acepta: null, number, bigint, string y Uint8Array.
 *     Un `undefined` o un `true` lanzan excepción. Por eso `sanitizeParams()`
 *     convierte undefined→null y boolean→1/0. Este es el error nº1 al empezar.
 *     node:sqlite accepts only null/number/bigint/string/Uint8Array: we convert.
 *   • Transacción ES/EN/PT: `BEGIN ... COMMIT` agrupa varias escrituras: o se
 *     guardan TODAS o ninguna (`ROLLBACK`). Insertar 500 mensajes sin
 *     transacción es 500 veces más lento Y puede dejar la base a medias.
 *     A transaction commits all writes or none; also dramatically faster.
 *   • WAL (Write-Ahead Logging) ES/EN/PT: modo de journal donde las escrituras
 *     van a un archivo -wal y los lectores no bloquean a los escritores.
 *     Crea archivos .db-wal y .db-shm: son temporales, por eso están en .gitignore.
 *     WAL lets readers and writers coexist; it creates temporary side files.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { PATHS } from '../../core/shared/paths.js';
import { ensureDir } from '../../core/shared/json.js';
import { ok, fail, attempt } from '../../core/shared/result.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(THIS_DIR, 'migrations');
export const SCHEMA_VERSION = '0001';

let ACTIVE = null; // ES: conexión reutilizada del proceso | EN: process-wide connection

/** ES/EN/PT: lista los archivos de migración ordenados. Lists migration files in order. */
export function listMigrations(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4,}_.+\.sql$/.test(name))
    .sort()
    .map((name) => ({ name, version: name.split('_')[0], file: path.join(dir, name) }));
}

/**
 * ES: convierte los parámetros a tipos que node:sqlite acepta.
 *     undefined → null, boolean → 1/0, Date → ISO string, objeto/array → JSON.
 * EN: converts parameters into types node:sqlite accepts.
 *     undefined → null, boolean → 1/0, Date → ISO string, object/array → JSON.
 * PT: converte os parâmetros para tipos que node:sqlite aceita.
 *     undefined → null, boolean → 1/0, Date → string ISO, objeto/array → JSON.
 *
 * @param {any[]} params
 */
export function sanitizeParams(params = []) {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') return value;
    if (value instanceof Uint8Array) return value;
    // ES: objetos y arrays se serializan a JSON (columnas *_json).
    // EN: objects and arrays are serialized to JSON (the *_json columns).
    // PT: objetos e arrays são serializados em JSON (as colunas *_json).
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
}

/** ES/EN/PT: serializa a JSON o null. Serializes to JSON or null. */
export function toJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return null; }
}

/** ES/EN/PT: parsea JSON tolerante a fallos. Failure-tolerant JSON parse. */
export function fromJson(text, fallback = null) {
  if (text === null || text === undefined || text === '') return fallback;
  if (typeof text !== 'string') return text;
  try { return JSON.parse(text); } catch { return fallback; }
}

/**
 * ES: aplica las migraciones pendientes y registra la versión del esquema.
 * EN: applies pending migrations and records the schema version.
 * PT: aplica as migrações pendentes e registra a versão do schema.
 */
export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const migrations = listMigrations();
  const applied = [];
  const now = new Date().toISOString();

  for (const migration of migrations) {
    const already = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get(`migration:${migration.version}`);
    if (already) continue;
    const sql = fs.readFileSync(migration.file, 'utf8');
    // ES: exec() permite múltiples sentencias separadas por ';'. prepare() no.
    // EN: exec() allows multiple ';'-separated statements. prepare() does not.
    // PT: exec() permite múltiplas sentenças separadas por ';'. prepare() não.
    db.exec(sql);
    db.prepare('INSERT INTO schema_meta(key, value, updated_at) VALUES (?,?,?)').run(`migration:${migration.version}`, now, now);
    applied.push(migration.version);
  }

  const current = migrations.length ? migrations[migrations.length - 1].version : SCHEMA_VERSION;
  db.prepare(`INSERT INTO schema_meta(key, value, updated_at) VALUES ('schema_version', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(current, now);

  return { applied, schema_version: current, total_migrations: migrations.length };
}

/**
 * ES: abre (o reutiliza) la base de datos del conocimiento.
 * EN: opens (or reuses) the knowledge database.
 * PT: abre (ou reutiliza) o banco de dados do conhecimento.
 *
 * @param {{ file?: string, migrate?: boolean, reuse?: boolean, readOnly?: boolean }} [options]
 */
export function openDatabase(options = {}) {
  const { file = PATHS.database, migrate: shouldMigrate = true, reuse = true, readOnly = false } = options;

  if (reuse && ACTIVE && ACTIVE.file === file && !readOnly) return ACTIVE.db;

  ensureDir(path.dirname(file));
  const db = new DatabaseSync(file, readOnly ? { readOnly: true } : {});

  if (shouldMigrate && !readOnly) {
    migrate(db);
    db.prepare('PRAGMA foreign_keys = ON').run();
    // ES: autoreparación defensiva — si un índice FTS quedó inconsistente por una
    //     ejecución anterior interrumpida, lo reconstruimos al abrir.
    // EN: defensive self-healing — if an FTS index was left inconsistent by a
    //     previous interrupted run, we rebuild it on open.
    // PT: autorreparo defensivo — se um índice FTS ficou inconsistente por uma
    //     execução anterior interrompida, nós o reconstruímos ao abrir.
    try {
      db.prepare('SELECT COUNT(*) AS n FROM fts_index').get();
    } catch {
      rebuildFtsIndexes(db);
    }
  }

  if (reuse && !readOnly) {
    ACTIVE = { file, db };
  }
  return db;
}

/** ES/EN/PT: cierra la conexión activa. Closes the active connection. */
export function closeDatabase(db = null) {
  const target = db ?? ACTIVE?.db;
  if (!target) return false;
  try { target.close(); } catch { /* ES: ya estaba cerrada | EN: already closed */ }
  if (ACTIVE && ACTIVE.db === target) ACTIVE = null;
  return true;
}

/** ES/EN/PT: ejecuta una función con una base abierta y la cierra al terminar. */
export function withDatabase(fn, options = {}) {
  const db = openDatabase({ ...options, reuse: false });
  try {
    return fn(db);
  } finally {
    closeDatabase(db);
  }
}

/* ── Ayudantes de consulta / Query helpers ────────────────────────────────── */

/** ES/EN/PT: todas las filas. All rows. */
export function all(db, sql, params = []) {
  return db.prepare(sql).all(...sanitizeParams(params));
}

/** ES/EN/PT: la primera fila o undefined. First row or undefined. */
export function get(db, sql, params = []) {
  return db.prepare(sql).get(...sanitizeParams(params));
}

/** ES/EN/PT: ejecuta escritura y devuelve {changes, lastInsertRowid}. Runs a write. */
export function run(db, sql, params = []) {
  return db.prepare(sql).run(...sanitizeParams(params));
}

/** ES/EN/PT: un valor escalar de la primera fila. A single scalar value. */
export function scalar(db, sql, params = [], fallback = null) {
  const row = get(db, sql, params);
  if (!row) return fallback;
  const value = Object.values(row)[0];
  return value === undefined ? fallback : value;
}

/**
 * ES: ejecuta varias operaciones dentro de una transacción. Si algo falla, se
 *     revierte TODO. Devuelve un Result para no lanzar excepciones.
 * EN: runs several operations inside a transaction. If anything fails, EVERYTHING
 *     is rolled back. Returns a Result instead of throwing.
 * PT: executa várias operações dentro de uma transação. Se algo falhar, TUDO é
 *     revertido. Devolve um Result em vez de lançar exceções.
 */
export function tx(db, fn) {
  return attempt(() => {
    db.exec('BEGIN');
    try {
      const value = fn(db);
      db.exec('COMMIT');
      return value;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* ES: nada que revertir | EN: nothing to roll back */ }
      throw error;
    }
  }, { code: 'db_transaction_failed', interruptionType: 'tool_error', layer: 'knowledge' });
}

/**
 * ES: inserta o reemplaza una fila (upsert) usando INSERT ... ON CONFLICT.
 * EN: inserts or replaces a row (upsert) using INSERT ... ON CONFLICT.
 * PT: insere ou substitui uma linha (upsert) usando INSERT ... ON CONFLICT.
 *
 * @param {string} table
 * @param {Record<string, any>} row
 * @param {string} [conflictKey='id']
 */
export function upsert(db, table, row, conflictKey = 'id') {
  const keys = Object.keys(row);
  if (!keys.length) return fail('upsert requires a non-empty row', { code: 'db_upsert_empty' });
  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.filter((k) => k !== conflictKey).map((k) => `${k} = excluded.${k}`).join(', ');
  const sql = updates
    ? `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(${conflictKey}) DO UPDATE SET ${updates}`
    : `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  return attempt(() => run(db, sql, keys.map((k) => row[k])), { code: 'db_upsert_failed', details: { table } });
}

/**
 * ES: (re)indexa una entidad en el índice FTS unificado. Borra la entrada
 *     anterior del mismo id para no duplicar al reprocesar.
 * EN: (re)indexes an entity in the unified FTS index. Deletes the previous entry
 *     with the same id so reprocessing never duplicates.
 * PT: (re)indexa uma entidade no índice FTS unificado. Apaga a entrada anterior
 *     do mesmo id para não duplicar ao reprocessar.
 */
export function indexEntity(db, { entityType, entityId, title = '', body = '', tags = [] }) {
  run(db, 'DELETE FROM fts_index WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
  run(db, 'INSERT INTO fts_index(entity_type, entity_id, title, body, tags) VALUES (?,?,?,?,?)', [
    entityType,
    entityId,
    String(title ?? '').slice(0, 2000),
    String(body ?? '').slice(0, 200000),
    Array.isArray(tags) ? tags.join(' ') : String(tags ?? ''),
  ]);
  return entityId;
}

/** ES/EN/PT: índice FTS dedicado a mensajes (búsqueda conversacional). Message-only FTS index. */
export function indexMessage(db, message) {
  run(db, 'DELETE FROM fts_messages WHERE message_id = ?', [message.id]);
  run(db, 'INSERT INTO fts_messages(message_id, session_id, role, intent, body) VALUES (?,?,?,?,?)', [
    message.id, message.session_id ?? null, message.role ?? 'user', message.intent ?? null, String(message.content ?? ''),
  ]);
}

/** ES/EN/PT: estadísticas de la base (filas por tabla, tamaño en disco). */
export function dbStats(db, file = PATHS.database) {
  const tables = all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'fts_%' ORDER BY name")
    .map((r) => r.name);
  const counts = {};
  for (const table of tables) {
    try { counts[table] = Number(scalar(db, `SELECT COUNT(*) AS n FROM ${table}`, [], 0)); } catch { counts[table] = null; }
  }
  let bytes = 0;
  try { bytes = fs.statSync(file).size; } catch { bytes = 0; }
  return {
    file: path.relative(PATHS.root, file).split(path.sep).join('/'),
    bytes,
    tables: tables.length,
    counts,
    indexed_entities: Number(scalar(db, 'SELECT COUNT(*) AS n FROM fts_index', [], 0)),
    indexed_messages: Number(scalar(db, 'SELECT COUNT(*) AS n FROM fts_messages', [], 0)),
    schema_version: scalar(db, "SELECT value FROM schema_meta WHERE key='schema_version'", [], null),
  };
}

/**
 * ES: reconstruye los índices FTS5. Es la reparación oficial que sugiere SQLite
 *     cuando el índice queda inconsistente ("run 'rebuild'").
 * EN: rebuilds the FTS5 indexes. This is the official repair SQLite suggests when
 *     an index becomes inconsistent ("run 'rebuild'").
 * PT: reconstrói os índices FTS5. É o reparo oficial que o SQLite sugere quando o
 *     índice fica inconsistente ("run 'rebuild'").
 */
export function rebuildFtsIndexes(db) {
  const rebuilt = [];
  for (const table of ['fts_index', 'fts_messages']) {
    try {
      db.exec(`INSERT INTO ${table}(${table}) VALUES('rebuild')`);
      rebuilt.push(table);
    } catch {
      // ES: si la tabla no existe todavía, no hay nada que reconstruir.
      // EN: if the table does not exist yet, there is nothing to rebuild.
      // PT: se a tabela ainda não existe, não há nada para reconstruir.
    }
  }
  return rebuilt;
}

/**
 * ES: vacía todas las tablas de datos conservando el esquema.
 *     ⚠️ BUG REAL CORREGIDO: antes seleccionábamos TODAS las tablas y eso
 *     incluía las tablas sombra internas de FTS5 (fts_index_data, fts_index_idx,
 *     fts_index_content, fts_index_docsize, fts_index_config). Borrarlas a mano
 *     destruye la estructura del índice y SQLite responde
 *     "invalid fts5 file format (found 0, expected 4 or 5) - run 'rebuild'".
 *     La solución correcta y GENÉRICA es filtrar `sql IS NOT NULL`: las tablas
 *     sombra creadas internamente por una tabla virtual tienen sql NULL, mientras
 *     que la tabla virtual (fts_index) sí conserva su CREATE VIRTUAL TABLE y
 *     acepta `DELETE FROM` sin romperse.
 * EN: empties all data tables keeping the schema.
 *     ⚠️ REAL BUG FIXED: we used to select EVERY table, which included the FTS5
 *     internal shadow tables. Deleting them by hand destroys the index structure.
 *     The correct GENERIC fix is filtering `sql IS NOT NULL`: shadow tables
 *     created internally by a virtual table have NULL sql, while the virtual
 *     table itself keeps its CREATE VIRTUAL TABLE and accepts DELETE FROM safely.
 * PT: esvazia todas as tabelas de dados preservando o schema.
 *     ⚠️ BUG REAL CORRIGIDO: antes selecionávamos TODAS as tabelas, o que incluía
 *     as tabelas sombra internas do FTS5. Apagá-las à mão destrói a estrutura do
 *     índice. O correto e GENÉRICO é filtrar `sql IS NOT NULL`: as tabelas sombra
 *     criadas internamente por uma tabela virtual têm sql NULL, enquanto a tabela
 *     virtual mantém seu CREATE VIRTUAL TABLE e aceita DELETE FROM com segurança.
 */
export function truncateData(db) {
  const tables = all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_meta' AND sql IS NOT NULL ORDER BY name").map((r) => r.name);
  return tx(db, (handle) => {
    handle.exec('PRAGMA foreign_keys = OFF');
    for (const table of tables) handle.exec(`DELETE FROM ${table}`);
    handle.exec('PRAGMA foreign_keys = ON');
    // ES: tras vaciar, reconstruimos los índices FTS para dejarlos consistentes.
    // EN: after emptying, we rebuild the FTS indexes to leave them consistent.
    // PT: após esvaziar, reconstruímos os índices FTS para deixá-los consistentes.
    rebuildFtsIndexes(handle);
    return tables.length;
  });
}

/** ES/EN/PT: borra físicamente la base (y sus archivos WAL). Physically deletes the DB and WAL files. */
export function destroyDatabase(file = PATHS.database) {
  closeDatabase();
  const removed = [];
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const candidate = `${file}${suffix}`;
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate, { force: true });
      removed.push(path.basename(candidate));
    }
  }
  return ok({ removed });
}

export default {
  MIGRATIONS_DIR, SCHEMA_VERSION, listMigrations, sanitizeParams, toJson, fromJson, migrate, rebuildFtsIndexes,
  openDatabase, closeDatabase, withDatabase, all, get, run, scalar, tx, upsert,
  indexEntity, indexMessage, dbStats, truncateData, destroyDatabase,
};

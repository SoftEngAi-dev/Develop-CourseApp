-- ═══════════════════════════════════════════════════════════════════════════
-- knowledge/db/migrations/0001_init.sql
-- ───────────────────────────────────────────────────────────────────────────
-- 🇪🇸 ES — QUÉ HACE: crea TODAS las tablas del Knowledge Engine: sesiones,
--     mensajes, decisiones, planes, acciones, búsquedas, errores,
--     interrupciones, requisitos, lecciones, artefactos, construcciones,
--     dependencias, nodos y aristas del grafo, eventos... más un índice de
--     búsqueda full-text (FTS5) que cruza todas las entidades.
--     POR QUÉ EXISTE: el nivel PROCESSED/KNOWLEDGE necesita ser consultable.
--     Recorrer 5.000 archivos JSON para responder "¿por qué elegimos SQLite?"
--     tardaría minutos; una tabla con índice responde en milisegundos.
--     DEC-00002: node:sqlite + FTS5, cero dependencias npm.
--
-- 🇬🇧 EN — WHAT IT DOES: creates EVERY table of the Knowledge Engine:
--     sessions, messages, decisions, plans, actions, searches, errors,
--     interruptions, requirements, lessons, artifacts, builds, dependencies,
--     graph nodes and edges, events... plus a full-text search index (FTS5)
--     spanning all entities.
--     WHY IT EXISTS: the PROCESSED/KNOWLEDGE level must be queryable. Scanning
--     5.000 JSON files to answer "why did we choose SQLite?" would take minutes;
--     an indexed table answers in milliseconds.
--
-- 🇧🇷 PT — O QUE FAZ: cria TODAS as tabelas do Knowledge Engine: sessões,
--     mensagens, decisões, planos, ações, buscas, erros, interrupções,
--     requisitos, lições, artefatos, construções, dependências, nós e arestas
--     do grafo, eventos... mais um índice de busca full-text (FTS5) que cruza
--     todas as entidades.
--     POR QUE EXISTE: o nível PROCESSED/KNOWLEDGE precisa ser consultável.
--     Percorrer 5.000 arquivos JSON para responder "por que escolhemos SQLite?"
--     levaria minutos; uma tabela indexada responde em milissegundos.
--
-- 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
--   • CREATE TABLE IF NOT EXISTS ES/EN/PT: crea la tabla solo si no existe.
--     Así el script de migración se puede ejecutar 100 veces sin romper nada
--     (idempotente). Creates the table only if missing, so it is idempotent.
--   • PRIMARY KEY ES/EN/PT: columna que identifica cada fila de forma única.
--     Intentar repetir un ID da error: eso es bueno, protege la integridad.
--     A column that uniquely identifies each row; duplicates raise an error.
--   • TEXT vs INTEGER vs REAL ES/EN/PT: SQLite es de "tipado dinámico", pero
--     declarar el tipo ayuda a optimizar y documenta la intención.
--     SQLite is dynamically typed, but declaring types documents intent.
--   • ¿Por qué guardamos JSON dentro de una columna TEXT? ES/EN/PT: campos como
--     `alternatives` son listas de objetos de forma variable. Crear una tabla
--     por cada uno sería explosión de tablas; guardar JSON nos da flexibilidad.
--     El truco: lo que se BUSCA va en columnas normales; lo que se MUESTRA va
--     en JSON. Searchable data in columns, presentational data in JSON.
--   • FOREIGN KEY ... ON DELETE CASCADE ES/EN/PT: si borras una sesión, se
--     borran sus mensajes automáticamente. Sin esto quedarían huérfanos.
--     Deleting a session deletes its messages automatically.
--   • INDEX ES/EN/PT: estructura que acelera búsquedas por una columna, a
--     cambio de ocupar espacio y hacer las escrituras algo más lentas.
--     An index speeds up lookups on a column at the cost of space.
--   • FTS5 ES/EN/PT: extensión de SQLite para búsqueda de texto completo.
--     Entiende "MATCH 'sqlite OR fts5'", ordena por relevancia (bm25) y
--     tokeniza palabras. Es lo que hace posible `genesis search`.
--     SQLite's full-text search extension; powers `genesis search`.
--   • `content=''` en FTS5 ES/EN/PT: tabla "sin contenido": guarda solo el
--     índice, no el texto. Ocupa menos, pero NO puedes leer las columnas de
--     vuelta (devuelven null). Por eso aquí NO la usamos: queremos mostrar el
--     texto encontrado. Contentless tables cannot return column values.
-- ═══════════════════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Metadatos del esquema / Schema metadata ────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── NIVEL 1→2: sesiones y mensajes procesados ──────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  title          TEXT,
  source         TEXT,
  format         TEXT,
  started_at     TEXT,
  ended_at       TEXT,
  captured_at    TEXT,
  message_count  INTEGER DEFAULT 0,
  chars          INTEGER DEFAULT 0,
  language       TEXT,
  raw_hash       TEXT,
  processed_at   TEXT,
  file           TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL,
  idx                INTEGER NOT NULL DEFAULT 0,
  role               TEXT NOT NULL DEFAULT 'user',
  ts                 TEXT,
  content            TEXT NOT NULL,
  language           TEXT,
  language_confidence REAL,
  intent             TEXT,
  intent_confidence  REAL,
  secondary_intents  TEXT,
  chars              INTEGER DEFAULT 0,
  words              INTEGER DEFAULT 0,
  lines              INTEGER DEFAULT 0,
  requirements_json  TEXT,
  constraints_json   TEXT,
  unknowns_json      TEXT,
  headings_json      TEXT,
  entities_json      TEXT,
  terms_json         TEXT,
  links_json         TEXT,
  code_blocks        INTEGER DEFAULT 0,
  json_blocks        INTEGER DEFAULT 0,
  interpreted_by     TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, idx);
CREATE INDEX IF NOT EXISTS idx_messages_intent  ON messages(intent);
CREATE INDEX IF NOT EXISTS idx_messages_role    ON messages(role);

-- ── Decision Traces (DEC-00003) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id              TEXT PRIMARY KEY,
  layer           TEXT,
  status          TEXT DEFAULT 'proposed',
  objective_es    TEXT,
  objective_en    TEXT,
  objective_pt    TEXT,
  context         TEXT,
  constraints_json TEXT,
  alternatives_json TEXT,
  decision        TEXT NOT NULL,
  justification   TEXT,
  consequence     TEXT,
  related_json    TEXT,
  evidence        TEXT,
  session_id      TEXT,
  created_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_decisions_layer  ON decisions(layer);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);

-- ── Planes (sección 3.C) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                TEXT PRIMARY KEY,
  session_id        TEXT,
  task              TEXT,
  layer             TEXT,
  objective         TEXT NOT NULL,
  steps_json        TEXT,
  dependencies_json TEXT,
  risks_json        TEXT,
  status            TEXT DEFAULT 'proposed',
  created_at        TEXT
);

-- ── Acciones ejecutadas (sección 3.D y 3.E) ────────────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT,
  task        TEXT,
  layer       TEXT,
  action      TEXT NOT NULL,
  tool        TEXT,
  result      TEXT,
  status      TEXT DEFAULT 'success',
  artifact    TEXT,
  verification TEXT,
  ts          TEXT
);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- ── Búsquedas (sección 15) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS searches (
  id               TEXT PRIMARY KEY,
  session_id       TEXT,
  query            TEXT NOT NULL,
  reason           TEXT,
  sources_json     TEXT,
  selected         TEXT,
  why              TEXT,
  influenced_json  TEXT,
  ts               TEXT
);

-- ── Errores y su ciclo de aprendizaje (sección 24) ─────────────────────────
CREATE TABLE IF NOT EXISTS errors (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  task          TEXT,
  layer         TEXT,
  message       TEXT NOT NULL,
  analysis      TEXT,
  recovery      TEXT,
  lesson        TEXT,
  rule_created  TEXT,
  severity      TEXT DEFAULT 'medium',
  resolved      INTEGER DEFAULT 0,
  ts            TEXT
);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON errors(resolved);

-- ── Interruptions / "Cortes" (DEC-00004) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS interruptions (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL,
  layer              TEXT,
  task               TEXT,
  reason             TEXT NOT NULL,
  impact             TEXT DEFAULT 'medium',
  recoverable        INTEGER DEFAULT 1,
  recovery_plan_json TEXT,
  status             TEXT DEFAULT 'open',
  detected_at        TEXT,
  resolved_at        TEXT,
  waiting_on         TEXT
);
CREATE INDEX IF NOT EXISTS idx_interruptions_status ON interruptions(status);
CREATE INDEX IF NOT EXISTS idx_interruptions_type   ON interruptions(type);

-- ── Requisitos y sus cambios (sección 2 / nivel 2) ─────────────────────────
CREATE TABLE IF NOT EXISTS requirements (
  id           TEXT PRIMARY KEY,
  layer        TEXT,
  title        TEXT NOT NULL,
  priority     TEXT DEFAULT 'medium',
  status       TEXT DEFAULT 'discovered',
  acceptance   TEXT,
  source_id    TEXT,
  session_id   TEXT,
  created_at   TEXT,
  updated_at   TEXT
);
CREATE TABLE IF NOT EXISTS requirement_changes (
  id              TEXT PRIMARY KEY,
  requirement_id  TEXT NOT NULL,
  field           TEXT NOT NULL,
  before_value    TEXT,
  after_value     TEXT,
  reason          TEXT,
  ts              TEXT,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
);

-- ── Lecciones (sección 3.G) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id           TEXT PRIMARY KEY,
  source_type  TEXT,
  source_id    TEXT,
  lesson       TEXT NOT NULL,
  future_rule  TEXT,
  layer        TEXT,
  created_at   TEXT
);

-- ── Construcciones / Builds (sección 16) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS builds (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  status          TEXT DEFAULT 'planned',
  objective       TEXT,
  layer           TEXT,
  files_json      TEXT,
  dependencies_json TEXT,
  tests_json      TEXT,
  problems_json   TEXT,
  fixes_json      TEXT,
  decisions_json  TEXT,
  documentation   TEXT,
  course_ref      TEXT,
  created_at      TEXT,
  completed_at    TEXT
);

-- ── Artefactos producidos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  path        TEXT,
  build_id    TEXT,
  session_id  TEXT,
  hash        TEXT,
  bytes       INTEGER,
  created_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON artifacts(kind);

-- ── Dependencias (de paquetes y entre entidades) ───────────────────────────
CREATE TABLE IF NOT EXISTS dependencies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  version      TEXT,
  kind         TEXT DEFAULT 'runtime',
  required_by  TEXT,
  built_in     INTEGER DEFAULT 0,
  notes        TEXT
);

-- ── Knowledge Graph (sección 11) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  label       TEXT NOT NULL,
  label_es    TEXT,
  label_en    TEXT,
  label_pt    TEXT,
  what_is     TEXT,
  why_exists  TEXT,
  where_used  TEXT,
  how_built   TEXT,
  problems    TEXT,
  learned     TEXT,
  code_refs_json  TEXT,
  sessions_json   TEXT,
  sources_json    TEXT,
  meta_json   TEXT,
  created_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);

CREATE TABLE IF NOT EXISTS edges (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL,
  to_id       TEXT NOT NULL,
  relation    TEXT NOT NULL,
  weight      REAL DEFAULT 1,
  meta_json   TEXT,
  created_at  TEXT,
  FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id)   REFERENCES nodes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_id);

-- ── Eventos (espejo consultable del JSONL de RAW) ──────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  ts          TEXT NOT NULL,
  layer       TEXT,
  task        TEXT,
  actor       TEXT,
  severity    TEXT,
  session_id  TEXT,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);

-- ── Tareas (espejo de control/tasks.json para consultas rápidas) ───────────
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  phase        TEXT,
  layer        TEXT,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'discovered',
  progress     INTEGER DEFAULT 0,
  created_at   TEXT,
  completed_at TEXT,
  updated_at   TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ÍNDICE DE BÚSQUEDA FULL-TEXT (FTS5)
-- ES: UNA sola tabla FTS que indexa todas las entidades. Cada fila dice de qué
--     tipo es (entity_type) y a qué entidad apunta (entity_id). Así
--     `genesis search "sqlite"` devuelve decisiones, mensajes, lecciones y
--     nodos del grafo mezclados por relevancia, en una única consulta.
-- EN: ONE FTS table indexing every entity. Each row states its entity_type and
--     points to its entity_id, so `genesis search "sqlite"` returns decisions,
--     messages, lessons and graph nodes ranked together in a single query.
-- PT: UMA única tabela FTS indexando todas as entidades. Cada linha diz o
--     entity_type e aponta para o entity_id, então `genesis search "sqlite"`
--     devolve decisões, mensagens, lições e nós do grafo juntos, por relevância.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
  entity_type UNINDEXED,
  entity_id   UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ES: `remove_diacritics 2` hace que "decisión" y "decision" encuentren lo
--     mismo. Crítico en un proyecto trilingüe ES/EN/PT.
-- EN: `remove_diacritics 2` makes "decisión" and "decision" match the same
--     thing. Critical in a trilingual ES/EN/PT project.
-- PT: `remove_diacritics 2` faz "decisão" e "decision" encontrarem a mesma
--     coisa. Crítico num projeto trilíngue ES/EN/PT.

CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages USING fts5(
  message_id UNINDEXED,
  session_id UNINDEXED,
  role       UNINDEXED,
  intent     UNINDEXED,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

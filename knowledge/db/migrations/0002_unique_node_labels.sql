-- ═══════════════════════════════════════════════════════════════════════════
-- knowledge/db/migrations/0002_unique_node_labels.sql
-- ───────────────────────────────────────────────────────────────────────────
-- 🇪🇸 ES — QUÉ HACE: garantiza en la propia base que no puedan existir dos nodos
--     con el mismo tipo y la misma etiqueta, y limpia los duplicados que ya se
--     hubieran creado.
--     POR QUÉ EXISTE (bug real detectado en pruebas): `ensureNode()` guardaba la
--     etiqueta CRUDA (con saltos de línea y espacios múltiples) pero la buscaba
--     NORMALIZADA (espacios colapsados). Como `lower("a\nb") <> lower("a b")`, la
--     búsqueda nunca encontraba el nodo existente y se creaba un duplicado.
--     Se observó con DEC-00002: NOD-00029 y NOD-00082 con etiquetas idénticas
--     byte a byte. La corrección tiene dos partes:
--       1. en el código: normalizar antes de guardar Y antes de buscar;
--       2. aquí: un índice UNIQUE que hace imposible el duplicado a nivel de base,
--          aunque un módulo futuro vuelva a equivocarse.
--     Esto es defensa en profundidad: el código puede fallar, la restricción no.
--
-- 🇬🇧 EN — WHAT IT DOES: guarantees at the database level that two nodes with the
--     same kind and label cannot exist, and cleans up duplicates already created.
--     WHY IT EXISTS (real bug found in testing): `ensureNode()` stored the RAW
--     label (with newlines and multiple spaces) but looked it up NORMALIZED
--     (whitespace collapsed). Because `lower("a\nb") <> lower("a b")`, the lookup
--     never found the existing node and a duplicate was created. Observed with
--     DEC-00002: NOD-00029 and NOD-00082 with byte-identical labels. The fix has
--     two parts: (1) in code, normalize before storing AND before searching;
--     (2) here, a UNIQUE index that makes duplicates impossible at the database
--     level even if a future module gets it wrong again.
--     This is defense in depth: code can fail, the constraint cannot.
--
-- 🇧🇷 PT — O QUE FAZ: garante, no próprio banco, que não possam existir dois nós
--     com o mesmo tipo e o mesmo rótulo, e limpa as duplicatas já criadas.
--     POR QUE EXISTE (bug real detectado em testes): `ensureNode()` guardava o
--     rótulo BRUTO (com quebras de linha e espaços múltiplos) mas o procurava
--     NORMALIZADO (espaços colapsados). Como `lower("a\nb") <> lower("a b")`, a
--     busca nunca encontrava o nó existente e uma duplicata era criada. A correção
--     tem duas partes: (1) no código, normalizar antes de guardar E de buscar;
--     (2) aqui, um índice UNIQUE que torna a duplicata impossível no nível do
--     banco. Isto é defesa em profundidade: o código pode falhar, a restrição não.
--
-- 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
--   • Índice UNIQUE sobre expresión ES/EN/PT: `CREATE UNIQUE INDEX ... ON
--     nodes(kind, lower(label))` no indexa la columna tal cual, sino el resultado
--     de una función. SQLite lo llama "expression index". Así la unicidad se
--     aplica ignorando mayúsculas, sin necesidad de guardar una columna extra.
--     An expression index enforces uniqueness over a computed value.
--   • ¿Por qué borrar duplicados ANTES de crear el índice? ES/EN/PT: si ya hay
--     dos filas iguales, `CREATE UNIQUE INDEX` falla. Por eso el DELETE va primero.
--     El `MIN(rowid)` conserva la fila más antigua de cada grupo.
--     You must remove existing duplicates before a unique index can be created.
--   • Migración numerada ES/EN/PT: este archivo se llama 0002_ y no se edita el
--     0001_. Las migraciones son históricas: se AÑADEN, nunca se reescriben, igual
--     que el nivel RAW del proyecto. Migrations are append-only history.
-- ═══════════════════════════════════════════════════════════════════════════

-- ES: 1) canonicalizamos las etiquetas ya guardadas (saltos de línea y tabulaciones
--     → un solo espacio). Sin este paso, dos filas que son "la misma" seguirían
--     siendo distintas para el índice y el DELETE siguiente no las agruparía.
-- EN: 1) we canonicalize already stored labels (newlines and tabs → a single space).
--     Without this step two rows that are "the same" would remain different for the
--     index and the next DELETE would not group them.
-- PT: 1) canonicalizamos os rótulos já guardados (quebras de linha e tabulações →
--     um único espaço). Sem este passo, duas linhas que são "a mesma" continuariam
--     diferentes para o índice e o DELETE seguinte não as agruparia.
UPDATE nodes
   SET label = trim(replace(replace(replace(label, char(10), ' '), char(13), ' '), char(9), ' '))
 WHERE label LIKE '%' || char(10) || '%' OR label LIKE '%' || char(13) || '%' OR label LIKE '%' || char(9) || '%';

-- ES: 2) eliminamos duplicados conservando el nodo más antiguo de cada grupo.
-- EN: 2) remove duplicates keeping the oldest node of each group.
-- PT: 2) eliminamos duplicatas preservando o nó mais antigo de cada grupo.
DELETE FROM nodes
 WHERE rowid NOT IN (
   SELECT MIN(rowid) FROM nodes GROUP BY kind, lower(trim(replace(replace(label, char(10), ' '), char(13), ' ')))
 );

-- ES: 3) las aristas huérfanas que apuntaban a nodos borrados deben desaparecer.
--     `ON DELETE CASCADE` solo funciona si foreign_keys estaba activo al borrar;
--     por seguridad las limpiamos explícitamente.
-- EN: 3) orphan edges pointing at deleted nodes must disappear. CASCADE only
--     applies when foreign_keys was enabled at delete time, so we clean explicitly.
-- PT: 3) arestas órfãs apontando para nós apagados devem desaparecer. CASCADE só
--     vale se foreign_keys estava ativo; por segurança limpamos explicitamente.
DELETE FROM edges WHERE from_id NOT IN (SELECT id FROM nodes);
DELETE FROM edges WHERE to_id   NOT IN (SELECT id FROM nodes);

-- ES: 4) restricción dura: un (kind, label) normalizado no puede repetirse.
-- EN: 4) hard constraint: a normalized (kind, label) cannot repeat.
-- PT: 4) restrição dura: um (kind, label) normalizado não pode se repetir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_nodes_kind_label
  ON nodes(kind, lower(trim(replace(replace(label, char(10), ' '), char(13), ' '))));

-- ES: 5) índice de apoyo para buscar aristas por relación (usado por el grafo).
-- EN: 5) supporting index to look up edges by relation (used by the graph).
-- PT: 5) índice de apoio para buscar arestas por relação (usado pelo grafo).
CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);

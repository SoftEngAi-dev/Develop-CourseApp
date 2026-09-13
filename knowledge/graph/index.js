/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/graph/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: construye y consulta el GRAFO DE CONOCIMIENTO. Un grafo es
 *     un conjunto de NODOS (cosas: React, SQLite, "Context Engine", la decisión
 *     DEC-00002) y ARISTAS (relaciones: React ─usa→ TypeScript,
 *     DEC-00002 ─decide_sobre→ SQLite, LECCIÓN ─evita→ ERROR).
 *     Cada nodo guarda el perfil completo de la sección 11:
 *       qué es · por qué existe · dónde se utiliza · cómo se implementó ·
 *       qué problemas tuvo · qué aprendimos · código relacionado ·
 *       sesiones relacionadas · fuentes
 *     POR QUÉ EXISTE: una base de datos relacional responde "¿qué decisiones
 *     mencionan SQLite?". Un grafo responde "¿cómo se conecta SQLite con todo lo
 *     demás?". La segunda pregunta es la que de verdad enseña el proyecto.
 *
 * 🇬🇧 EN — WHAT IT DOES: builds and queries the KNOWLEDGE GRAPH. A graph is a
 *     set of NODES (things: React, SQLite, "Context Engine", decision DEC-00002)
 *     and EDGES (relations: React ─uses→ TypeScript, DEC-00002 ─decides_about→
 *     SQLite, LESSON ─prevents→ ERROR). Each node stores the full section-11
 *     profile: what it is, why it exists, where it is used, how it was built,
 *     what problems it had, what we learned, related code, related sessions,
 *     sources.
 *     WHY IT EXISTS: a relational database answers "which decisions mention
 *     SQLite?". A graph answers "how does SQLite connect to everything else?".
 *     The second question is the one that actually teaches the project.
 *
 * 🇧🇷 PT — O QUE FAZ: constrói e consulta o GRAFO DE CONHECIMENTO. Um grafo é um
 *     conjunto de NÓS (coisas: React, SQLite, "Context Engine", a decisão
 *     DEC-00002) e ARESTAS (relações: React ─usa→ TypeScript,
 *     DEC-00002 ─decide_sobre→ SQLite, LIÇÃO ─evita→ ERRO). Cada nó guarda o
 *     perfil completo da seção 11.
 *     POR QUE EXISTE: um banco relacional responde "quais decisões mencionam
 *     SQLite?". Um grafo responde "como o SQLite se conecta a todo o resto?". A
 *     segunda pergunta é a que realmente ensina o projeto.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Grafo dirigido ES/EN/PT: las aristas tienen dirección (A→B no implica
 *     B→A). "React usa TypeScript" no significa "TypeScript usa React".
 *     Directed edges: A→B does not imply B→A.
 *   • Peso (weight) ES/EN/PT: número que dice qué tan fuerte es la relación.
 *     Si dos tecnologías aparecen juntas en 30 mensajes, su arista pesa más que
 *     si aparecen juntas una vez. Ese peso es el que permite dibujar el grafo
 *     con las relaciones importantes más gruesas.
 *     Weight = how strong a relation is; co-occurrence counts build it.
 *   • Co-ocurrencia ES/EN/PT: técnica básica de construcción de grafos a partir
 *     de texto. Si A y B aparecen en el mismo mensaje, existe una relación
 *     candidata. No sabemos SEMÁNTICAMENTE cuál es, por eso la llamamos
 *     "co_occurs" y la refinamos después. Honestidad: no inventamos significado.
 *     Co-occurrence: if A and B appear in the same message, a candidate relation
 *     exists. We honestly name it "co_occurs" instead of inventing meaning.
 *   • BFS (búsqueda en anchura) ES/EN/PT: para explorar "vecinos a profundidad
 *     2" usamos una COLA: visitamos el nodo, encolamos sus vecinos, y repetimos
 *     controlando la profundidad. Un `visited` Set evita bucles infinitos en
 *     grafos con ciclos (que son lo normal).
 *     BFS uses a queue and a visited set to explore neighbours by depth safely.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, toJson, fromJson, indexEntity, all, get } from '../db/index.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

/** ES/EN/PT: tipos de nodo admitidos. Allowed node kinds (the /knowledge taxonomy). */
export const NODE_KINDS = Object.freeze([
  'concept', 'technology', 'architecture', 'decision', 'tutorial', 'pattern',
  'lesson', 'mistake', 'solution', 'glossary', 'reference', 'requirement',
  'build', 'task', 'phase', 'session', 'category',
]);

/** ES/EN/PT: tipos de relación admitidos. Allowed edge relations. */
export const RELATIONS = Object.freeze([
  'uses', 'depends_on', 'part_of', 'decides_about', 'implements', 'prevents',
  'caused', 'co_occurs', 'documented_in', 'discussed_in', 'belongs_to',
  'produced', 'supersedes', 'relates_to', 'taught_by', 'verified_by',
]);

/**
 * ES: categorías raíz del nivel KNOWLEDGE (sección 2, nivel 3).
 * EN: root categories of the KNOWLEDGE level (section 2, level 3).
 * PT: categorias raiz do nível KNOWLEDGE (seção 2, nível 3).
 */
export const KNOWLEDGE_CATEGORIES = Object.freeze([
  { label: 'concepts', what_is: 'Reusable explanations of ideas used in the project.' },
  { label: 'technologies', what_is: 'Tools, libraries and runtimes, with why each was chosen.' },
  { label: 'architecture', what_is: 'Structural decisions: levels, layers, modules and seams.' },
  { label: 'decisions', what_is: 'Decision Traces: objective, context, alternatives, justification.' },
  { label: 'tutorials', what_is: 'Step-by-step reconstructions of real builds.' },
  { label: 'patterns', what_is: 'Repeated solutions worth reusing (observer, adapter, result).' },
  { label: 'lessons', what_is: 'What we learned, in human language.' },
  { label: 'mistakes', what_is: 'Errors with their analysis and recovery.' },
  { label: 'solutions', what_is: 'Fixes that worked, ready to be reapplied.' },
  { label: 'glossary', what_is: 'Trilingual technical vocabulary (ES/EN/PT).' },
  { label: 'references', what_is: 'External sources with the reason they were selected.' },
]);

/** ES/EN/PT: normaliza una etiqueta para COMPARAR (minúsculas + espacios colapsados). */
export function normalizeLabel(label) {
  return String(label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * ES: forma canónica que se GUARDA: recorta y colapsa espacios, pero conserva las
 *     mayúsculas para que la etiqueta siga siendo bonita en la interfaz.
 *     ⚠️ BUG REAL CORREGIDO: antes guardábamos la etiqueta cruda (con "\n") y la
 *     buscábamos normalizada. Como `lower("a\nb") <> lower("a b")`, la búsqueda
 *     nunca encontraba el nodo y se creaban duplicados (NOD-00029 / NOD-00082 con
 *     etiquetas idénticas). La regla es simple y vale para cualquier sistema:
 *     GUARDA EN LA MISMA FORMA EN QUE VAS A BUSCAR.
 * EN: canonical form that gets STORED: trims and collapses whitespace but keeps
 *     capitalization so the label still looks good in the UI.
 *     ⚠️ REAL BUG FIXED: we used to store the raw label (with "\n") and look it up
 *     normalized. Since `lower("a\nb") <> lower("a b")`, the lookup never matched
 *     and duplicates were created. The rule is simple and applies to any system:
 *     STORE IN THE SAME FORM YOU WILL SEARCH BY.
 * PT: forma canônica que é GUARDADA: apara e colapsa espaços, mas preserva as
 *     maiúsculas para o rótulo continuar bonito na interface.
 *     ⚠️ BUG REAL CORRIGIDO: antes guardávamos o rótulo bruto (com "\n") e o
 *     procurávamos normalizado. Como `lower("a\nb") <> lower("a b")`, a busca nunca
 *     encontrava o nó e duplicatas eram criadas. A regra é simples: GUARDE NA
 *     MESMA FORMA EM QUE VOCÊ VAI BUSCAR.
 */
export function canonicalLabel(label) {
  return String(label ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * ES: obtiene o crea un nodo. Si ya existe uno con el mismo kind+label, lo
 *     ACTUALIZA sin perder los datos previos (fusión, no sobreescritura).
 * EN: gets or creates a node. If one already exists with the same kind+label, it
 *     UPDATES it without losing previous data (merge, not overwrite).
 * PT: obtém ou cria um nó. Se já existir um com o mesmo kind+label, ele o
 *     ATUALIZA sem perder os dados prévios (fusão, não sobrescrita).
 *
 * @param {object} db
 * @param {{ kind: string, label: string, label_es?: string, label_en?: string, label_pt?: string, what_is?: string, why_exists?: string, where_used?: string, how_built?: string, problems?: string, learned?: string, code_refs?: string[], sessions?: string[], sources?: string[], meta?: object }} spec
 */
export function ensureNode(db, spec) {
  const kind = NODE_KINDS.includes(spec.kind) ? spec.kind : 'concept';
  // ES: canonicalizamos UNA vez y usamos la misma cadena para guardar y buscar.
  // EN: we canonicalize ONCE and use the same string to store and to search.
  // PT: canonicalizamos UMA vez e usamos a mesma string para guardar e buscar.
  const label = canonicalLabel(spec.label);
  if (!label) return null;

  const existing = get(db, 'SELECT * FROM nodes WHERE kind = ? AND lower(label) = ?', [kind, label.toLowerCase()]);
  const now = new Date().toISOString();

  if (existing) {
    // ES: fusión: solo rellenamos lo que estaba vacío y unimos listas.
    // EN: merge: we only fill what was empty and union the lists.
    // PT: fusão: só preenchemos o que estava vazio e unimos as listas.
    const mergedCode = [...new Set([...(fromJson(existing.code_refs_json, []) ?? []), ...(spec.code_refs ?? [])])];
    const mergedSessions = [...new Set([...(fromJson(existing.sessions_json, []) ?? []), ...(spec.sessions ?? [])])];
    const mergedSources = [...new Set([...(fromJson(existing.sources_json, []) ?? []), ...(spec.sources ?? [])])];
    db.prepare(`UPDATE nodes SET
        label_es = COALESCE(NULLIF(?, ''), label_es),
        label_en = COALESCE(NULLIF(?, ''), label_en),
        label_pt = COALESCE(NULLIF(?, ''), label_pt),
        what_is = COALESCE(NULLIF(?, ''), what_is),
        why_exists = COALESCE(NULLIF(?, ''), why_exists),
        where_used = COALESCE(NULLIF(?, ''), where_used),
        how_built = COALESCE(NULLIF(?, ''), how_built),
        problems = COALESCE(NULLIF(?, ''), problems),
        learned = COALESCE(NULLIF(?, ''), learned),
        code_refs_json = ?, sessions_json = ?, sources_json = ?, meta_json = ?
      WHERE id = ?`).run(
      spec.label_es ?? '', spec.label_en ?? '', spec.label_pt ?? '',
      spec.what_is ?? '', spec.why_exists ?? '', spec.where_used ?? '', spec.how_built ?? '',
      spec.problems ?? '', spec.learned ?? '',
      toJson(mergedCode), toJson(mergedSessions), toJson(mergedSources),
      toJson({ ...(fromJson(existing.meta_json, {}) ?? {}), ...(spec.meta ?? {}) }),
      existing.id,
    );
    indexEntity(db, {
      entityType: 'node', entityId: existing.id,
      title: `${existing.id} · ${label} (${kind})`,
      body: [spec.what_is ?? existing.what_is, spec.why_exists ?? existing.why_exists, spec.how_built ?? existing.how_built, spec.learned ?? existing.learned].filter(Boolean).join('\n'),
      tags: ['node', kind, label],
    });
    return existing.id;
  }

  const id = nextId(ID_PREFIX.node, all(db, 'SELECT id FROM nodes').map((r) => r.id));
  db.prepare(`INSERT INTO nodes (id, kind, label, label_es, label_en, label_pt, what_is, why_exists, where_used, how_built, problems, learned, code_refs_json, sessions_json, sources_json, meta_json, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, kind, label, spec.label_es ?? null, spec.label_en ?? label, spec.label_pt ?? null,
    spec.what_is ?? null, spec.why_exists ?? null, spec.where_used ?? null, spec.how_built ?? null,
    spec.problems ?? null, spec.learned ?? null,
    toJson(spec.code_refs ?? []), toJson(spec.sessions ?? []), toJson(spec.sources ?? []),
    toJson(spec.meta ?? {}), now,
  );
  indexEntity(db, {
    entityType: 'node', entityId: id,
    title: `${id} · ${label} (${kind})`,
    body: [spec.what_is, spec.why_exists, spec.how_built, spec.learned].filter(Boolean).join('\n'),
    tags: ['node', kind, label],
  });
  return id;
}

/**
 * ES: crea (o refuerza) una arista entre dos nodos. Si la relación ya existe,
 *     suma peso en lugar de duplicarla.
 * EN: creates (or strengthens) an edge between two nodes. If the relation already
 *     exists, it adds weight instead of duplicating it.
 * PT: cria (ou reforça) uma aresta entre dois nós. Se a relação já existe, soma
 *     peso em vez de duplicá-la.
 */
export function link(db, fromId, toId, relation, weight = 1, meta = null) {
  if (!fromId || !toId || fromId === toId) return null;
  const kind = RELATIONS.includes(relation) ? relation : 'relates_to';
  // ES: ⚠️ BUG REAL CORREGIDO: el SELECT original pedía solo (id, weight), así que
  //     `existing.meta_json` era `undefined` y node:sqlite lanzaba
  //     "Provided value cannot be bound to SQLite parameter 2" en cuanto la arista
  //     ya existía (segunda ejecución del grafo). node:sqlite NO acepta undefined:
  //     solo null, number, bigint, string y Uint8Array. Hay que seleccionar todas
  //     las columnas que se van a reutilizar, o normalizar con `?? null`.
  // EN: ⚠️ REAL BUG FIXED: the original SELECT asked only for (id, weight), so
  //     `existing.meta_json` was `undefined` and node:sqlite threw "Provided value
  //     cannot be bound to SQLite parameter 2" as soon as the edge already existed
  //     (second graph run). node:sqlite does NOT accept undefined: only null,
  //     number, bigint, string and Uint8Array. Select every column you reuse, or
  //     normalize with `?? null`.
  // PT: ⚠️ BUG REAL CORRIGIDO: o SELECT original pedia só (id, weight), então
  //     `existing.meta_json` era `undefined` e o node:sqlite lançava "Provided
  //     value cannot be bound to SQLite parameter 2" assim que a aresta já
  //     existia. O node:sqlite NÃO aceita undefined: só null, number, bigint,
  //     string e Uint8Array. Selecione toda coluna que for reutilizar.
  const existing = get(db, 'SELECT id, weight, meta_json FROM edges WHERE from_id = ? AND to_id = ? AND relation = ?', [fromId, toId, kind]);
  if (existing) {
    db.prepare('UPDATE edges SET weight = weight + ?, meta_json = ? WHERE id = ?')
      .run(weight, meta ? toJson(meta) : (existing.meta_json ?? null), existing.id);
    return existing.id;
  }
  const id = nextId(ID_PREFIX.edge, all(db, 'SELECT id FROM edges').map((r) => r.id));
  db.prepare('INSERT INTO edges (id, from_id, to_id, relation, weight, meta_json, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, fromId, toId, kind, weight, toJson(meta ?? {}), new Date().toISOString());
  return id;
}

/**
 * ES: construye el grafo completo a partir de lo que ya hay en la base.
 *     Es idempotente: ejecutarlo dos veces no duplica nodos ni infla aristas
 *     más allá de lo real (las co-ocurrencias se recalculan desde cero).
 * EN: builds the complete graph from what already exists in the database.
 *     It is idempotent: running it twice does not duplicate nodes nor inflate
 *     edges beyond reality (co-occurrences are recomputed from scratch).
 * PT: constrói o grafo completo a partir do que já existe no banco. É
 *     idempotente: executá-lo duas vezes não duplica nós nem infla arestas.
 */
export function buildKnowledgeGraph(options = {}) {
  const { bus = null } = options;
  const db = options.db ?? openDatabase();
  // ES: `fresh` vacía nodos y aristas antes de reconstruir. El grafo es dato
  //     DERIVADO (nivel 3) de las tablas procesadas (nivel 2): se puede
  //     regenerar siempre. Reconstruir desde cero evita que queden nodos
  //     huérfanos de ejecuciones anteriores (por ejemplo una lección creada con
  //     otra etiqueta antes de corregir un bug de extracción).
  // EN: `fresh` empties nodes and edges before rebuilding. The graph is DERIVED
  //     data (level 3) from the processed tables (level 2): it can always be
  //     regenerated. Rebuilding from scratch prevents orphan nodes left behind by
  //     earlier runs (e.g. a lesson created with a different label before an
  //     extraction bug was fixed).
  // PT: `fresh` esvazia nós e arestas antes de reconstruir. O grafo é dado
  //     DERIVADO (nível 3) das tabelas processadas (nível 2): pode sempre ser
  //     regenerado. Reconstruir do zero evita nós órfãos de execuções anteriores.
  const { fresh = false } = options;

  const result = tx(db, (handle) => {
    if (fresh) {
      // ES/EN/PT: primero las aristas (referencian nodos), luego los nodos.
      // Delete edges first (they reference nodes), then the nodes.
      handle.prepare('DELETE FROM edges').run();
      handle.prepare('DELETE FROM nodes').run();
    }
    const counts = { categories: 0, technologies: 0, decisions: 0, requirements: 0, tasks: 0, lessons: 0, mistakes: 0, searches: 0, co_occurrences: 0, edges: 0 };

    // ES: 1) categorías raíz del nivel KNOWLEDGE.
    // EN: 1) root categories of the KNOWLEDGE level.
    // PT: 1) categorias raiz do nível KNOWLEDGE.
    const categoryIds = {};
    const root = ensureNode(handle, { kind: 'architecture', label: 'Genesis Knowledge Root', why_exists: 'Root of the knowledge graph; groups every category of level 3.', what_is: 'The project knowledge tree.' });
    for (const category of KNOWLEDGE_CATEGORIES) {
      const id = ensureNode(handle, { kind: 'category', label: category.label, what_is: category.what_is, why_exists: 'Part of the level-3 KNOWLEDGE taxonomy (DEC-00001).' });
      categoryIds[category.label] = id;
      link(handle, root, id, 'part_of', 1);
      counts.categories += 1;
    }

    // ES: 2) tecnologías/conceptos detectados en los mensajes + en qué sesión aparecen.
    // EN: 2) technologies/concepts detected in messages + the session they appear in.
    // PT: 2) tecnologias/conceitos detectados nas mensagens + em que sessão aparecem.
    const messages = all(handle, 'SELECT id, session_id, content, terms_json FROM messages');
    const termSessions = new Map();
    const cooccurrence = new Map();

    for (const message of messages) {
      const terms = fromJson(message.terms_json, []) ?? [];
      for (const term of terms) {
        const key = normalizeLabel(term);
        if (!termSessions.has(key)) termSessions.set(key, new Set());
        termSessions.get(key).add(message.session_id);
      }
      // ES: co-ocurrencia por pares dentro del mismo mensaje.
      // EN: pairwise co-occurrence inside the same message.
      // PT: co-ocorrência por pares dentro da mesma mensagem.
      const unique = [...new Set(terms.map(normalizeLabel))].sort();
      for (let i = 0; i < unique.length; i += 1) {
        for (let j = i + 1; j < unique.length; j += 1) {
          const pair = `${unique[i]}||${unique[j]}`;
          cooccurrence.set(pair, (cooccurrence.get(pair) ?? 0) + 1);
        }
      }
    }

    const techIds = new Map();
    for (const [term, sessions] of termSessions) {
      const id = ensureNode(handle, {
        kind: 'technology',
        label: term,
        what_is: `Technical term observed in the project conversations.`,
        where_used: `Mentioned in ${sessions.size} session(s): ${[...sessions].join(', ')}`,
        sessions: [...sessions],
      });
      techIds.set(term, id);
      link(handle, categoryIds.technologies, id, 'part_of', 1);
      for (const session of sessions) {
        const sessionNode = ensureNode(handle, { kind: 'session', label: String(session), what_is: 'Captured conversation session (RAW level).' });
        link(handle, id, sessionNode, 'discussed_in', 1);
      }
      counts.technologies += 1;
    }

    // ES: 3) aristas de co-ocurrencia con peso = veces que aparecieron juntas.
    // EN: 3) co-occurrence edges with weight = times they appeared together.
    // PT: 3) arestas de co-ocorrência com peso = vezes que apareceram juntas.
    for (const [pair, weight] of cooccurrence) {
      const [a, b] = pair.split('||');
      const from = techIds.get(a);
      const to = techIds.get(b);
      if (from && to) {
        link(handle, from, to, 'co_occurs', weight);
        counts.co_occurrences += 1;
      }
    }

    // ES: 4) decisiones como nodos, ligadas a las tecnologías que mencionan.
    // EN: 4) decisions as nodes, linked to the technologies they mention.
    // PT: 4) decisões como nós, ligadas às tecnologias que mencionam.
    for (const decision of all(handle, 'SELECT id, decision, objective_en, justification, consequence, layer, status FROM decisions')) {
      const id = ensureNode(handle, {
        kind: 'decision',
        label: `${decision.id}: ${String(decision.decision ?? '').slice(0, 80)}`,
        what_is: String(decision.decision ?? ''),
        why_exists: String(decision.objective_en ?? ''),
        how_built: String(decision.justification ?? ''),
        learned: String(decision.consequence ?? ''),
        meta: { status: decision.status, layer: decision.layer },
      });
      link(handle, categoryIds.decisions, id, 'part_of', 1);
      const haystack = `${decision.decision ?? ''} ${decision.objective_en ?? ''} ${decision.justification ?? ''}`.toLowerCase();
      for (const [term, techId] of techIds) {
        if (haystack.includes(term)) {
          link(handle, id, techId, 'decides_about', 2);
          counts.edges += 1;
        }
      }
      counts.decisions += 1;
    }

    // ES: 5) requisitos ligados a su capa y a las tareas que los implementan.
    // EN: 5) requirements linked to their layer and to the tasks implementing them.
    // PT: 5) requisitos ligados à sua camada e às tarefas que os implementam.
    for (const requirement of all(handle, 'SELECT id, title, layer, status, acceptance FROM requirements')) {
      const id = ensureNode(handle, {
        kind: 'requirement', label: `${requirement.id}: ${String(requirement.title).slice(0, 80)}`,
        what_is: String(requirement.title), why_exists: String(requirement.acceptance ?? ''),
        meta: { status: requirement.status, layer: requirement.layer },
      });
      link(handle, categoryIds.architecture, id, 'part_of', 1);
      counts.requirements += 1;
    }

    // ES: 6) tareas y fases. Tasks and phases.
    const phaseIds = new Map();
    for (const task of all(handle, 'SELECT id, title, phase, layer, status FROM tasks')) {
      let phaseId = phaseIds.get(task.phase);
      if (task.phase && !phaseId) {
        phaseId = ensureNode(handle, { kind: 'phase', label: String(task.phase), what_is: 'Roadmap phase.' });
        phaseIds.set(task.phase, phaseId);
        link(handle, categoryIds.architecture, phaseId, 'part_of', 1);
      }
      const id = ensureNode(handle, { kind: 'task', label: `${task.id}: ${String(task.title).slice(0, 80)}`, what_is: String(task.title), meta: { status: task.status, layer: task.layer } });
      if (phaseId) link(handle, id, phaseId, 'belongs_to', 1);
      counts.tasks += 1;
    }

    // ES: 7) errores = mistakes, lecciones = lessons, con arista "prevents".
    // EN: 7) errors = mistakes, lessons = lessons, with a "prevents" edge.
    // PT: 7) erros = mistakes, lições = lessons, com aresta "prevents".
    // ES: las lecciones se crean ANTES que los errores para que cada error pueda
    //     enlazar con el nodo de lección ya existente (lessons.source_id = ERR-xxx).
    //     Sin este orden se creaban DOS nodos para la misma lección: uno con la
    //     etiqueta "LES-00001: texto" y otro con el texto suelto.
    // EN: lessons are created BEFORE errors so each error can link to the existing
    //     lesson node (lessons.source_id = ERR-xxx). Without this order, TWO nodes
    //     were created for the same lesson: one labelled "LES-00001: text" and
    //     another with the bare text.
    // PT: as lições são criadas ANTES dos erros para que cada erro possa ligar ao
    //     nó de lição já existente. Sem essa ordem, criavam-se DOIS nós.
    const lessonNodeByErrorId = new Map();
    for (const lesson of all(handle, 'SELECT id, lesson, future_rule, source_id FROM lessons')) {
      const id = ensureNode(handle, { kind: 'lesson', label: `${lesson.id}: ${String(lesson.lesson).slice(0, 80)}`, what_is: String(lesson.lesson), learned: String(lesson.future_rule ?? '') });
      link(handle, categoryIds.lessons, id, 'part_of', 1);
      if (lesson.source_id) lessonNodeByErrorId.set(String(lesson.source_id), id);
    }

    for (const error of all(handle, 'SELECT id, message, analysis, recovery, lesson FROM errors')) {
      const mistakeId = ensureNode(handle, {
        kind: 'mistake', label: `${error.id}: ${String(error.message).slice(0, 80)}`,
        what_is: String(error.message), why_exists: String(error.analysis ?? ''), learned: String(error.lesson ?? ''),
      });
      link(handle, categoryIds.mistakes, mistakeId, 'part_of', 1);
      if (error.lesson) {
        // ES: reutiliza el nodo de lección ya creado; solo si el error no tiene
        //     lección registrada en la tabla `lessons` se crea uno provisional.
        // EN: reuse the lesson node already created; only build a provisional one
        //     when this error has no row in the `lessons` table.
        // PT: reutiliza o nó de lição já criado; só cria um provisório quando o
        //     erro não tem linha na tabela `lessons`.
        const lessonId = lessonNodeByErrorId.get(String(error.id))
          ?? ensureNode(handle, { kind: 'lesson', label: `${error.id} lesson: ${String(error.lesson).slice(0, 70)}`, what_is: String(error.lesson), learned: String(error.recovery ?? '') });
        link(handle, categoryIds.lessons, lessonId, 'part_of', 1);
        link(handle, lessonId, mistakeId, 'prevents', 2);
        counts.lessons += 1;
      }
      counts.mistakes += 1;
    }

    // ES: 8) búsquedas = references, ligadas a las decisiones que influenciaron.
    // EN: 8) searches = references, linked to the decisions they influenced.
    // PT: 8) buscas = references, ligadas às decisões que influenciaram.
    for (const search of all(handle, 'SELECT id, query, reason, selected, sources_json, influenced_json FROM searches')) {
      const id = ensureNode(handle, {
        kind: 'reference', label: `${search.id}: ${String(search.query).slice(0, 80)}`,
        what_is: String(search.query), why_exists: String(search.reason ?? ''),
        learned: String(search.selected ?? ''), sources: fromJson(search.sources_json, []) ?? [],
      });
      link(handle, categoryIds.references, id, 'part_of', 1);
      for (const influenced of fromJson(search.influenced_json, []) ?? []) {
        const decisionRow = get(handle, 'SELECT id, decision FROM decisions WHERE id = ?', [String(influenced)]);
        if (decisionRow) {
          const decisionNode = ensureNode(handle, { kind: 'decision', label: `${decisionRow.id}: ${String(decisionRow.decision ?? '').slice(0, 80)}`, what_is: String(decisionRow.decision ?? '') });
          link(handle, id, decisionNode, 'produced', 2);
        }
      }
      counts.searches += 1;
    }

    counts.edges = Number(handle.prepare('SELECT COUNT(*) AS n FROM edges').get()?.n ?? 0);
    counts.nodes = Number(handle.prepare('SELECT COUNT(*) AS n FROM nodes').get()?.n ?? 0);
    return counts;
  });

  if (result.ok) {
    bus?.emit('KNOWLEDGE_EXTRACTED', { kind: 'knowledge-graph', ...result.value }, { layer: 'knowledge' });
  }
  return result;
}

/** ES/EN/PT: vecinos directos de un nodo, con dirección y peso. Direct neighbours with direction and weight. */
export function neighbors(db, nodeId) {
  const outgoing = all(db, `SELECT e.id, e.relation, e.weight, n.id AS node_id, n.kind, n.label
                            FROM edges e JOIN nodes n ON n.id = e.to_id WHERE e.from_id = ? ORDER BY e.weight DESC`, [nodeId])
    .map((row) => ({ direction: 'out', relation: row.relation, weight: Number(row.weight), node: { id: row.node_id, kind: row.kind, label: row.label } }));
  const incoming = all(db, `SELECT e.id, e.relation, e.weight, n.id AS node_id, n.kind, n.label
                            FROM edges e JOIN nodes n ON n.id = e.from_id WHERE e.to_id = ? ORDER BY e.weight DESC`, [nodeId])
    .map((row) => ({ direction: 'in', relation: row.relation, weight: Number(row.weight), node: { id: row.node_id, kind: row.kind, label: row.label } }));
  return { outgoing, incoming };
}

/**
 * ES: subgrafo alrededor de un nodo hasta una profundidad dada (BFS).
 * EN: subgraph around a node up to a given depth (BFS).
 * PT: subgrafo ao redor de um nó até uma profundidade dada (BFS).
 */
export function subgraph(db, startId, depth = 2, limit = 120) {
  const visited = new Set([startId]);
  const nodeIds = [startId];
  let frontier = [startId];

  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next = [];
    for (const id of frontier) {
      const { outgoing, incoming } = neighbors(db, id);
      for (const edge of [...outgoing, ...incoming]) {
        if (visited.has(edge.node.id)) continue;
        visited.add(edge.node.id);
        nodeIds.push(edge.node.id);
        next.push(edge.node.id);
        if (nodeIds.length >= limit) break;
      }
      if (nodeIds.length >= limit) break;
    }
    frontier = next;
  }

  const placeholders = nodeIds.map(() => '?').join(',');
  const nodes = all(db, `SELECT id, kind, label, what_is, why_exists, where_used, how_built, problems, learned FROM nodes WHERE id IN (${placeholders})`, nodeIds);
  const edges = all(db, `SELECT id, from_id, to_id, relation, weight FROM edges WHERE from_id IN (${placeholders}) AND to_id IN (${placeholders})`, [...nodeIds, ...nodeIds]);
  return { root: startId, depth, nodes, edges };
}

/** ES/EN/PT: perfil completo de un nodo (la ficha de la sección 11). Full node profile (section 11 card). */
export function nodeProfile(db, nodeId) {
  const node = get(db, 'SELECT * FROM nodes WHERE id = ? OR lower(label) = ?', [nodeId, normalizeLabel(nodeId)]);
  if (!node) return null;
  const links = neighbors(db, node.id);
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    trilingual: { es: node.label_es ?? node.label, en: node.label_en ?? node.label, pt: node.label_pt ?? node.label },
    what_is: node.what_is,
    why_exists: node.why_exists,
    where_used: node.where_used,
    how_built: node.how_built,
    problems: node.problems,
    learned: node.learned,
    code_refs: fromJson(node.code_refs_json, []),
    sessions: fromJson(node.sessions_json, []),
    sources: fromJson(node.sources_json, []),
    meta: fromJson(node.meta_json, {}),
    relations: links,
  };
}

/** ES/EN/PT: exporta el grafo completo para la interfaz web. Exports the whole graph for the web UI. */
export function exportGraph(db, limit = 400) {
  const nodes = all(db, 'SELECT id, kind, label, what_is FROM nodes ORDER BY kind, label LIMIT ?', [limit]);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = all(db, 'SELECT from_id, to_id, relation, weight FROM edges ORDER BY weight DESC LIMIT ?', [limit * 3])
    .filter((e) => ids.has(e.from_id) && ids.has(e.to_id));
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, what_is: n.what_is })),
    edges: edges.map((e) => ({ source: e.from_id, target: e.to_id, relation: e.relation, weight: Number(e.weight) })),
    stats: graphStats(db),
  };
}

/** ES/EN/PT: estadísticas del grafo. Graph statistics. */
export function graphStats(db) {
  const byKind = Object.fromEntries(all(db, 'SELECT kind, COUNT(*) AS n FROM nodes GROUP BY kind ORDER BY n DESC').map((r) => [r.kind, Number(r.n)]));
  const byRelation = Object.fromEntries(all(db, 'SELECT relation, COUNT(*) AS n FROM edges GROUP BY relation ORDER BY n DESC').map((r) => [r.relation, Number(r.n)]));
  const nodes = Number(get(db, 'SELECT COUNT(*) AS n FROM nodes')?.n ?? 0);
  const edges = Number(get(db, 'SELECT COUNT(*) AS n FROM edges')?.n ?? 0);
  const hubs = all(db, `SELECT n.id, n.kind, n.label, COUNT(e.id) AS degree FROM nodes n
                        LEFT JOIN edges e ON e.from_id = n.id OR e.to_id = n.id
                        GROUP BY n.id ORDER BY degree DESC LIMIT 8`);
  return { nodes, edges, density: nodes > 1 ? Math.round((edges / (nodes * (nodes - 1))) * 10000) / 10000 : 0, by_kind: byKind, by_relation: byRelation, hubs };
}

export default { NODE_KINDS, RELATIONS, KNOWLEDGE_CATEGORIES, normalizeLabel, canonicalLabel, ensureNode, link, buildKnowledgeGraph, neighbors, subgraph, nodeProfile, exportGraph, graphStats };

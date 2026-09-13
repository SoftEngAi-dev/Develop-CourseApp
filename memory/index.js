/* ═══════════════════════════════════════════════════════════════════════════
 * memory/index.js — MEMORY aggregator (the agent's single door)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: reúne las cuatro memorias (proyecto, sesión, decisiones,
 *     lecciones) en una sola instantánea y ofrece `recall(query)`, que busca en
 *     TODAS a la vez y devuelve resultados ordenados por relevancia.
 *     POR QUÉ EXISTE: el bucle del agente empieza por "contextualize" (POL-0006:
 *     contextualizar ANTES de razonar). Si cada agente tuviera que ensamblar su
 *     propio contexto, acabaríamos con cinco versiones distintas y contradictorias
 *     del "estado del proyecto". Una sola puerta = una sola verdad.
 *     ESTADO: IMPLEMENTADA. Compone las cuatro fachadas + retrieval de Fase 2;
 *     no añade lógica de negocio nueva.
 *
 * 🇬🇧 EN — WHAT IT DOES: gathers the four memories (project, session, decisions,
 *     lessons) into a single snapshot and offers `recall(query)`, which searches
 *     ALL of them at once and returns results ranked by relevance.
 *     WHY IT EXISTS: the agent loop starts with "contextualize" (POL-0006:
 *     contextualize BEFORE reasoning). If every agent had to assemble its own
 *     context we would end up with five different, contradictory versions of "the
 *     project state". One door = one truth.
 *     STATUS: IMPLEMENTED. Composes the four façades + Phase 2 retrieval.
 *
 * 🇧🇷 PT — O QUE FAZ: reúne as quatro memórias num único snapshot e oferece
 *     `recall(query)`, que busca em TODAS ao mesmo tempo.
 *     POR QUE EXISTE: o loop do agente começa por "contextualize" (POL-0006).
 *     Uma única porta = uma única verdade. ESTADO: IMPLEMENTADA.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Composición ES/EN/PT: este módulo no sabe NADA de SQL. Llama a las cuatro
 *     fachadas y combina sus resultados. Esa separación es lo que permite cambiar
 *     la base de datos sin tocar la memoria. Composition over duplication.
 *   • Los cuatro tipos de memoria ES/EN/PT: vienen de la psicología cognitiva y
 *     son una metáfora útil, no un adorno:
 *       – proyecto  ≈ memoria SEMÁNTICA (hechos estables: "usamos SQLite")
 *       – sesión    ≈ memoria EPISÓDICA (qué pasó y cuándo)
 *       – decisiones≈ memoria JUSTIFICATIVA (por qué)
 *       – lecciones ≈ memoria PROCEDIMENTAL (cómo actuar la próxima vez)
 *     Four memory kinds map to semantic / episodic / justificatory / procedural.
 *   • `Promise` no hace falta aquí ES/EN/PT: todo es síncrono (SQLite local).
 *     Añadir `async` "por si acaso" solo complica el código. No async without need.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail } from '../core/shared/result.js';
import { openDatabase } from '../knowledge/db/index.js';
import { search } from '../knowledge/retrieval/search.js';
import { projectMemory, renderProjectMemory } from './project/index.js';
import { sessionMemory, latestSessionMemory, listSessionMemory } from './session/index.js';
import { decisionMemory, recallDecision, recallWhy, activeDecisions } from './decisions/index.js';
import { lessonMemory, pendingRules, repeatedFailures } from './lessons/index.js';

/**
 * ES: instantánea completa de la memoria (lo que un agente carga al arrancar).
 * EN: full memory snapshot (what an agent loads on startup).
 * PT: snapshot completo da memória (o que um agente carrega ao iniciar).
 *
 * @param {object} [options]
 * @param {object} [options.db]
 * @param {boolean} [options.compact=false]
 * @param {string} [options.sessionId] sesión concreta; por defecto la más reciente
 * @param {string} [options.language='en']
 */
export function memorySnapshot(options = {}) {
  const { db = openDatabase(), compact = false, sessionId = null, language = 'en' } = options;

  const project = projectMemory({ compact });
  const decisions = decisionMemory({ db, compact, language, withProvenance: false });
  const lessons = lessonMemory({ db });
  const session = sessionId ? sessionMemory(sessionId, { db }) : latestSessionMemory({ db });
  const sessions = listSessionMemory();

  return ok({
    kind: 'memory-snapshot',
    generated_at: new Date().toISOString(),
    compact,
    project: project.ok ? project.value : null,
    project_error: project.ok ? null : project.error,
    session: session.ok ? session.value : null,
    session_error: session.ok ? session.error : null,
    sessions: sessions.ok ? sessions.value : null,
    decisions: decisions.ok
      ? (compact
        ? { count: decisions.value.count, by_status: decisions.value.by_status, list: decisions.value.decisions.map((d) => ({ id: d.id, status: d.status, decision: d.decision })) }
        : decisions.value)
      : null,
    lessons: lessons.ok
      ? (compact ? { totals: lessons.value.totals, cycle: lessons.value.cycle, list: lessons.value.lessons.map((l) => ({ id: l.id, lesson: l.lesson, rule: l.future_rule })) } : lessons.value)
      : null,
    rendered: renderProjectMemory(project, language),
  });
}

/**
 * ES: `recall(query)` — busca en TODA la memoria y devuelve resultados por tipo.
 * EN: `recall(query)` — searches ALL memory and returns results grouped by type.
 * PT: `recall(query)` — busca em TODA a memória e devolve resultados por tipo.
 *
 * @param {string} query texto libre
 * @param {object} [options]
 * @param {object} [options.db]
 * @param {number} [options.limit=12]
 */
export function recall(query, options = {}) {
  const { db = openDatabase(), limit = 12 } = options;
  if (!query || !String(query).trim()) return fail('recall requires a query', { code: 'missing_argument' });

  /*
   * ES: OJO con las firmas reales (error clásico al componer módulos):
   *     – `search(query, options)` devuelve un OBJETO con `.results`, no un array.
   *     – `whyDidWeChoose(term, options)` también recibe el término primero.
   *     Componer sin leer la firma del otro módulo es la fuente nº1 de bugs
   *     silenciosos: no falla al cargar, falla al usar.
   * EN: mind the real signatures (a classic when composing modules):
   *     – `search(query, options)` returns an OBJECT with `.results`, not an array.
   *     – `whyDidWeChoose(term, options)` also takes the term first.
   *     Composing without reading the other module's signature is the nº1 source
   *     of silent bugs: it does not fail on load, it fails on use.
   * PT: atenção às assinaturas reais: `search` devolve OBJETO com `.results`.
   */
  const found = search(String(query), { db, limit });
  const hits = found?.results ?? [];
  const why = recallWhy(String(query), { db });

  return ok({
    kind: 'memory-recall',
    query: String(query),
    generated_at: new Date().toISOString(),
    total: hits.length,
    facets: found?.facets ?? null,
    results: hits,
    why: why.ok ? why.value : null,
  });
}

/**
 * ES: memoria mínima para un prompt: 4 memorias, 1 página de texto.
 * EN: minimal memory for a prompt: 4 memories, 1 page of text.
 * PT: memória mínima para um prompt: 4 memórias, 1 página de texto.
 */
export function recallForPrompt(options = {}) {
  const { db = openDatabase(), language = 'en', maxDecisions = 6, maxLessons = 4 } = options;
  const snapshot = memorySnapshot({ db, compact: true, language });
  if (!snapshot.ok) return snapshot;
  const value = snapshot.value;
  return ok({
    kind: 'prompt-memory',
    language,
    project: value.rendered,
    session: value.session ? `${value.session.session?.id ?? '?'} · ${value.session.totals?.messages ?? 0} messages · ${value.session.totals?.decisions ?? 0} decisions` : 'no session captured yet',
    decisions: (value.decisions?.list ?? []).slice(0, maxDecisions),
    lessons: (value.lessons?.list ?? []).slice(0, maxLessons),
    open_blocks: value.project?.open_blocks ?? [],
  });
}

export default {
  memorySnapshot,
  recall,
  recallForPrompt,
  projectMemory,
  renderProjectMemory,
  sessionMemory,
  latestSessionMemory,
  listSessionMemory,
  decisionMemory,
  recallDecision,
  recallWhy,
  activeDecisions,
  lessonMemory,
  pendingRules,
  repeatedFailures,
};

/*
 * ES: reexportamos las cuatro fachadas como EXPORTACIONES NOMBRADAS. Sin esto,
 *     `import { recallDecision } from './memory/index.js'` falla aunque el objeto
 *     default las contenga: en ESM, `export default {...}` NO crea nombres
 *     importables. Es una diferencia sutil y muy común entre CJS y ESM.
 * EN: we re-export the four façades as NAMED exports. Without this,
 *     `import { recallDecision } from './memory/index.js'` fails even though the
 *     default object contains them: in ESM, `export default {...}` does NOT create
 *     importable names. A subtle and very common CJS-vs-ESM difference.
 * PT: reexportamos as quatro fachadas como exports NOMEADOS. `export default {}`
 *     NÃO cria nomes importáveis em ESM.
 */
export {
  projectMemory,
  renderProjectMemory,
  sessionMemory,
  latestSessionMemory,
  listSessionMemory,
  decisionMemory,
  recallDecision,
  recallWhy,
  activeDecisions,
  lessonMemory,
  pendingRules,
  repeatedFailures,
};

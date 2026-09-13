/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/retrieval/context.js  —  THE CONTEXT ENGINE
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: construye el SESSION CONTEXT de la sección 8. Cuando una
 *     sesión nueva dice "continuemos con el agente", este módulo recupera
 *     automáticamente:
 *         PROJECT STATE + CURRENT TASK + LAST CHECKPOINT + RELEVANT DECISIONS
 *         + RELATED DOCUMENTATION + FAILED ATTEMPTS + KNOWN CONSTRAINTS
 *         + REQUIRED FILES
 *     y lo renderiza como bloque de texto listo para leer (o para pegarle a una
 *     IA y que continúe sin que tú repitas nada).
 *     POR QUÉ EXISTE: este es el módulo que más tiempo te ahorra. Sin él, cada
 *     sesión empieza con diez minutos de "te pongo en contexto". Con él, el
 *     contexto es una consulta. También implementa POL-0006: el agente pregunta
 *     "¿qué sabemos ya?" ANTES de "¿qué tengo que hacer?".
 *
 * 🇬🇧 EN — WHAT IT DOES: builds the SESSION CONTEXT from section 8. When a new
 *     session says "let's continue with the agent", this module automatically
 *     retrieves PROJECT STATE + CURRENT TASK + LAST CHECKPOINT + RELEVANT
 *     DECISIONS + RELATED DOCUMENTATION + FAILED ATTEMPTS + KNOWN CONSTRAINTS +
 *     REQUIRED FILES, and renders it as a text block ready to read (or to paste
 *     into an AI so it can continue without you repeating anything).
 *     WHY IT EXISTS: this is the module that saves you the most time. Without it
 *     every session starts with ten minutes of "let me give you context". With
 *     it, context is one query. It also implements POL-0006: the agent asks
 *     "what do we already know?" BEFORE "what must I do?".
 *
 * 🇧🇷 PT — O QUE FAZ: constrói o SESSION CONTEXT da seção 8. Quando uma nova
 *     sessão diz "vamos continuar com o agente", este módulo recupera
 *     automaticamente PROJECT STATE + CURRENT TASK + LAST CHECKPOINT + RELEVANT
 *     DECISIONS + RELATED DOCUMENTATION + FAILED ATTEMPTS + KNOWN CONSTRAINTS +
 *     REQUIRED FILES, e o renderiza como bloco de texto pronto para ler (ou para
 *     colar numa IA e ela continuar sem você repetir nada).
 *     POR QUE EXISTE: é o módulo que mais tempo economiza. Sem ele, toda sessão
 *     começa com dez minutos de "deixa eu te contextualizar". Com ele, contexto
 *     é uma consulta. Também implementa POL-0006: o agente pergunta "o que já
 *     sabemos?" ANTES de "o que eu tenho que fazer?".
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Recuperación de contexto ES/EN/PT: no se trata de "traer todo", se trata
 *     de traer lo RELEVANTE y poco. Un contexto de 50.000 palabras es inútil:
 *     nadie (ni una IA) lo aprovecha. Por eso cada sección tiene su `limit`.
 *     Context retrieval means relevant AND small; every section has a limit.
 *   • Jerarquía de fuentes ES/EN/PT: primero el plano de control (state.json,
 *     tasks.json) porque es pequeño y autoritativo; después la base de
 *     conocimiento (decisiones, errores) filtrada por relevancia. Ir de lo
 *     barato a lo caro es un principio general de rendimiento.
 *     Read the cheap authoritative control plane first, then query the DB.
 *   • Renderizado en dos formatos ES/EN/PT: objeto estructurado (para la app) y
 *     texto (para humanos y para pegar en un chat). Misma información, dos
 *     presentaciones. Nunca guardes solo el texto: perderías la estructura.
 *     Same information, two presentations: structured object and text.
 *   • `?? []` ES/EN/PT: si una consulta devuelve undefined, usamos un array
 *     vacío. Así los `.map()` siguientes no revientan. Defensa barata.
 *     Defaulting to [] keeps the following .map() calls from crashing.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, all, get, fromJson } from '../db/index.js';
import { search, timeline, whyDidWeChoose } from './search.js';
import { neighbors } from '../graph/index.js';
import { loadState, loadTasks, loadRoadmap, summarize } from '../../core/state/index.js';
import { loadManifest } from '../../core/manifest/index.js';
import { latestCheckpoint } from '../../core/checkpoint/index.js';
import { readJson } from '../../core/shared/json.js';
import { PATHS } from '../../core/shared/paths.js';
import { ok } from '../../core/shared/result.js';

/**
 * ES: construye el contexto completo de sesión.
 * EN: builds the complete session context.
 * PT: constrói o contexto completo de sessão.
 *
 * @param {{ db?: object, bus?: object, query?: string|null, taskId?: string|null, limits?: object }} [options]
 */
export function buildSessionContext(options = {}) {
  const { bus = null, query = null, taskId = null } = options;
  const db = options.db ?? openDatabase();
  const limits = {
    decisions: 6,
    errors: 5,
    searches: 4,
    lessons: 5,
    files: 12,
    events: 25,
    constraints: 10,
    documentation: 8,
    ...options.limits,
  };

  const state = loadState().value ?? {};
  const tasks = loadTasks().value ?? { tasks: [] };
  const roadmap = loadRoadmap().value ?? { phases: [] };
  const manifest = loadManifest().value ?? null;
  const policies = readJson(PATHS.policies, { rules: [] })?.rules ?? [];

  const taskList = tasks.tasks ?? [];
  const currentTask = taskList.find((t) => t.id === (taskId ?? state.current_task)) ?? null;
  const checkpoint = latestCheckpoint();

  // ES: 1) DECISIONES RELEVANTES — por consulta si la hay, si no por la capa de la tarea actual.
  // EN: 1) RELEVANT DECISIONS — by query when present, otherwise by the current task's layer.
  // PT: 1) DECISÕES RELEVANTES — pela consulta se houver, senão pela camada da tarefa atual.
  let decisions = [];
  if (query) {
    const hits = search(query, { db, types: ['decision'], limit: limits.decisions });
    decisions = hits.results.map((hit) => ({ id: hit.id, decision: hit.entity?.decision ?? hit.title, status: hit.entity?.status ?? null, layer: hit.entity?.layer ?? null, snippet: hit.snippet, relevance: hit.score }));
  }
  if (!decisions.length) {
    const layer = currentTask?.layer ?? null;
    const rows = layer
      ? all(db, 'SELECT id, decision, status, layer, justification FROM decisions WHERE layer = ? ORDER BY id DESC LIMIT ?', [layer, limits.decisions])
      : all(db, 'SELECT id, decision, status, layer, justification FROM decisions ORDER BY id DESC LIMIT ?', [limits.decisions]);
    decisions = rows.map((row) => ({ ...row, snippet: String(row.justification ?? '').slice(0, 200) }));
  }

  // ES: 2) INTENTOS FALLIDOS — errores e interrupciones abiertas. Nunca ocultar los fallos.
  // EN: 2) FAILED ATTEMPTS — errors and open interruptions. Never hide failures.
  // PT: 2) TENTATIVAS FALHAS — erros e interrupções abertas. Nunca esconder as falhas.
  const failedAttempts = all(db, 'SELECT id, message, severity, analysis, recovery, resolved, ts FROM errors ORDER BY ts DESC LIMIT ?', [limits.errors])
    .map((row) => ({ ...row, resolved: Boolean(row.resolved) }));
  const interruptions = all(db, "SELECT id, type, layer, task, reason, impact, status, detected_at FROM interruptions WHERE status <> 'resolved' ORDER BY detected_at DESC LIMIT 10");

  // ES: 3) RESTRICCIONES CONOCIDAS — políticas hard + requisitos críticos.
  // EN: 3) KNOWN CONSTRAINTS — hard policies + critical requirements.
  // PT: 3) RESTRIÇÕES CONHECIDAS — políticas hard + requisitos críticos.
  const hardPolicies = policies.filter((rule) => rule.enforcement === 'hard').slice(0, limits.constraints);
  const criticalRequirements = all(db, "SELECT id, title, acceptance FROM requirements WHERE priority IN ('critical','high') ORDER BY priority, id LIMIT ?", [limits.constraints])
    .map((row) => ({ id: row.id, title: row.title, acceptance: row.acceptance }));

  // ES: 4) ARCHIVOS REQUERIDOS — artefactos de la tarea actual + rutas del manifest.
  // EN: 4) REQUIRED FILES — artifacts of the current task + manifest paths.
  // PT: 4) ARQUIVOS NECESSÁRIOS — artefatos da tarefa atual + caminhos do manifest.
  const requiredFiles = [
    ...(currentTask?.artifacts ?? []),
    ...(manifest?.architecture?.levels ?? []).map((level) => level.path),
    'control/manifest.json', 'control/state.json', 'control/tasks.json', 'control/decisions.json',
  ];
  const artifactRows = all(db, 'SELECT path, kind FROM artifacts ORDER BY created_at DESC LIMIT ?', [limits.files])
    .map((row) => row.path)
    .filter(Boolean);

  // ES: 5) DOCUMENTACIÓN RELACIONADA — lecciones, nodos del grafo y planes.
  // EN: 5) RELATED DOCUMENTATION — lessons, graph nodes and plans.
  // PT: 5) DOCUMENTAÇÃO RELACIONADA — lições, nós do grafo e planos.
  const lessons = all(db, 'SELECT id, lesson, future_rule FROM lessons ORDER BY created_at DESC LIMIT ?', [limits.lessons]);
  const plans = all(db, "SELECT id, objective, status FROM plans ORDER BY created_at DESC LIMIT 5");
  const documentation = [
    ...lessons.map((row) => ({ kind: 'lesson', id: row.id, title: String(row.lesson).slice(0, 140), rule: row.future_rule })),
    ...plans.map((row) => ({ kind: 'plan', id: row.id, title: String(row.objective).slice(0, 140), status: row.status })),
    ...all(db, 'SELECT id, kind, label FROM nodes WHERE kind IN (\'tutorial\',\'pattern\',\'concept\') ORDER BY label LIMIT ?', [limits.documentation])
      .map((row) => ({ kind: row.kind, id: row.id, title: row.label })),
  ].slice(0, limits.documentation * 2);

  // ES: 6) BÚSQUEDAS Y GRAFO — qué se consultó y cómo se conecta.
  // EN: 6) SEARCHES AND GRAPH — what was consulted and how it connects.
  // PT: 6) BUSCAS E GRAFO — o que foi consultado e como se conecta.
  const searches = all(db, 'SELECT id, query, reason, selected FROM searches ORDER BY ts DESC LIMIT ?', [limits.searches]);
  const provenance = query ? whyDidWeChoose(query, { db, limit: 2 }).chains : [];
  const graphNeighbours = query ? findRelatedNodes(db, query, 3) : [];

  // ES: 7) TIMELINE RECIENTE — qué pasó en los últimos eventos.
  // EN: 7) RECENT TIMELINE — what happened in the last events.
  // PT: 7) TIMELINE RECENTE — o que aconteceu nos últimos eventos.
  const recent = timeline({ db, limit: limits.events });

  const summary = summarize(state, tasks);
  const nextTask = taskList.find((t) => ['planned', 'ready', 'discovered'].includes(t.status)) ?? null;
  const currentPhase = (roadmap.phases ?? []).find((p) => p.id === state.current_phase) ?? null;

  const context = {
    generated_at: new Date().toISOString(),
    query: query ?? null,
    project: {
      name: manifest?.project?.name ?? 'Genesis Autonomous Engineering',
      version: manifest?.project?.version ?? null,
      central_rule: manifest?.vision?.central_rule ?? null,
    },
    state: summary,
    progress: state.progress ?? null,
    current_phase: currentPhase ? { id: currentPhase.id, name: currentPhase.name, status: currentPhase.status } : null,
    current_task: currentTask ? { id: currentTask.id, title: currentTask.title, status: currentTask.status, progress: currentTask.progress ?? 0, layer: currentTask.layer, acceptance: currentTask.acceptance ?? null, recovery_plan: currentTask.recovery_plan ?? null } : null,
    last_checkpoint: checkpoint ? { id: checkpoint.id, label: checkpoint.label, created_at: checkpoint.created_at, summary: checkpoint.summary } : null,
    blocks: [...(state.blocks ?? []).filter((b) => b.status !== 'resolved'), ...interruptions],
    relevant_decisions: decisions,
    failed_attempts: failedAttempts,
    open_interruptions: interruptions,
    known_constraints: { hard_policies: hardPolicies, critical_requirements: criticalRequirements },
    required_files: [...new Set([...requiredFiles, ...artifactRows])].slice(0, limits.files * 2),
    related_documentation: documentation,
    searches,
    provenance,
    graph_neighbours: graphNeighbours,
    recent_timeline: recent.events.slice(-12).map((event) => ({ ts: event.ts, type: event.type, layer: event.layer, preview: JSON.stringify(event.payload ?? {}).slice(0, 120) })),
    next_recommended_action: state.next_recommended_action
      ?? (nextTask ? { en: `Continue with ${nextTask.id}: ${nextTask.title}`, es: `Continuar con ${nextTask.id}: ${nextTask.title}`, pt: `Continuar com ${nextTask.id}: ${nextTask.title}` } : null),
    roadmap_remaining: (roadmap.phases ?? []).filter((p) => p.status !== 'completed').map((p) => ({ id: p.id, name: p.name, status: p.status, weight: p.weight })),
  };

  bus?.emit('CONTEXT_BUILT', {
    query: query ?? null,
    decisions: decisions.length,
    failed_attempts: failedAttempts.length,
    files: context.required_files.length,
    events: recent.count,
  }, { layer: 'knowledge', task: currentTask?.id ?? null });

  return ok(context);
}

/** ES/EN/PT: nodos del grafo cuyo nombre aparece en la consulta. Graph nodes whose label appears in the query. */
export function findRelatedNodes(db, query, limit = 5) {
  const words = String(query ?? '').toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) ?? [];
  if (!words.length) return [];
  const rows = all(db, 'SELECT id, kind, label, what_is FROM nodes');
  const scored = rows
    .map((row) => {
      const label = String(row.label).toLowerCase();
      const hits = words.filter((word) => label.includes(word)).length;
      return hits ? { id: row.id, kind: row.kind, label: row.label, what_is: row.what_is, hits, relations: neighbors(db, row.id).outgoing.slice(0, 4) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);
  return scored;
}

/**
 * ES: renderiza el contexto como bloque de texto legible (formato sección 8).
 * EN: renders the context as a readable text block (section 8 format).
 * PT: renderiza o contexto como bloco de texto legível (formato da seção 8).
 */
export function renderSessionContext(context, options = {}) {
  const { language = 'en', compact = false } = options;
  const line = (label, value) => `${label.padEnd(26, ' ')} ${value ?? '—'}`;
  const list = (items, renderer = (item) => `  - ${item}`) => (items?.length ? items.map(renderer).join('\n') : '  —');
  const trilingual = (value) => (value && typeof value === 'object' ? value[language] ?? value.en ?? value.es ?? value.pt ?? JSON.stringify(value) : value);

  const out = [];
  out.push('═'.repeat(72));
  out.push('SESSION CONTEXT · GENESIS PROJECT KNOWLEDGE & AUTONOMOUS ENGINE');
  out.push(`Generated: ${context.generated_at}`);
  out.push('═'.repeat(72));
  out.push('');
  out.push(line('Project:', `${context.project.name}${context.project.version ? ` v${context.project.version}` : ''}`));
  out.push(line('Central rule:', context.project.central_rule ?? '—'));
  out.push(line('Progress:', `${context.progress?.percent ?? 0}%`));
  out.push(line('Current phase:', context.current_phase ? `${context.current_phase.id} · ${context.current_phase.name} (${context.current_phase.status})` : '—'));
  out.push(line('Current task:', context.current_task ? `${context.current_task.id} · ${context.current_task.title} [${context.current_task.status} ${context.current_task.progress}%]` : '—'));
  out.push(line('Agent:', context.state?.agent_status ?? 'idle'));
  out.push(line('Last checkpoint:', context.last_checkpoint ? `${context.last_checkpoint.id} · ${context.last_checkpoint.label} (${context.last_checkpoint.created_at})` : 'none'));
  out.push(line('Blocks:', context.blocks?.length ?? 0));
  out.push('');

  out.push(`RELEVANT DECISIONS (${context.relevant_decisions?.length ?? 0})`);
  out.push(list(context.relevant_decisions, (d) => `  - ${d.id} [${d.status ?? '?'}] ${String(d.decision ?? '').slice(0, 110)}`));
  out.push('');

  out.push(`FAILED ATTEMPTS / OPEN INTERRUPTIONS (${(context.failed_attempts?.length ?? 0) + (context.open_interruptions?.length ?? 0)})`);
  out.push(list(context.failed_attempts, (e) => `  - ${e.id} [${e.severity}${e.resolved ? ' · resolved' : ''}] ${String(e.message).slice(0, 100)}`));
  out.push(list(context.open_interruptions, (i) => `  - ${i.id} <${i.type}> ${String(i.reason).slice(0, 100)}`));
  out.push('');

  out.push('KNOWN CONSTRAINTS');
  out.push(list(context.known_constraints?.hard_policies, (p) => `  - ${p.id} ${p.key}: ${p.statement}`));
  out.push(list(context.known_constraints?.critical_requirements, (r) => `  - ${r.id} ${String(r.title).slice(0, 100)}`));
  out.push('');

  if (!compact) {
    out.push('REQUIRED FILES');
    out.push(list(context.required_files, (f) => `  - ${f}`));
    out.push('');
    out.push('RELATED DOCUMENTATION');
    out.push(list(context.related_documentation, (d) => `  - [${d.kind}] ${d.id} ${String(d.title).slice(0, 110)}`));
    out.push('');
    out.push('SEARCHES PERFORMED');
    out.push(list(context.searches, (s) => `  - ${s.id} "${String(s.query).slice(0, 90)}"${s.selected ? ` → selected: ${String(s.selected).slice(0, 60)}` : ''}`));
    out.push('');
    if (context.graph_neighbours?.length) {
      out.push('KNOWLEDGE GRAPH · RELATED NODES');
      out.push(list(context.graph_neighbours, (n) => `  - (${n.kind}) ${n.label}${n.relations?.length ? ` → ${n.relations.map((r) => `${r.relation}:${r.node.label}`).join(', ').slice(0, 120)}` : ''}`));
      out.push('');
    }
    out.push('RECENT TIMELINE');
    out.push(list(context.recent_timeline, (e) => `  - ${String(e.ts).slice(11, 19)} ${e.type.padEnd(22, ' ')} ${e.layer ?? ''} ${e.preview ?? ''}`));
    out.push('');
  }

  out.push('NEXT RECOMMENDED ACTION');
  out.push(`  ${trilingual(context.next_recommended_action) ?? '—'}`);
  out.push('');
  out.push('REMAINING ROADMAP');
  out.push(list(context.roadmap_remaining, (p) => `  - ${p.id} ${p.name} [${p.status}, weight ${p.weight}]`));
  out.push('');
  out.push('═'.repeat(72));
  return out.join('\n');
}

/**
 * ES: versión Markdown del contexto, pensada para PEGAR en una conversación con
 *     una IA y que continúe exactamente donde lo dejamos. Es el caso de uso real:
 *     abrir chat nuevo → pegar esto → seguir trabajando sin repetir nada.
 * EN: Markdown version of the context, meant to be PASTED into an AI
 *     conversation so it continues exactly where we left off. This is the real
 *     use case: open a new chat → paste this → keep working without repeating.
 * PT: versão Markdown do contexto, pensada para COLAR numa conversa com uma IA e
 *     ela continuar exatamente de onde paramos. É o caso de uso real: abrir um
 *     chat novo → colar isto → seguir trabalhando sem repetir nada.
 */
export function renderContextMarkdown(context) {
  const bullets = (items, fn) => (items?.length ? items.map((item) => `- ${fn(item)}`).join('\n') : '- —');
  return [
    `# Session Context — ${context.project.name}`,
    ``,
    `_Generated ${context.generated_at} · Rule: ${context.project.central_rule ?? '—'}_`,
    ``,
    `## Where we are`,
    `- Progress: **${context.progress?.percent ?? 0}%**`,
    `- Phase: ${context.current_phase ? `${context.current_phase.id} (${context.current_phase.name}) — ${context.current_phase.status}` : '—'}`,
    `- Task: ${context.current_task ? `${context.current_task.id} — ${context.current_task.title} [${context.current_task.status}]` : '—'}`,
    `- Last checkpoint: ${context.last_checkpoint ? context.last_checkpoint.id : 'none'}`,
    `- Open blocks: ${context.blocks?.length ?? 0}`,
    ``,
    `## Relevant decisions`,
    bullets(context.relevant_decisions, (d) => `**${d.id}** [${d.status ?? '?'}] ${d.decision ?? ''}${d.justification ? ` — _${String(d.justification).slice(0, 160)}_` : ''}`),
    ``,
    `## Failed attempts (do not repeat)`,
    bullets([...(context.failed_attempts ?? []), ...(context.open_interruptions ?? [])], (e) => `${e.id} ${e.message ?? e.reason ?? ''}${e.recovery ? ` → recovery: ${e.recovery}` : ''}`),
    ``,
    `## Hard constraints`,
    bullets(context.known_constraints?.hard_policies, (p) => `\`${p.key}\` — ${p.statement}`),
    ``,
    `## Files involved`,
    bullets(context.required_files, (f) => `\`${f}\``),
    ``,
    `## Next recommended action`,
    typeof context.next_recommended_action === 'object' && context.next_recommended_action
      ? `- EN: ${context.next_recommended_action.en}\n- ES: ${context.next_recommended_action.es}\n- PT: ${context.next_recommended_action.pt}`
      : `- ${context.next_recommended_action ?? '—'}`,
    ``,
    `## Remaining roadmap`,
    bullets(context.roadmap_remaining, (p) => `${p.id} — ${p.name} (${p.status}, weight ${p.weight})`),
  ].join('\n');
}

export default { buildSessionContext, findRelatedNodes, renderSessionContext, renderContextMarkdown };

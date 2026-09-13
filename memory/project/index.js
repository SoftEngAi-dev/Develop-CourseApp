/* ═══════════════════════════════════════════════════════════════════════════
 * memory/project/index.js — PROJECT MEMORY façade
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: responde "¿qué es este proyecto y dónde está?" en una sola
 *     llamada: manifiesto + estado + hoja de ruta + políticas + tareas.
 *     POR QUÉ EXISTE: el agente (Fase 5) y el Context Engine necesitan memoria
 *     de PROYECTO separada de la de sesión. Un agente sin memoria de proyecto
 *     vuelve a preguntar lo que ya está decidido. Esta fachada es la puerta
 *     única de lectura: nadie más vuelve a abrir cinco JSON a mano.
 *     ESTADO: IMPLEMENTADA. Solo LEE datos ya existentes de las Fases 0-2; no
 *     añade comportamiento nuevo, por eso no es un stub.
 *
 * 🇬🇧 EN — WHAT IT DOES: answers "what is this project and where does it stand?"
 *     in one call: manifest + state + roadmap + policies + tasks.
 *     WHY IT EXISTS: the agent (Phase 5) and the Context Engine need PROJECT
 *     memory separate from session memory. An agent without project memory asks
 *     again about things already decided. This façade is the single read door.
 *     STATUS: IMPLEMENTED. It only READS data already produced by Phases 0-2; it
 *     adds no new behaviour, which is why it is not a stub.
 *
 * 🇧🇷 PT — O QUE FAZ: responde "o que é este projeto e onde ele está?" numa
 *     chamada: manifesto + estado + roteiro + políticas + tarefas.
 *     POR QUE EXISTE: o agente (Fase 5) precisa de memória de PROJETO separada da
 *     memória de sessão. Sem ela, pergunta de novo o que já foi decidido.
 *     ESTADO: IMPLEMENTADA. Apenas LÊ dados das Fases 0-2.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Qué es una "fachada" (façade) ES/EN/PT: un módulo que no hace trabajo
 *     nuevo: solo reúne varias llamadas en una interfaz simple. Como el menú de
 *     un restaurante: no cocina, pero te evita entrar a la cocina.
 *     A façade adds no logic; it groups several calls behind one simple API.
 *   • Por qué "solo lectura" importa ES/EN/PT: si una fachada también ESCRIBE,
 *     nadie sabe ya quién modificó qué. Mantenerla de lectura la hace segura de
 *     llamar desde cualquier lugar, incluidas las pruebas.
 *     A read-only façade is safe to call from anywhere, including tests.
 *   • Result {ok, value|error} ES/EN/PT: en vez de lanzar excepciones (que
 *     obligan a try/catch en cada llamada), devolvemos un objeto con `ok`.
 *     El error se convierte en DATO, no en salto de control. Ver
 *     core/shared/result.js. Errors as data, not as control flow.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { ok, fail } from '../../core/shared/result.js';
import { loadManifest } from '../../core/manifest/index.js';
import { loadState, loadTasks, loadRoadmap, summarize } from '../../core/state/index.js';
import { readJson } from '../../core/shared/json.js';
import { PATHS } from '../../core/shared/paths.js';

/**
 * ES: memoria de proyecto: identidad, visión, estado actual, hoja de ruta y reglas.
 * EN: project memory: identity, vision, current state, roadmap and rules.
 * PT: memória de projeto: identidade, visão, estado atual, roteiro e regras.
 *
 * @param {object} [options]
 * @param {boolean} [options.compact=false] devuelve solo lo esencial (menos bytes)
 * @returns {{ok:true,value:object}|{ok:false,error:object}}
 */
export function projectMemory(options = {}) {
  const { compact = false } = options;
  const manifestResult = loadManifest();
  if (!manifestResult.ok) return fail(manifestResult.error);

  const manifest = manifestResult.value;
  const state = loadState().value ?? {};
  const tasks = loadTasks().value ?? { tasks: [] };
  const roadmap = loadRoadmap().value ?? { phases: [] };
  const policies = readJson(PATHS.policies, { rules: [] });

  const summary = summarize(state, tasks);

  if (compact) {
    return ok({
      kind: 'project-memory',
      compact: true,
      id: manifest.project?.id ?? null,
      name: manifest.project?.name ?? null,
      version: manifest.project?.version ?? null,
      north_star: manifest.vision?.north_star ?? null,
      central_rule: manifest.vision?.central_rule ?? null,
      progress_percent: summary.progress_percent ?? 0,
      current_phase: summary.current_phase ?? null,
      current_task: summary.current_task ?? null,
      open_blocks: summary.open_blocks ?? [],
      hard_rules: (policies.rules ?? []).filter((rule) => rule.severity === 'hard' || rule.blocking === true).map((rule) => rule.id ?? rule.rule ?? rule),
    });
  }

  return ok({
    kind: 'project-memory',
    compact: false,
    identity: {
      id: manifest.project?.id ?? null,
      name: manifest.project?.name ?? null,
      codename: manifest.project?.codename ?? null,
      version: manifest.project?.version ?? null,
      license: manifest.project?.license ?? null,
      summary: manifest.project?.summary ?? null,
    },
    vision: manifest.vision ?? {},
    architecture: {
      levels: manifest.architecture?.levels ?? [],
      layers: manifest.architecture?.layers ?? [],
      pipeline: manifest.architecture?.pipeline ?? [],
      agent_loop: manifest.architecture?.agent_loop ?? [],
      mutation_protocol: manifest.architecture?.mutation_protocol ?? [],
      modes: manifest.architecture?.modes ?? [],
    },
    state: summary,
    roadmap: {
      phases: (roadmap.phases ?? []).map((phase) => ({
        id: phase.id, name: phase.name, status: phase.status, weight: phase.weight,
        deliverables: phase.deliverables ?? [], exit_criteria: phase.exit_criteria ?? null,
      })),
      completed_phases: (roadmap.phases ?? []).filter((phase) => phase.status === 'completed').map((phase) => phase.id),
      remaining_phases: (roadmap.phases ?? []).filter((phase) => phase.status !== 'completed').map((phase) => phase.id),
    },
    tasks: {
      total: (tasks.tasks ?? []).length,
      by_status: (tasks.tasks ?? []).reduce((acc, task) => { acc[task.status] = (acc[task.status] ?? 0) + 1; return acc; }, {}),
      blocked: (tasks.tasks ?? []).filter((task) => task.status === 'blocked').map((task) => ({ id: task.id, title: task.title, blocks: task.blocks ?? [] })),
      next: (tasks.tasks ?? []).filter((task) => ['planned', 'in_progress', 'running'].includes(task.status)).slice(0, 5).map((task) => ({ id: task.id, title: task.title, status: task.status })),
    },
    policies: policies.rules ?? [],
    anti_goals: manifest.vision?.anti_goals ?? [],
  });
}

/** ES/EN/PT: texto legible de la memoria de proyecto, para volcar en un prompt. */
export function renderProjectMemory(memory, language = 'en') {
  if (!memory?.ok) return '';
  const value = memory.value;
  /*
   * ES: la versión compacta guarda identidad y visión APLANADAS (id, name,
   *     north_star en la raíz); la completa las guarda anidadas (identity.id,
   *     vision.north_star). Un renderizador que solo conoce una forma se rompe
   *     con la otra: por eso aceptamos las dos con `??`.
   * EN: the compact version stores identity and vision FLATTENED (id, name,
   *     north_star at the root); the full one nests them (identity.id,
   *     vision.north_star). A renderer that knows only one shape breaks on the
   *     other: that is why we accept both with `??`.
   * PT: a versão compacta achata identidade/visão; a completa as aninha.
   */
  const name = value.identity?.name ?? value.name ?? 'unknown';
  const id = value.identity?.id ?? value.id ?? '';
  const version = value.identity?.version ?? value.version ?? '?';
  const northStar = value.vision?.north_star?.[language] ?? value.north_star?.[language] ?? '';
  const centralRule = value.vision?.central_rule ?? value.central_rule ?? '';
  const progress = value.state?.progress_percent ?? value.progress_percent ?? 0;
  const phase = value.state?.current_phase ?? value.current_phase ?? '?';
  const task = value.state?.current_task ?? value.current_task ?? null;

  const lines = [
    `PROJECT: ${name}${id ? ` (${id})` : ''} v${version}`,
    northStar ? `NORTH STAR: ${northStar}` : null,
    centralRule ? `CENTRAL RULE: ${centralRule}` : null,
    `PROGRESS: ${progress}% · phase ${phase}`,
    task ? `CURRENT TASK: ${task.id} · ${task.title} [${task.status}${task.progress !== undefined ? ` ${task.progress}%` : ''}]` : null,
    (value.state?.open_blocks ?? value.open_blocks ?? []).length
      ? `OPEN BLOCKS: ${(value.state?.open_blocks ?? value.open_blocks).map((block) => `${block.id ?? block.type ?? 'block'} (${block.reason ?? ''})`).join(' | ')}`
      : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export default { projectMemory, renderProjectMemory };

/* ═══════════════════════════════════════════════════════════════════════════
 * core/state/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: administra el ESTADO del proyecto (control/state.json) y
 *     las TAREAS (control/tasks.json): cargar, guardar, calcular progreso,
 *     incrementar contadores y hacer transiciones de tarea válidas.
 *     POR QUÉ EXISTE (sección 8 y nivel 5): este es el archivo que permite que
 *     otra sesión no tenga que releer todo el universo. Al abrir el proyecto,
 *     `state.json` responde: ¿en qué fase vamos?, ¿qué tarea toca?, ¿cuántos
 *     bloqueos hay?, ¿cuál fue el último checkpoint?
 *     Es la diferencia entre "un montón de chats" y "un proyecto con memoria".
 *
 * 🇬🇧 EN — WHAT IT DOES: manages project STATE (control/state.json) and TASKS
 *     (control/tasks.json): load, save, compute progress, bump counters and
 *     perform valid task transitions.
 *     WHY IT EXISTS (section 8 and level 5): this is the file that lets another
 *     session avoid re-reading the whole universe. On opening the project,
 *     state.json answers: which phase are we in? which task is next? how many
 *     blocks? what was the last checkpoint?
 *     It is the difference between "a pile of chats" and "a project with memory".
 *
 * 🇧🇷 PT — O QUE FAZ: administra o ESTADO do projeto (control/state.json) e as
 *     TAREFAS (control/tasks.json): carregar, salvar, calcular progresso,
 *     incrementar contadores e fazer transições de tarefa válidas.
 *     POR QUE EXISTE (seção 8 e nível 5): é o arquivo que permite que outra
 *     sessão não precise reler o universo inteiro. Ao abrir o projeto,
 *     state.json responde: em que fase estamos? qual tarefa vem a seguir?
 *     quantos bloqueios? qual foi o último checkpoint?
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Estado vs Evento ES/EN/PT: el ESTADO es una foto ("progreso 68%");
 *     el EVENTO es una película ("hace 3 segundos se completó la tarea X").
 *     Necesitas ambos: el estado para arrancar rápido, los eventos para auditar.
 *     State is a snapshot; an event is a film. You need both.
 *   • Progreso ponderado ES/EN/PT: si la Fase 2 pesa 20 y la Fase 7 pesa 5,
 *     completar la Fase 2 debe mover la aguja cuatro veces más. Sumar tareas
 *     sin peso hace que el progreso mienta.
 *     Weighted progress: a heavy phase moves the needle more than a light one.
 *   • `Math.round(x * 100) / 100` ES/EN/PT: truco estándar para redondear a 2
 *     decimales sin librerías. Multiplicas, redondeas el entero, divides.
 *     Standard trick to round to 2 decimals without libraries.
 *   • Inmutabilidad defensiva ES/EN/PT: devolvemos `structuredClone` de lo
 *     guardado para que nadie modifique el estado "de verdad" por accidente.
 *     We return clones so nobody mutates the real state by accident.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { PATHS } from '../shared/paths.js';
import { readJson, writeJson } from '../shared/json.js';
import { ok, fail, attempt } from '../shared/result.js';
import { canTransition, isTaskState, isActive, needsAttention } from './task-states.js';

/**
 * ES: crea un estado inicial vacío (lo usa `genesis init`).
 * EN: creates an empty initial state (used by `genesis init`).
 * PT: cria um estado inicial vazio (usado por `genesis init`).
 */
export function createInitialState(overrides = {}) {
  const now = new Date().toISOString();
  return {
    state_version: '1.0.0',
    project: 'genesis',
    initialized: true,
    initialized_at: now,
    updated_at: now,
    current_phase: 'phase-0',
    current_layer: 'vision',
    current_task: null,
    progress: { percent: 0, method: 'weighted_phase_completion', phases_completed: [], phases_stub: [] },
    counters: { sessions: 0, messages: 0, events: 0, decisions: 0, interruptions: 0, checkpoints: 0, lessons: 0, builds: 0 },
    agent: { status: 'idle', last_run_at: null, loop_position: null },
    blocks: [],
    last_checkpoint: null,
    next_recommended_action: null,
    ...overrides,
  };
}

/** ES/EN/PT: carga state.json. Loads state.json. */
export function loadState(file = PATHS.state) {
  return attempt(() => readJson(file, createInitialState()), { code: 'state_load_failed', layer: 'control' });
}

/** ES/EN/PT: carga tasks.json. Loads tasks.json. */
export function loadTasks(file = PATHS.tasks) {
  return attempt(() => readJson(file, { tasks: [], state_machine: [] }), { code: 'tasks_load_failed', layer: 'control' });
}

/** ES/EN/PT: carga roadmap.json. Loads roadmap.json. */
export function loadRoadmap(file = PATHS.roadmap) {
  return attempt(() => readJson(file, { phases: [] }), { code: 'roadmap_load_failed', layer: 'control' });
}

/**
 * ES: guarda el estado marcando `updated_at` automáticamente y emitiendo el
 *     evento STATE_UPDATED (POL-0001: todo deja rastro).
 * EN: saves the state stamping `updated_at` automatically and emitting the
 *     STATE_UPDATED event (POL-0001: everything leaves a trace).
 * PT: salva o estado marcando `updated_at` automaticamente e emitindo o evento
 *     STATE_UPDATED (POL-0001: tudo deixa rastro).
 */
export function saveState(state, options = {}) {
  const { bus = null, file = PATHS.state, reason = 'state update' } = options;
  return attempt(() => {
    const next = { ...state, updated_at: new Date().toISOString() };
    const result = writeJson(file, next);
    bus?.emit('STATE_UPDATED', { reason, progress: next.progress?.percent ?? null, current_task: next.current_task ?? null }, { layer: 'control' });
    return { state: next, ...result };
  }, { code: 'state_save_failed', layer: 'control' });
}

/**
 * ES: calcula el progreso ponderado usando los pesos del roadmap y el estado de
 *     cada tarea. Una fase completada aporta todo su peso; una fase a medias
 *     aporta la media del progreso de sus tareas.
 * EN: computes weighted progress using roadmap weights and each task's status.
 *     A completed phase contributes its full weight; a half-done phase
 *     contributes the average progress of its tasks.
 * PT: calcula o progresso ponderado usando os pesos do roadmap e o status de
 *     cada tarefa. Uma fase concluída contribui com todo o seu peso; uma fase
 *     pela metade contribui com a média do progresso de suas tarefas.
 *
 * @returns {{ percent: number, per_phase: object[], phases_completed: string[], total_weight: number, earned_weight: number }}
 */
export function computeProgress(roadmap, tasks) {
  const phases = roadmap?.phases ?? [];
  const taskList = tasks?.tasks ?? [];
  const totalWeight = phases.reduce((sum, phase) => sum + (Number(phase.weight) || 0), 0) || 1;
  let earned = 0;
  const perPhase = [];
  const completed = [];

  for (const phase of phases) {
    const weight = Number(phase.weight) || 0;
    const phaseTasks = taskList.filter((t) => t.phase === phase.id);

    let ratio = 0;
    if (phase.status === 'completed') {
      ratio = 1;
    } else if (phaseTasks.length > 0) {
      // ES: media del progreso declarado de cada tarea de la fase.
      // EN: average of the declared progress of each task in the phase.
      // PT: média do progresso declarado de cada tarefa da fase.
      ratio = phaseTasks.reduce((sum, t) => sum + Math.min(100, Math.max(0, Number(t.progress) || 0)), 0) / (phaseTasks.length * 100);
    } else if (phase.status === 'stub' || phase.status === 'planned') {
      ratio = 0;
    }

    earned += weight * ratio;
    if (ratio >= 1) completed.push(phase.id);
    perPhase.push({ id: phase.id, name: phase.name, weight, status: phase.status, ratio: Math.round(ratio * 1000) / 1000, tasks: phaseTasks.length });
  }

  const percent = Math.round((earned / totalWeight) * 1000) / 10;
  return { percent, per_phase: perPhase, phases_completed: completed, total_weight: totalWeight, earned_weight: Math.round(earned * 100) / 100 };
}

/**
 * ES: mueve una tarea a un nuevo estado SOLO si la transición es legal.
 *     Si no lo es, devuelve un fallo con el motivo (no lanza excepción).
 * EN: moves a task to a new state ONLY if the transition is legal. Otherwise it
 *     returns a failure with the reason (it does not throw).
 * PT: move uma tarefa para um novo estado SOMENTE se a transição for legal.
 *     Caso contrário, devolve uma falha com o motivo (não lança exceção).
 *
 * @param {string} taskId
 * @param {string} newStatus
 * @param {{ bus?: object, reason?: string, progress?: number, file?: string }} [options]
 */
export function transitionTask(taskId, newStatus, options = {}) {
  const { bus = null, reason = null, progress = null, file = PATHS.tasks } = options;

  if (!isTaskState(newStatus)) {
    return fail(`Unknown task state "${newStatus}"`, { code: 'invalid_state', interruptionType: 'ambiguity', layer: 'control', task: taskId });
  }

  const loaded = loadTasks(file);
  if (!loaded.ok) return loaded;
  const data = loaded.value;
  const task = (data.tasks ?? []).find((t) => t.id === taskId);
  if (!task) {
    return fail(`Task ${taskId} not found in ${file}`, { code: 'task_not_found', interruptionType: 'ambiguity', layer: 'control', task: taskId });
  }

  const from = task.status ?? 'discovered';
  if (!canTransition(from, newStatus)) {
    // ES: aquí es donde la máquina de estados protege la honestidad del progreso.
    // EN: this is where the state machine protects the honesty of progress.
    // PT: aqui é onde a máquina de estados protege a honestidade do progresso.
    return fail(`Illegal transition ${from} -> ${newStatus} for ${taskId}`, {
      code: 'illegal_transition',
      interruptionType: 'conflict',
      layer: 'control',
      task: taskId,
      details: { from, to: newStatus },
    });
  }

  const now = new Date().toISOString();
  task.status = newStatus;
  task.updated_at = now;
  if (progress !== null) task.progress = Math.min(100, Math.max(0, Number(progress)));
  if (newStatus === 'completed') {
    task.progress = 100;
    task.completed_at = now;
  }
  if (reason) task.last_reason = reason;
  task.history = [...(task.history ?? []), { from, to: newStatus, at: now, reason }];

  const saved = attempt(() => writeJson(file, data), { code: 'tasks_save_failed' });
  if (!saved.ok) return saved;

  bus?.emit('STATE_UPDATED', { kind: 'task_transition', task: taskId, from, to: newStatus, reason }, { layer: 'control', task: taskId });
  return ok({ task, from, to: newStatus });
}

/**
 * ES: incrementa un contador del estado (sessions, messages, decisions...).
 * EN: bumps a state counter (sessions, messages, decisions...).
 * PT: incrementa um contador do estado (sessions, messages, decisions...).
 */
export function bumpCounter(name, amount = 1, options = {}) {
  const { bus = null, save = true } = options;
  const loaded = loadState();
  if (!loaded.ok) return loaded;
  const state = loaded.value;
  state.counters = state.counters ?? {};
  state.counters[name] = (Number(state.counters[name]) || 0) + amount;
  if (!save) return ok(state);
  return saveState(state, { bus, reason: `counter ${name} += ${amount}` });
}

/**
 * ES: sincroniza el estado con la realidad: recalcula progreso, fase actual,
 *     tarea actual, bloqueos abiertos y contadores. Se ejecuta al iniciar y al
 *     cerrar cada sesión (`genesis init`, `genesis resume`, `genesis status`).
 * EN: synchronizes the state with reality: recomputes progress, current phase,
 *     current task, open blocks and counters. Runs at the start and end of each
 *     session (`genesis init`, `genesis resume`, `genesis status`).
 * PT: sincroniza o estado com a realidade: recalcula progresso, fase atual,
 *     tarefa atual, bloqueios abertos e contadores. Executa ao iniciar e ao
 *     encerrar cada sessão.
 */
export function reconcile(options = {}) {
  const { bus = null, save = true } = options;
  const stateResult = loadState();
  const tasksResult = loadTasks();
  const roadmapResult = loadRoadmap();
  if (!stateResult.ok) return stateResult;
  if (!tasksResult.ok) return tasksResult;
  if (!roadmapResult.ok) return roadmapResult;

  const state = stateResult.value;
  const tasks = tasksResult.value;
  const roadmap = roadmapResult.value;
  const progress = computeProgress(roadmap, tasks);

  // ES: la tarea actual es la primera activa; si no hay, la primera que necesita atención.
  // EN: the current task is the first active one; otherwise the first needing attention.
  // PT: a tarefa atual é a primeira ativa; se não houver, a primeira que precisa de atenção.
  const taskList = tasks.tasks ?? [];
  const current = taskList.find((t) => isActive(t.status)) ?? taskList.find((t) => needsAttention(t.status)) ?? taskList.find((t) => t.status === 'planned' || t.status === 'ready') ?? null;

  const phases = roadmap.phases ?? [];
  const currentPhase = phases.find((p) => p.id === current?.phase) ?? phases.find((p) => p.status !== 'completed') ?? phases[phases.length - 1] ?? null;

  state.progress = {
    percent: progress.percent,
    method: 'weighted_phase_completion',
    phases_completed: progress.phases_completed,
    phases_stub: phases.filter((p) => p.status === 'stub' || p.status === 'planned').map((p) => p.id),
    per_phase: progress.per_phase,
  };
  state.current_phase = currentPhase?.id ?? state.current_phase ?? null;
  state.current_layer = current?.layer ?? state.current_layer ?? null;
  state.current_task = current?.id ?? null;
  state.counters = {
    ...(state.counters ?? {}),
    tasks_total: taskList.length,
    tasks_completed: taskList.filter((t) => t.status === 'completed').length,
    tasks_blocked: taskList.filter((t) => t.status === 'blocked' || t.status === 'failed').length,
  };

  if (!save) return ok({ state, progress, current_task: current, current_phase: currentPhase });
  const saved = saveState(state, { bus, reason: 'reconcile' });
  if (!saved.ok) return saved;
  return ok({ state: saved.value.state, progress, current_task: current, current_phase: currentPhase });
}

/**
 * ES: construye el resumen de estado legible (el bloque "Proyecto / Estado /
 *     Última tarea / Bloqueos / Siguiente acción" de la sección 8).
 * EN: builds the human-readable state summary (the "Project / State / Last task
 *     / Blocks / Next action" block from section 8).
 * PT: constrói o resumo de estado legível (o bloco "Projeto / Estado / Última
 *     tarefa / Bloqueios / Próxima ação" da seção 8).
 */
export function summarize(state, tasks) {
  const taskList = tasks?.tasks ?? [];
  const current = taskList.find((t) => t.id === state?.current_task) ?? null;
  const openBlocks = (state?.blocks ?? []).filter((b) => b.status !== 'resolved' && b.status !== 'closed');
  return {
    project: state?.project ?? 'genesis',
    progress_percent: state?.progress?.percent ?? 0,
    current_phase: state?.current_phase ?? null,
    current_task: current ? { id: current.id, title: current.title, status: current.status, progress: current.progress ?? 0 } : null,
    agent_status: state?.agent?.status ?? 'idle',
    open_blocks: openBlocks,
    counters: state?.counters ?? {},
    last_checkpoint: state?.last_checkpoint ?? null,
    next_recommended_action: state?.next_recommended_action ?? null,
    updated_at: state?.updated_at ?? null,
  };
}

export default { createInitialState, loadState, loadTasks, loadRoadmap, saveState, computeProgress, transitionTask, bumpCounter, reconcile, summarize };

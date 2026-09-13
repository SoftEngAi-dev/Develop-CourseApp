/* ═══════════════════════════════════════════════════════════════════════════
 * core/checkpoint/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: guarda "fotos" completas del plano de control
 *     (manifest, state, tasks, roadmap, policies, decisions, agent-state) en
 *     control/checkpoints/CHK-00001-<etiqueta>.json, y permite compararlas,
 *     listarlas y RESTAURARLAS.
 *     POR QUÉ EXISTE (sección 22 y POL-0003): la IA puede equivocarse. Si antes
 *     de una operación arriesgada existe un checkpoint, el error deja de ser
 *     catastrófico y pasa a ser un `genesis rollback`. Sin checkpoint, un mal
 *     parche puede destruir semanas de trabajo.
 *     Regla: snapshot → diff → rollback. Nunca modificar sin foto previa.
 *
 * 🇬🇧 EN — WHAT IT DOES: takes complete "snapshots" of the control plane
 *     (manifest, state, tasks, roadmap, policies, decisions, agent-state) into
 *     control/checkpoints/CHK-00001-<label>.json, and allows comparing, listing
 *     and RESTORING them.
 *     WHY IT EXISTS (section 22 and POL-0003): the AI can be wrong. If a
 *     checkpoint exists before a risky operation, a mistake stops being
 *     catastrophic and becomes a `genesis rollback`. Without checkpoints a bad
 *     patch can destroy weeks of work.
 *     Rule: snapshot → diff → rollback. Never mutate without a prior snapshot.
 *
 * 🇧🇷 PT — O QUE FAZ: guarda "fotos" completas do plano de controle (manifest,
 *     state, tasks, roadmap, policies, decisions, agent-state) em
 *     control/checkpoints/CHK-00001-<etiqueta>.json, e permite compará-las,
 *     listá-las e RESTAURÁ-las.
 *     POR QUE EXISTE (seção 22 e POL-0003): a IA pode errar. Se existir um
 *     checkpoint antes de uma operação arriscada, o erro deixa de ser
 *     catastrófico e vira um `genesis rollback`. Sem checkpoint, um patch ruim
 *     pode destruir semanas de trabalho.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Checkpoint vs commit de Git ES/EN/PT: Git versiona CÓDIGO; el checkpoint
 *     versiona el ESTADO DEL PROYECTO (progreso, decisiones, tareas). Son
 *     complementarios: Git no sabe que vas por la Fase 2 al 68%.
 *     Git versions code; checkpoints version project state. Complementary.
 *   • Snapshot "gordo" ES/EN/PT: guardamos el contenido completo de cada
 *     archivo, no un diff. Ocupa más disco, pero restaurar es trivial y no
 *     depende de que todos los snapshots anteriores sigan existiendo.
 *     We store full contents, not deltas: bigger but trivially restorable.
 *   • `fs.statSync(f).size` ES/EN/PT: tamaño en bytes. Lo registramos para
 *     detectar archivos vacíos o crecimientos anómalos. Size in bytes.
 *   • Orden lexicográfico de IDs ES/EN/PT: como los IDs llevan ceros a la
 *     izquierda (CHK-00009 < CHK-00010), ordenar los nombres de archivo por
 *     texto ya da el orden cronológico. Por eso usamos `padStart`.
 *     Zero-padded IDs sort correctly as plain text.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../shared/paths.js';
import { readJson, writeJson, ensureDir } from '../shared/json.js';
import { ok, fail, attempt } from '../shared/result.js';
import { nextId, ID_PREFIX, safeSlug, compactTimestamp } from '../shared/ids.js';
import { deepDiff, summarizeDiff } from '../shared/deep.js';

/** ES/EN/PT: archivos del plano de control que se fotografían. Control-plane files included in every snapshot. */
export const SNAPSHOT_FILES = Object.freeze([
  { key: 'manifest', file: PATHS.manifest },
  { key: 'state', file: PATHS.state },
  { key: 'tasks', file: PATHS.tasks },
  { key: 'roadmap', file: PATHS.roadmap },
  { key: 'policies', file: PATHS.policies },
  { key: 'decisions', file: PATHS.decisions },
  { key: 'agent_state', file: PATHS.agentState },
]);

function existingCheckpointIds(dir = PATHS.checkpoints) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((name) => /^((CHK|chk)-\d+)/.exec(name)?.[1])
    .filter(Boolean)
    .map((id) => id.toUpperCase());
}

/**
 * ES: crea un checkpoint. Devuelve la ruta y el ID.
 * EN: creates a checkpoint. Returns the path and the ID.
 * PT: cria um checkpoint. Devolve o caminho e o ID.
 *
 * @param {{ label?: string, note?: string, bus?: object, dir?: string, phase?: string, task?: string }} [options]
 */
export function createCheckpoint(options = {}) {
  const { label = 'checkpoint', note = null, bus = null, dir = PATHS.checkpoints, phase = null, task = null } = options;

  return attempt(() => {
    ensureDir(dir);
    const id = nextId(ID_PREFIX.checkpoint, existingCheckpointIds(dir));
    const stamp = compactTimestamp();
    const fileName = `${id}-${stamp}-${safeSlug(label, 40)}.json`;
    const file = path.join(dir, fileName);

    const files = {};
    for (const entry of SNAPSHOT_FILES) {
      const exists = fs.existsSync(entry.file);
      files[entry.key] = {
        path: path.relative(PATHS.root, entry.file).split(path.sep).join('/'),
        exists,
        bytes: exists ? fs.statSync(entry.file).size : 0,
        content: exists ? readJson(entry.file) : null,
      };
    }

    const checkpoint = {
      id,
      label,
      note,
      phase,
      task,
      created_at: new Date().toISOString(),
      generator: 'core/checkpoint',
      engine: process.version,
      files,
      summary: {
        progress_percent: files.state?.content?.progress?.percent ?? null,
        current_phase: files.state?.content?.current_phase ?? phase,
        current_task: files.state?.content?.current_task ?? task,
        tasks_total: (files.tasks?.content?.tasks ?? []).length,
        decisions_total: (files.decisions?.content?.decisions ?? []).length,
        open_blocks: (files.state?.content?.blocks ?? []).filter((b) => b.status !== 'resolved').length,
      },
    };

    writeJson(file, checkpoint);
    bus?.emit('CHECKPOINT_CREATED', { id, label, file: path.relative(PATHS.root, file), summary: checkpoint.summary }, { layer: 'infrastructure', task });

    // ES: el estado recuerda cuál fue el último checkpoint (para `genesis resume`).
    // EN: the state remembers the last checkpoint (for `genesis resume`).
    // PT: o estado lembra qual foi o último checkpoint (para `genesis resume`).
    const state = files.state?.content;
    if (state) {
      state.last_checkpoint = { id, label, created_at: checkpoint.created_at, file: path.relative(PATHS.root, file) };
      state.updated_at = new Date().toISOString();
      writeJson(PATHS.state, state, { backup: false });
    }

    return { id, file, fileName, summary: checkpoint.summary };
  }, { code: 'checkpoint_create_failed', interruptionType: 'tool_error', layer: 'infrastructure' });
}

/** ES/EN/PT: lista los checkpoints (metadatos ligeros, sin cargar contenido). */
export function listCheckpoints(dir = PATHS.checkpoints) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const data = readJson(path.join(dir, name), null);
      return {
        id: data?.id ?? name,
        label: data?.label ?? null,
        created_at: data?.created_at ?? null,
        file: name,
        summary: data?.summary ?? null,
      };
    });
}

/** ES/EN/PT: el checkpoint más reciente. The most recent checkpoint. */
export function latestCheckpoint(dir = PATHS.checkpoints) {
  const all = listCheckpoints(dir);
  return all.length ? all[all.length - 1] : null;
}

/**
 * ES: carga el contenido completo de un checkpoint (por ID o por nombre de archivo).
 * EN: loads the full content of a checkpoint (by ID or file name).
 * PT: carrega o conteúdo completo de um checkpoint (por ID ou nome de arquivo).
 */
export function loadCheckpoint(idOrFile, dir = PATHS.checkpoints) {
  if (!fs.existsSync(dir)) return fail(`Checkpoint directory missing: ${dir}`, { code: 'checkpoint_dir_missing', interruptionType: 'dependency_missing' });
  const wanted = String(idOrFile).trim();
  const name = fs.readdirSync(dir).find((n) => n === wanted || n.startsWith(`${wanted}-`) || n.endsWith(`${wanted}.json`));
  if (!name) return fail(`Checkpoint "${idOrFile}" not found in ${dir}`, { code: 'checkpoint_not_found', interruptionType: 'ambiguity' });
  const data = readJson(path.join(dir, name), null);
  if (!data) return fail(`Checkpoint file ${name} is corrupt`, { code: 'checkpoint_corrupt', interruptionType: 'failed', recoverable: false });
  return ok({ ...data, _file: path.join(dir, name) });
}

/**
 * ES: RESTAURA un checkpoint. Antes de sobrescribir cada archivo, `writeJson`
 *     genera automáticamente el .bak, así el rollback del rollback también existe.
 * EN: RESTORES a checkpoint. Before overwriting each file, `writeJson` creates
 *     the .bak automatically, so a rollback of the rollback also exists.
 * PT: RESTAURA um checkpoint. Antes de sobrescrever cada arquivo, `writeJson`
 *     gera automaticamente o .bak, então o rollback do rollback também existe.
 */
export function restoreCheckpoint(idOrFile, options = {}) {
  const { bus = null, only = null } = options;
  const loaded = loadCheckpoint(idOrFile);
  if (!loaded.ok) return loaded;
  const checkpoint = loaded.value;

  const restored = [];
  const skipped = [];
  const before = {};

  for (const entry of SNAPSHOT_FILES) {
    if (only && !only.includes(entry.key)) { skipped.push(entry.key); continue; }
    const snapshot = checkpoint.files?.[entry.key];
    if (!snapshot || snapshot.content === null || snapshot.content === undefined) { skipped.push(entry.key); continue; }
    before[entry.key] = fs.existsSync(entry.file) ? readJson(entry.file) : null;
    writeJson(entry.file, snapshot.content);
    restored.push({ key: entry.key, path: snapshot.path });
  }

  const diff = {};
  for (const entry of restored) {
    diff[entry.key] = deepDiff(before[entry.key], checkpoint.files[entry.key].content);
  }

  bus?.emit('RECOVERY_COMPLETED', { kind: 'checkpoint_restore', checkpoint: checkpoint.id, restored: restored.map((r) => r.key), skipped }, { layer: 'infrastructure' });

  return ok({ checkpoint: checkpoint.id, restored, skipped, diff });
}

/**
 * ES: compara dos checkpoints y devuelve qué cambió entre ellos, archivo por archivo.
 * EN: compares two checkpoints and returns what changed between them, file by file.
 * PT: compara dois checkpoints e devolve o que mudou entre eles, arquivo por arquivo.
 */
export function diffCheckpoints(idA, idB) {
  const a = loadCheckpoint(idA);
  const b = loadCheckpoint(idB);
  if (!a.ok) return a;
  if (!b.ok) return b;

  const perFile = {};
  for (const entry of SNAPSHOT_FILES) {
    const before = a.value.files?.[entry.key]?.content ?? null;
    const after = b.value.files?.[entry.key]?.content ?? null;
    const diff = deepDiff(before, after);
    if (diff.added.length || diff.removed.length || diff.changed.length) {
      perFile[entry.key] = { ...diff, lines: summarizeDiff(diff, 20) };
    }
  }
  return ok({ from: a.value.id, to: b.value.id, changed_files: Object.keys(perFile), per_file: perFile });
}

/** ES/EN/PT: borra checkpoints viejos dejando los N más recientes. Prunes old checkpoints keeping the N most recent. */
export function pruneCheckpoints(keep = 20, dir = PATHS.checkpoints) {
  const all = listCheckpoints(dir);
  if (all.length <= keep) return ok({ removed: [], kept: all.length });
  const victims = all.slice(0, all.length - keep);
  const removed = [];
  for (const victim of victims) {
    try {
      fs.rmSync(path.join(dir, victim.file), { force: true });
      removed.push(victim.id);
    } catch { /* ES: seguimos con el siguiente | EN: continue with the next */ }
  }
  return ok({ removed, kept: all.length - removed.length });
}

export default { SNAPSHOT_FILES, createCheckpoint, listCheckpoints, latestCheckpoint, loadCheckpoint, restoreCheckpoint, diffCheckpoints, pruneCheckpoints };

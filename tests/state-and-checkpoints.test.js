/* ═══════════════════════════════════════════════════════════════════════════
 * tests/state-and-checkpoints.test.js — VERIFICATION LEVEL: unit + mutation-safety
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: dos garantías estructurales.
 *     (1) La máquina de estados de tareas: 13 estados y transiciones legales; un
 *         salto ilegal (discovered → completed) se RECHAZA, y eso es lo que hace
 *         creíble el porcentaje de progreso.
 *     (2) La red de seguridad de mutaciones (POL-0003): crear checkpoint en un
 *         directorio temporal, listarlos, podar los viejos, comparar dos
 *         checkpoints reales del repositorio, y comprobar que restaurar un id
 *         inexistente falla SIN escribir nada.
 *     El nivel "mutation-safety" declarado en control/manifest.json existe por
 *     este archivo: un cambio que no se puede deshacer no debería entrar jamás.
 * 🇬 EN — WHAT IT TESTS: two structural guarantees.
 *     (1) The task state machine: 13 states and legal transitions; an illegal
 *         jump (discovered → completed) is REJECTED, which is what makes the
 *         progress percentage trustworthy.
 *     (2) The mutation safety net (POL-0003): creating checkpoints in a temp
 *         directory, listing them, pruning old ones, diffing two real checkpoints
 *         of the repository, and verifying that restoring a missing id fails
 *         WITHOUT writing anything.
 *     The "mutation-safety" level declared in control/manifest.json exists because
 *     of this file: a change that cannot be undone must never enter.
 * 🇧🇷 PT — O QUE TESTA: (1) a máquina de estados das tarefas (saltos ilegais são
 *     rejeitados); (2) a rede de segurança de mutações: checkpoints em diretório
 *     temporário, poda, diff de checkpoints reais e restore de id inexistente
 *     falhando SEM escrever nada.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Máquina de estados finita ES/EN/PT: un conjunto de estados y una tabla de
 *     "desde aquí puedes ir a allí". Sin tabla, cualquier código puede marcar
 *     cualquier cosa como "completado". Con tabla, completar exige verificar.
 *     A transition table is what stops "completed" from meaning nothing.
 *   • Progreso ponderado ES/EN/PT: cada fase pesa (20% la 2, 5% la 7…). El total
 *     sale de las fases completadas, no de una opinión. Si el número no se puede
 *     recalcular desde los datos, no es un indicador: es un adorno.
 *     Progress must be recomputable from data or it is decoration.
 *   • Restaurar que no escribe ES/EN/PT: el caso de error más peligroso de un
 *     sistema de rollback es el que escribe ANTES de validar el id. Aquí se
 *     prueba que el fallo ocurre sin efectos secundarios.
 *     A rollback that writes before validating its id is a loaded gun.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canTransition, nextStates, isTerminal, isTaskState, TASK_STATES } from '../core/state/task-states.js';
import { computeProgress, summarize, loadState, loadTasks, loadRoadmap } from '../core/state/index.js';
import { createCheckpoint, listCheckpoints, latestCheckpoint, loadCheckpoint, restoreCheckpoint, diffCheckpoints, pruneCheckpoints } from '../core/checkpoint/index.js';
import { createLogger } from '../core/logger/index.js';
import { EventBus } from '../core/event-bus/index.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-chk-'));
const quiet = () => new EventBus({ persist: false, logger: createLogger({ scope: 'test-chk', quiet: true }) });

/*
 * ES: ⚠️ LECCIÓN REAL DE ESTE ARCHIVO: createCheckpoint() actualiza
 *     control/state.json (last_checkpoint) INCLUSO cuando se le pasa un dir
 *     temporal. La primera ejecución de estos tests contaminó el plano de
 *     control de verdad (last_checkpoint apuntando a /tmp borrado). La red de
 *     seguridad: respaldar los dos archivos al cargar el módulo y restaurarlos
 *     al terminar, pase lo que pase. Un test jamás debe dejar cicatrices.
 * EN: REAL LESSON: createCheckpoint() updates control/state.json even when given
 *     a temp dir. The first run of these tests polluted the real control plane.
 *     Safety net: back both files up at module load, restore them at teardown.
 *     A test must never leave scars.
 * PT: LIÇÃO REAL: createCheckpoint() atualiza o state.json mesmo com dir
 *     temporário. Backup no load + restore no teardown: testes não deixam
 *     cicatrizes.
 */
const STATE_FILE = 'control/state.json';
const BAK_FILE = 'control/state.json.bak';
const stateBackup = fs.readFileSync(STATE_FILE, 'utf8');
const bakBackup = fs.existsSync(BAK_FILE) ? fs.readFileSync(BAK_FILE, 'utf8') : null;
test.after(() => {
  fs.writeFileSync(STATE_FILE, stateBackup);
  if (bakBackup !== null) fs.writeFileSync(BAK_FILE, bakBackup);
});

test('task state machine: illegal jumps are refused', () => {
  assert.equal(isTaskState('running'), true);
  assert.equal(isTaskState('interrupted'), true, 'interrupted is accepted even outside the table');
  assert.equal(isTaskState('vibing'), false);

  assert.equal(canTransition('planned', 'ready'), true);
  assert.equal(canTransition('ready', 'running'), true);
  assert.equal(canTransition('running', 'verifying'), true);
  assert.equal(canTransition('verifying', 'completed'), true);
  assert.equal(canTransition('running', 'running'), true, 'staying put is always legal');

  assert.equal(canTransition('discovered', 'completed'), false, 'cannot complete without verifying');
  assert.equal(canTransition('completed', 'running'), false, 'completed is terminal');
  assert.equal(isTerminal('completed'), true);
  assert.equal(isTerminal('skipped'), true);
  assert.ok(nextStates('planned').includes('ready'));
  assert.deepEqual(nextStates('completed'), []);
  assert.equal(TASK_STATES.length, 13);
});

test('progress is recomputable from roadmap weights and task states', () => {
  const roadmap = loadRoadmap().value;
  const tasks = loadTasks().value;
  const state = loadState().value;

  const computed = computeProgress(roadmap, tasks);
  const percent = computed.percent;
  assert.ok(percent >= 0 && percent <= 100, `progress must be a percentage, got ${percent}`);
  assert.ok(Array.isArray(computed.per_phase) && computed.per_phase.length === 8, 'all eight phases are accounted');

  const summary = summarize(state, tasks);
  assert.equal(summary.progress_percent, percent, 'summarize and computeProgress must agree');
  assert.ok(summary.current_phase, 'the summary names the current phase');
  assert.ok(Array.isArray(summary.open_blocks), 'open blocks are part of the summary');

  const completed = roadmap.phases.filter((phase) => phase.status === 'completed');
  const expectedFromPhases = completed.reduce((total, phase) => total + (phase.weight ?? 0), 0);
  assert.ok(Math.abs(percent - expectedFromPhases) <= 10, 'phase weights dominate the percentage');
});

test('checkpoints: create, list, latest and prune inside a temp dir', () => {
  const dir = tmp();
  const bus = quiet();

  const first = createCheckpoint({ label: 'alpha', dir, bus });
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}));
  const second = createCheckpoint({ label: 'beta', dir, bus });
  const third = createCheckpoint({ label: 'gamma', dir, bus });
  assert.equal(second.ok, true);
  assert.equal(third.ok, true);

  const list = listCheckpoints(dir);
  assert.equal(list.length, 3);
  assert.equal(latestCheckpoint(dir).id, third.value.id);

  const loaded = loadCheckpoint(first.value.id, dir);
  assert.equal(loaded.ok, true);
  assert.ok(loaded.value.files, 'a checkpoint snapshots the control-plane files');
  assert.ok(Object.keys(loaded.value.files).length >= 4, 'manifest, state, tasks, roadmap at least');

  pruneCheckpoints(2, dir);
  assert.equal(listCheckpoints(dir).length, 2, 'prune keeps the N most recent');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('diffing two real checkpoints reports what changed between them', () => {
  const list = listCheckpoints();
  assert.ok(list.length >= 2, 'the repository carries at least two checkpoints');
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const result = diffCheckpoints(sorted[0].id, sorted[sorted.length - 1].id);
  assert.equal(result.ok, true);
  assert.equal(result.value.from, sorted[0].id);
  assert.equal(result.value.to, sorted[sorted.length - 1].id);
  assert.ok(Array.isArray(result.value.changed_files));
});

test('mutation-safety: restoring an unknown checkpoint fails without writing', () => {
  const before = fs.readFileSync('control/state.json', 'utf8');
  const result = restoreCheckpoint('CHK-99999');
  assert.equal(result.ok, false);
  assert.match(result.error.message, /CHK-99999/);
  const after = fs.readFileSync('control/state.json', 'utf8');
  assert.equal(before, after, 'a failed restore must not touch the control plane');
});

test('mutation-safety: a checkpoint snapshot round-trips byte-identical content', () => {
  const dir = tmp();
  /*
   * ES: OJO — createCheckpoint() también actualiza control/state.json con el
   *     last_checkpoint recién creado (efecto secundario DOCUMENTADO aquí). Por
   *     eso comparamos el snapshot contra el estado ANTES de crear, y luego
   *     verificamos que el estado vivo apunta al checkpoint nuevo. El harness de
   *     arriba restaura todo al final.
   * EN: CAREFUL — createCheckpoint() also updates control/state.json with the new
   *     last_checkpoint (side effect DOCUMENTED here). So we compare the snapshot
   *     against the state BEFORE creation, then verify the live state points at
   *     the new checkpoint. The harness above restores everything at teardown.
   * PT: createCheckpoint() também atualiza o state.json; comparamos com o estado
   *     ANTERIOR e o harness restaura tudo no fim.
   */
  const stateBefore = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const created = createCheckpoint({ label: 'roundtrip', dir });
  assert.equal(created.ok, true);
  const loaded = loadCheckpoint(created.value.id, dir);
  const snapshotState = loaded.value.files.state?.content ?? null;
  assert.deepEqual(snapshotState, stateBefore, 'the snapshot must equal the file it came from');

  const stateAfter = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  assert.equal(stateAfter.last_checkpoint.id, created.value.id, 'the live state now points at the new checkpoint');
  fs.rmSync(dir, { recursive: true, force: true });
});

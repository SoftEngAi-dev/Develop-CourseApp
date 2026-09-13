/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/run-full-pipeline.js — `npm run pipeline`
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪 ES — QUÉ HACE: la cadena completa, en el orden correcto y sin preguntas:
 *       1. init        → asegura directorios, manifiesto, estado, primer checkpoint
 *       2. demo        → ingiere y procesa la sesión fundacional
 *       3. process     → reprocesa TODO el plano de control + sesiones (idempotente)
 *       4. checkpoint  → fotografía el estado alcanzado
 *       5. snapshot    → congela la API en apps/console/snapshot.json (modo offline)
 *     Cada paso depende del anterior; si uno falla, la cadena se detiene y el
 *     código de salida lo dice. Es el comando que hay que ejecutar después de
 *     clonar el repositorio para tener el sistema entero despierto.
 *     USO: npm run pipeline
 *
 * 🇬 EN — WHAT IT DOES: the full chain, in the right order, no questions asked:
 *       1. init        → ensures directories, manifest, state, first checkpoint
 *       2. demo        → ingests and processes the founding session
 *       3. process     → reprocesses ALL control plane + sessions (idempotent)
 *       4. checkpoint  → photographs the reached state
 *       5. snapshot    → freezes the API into apps/console/snapshot.json (offline mode)
 *     Each step depends on the previous one; if one fails the chain stops and the
 *     exit code says so. It is the command to run after cloning the repository to
 *     have the whole system awake.
 *     USAGE: npm run pipeline
 *
 * 🇧 PT — O QUE FAZ: a cadeia completa, na ordem certa: init → demo → process →
 *     checkpoint → snapshot. Se um passo falha, a cadeia para e o código de saída
 *     avisa. É o comando para rodar após clonar o repositório. USO: npm run pipeline.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Orquestar pasos ES/EN/PT: una función `step(nombre, fn)` que imprime,
 *     ejecuta y comprueba el Result mantiene el flujo legible. Sin ella, este
 *     archivo sería un muro de ifs anidados. One tiny helper keeps the chain
 *     readable instead of a wall of nested ifs.
 *   • Por qué checkpoint DESPUÉS de process ES/EN/PT: el checkpoint fotografía el
 *     estado ALCANZADO, no el deseado. Hacerlo antes dejaría una foto mentirosa.
 *     Checkpoint the reached state, never the wished one.
 *   • Snapshot al final ES/EN/PT: el snapshot congela lo que la API devuelve HOY.
 *     Generarlo antes de procesar congelaría datos viejos en la app offline.
 *     Freeze last, so the offline app carries the freshest data.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { PATHS, toProjectRelative } from '../core/shared/paths.js';
import { createLogger } from '../core/logger/index.js';
import { EventBus } from '../core/event-bus/index.js';
import { ensureDirIfNeeded as ensureDir } from '../core/shared/internal.js';
import { ingestSession } from '../core/capture/index.js';
import { ingestAll } from '../knowledge/ingestion/index.js';
import { processSession, processAll } from '../knowledge/processor/index.js';
import { createCheckpoint, latestCheckpoint } from '../core/checkpoint/index.js';
import { generateAll as generateDocs } from '../documentation/engine/index.js';
import { closeDatabase } from '../knowledge/db/index.js';
import { loadState, loadTasks, summarize } from '../core/state/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const logger = createLogger({ scope: 'pipeline' });
const bus = new EventBus({ logger });

let failures = 0;

function step(name, fn) {
  process.stdout.write(`\n── ${name} ${'─'.repeat(Math.max(2, 46 - name.length))}\n`);
  try {
    const result = fn();
    if (result && result.ok === false) {
      logger.error(`${name}: ${result.error?.message ?? 'failed'}`);
      failures += 1;
      return false;
    }
    return true;
  } catch (error) {
    logger.error(`${name}: ${error.message}`);
    failures += 1;
    return false;
  }
}

/* 1) init: directorios + control plane mínimo. dirs + minimal control plane. */
step('init', () => {
  for (const dir of [PATHS.raw, PATHS.rawSessions, PATHS.rawMessages, PATHS.rawEvents, PATHS.processed, PATHS.indexes, PATHS.checkpoints]) {
    ensureDir(dir);
  }
  const state = loadState();
  if (!state.ok) throw new Error(state.error.message);
  /*
   * ES: el porcentaje NO vive en state.json: se CALCULA con `summarize()` a partir
   *     de los pesos del roadmap y del estado de las tareas. Leerlo del archivo
   *     daría 0 y mentiría. Progress is computed, never stored: read it from
   *     summarize(), not from the file.
   * PT: o percentual é calculado por summarize(), não guardado no arquivo.
   */
  const summary = summarize(state.value, loadTasks().value ?? { tasks: [] });
  process.stdout.write(`  control plane ok · progress ${summary.progress_percent ?? 0}% · phase ${summary.current_phase ?? '?'}\n`);
  if (!latestCheckpoint()) {
    const first = createCheckpoint({ label: 'genesis-init', bus });
    if (!first.ok) throw new Error(first.error.message);
    process.stdout.write(`  first checkpoint ${first.value.id} created\n`);
  }
  return { ok: true };
});

/* 2) demo: la sesión fundacional. the founding session. */
step('demo', () => {
  const sample = path.join(PATHS.samples, 'session-001-architecture.md');
  if (!fs.existsSync(sample)) return { ok: false, error: { message: `missing ${toProjectRelative(sample)}` } };
  const captured = ingestSession({ file: sample, title: 'Session 001 — Genesis architecture definition', bus });
  if (!captured.ok) return captured;
  const processed = processSession(captured.value.session.id, { bus, force: true });
  if (!processed.ok) return processed;
  process.stdout.write(`  ${captured.value.session.id} · ${processed.value.messages} messages · extracted ${JSON.stringify(processed.value.extracted ?? {})}\n`);
  return { ok: true };
});

/* 3) process: todo el plano de control + todas las sesiones. whole control plane. */
step('process', () => {
  const ingested = ingestAll({ bus });
  if (!ingested.ok) return ingested;
  const processed = processAll({ bus, force: true });
  if (!processed.ok) return processed;
  const value = processed.value;
  process.stdout.write(`  sessions ${value.sessions_processed ?? 0} (${value.sessions_failed ?? 0} failed) · decisions ${value.totals?.decisions ?? 0} · graph ${value.graph?.nodes ?? 0}/${value.graph?.edges ?? 0}\n`);
  return { ok: true };
});

/*
 * 4) docs: la documentación se genera SOLA, sin que nadie la pida (Fase 3).
 * EN: docs are generated AUTOMATICALLY, without being asked (Phase 3).
 * PT: a documentação é gerada SOZINHA, sem ninguém pedir (Fase 3).
 */
step('docs', () => {
  const docs = generateDocs({ bus });
  if (!docs.ok) return docs;
  process.stdout.write(`  ${docs.value.files.length} file(s) → documentation/generated · consistent: ${docs.value.verification.consistent}\n`);
  return { ok: true };
});

/* 5) checkpoint: fotografía lo alcanzado. photograph what was reached. */
step('checkpoint', () => {
  const checkpoint = createCheckpoint({ label: 'full-pipeline', bus });
  if (!checkpoint.ok) return checkpoint;
  process.stdout.write(`  ${checkpoint.value.id} · progress ${checkpoint.value.summary?.progress_percent ?? '?'}%\n`);
  return { ok: true };
});

/* 6) snapshot: congela la API para el modo offline. freeze the API for offline mode. */
step('snapshot', () => {
  const output = execFileSync(process.execPath, [path.join(PATHS.scripts, 'export-console-snapshot.js')], { encoding: 'utf8' });
  process.stdout.write(output.trim().split('\n').map((line) => `  ${line.trim()}`).join('\n'));
  process.stdout.write('\n');
  return { ok: true };
});

const counts = bus.counts();
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
process.stdout.write(`\n${failures === 0 ? '✓' : '✗'} pipeline finished with ${failures} failure(s) · ${total} observable event(s) emitted\n`);
process.stdout.write('  next: npm run serve   (then open the console and install it as an app)\n\n');

closeDatabase();
process.exitCode = failures === 0 ? 0 : 1;

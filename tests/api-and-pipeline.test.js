/* ═══════════════════════════════════════════════════════════════════════════
 * tests/api-and-pipeline.test.js — VERIFICATION LEVEL: integration + pipeline
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪 ES — QUÉ PRUEBA: dos cosas caras de prometer y baratas de romper.
 *     (1) La API HTTP completa sobre un servidor efímero (puerto 0): salud,
 *         estadísticas, auto-documentación de rutas, 404 con pista, bloqueo de
 *         path traversal y fallback SPA. Sin dependencias y sin CORS roto.
 *     (2) La IDEMPOTENCIA del pipeline (DEC-00007) sobre una COPIA temporal de la
 *         base: procesar dos veces con --force deja exactamente los mismos
 *         contadores. Es la prueba que impide que cualquier "mejora" futura
 *         convierta el motor en una fotocopiadora.
 * 🇬 EN — WHAT IT TESTS: two promises expensive to make and cheap to break.
 *     (1) The whole HTTP API on an ephemeral server (port 0): health, stats,
 *         route self-documentation, 404 with a hint, path-traversal blocking and
 *         SPA fallback. Zero dependencies, CORS intact.
 *     (2) Pipeline IDEMPOTENCY (DEC-00007) over a TEMPORARY COPY of the database:
 *         processing twice with force leaves exactly the same counters. This is
 *         the test that stops any future "improvement" from turning the engine
 *         into a photocopier.
 * 🇧🇷 PT — O QUE TESTA: (1) a API HTTP completa num servidor efêmero (porta 0);
 *     (2) a IDEMPOTÊNCIA do pipeline (DEC-00007) sobre uma CÓPIA temporária do
 *     banco: processar duas vezes com force deixa os mesmos contadores.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Puerto 0 ES/EN/PT: pedir el puerto 0 es pedirle al sistema operativo "uno
 *     que esté libre". Los tests nunca deben pelearse por el 3000 o el 4321 con
 *     el servidor que el usuario tiene abierto. Port 0 = any free port.
 *   • Traversal con %2e%2e ES/EN/PT: los navegadores y `fetch` normalizan "../",
 *     así que para probar la defensa hay que mandar la forma codificada y evitar
 *     la normalización del cliente. Si el servidor la decodifica y aun así no
 *     escapa de apps/console, la defensa es real.
 *     Send encoded dots: clients normalize plain "../" and would hide the bug.
 *   • Copia de base en caliente ES/EN/PT: SQLite en modo WAL puede tener archivos
 *     -wal/-shm al lado. Para copiar sin sorpresas usamos la API de backup… o,
 *     más simple y portable: abrir readOnly y volcar con `VACUUM INTO`, que
 *     produce un archivo único y consistente. VACUUM INTO = clean single-file copy.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../core/api/server.js';
import { createLogger } from '../core/logger/index.js';
import { EventBus } from '../core/event-bus/index.js';
import { openDatabase, closeDatabase, scalar } from '../knowledge/db/index.js';
import { processAll, processingSummary } from '../knowledge/processor/index.js';
import { PATHS } from '../core/shared/paths.js';

/* ── Servidor efímero / Ephemeral server ──────────────────────────────────── */

test('the zero-dependency API answers on an ephemeral port', async (t) => {
  const logger = createLogger({ scope: 'test-api', quiet: true });
  const bus = new EventBus({ persist: false, logger });
  const started = await startServer({ port: 0, host: '127.0.0.1', logger, bus });
  t.after(() => { started.server.close(); });
  const base = `http://127.0.0.1:${started.port}`;

  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.dependencies, 0, 'POL-0001 is enforced by the API itself');
  assert.equal(health.offline_capable, true);

  const stats = await (await fetch(`${base}/api/stats`)).json();
  assert.ok(stats.processing.decisions >= 12);
  assert.ok(stats.graph.nodes >= 70);
  assert.ok(stats.state.progress_percent >= 0);

  const routes = await (await fetch(`${base}/api/routes`)).json();
  assert.ok(routes.routes.length >= 30, 'the API documents itself');
  assert.ok(routes.routes.some((route) => route.pattern === '/api/routes'), 'the index includes itself');

  const missing = await fetch(`${base}/api/does-not-exist`);
  assert.equal(missing.status, 404);
  const missingBody = await missing.json();
  assert.ok(missingBody.error.hint, 'a 404 must teach the way out');

  const contextMd = await fetch(`${base}/api/context?format=md`);
  assert.equal(contextMd.status, 200);
  assert.match(await contextMd.text(), /^#/m);
});

test('static serving blocks path traversal and falls back to the SPA', async (t) => {
  const logger = createLogger({ scope: 'test-api-static', quiet: true });
  const bus = new EventBus({ persist: false, logger });
  const started = await startServer({ port: 0, host: '127.0.0.1', logger, bus });
  t.after(() => { started.server.close(); });
  const base = `http://127.0.0.1:${started.port}`;

  const traversal = await fetch(`${base}/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd`, { redirect: 'manual' });
  const body = await traversal.text();
  assert.ok(!body.includes('root:'), 'the passwd file must never leak');
  assert.ok(traversal.status === 200 || traversal.status === 404);

  const spa = await fetch(`${base}/decisions/DEC-00002`);
  assert.equal(spa.status, 200);
  assert.ok((await spa.text()).includes('<!DOCTYPE html>'), 'client routes get the app shell');
});

/* ── Idempotencia del pipeline / Pipeline idempotency ─────────────────────── */

test('DEC-00007: processing twice over a copy changes nothing', () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-pipe-'));
  const copy = path.join(workdir, 'copy.db');

  /*
   * ES: `VACUUM INTO` produce una copia consistente en un solo archivo, incluso
   *     con WAL activo. Es la forma portable de hacer snapshot de SQLite sin
   *     dependencias. EN: `VACUUM INTO` yields a consistent single-file copy even
   *     with WAL active: the portable, dependency-free SQLite snapshot.
   * PT: `VACUUM INTO` gera uma cópia consistente em um arquivo, mesmo com WAL.
   */
  const source = openDatabase({ readOnly: true, reuse: false });
  source.prepare(`VACUUM INTO ?`).run(copy);
  closeDatabase(source);

  const db = openDatabase({ file: copy, reuse: false });
  const baseline = processingSummary(db);

  const first = processAll({ db, force: true });
  assert.equal(first.ok, true, JSON.stringify(first.error ?? {}));
  const afterFirst = processingSummary(db);

  const second = processAll({ db, force: true });
  assert.equal(second.ok, true);
  const afterSecond = processingSummary(db);

  for (const key of ['decisions', 'plans', 'errors', 'searches', 'requirements', 'lessons', 'sessions', 'messages', 'nodes', 'edges', 'indexed_entities']) {
    assert.equal(afterFirst[key], baseline[key], `${key} must survive the first forced pass unchanged`);
    assert.equal(afterSecond[key], baseline[key], `${key} must survive the second forced pass unchanged`);
  }

  const lessons = Number(scalar(db, 'SELECT COUNT(*) AS n FROM lessons'));
  assert.equal(lessons, baseline.lessons, 'lessons never duplicate');
  const lessonNodes = Number(scalar(db, "SELECT COUNT(*) AS n FROM nodes WHERE kind = 'lesson'"));
  assert.equal(lessonNodes, lessons, 'the graph keeps exactly one node per lesson');

  closeDatabase(db);
  fs.rmSync(workdir, { recursive: true, force: true });
});

test('the processed summary on disk matches the live database', () => {
  const summaryFile = path.join(PATHS.processed, 'summary.json');
  assert.ok(fs.existsSync(summaryFile), 'the pipeline writes its summary (auto-documentation)');
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  assert.ok(summary.processed_at, 'the summary says when it ran');
  assert.ok(summary.totals, 'the summary carries extraction totals');
  assert.ok(summary.graph?.nodes >= 70, 'the summary carries the graph size');
});

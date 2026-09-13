/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/seed-demo-session.js — `npm run demo`
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: ingiere la conversación fundacional real
 *     (data/samples/session-001-architecture.md) y la procesa: de un texto plano
 *     salen Decision Traces, planes, errores, búsquedas, requisitos, lecciones,
 *     grafo de conocimiento e índice FTS5. Es el "hola mundo" del sistema: con un
 *     solo comando se ve todo el pipeline funcionando sobre datos reales.
 *     IDEMPOTENTE: ejecutarlo dos veces NO duplica nada (el RAW se guarda por
 *     hash y las entidades derivadas se deduplican por huella).
 *     USO: npm run demo   ·   node scripts/seed-demo-session.js [--duplicate]
 *
 * 🇬 EN — WHAT IT DOES: ingests the real founding conversation
 *     (data/samples/session-001-architecture.md) and processes it: from plain text
 *     come Decision Traces, plans, errors, searches, requirements, lessons, the
 *     knowledge graph and the FTS5 index. It is the system's "hello world": one
 *     command shows the whole pipeline running on real data.
 *     IDEMPOTENT: running it twice duplicates NOTHING (RAW is stored by hash and
 *     derived entities dedupe by fingerprint).
 *     USAGE: npm run demo · node scripts/seed-demo-session.js [--duplicate]
 *
 * 🇧🇷 PT — O QUE FAZ: ingere a conversa fundacional real e a processa: de um texto
 *     puro saem Trilhas de Decisão, planos, erros, buscas, requisitos, lições,
 *     grafo e índice FTS5. É o "hello world" do sistema. IDEMPOTENTE: rodar duas
 *     vezes não duplica nada. USO: npm run demo.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Un script no es un juguete ES/EN/PT: este archivo es la MISMA lógica que el
 *     comando `genesis demo` de la CLI. Dos puertas, un solo motor. Cuando algo
 *     tenga varios puntos de entrada (CLI, npm, API), todos deben delegar en las
 *     mismas funciones: si no, cada puerta se rompe por su lado.
 *     Several entry points must delegate to the same functions.
 *   • Result y el código de salida ES/EN/PT: `process.exitCode = 1` si algo falla.
 *     Es lo que permite encadenar scripts con `&&` y que la cadena se detenga en
 *     el primer fallo. Exit codes are how scripts talk to each other.
 *   • `--duplicate` ES/EN/PT: la única forma de capturar dos veces la misma
 *     sesión a propósito. Por defecto el sistema detecta el hash idéntico y no
 *     toca el RAW. The only deliberate way to capture the same session twice.
 * ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { PATHS, toProjectRelative } from '../core/shared/paths.js';
import { createLogger } from '../core/logger/index.js';
import { EventBus } from '../core/event-bus/index.js';
import { ingestSession } from '../core/capture/index.js';
import { processSession } from '../knowledge/processor/index.js';
import { closeDatabase } from '../knowledge/db/index.js';
import fs from 'node:fs';

const logger = createLogger({ scope: 'demo' });
const bus = new EventBus({ logger });
const duplicate = process.argv.includes('--duplicate');

const sample = path.join(PATHS.samples, 'session-001-architecture.md');

if (!fs.existsSync(sample)) {
  logger.error(`Sample not found: ${toProjectRelative(sample)}`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\n  ingesting ${toProjectRelative(sample)}\n`);

  /*
   * ES: ⚠️ la captura es idempotente por hash: sin --duplicate, re-ingiere y el
   *     sistema responde "duplicated: true" sin tocar el RAW.
   * EN: capture is idempotent by hash: without --duplicate a re-ingest answers
   *     "duplicated: true" and leaves RAW untouched.
   * PT: a captura é idempotente por hash.
   */
  const captured = ingestSession({ file: sample, title: 'Session 001 — Genesis architecture definition', bus, force: duplicate });
  if (!captured.ok) {
    logger.error(captured.error.message);
    process.exitCode = 1;
  } else {
    const processed = processSession(captured.value.session.id, { bus, force: true });
    if (!processed.ok) {
      logger.error(processed.error.message);
      process.exitCode = 1;
    } else {
      const extracted = processed.value.extracted ?? {};
      process.stdout.write(`\n  ✓ ${captured.value.session.id} · ${captured.value.duplicated ? 'already captured (idempotent)' : 'captured'} · ${processed.value.messages} messages\n`);
      process.stdout.write(`  extracted: ${JSON.stringify(extracted)}\n`);
      process.stdout.write(`\n  next: npm run status · npm run serve · node scripts/export-console-snapshot.js\n\n`);
    }
  }
}

const counts = bus.counts();
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
if (total) process.stdout.write(`  ${total} observable event(s) emitted → ${toProjectRelative(PATHS.rawEvents)}\n\n`);

closeDatabase();

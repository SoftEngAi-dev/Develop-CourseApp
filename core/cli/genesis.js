#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * core/cli/genesis.js  —  punto de entrada humano del sistema
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: la interfaz de línea de comandos `genesis`. Convierte todo
 *     el motor en ~15 verbos memorizables:
 *       genesis init       prepara el proyecto (carpetas, base, checkpoint)
 *       genesis resume     reconstruye el contexto y te dice por dónde seguir
 *       genesis status     dashboard en la terminal
 *       genesis doctor     diagnóstico de salud del sistema
 *       genesis capture    ingiere una conversación al nivel RAW
 *       genesis process    ejecuta el pipeline de conocimiento completo
 *       genesis search     busca en todo el conocimiento (FTS5)
 *       genesis context    imprime el SESSION CONTEXT (texto o Markdown)
 *       genesis timeline   historia cronológica de eventos
 *       genesis decisions  lista o muestra un Decision Trace
 *       genesis graph      estadísticas y vecinos del grafo
 *       genesis checkpoint / rollback  fotos y restauración del control
 *       genesis serve      arranca la API + el console offline
 *     POR QUÉ EXISTE (sección 19): el auto-init. `genesis init` y
 *     `genesis resume` son los dos comandos que hacen posible que una sesión
 *     nueva empiece en 2 segundos en vez de 20 minutos de lectura.
 *
 * 🇬🇧 EN — WHAT IT DOES: the `genesis` command line interface. It turns the whole
 *     engine into ~15 memorable verbs (init, resume, status, doctor, capture,
 *     process, search, context, timeline, decisions, graph, checkpoint, rollback,
 *     serve).
 *     WHY IT EXISTS (section 19): auto-init. `genesis init` and `genesis resume`
 *     are the two commands that let a new session start in 2 seconds instead of
 *     20 minutes of reading.
 *
 * 🇧🇷 PT — O QUE FAZ: a interface de linha de comando `genesis`. Converte todo o
 *     motor em ~15 verbos memorizáveis (init, resume, status, doctor, capture,
 *     process, search, context, timeline, decisions, graph, checkpoint,
 *     rollback, serve).
 *     POR QUE EXISTE (seção 19): o auto-init. `genesis init` e `genesis resume`
 *     são os dois comandos que permitem que uma nova sessão comece em 2 segundos
 *     em vez de 20 minutos de leitura.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Shebang `#!/usr/bin/env node` ES/EN/PT: primera línea que le dice al
 *     sistema operativo con qué intérprete ejecutar el archivo cuando lo llamas
 *     directamente (`./genesis.js`). `env` busca node en el PATH, que es más
 *     portable que escribir `/usr/bin/node`.
 *     The shebang tells the OS which interpreter runs this file directly.
 *   • `process.argv` ES/EN/PT: array de argumentos. `argv[0]` = ruta de node,
 *     `argv[1]` = ruta del script, `argv[2]` en adelante = lo que escribió el
 *     usuario. Por eso hacemos `argv.slice(2)`.
 *     argv[0] is node, argv[1] the script, argv[2]+ what the user typed.
 *   • Código de salida ES/EN/PT: `process.exitCode = 1` marca la ejecución como
 *     fallida sin cortar la salida pendiente (a diferencia de `process.exit(1)`,
 *     que puede truncar logs). Los scripts CI leen ese código.
 *     Set process.exitCode instead of process.exit() to avoid truncating output.
 *   • Tabla de comandos ES/EN/PT: en vez de un `if/else` gigante, guardamos los
 *     comandos en un objeto {nombre: función}. Añadir un comando nuevo es añadir
 *     una entrada. Es el patrón "command map" y evita funciones de 400 líneas.
 *     A command map object beats a giant if/else chain.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PATHS, WRITABLE_DIRS, ROOT, toProjectRelative } from '../shared/paths.js';
import { ensureDir, readJson, writeJson } from '../shared/json.js';
import { createLogger, projectLogger, COLORS } from '../logger/index.js';
import { EventBus } from '../event-bus/index.js';
import { loadManifest, describeManifest } from '../manifest/index.js';
import { loadState, loadTasks, loadRoadmap, reconcile, summarize, saveState, createInitialState, transitionTask } from '../state/index.js';
import { describeStateMachine } from '../state/task-states.js';
import { createCheckpoint, listCheckpoints, latestCheckpoint, restoreCheckpoint, diffCheckpoints } from '../checkpoint/index.js';
import { ingestSession, listSessions, captureStats } from '../capture/index.js';
import { openDatabase, closeDatabase, dbStats, destroyDatabase, all, fromJson } from '../../knowledge/db/index.js';
import { processAll, processSession, reprocess, processingSummary, recentEntities } from '../../knowledge/processor/index.js';
import { search, timeline, whyDidWeChoose, facets } from '../../knowledge/retrieval/search.js';
import { buildSessionContext, renderSessionContext, renderContextMarkdown } from '../../knowledge/retrieval/context.js';
import { exportGraph, graphStats, nodeProfile, neighbors } from '../../knowledge/graph/index.js';
import { renderDecisionTrace, loadDecision } from '../../knowledge/processor/decisions.js';
import { startServer } from '../api/server.js';

/* ── Utilidades de consola / Console helpers ─────────────────────────────── */

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [key, inlineValue] = token.slice(2).split('=');
      if (inlineValue !== undefined) flags[key] = inlineValue;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { flags[key] = argv[i + 1]; i += 1; }
      else flags[key] = true;
    } else if (token.startsWith('-') && token.length === 2) {
      flags[token.slice(1)] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

const c = COLORS;

// ES: `node:sqlite` es un módulo nativo de Node 22. Lo cargamos con createRequire
//     para poder usarlo dentro de una comprobación síncrona (doctor).
// EN: `node:sqlite` is a native Node 22 module. We load it with createRequire so
//     it can be used inside a synchronous check (doctor).
// PT: `node:sqlite` é um módulo nativo do Node 22. Nós o carregamos com
//     createRequire para poder usá-lo dentro de uma verificação síncrona (doctor).
const require$node_sqlite = () => createRequire(import.meta.url)('node:sqlite');
const paint = (color, text) => (process.stdout.isTTY ? `${color}${text}${c.reset}` : String(text));
const heading = (text) => `\n${paint(c.bold + c.cyan, text.toUpperCase())}\n${paint(c.gray, '─'.repeat(Math.min(72, text.length + 8)))}`;
const row = (label, value) => `  ${paint(c.gray, label.padEnd(24, ' '))} ${value}`;
const bullet = (text) => `  ${paint(c.cyan, '•')} ${text}`;

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function asJson(flags, value) {
  if (flags.json) { printJson(value); return true; }
  return false;
}

/* ── Comandos / Commands ─────────────────────────────────────────────────── */

const COMMANDS = {};

COMMANDS.help = {
  description: 'Show this help',
  usage: 'genesis help [command]',
  run({ positional }) {
    const wanted = positional[0];
    if (wanted && COMMANDS[wanted]) {
      const command = COMMANDS[wanted];
      process.stdout.write(`\n${paint(c.bold, `genesis ${wanted}`)} — ${command.description}\n\n  Usage: ${command.usage}\n\n${command.long ? `${command.long}\n\n` : ''}`);
      return 0;
    }
    const lines = [
      '',
      paint(c.bold + c.magenta, '  GENESIS — Project Knowledge & Autonomous Engine'),
      paint(c.gray, '  "Nothing happens without leaving an observable project event."'),
      '',
      paint(c.bold, '  BOOTSTRAP'),
      '    genesis init                 Prepare folders, database, control plane + checkpoint',
      '    genesis resume               Rebuild the SESSION CONTEXT and show what to do next',
      '    genesis doctor               Health check: node, sqlite, dirs, manifest, db, tests',
      '    genesis status               Terminal dashboard: progress, task, blocks, counters',
      '',
      paint(c.bold, '  CAPTURE & PROCESS'),
      '    genesis capture <file>       Ingest a conversation into RAW (then run process)',
      '    genesis process              Run the full knowledge pipeline (RAW → entities → graph)',
      '    genesis reprocess            Delete derived data and rebuild everything from RAW',
      '',
      paint(c.bold, '  KNOWLEDGE'),
      '    genesis search <query>       Full-text search across every entity',
      '    genesis context              Print the SESSION CONTEXT (text | --md | --json)',
      '    genesis timeline             Chronological event history',
      '    genesis decisions [id]       List Decision Traces or render one',
      '    genesis graph [node]         Graph statistics, or the neighbourhood of a node',
      '    genesis tasks                Tasks and their state machine position',
      '    genesis events               Recent observable events',
      '',
      paint(c.bold, '  RECOVERY'),
      '    genesis checkpoint [label]   Snapshot the control plane',
      '    genesis checkpoints          List snapshots',
      '    genesis rollback <id>        Restore a snapshot',
      '    genesis diff <a> <b>         Compare two snapshots',
      '',
      paint(c.bold, '  APPLICATION'),
      '    genesis serve                Start the zero-dependency API + offline console',
      '    genesis routes               List every HTTP route of the API',
      '',
      paint(c.gray, '  Global flags:  --json  --limit N  --quiet  --force'),
      '',
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  },
};

COMMANDS.init = {
  description: 'Bootstrap the project: folders, database, control plane, first checkpoint',
  usage: 'genesis init [--quiet] [--json] [--no-checkpoint]',
  long: 'Steps (section 19): detect project → detect environment → validate dependencies →\n  load manifest → load state → load memory → load relevant knowledge → detect pending\n  tasks → detect blocks → build context → leave the system ready to run.',
  async run({ flags, bus, logger }) {
    const started = Date.now();
    const report = { steps: [], ok: true };
    const step = (name, detail, okFlag = true) => {
      report.steps.push({ step: name, detail, ok: okFlag });
      if (!flags.quiet) process.stdout.write(`  ${okFlag ? paint(c.green, '✓') : paint(c.red, '✗')} ${name.padEnd(28, ' ')} ${paint(c.gray, detail)}\n`);
      if (!okFlag) report.ok = false;
    };

    if (!flags.quiet) process.stdout.write(heading('genesis init — bootstrap'));

    // ES: 1) entorno. EN: 1) environment. PT: 1) ambiente.
    const major = Number(process.versions.node.split('.')[0]);
    step('detect environment', `node ${process.versions.node} · ${process.platform} · ${process.arch}`, major >= 22);
    if (major < 22) {
      logger.error('Node 22.5+ is required for the built-in node:sqlite module.');
      return 1;
    }

    // ES: 2) dependencias: cero a propósito. EN: 2) dependencies: zero on purpose.
    const dependencyCount = Object.keys(readJson(path.join(ROOT, 'package.json'), {})?.dependencies ?? {}).length;
    step('validate dependencies', `${dependencyCount} npm dependencies (policy POL-0005 requires 0 in core)`, dependencyCount === 0);

    // ES: 3) estructura física de los cinco niveles. EN: 3) physical structure. PT: 3) estrutura física.
    let created = 0;
    for (const dir of [...WRITABLE_DIRS, PATHS.documentation, PATHS.processed]) {
      if (!fs.existsSync(dir)) { ensureDir(dir); created += 1; }
    }
    step('ensure five-level structure', `${created} directories created, ${WRITABLE_DIRS.length + 2 - created} already present`);

    // ES: 4) manifest válido. EN: 4) valid manifest. PT: 4) manifest válido.
    const manifest = loadManifest();
    if (!manifest.ok) {
      step('load manifest', manifest.error.message, false);
      return 1;
    }
    const described = describeManifest(manifest.value);
    step('load manifest', `${described.project} v${described.version} · ${described.levels.length} levels · ${described.layers} layers · ${described.requirements_completed}/${described.requirements_total} requirements done`);

    // ES: 5) estado: crear si falta, reconciliar si existe.
    // EN: 5) state: create when missing, reconcile when present.
    // PT: 5) estado: criar se faltar, reconciliar se existir.
    if (!fs.existsSync(PATHS.state)) {
      writeJson(PATHS.state, createInitialState());
      step('load state', 'created control/state.json from scratch');
    }
    const reconciled = reconcile({ bus });
    if (!reconciled.ok) {
      step('reconcile state', reconciled.error.message, false);
      return 1;
    }
    step('reconcile state', `progress ${reconciled.value.progress.percent}% · phase ${reconciled.value.current_phase?.id ?? '—'} · task ${reconciled.value.current_task?.id ?? '—'}`);

    // ES: 6) memoria / base de conocimiento. EN: 6) memory / knowledge DB. PT: 6) memória.
    const db = openDatabase();
    const stats = dbStats(db);
    step('load memory', `${toProjectRelative(PATHS.database)} · schema v${stats.schema_version} · ${stats.tables} tables · ${stats.indexed_entities} indexed entities`);

    // ES: 7) conocimiento relevante del plano de control dentro de la base.
    // EN: 7) relevant control-plane knowledge ingested into the DB.
    // PT: 7) conhecimento relevante do plano de controle ingerido no banco.
    const { ingestControlPlane } = await import('../../knowledge/ingestion/index.js');
    const control = ingestControlPlane({ db, bus });
    step('load relevant knowledge', control.ok ? `${control.value.requirements} requirements · ${control.value.tasks} tasks · ${control.value.decisions} decisions · ${control.value.policies} policies` : control.error.message, control.ok);

    // ES: 8) tareas pendientes. EN: 8) pending tasks. PT: 8) tarefas pendentes.
    const tasks = loadTasks().value?.tasks ?? [];
    const pending = tasks.filter((t) => !['completed', 'skipped'].includes(t.status));
    step('detect pending tasks', `${pending.length} pending of ${tasks.length} total`);

    // ES: 9) bloqueos. EN: 9) blocks. PT: 9) bloqueios.
    const state = loadState().value ?? {};
    const openBlocks = (state.blocks ?? []).filter((b) => b.status !== 'resolved');
    step('detect blocks', openBlocks.length ? openBlocks.map((b) => `${b.id ?? '?'} <${b.type}>`).join(', ') : 'none', true);

    // ES: 10) contexto. EN: 10) context. PT: 10) contexto.
    const context = buildSessionContext({ db, bus });
    step('build context', context.ok ? `${context.value.relevant_decisions.length} decisions · ${context.value.failed_attempts.length} failed attempts · ${context.value.required_files.length} files in scope` : context.error.message, context.ok);

    // ES: 11) checkpoint inicial (solo si hay algo que fotografiar).
    // EN: 11) initial checkpoint (only if there is something to photograph).
    // PT: 11) checkpoint inicial (somente se houver algo para fotografar).
    if (flags.checkpoint !== false && !flags['no-checkpoint']) {
      const checkpoint = createCheckpoint({ label: 'genesis-init', bus, phase: state.current_phase ?? null, task: state.current_task ?? null });
      step('create checkpoint', checkpoint.ok ? `${checkpoint.value.id} → ${toProjectRelative(checkpoint.value.file)}` : checkpoint.error.message, checkpoint.ok);
    }

    bus.emit('SESSION_STARTED', { kind: 'init', duration_ms: Date.now() - started }, { layer: 'infrastructure' });

    if (asJson(flags, report)) return report.ok ? 0 : 1;

    const next = context.ok ? context.value.next_recommended_action : null;
    process.stdout.write(`\n  ${paint(c.green, 'READY')} in ${Date.now() - started}ms\n`);
    if (next) {
      const text = typeof next === 'object' ? next.en ?? next.es ?? next.pt : next;
      process.stdout.write(`  ${paint(c.yellow, 'NEXT')} ${text}\n`);
    }
    process.stdout.write(`\n  ${paint(c.gray, 'Try:')} genesis resume ${paint(c.gray, '·')} genesis status ${paint(c.gray, '·')} genesis serve\n\n`);
    return report.ok ? 0 : 1;
  },
};

COMMANDS.resume = {
  description: 'Rebuild the SESSION CONTEXT: continue exactly where the project stopped',
  usage: 'genesis resume [--query TEXT] [--md] [--json] [--compact]',
  long: 'This is the command that makes a new session cheap. It answers:\n  where are we · what was the last task · which decisions matter · what failed before\n  · which constraints are hard · which files are involved · what to do next.',
  async run({ flags, positional, bus, logger }) {
    const db = openDatabase();
    reconcile({ bus });
    const query = flags.query ?? flags.q ?? (typeof positional[0] === 'string' ? positional[0] : null) ?? null;
    const result = buildSessionContext({ db, bus, query, taskId: flags.task ?? null });
    if (!result.ok) {
      logger.error(result.error.message);
      return 1;
    }

    bus.emit('SESSION_STARTED', { kind: 'resume', query }, { layer: 'core-engine' });

    if (flags.json) { printJson(result.value); return 0; }
    if (flags.md) { process.stdout.write(`${renderContextMarkdown(result.value)}\n`); return 0; }

    process.stdout.write(`${renderSessionContext(result.value, { compact: Boolean(flags.compact) })}\n`);

    if (!flags.quiet) {
      process.stdout.write(`\n  ${paint(c.gray, 'Tip:')} genesis resume --md ${paint(c.gray, 'produces a block you can paste into any AI chat to continue.')}\n\n`);
    }
    return 0;
  },
};

COMMANDS.status = {
  description: 'Terminal dashboard',
  usage: 'genesis status [--json]',
  async run({ flags, bus }) {
    const db = openDatabase();
    reconcile({ bus });
    const state = loadState().value ?? {};
    const tasks = loadTasks().value ?? { tasks: [] };
    const roadmap = loadRoadmap().value ?? { phases: [] };
    const summary = summarize(state, tasks);
    const stats = dbStats(db);
    const processing = processingSummary(db);
    const checkpoint = latestCheckpoint();

    if (asJson(flags, { summary, stats, processing, checkpoint, roadmap })) return 0;

    const bar = (percent) => {
      const filled = Math.round(Math.min(100, Math.max(0, percent)) / 5);
      return `${paint(c.green, '█'.repeat(filled))}${paint(c.gray, '░'.repeat(20 - filled))} ${percent}%`;
    };

    const lines = [
      heading('genesis — project status'),
      '',
      row('Project', paint(c.bold, 'Genesis Autonomous Engineering')),
      row('Rule', paint(c.gray, '"Nothing happens without leaving an observable project event."')),
      row('Progress', bar(summary.progress_percent ?? 0)),
      row('Current phase', summary.current_phase ?? '—'),
      row('Current task', summary.current_task ? `${summary.current_task.id} · ${summary.current_task.title} [${summary.current_task.status} ${summary.current_task.progress}%]` : '—'),
      row('Agent', summary.agent_status ?? 'idle'),
      row('Last checkpoint', checkpoint ? `${checkpoint.id} · ${checkpoint.label}` : 'none'),
      row('Open blocks', summary.open_blocks?.length ? paint(c.yellow, `${summary.open_blocks.length}`) : paint(c.green, '0')),
      '',
      heading('knowledge base'),
      row('Database', `${stats.file} · ${(stats.bytes / 1024).toFixed(1)} KB · schema v${stats.schema_version}`),
      row('Sessions / messages', `${processing.sessions} / ${processing.messages}`),
      row('Decisions', `${processing.decisions}`),
      row('Requirements', `${processing.requirements} (${processing.requirement_changes} changes tracked)`),
      row('Plans / actions', `${processing.plans} / ${processing.actions}`),
      row('Searches / errors', `${processing.searches} / ${processing.errors}`),
      row('Lessons / builds', `${processing.lessons} / ${processing.builds}`),
      row('Graph nodes / edges', `${processing.nodes} / ${processing.edges}`),
      row('Indexed entities', `${stats.indexed_entities} (+${stats.indexed_messages} messages)`),
      row('Events (RAW sink)', `${processing.events}`),
      '',
      heading('roadmap'),
      ...(roadmap.phases ?? []).map((phase) => {
        const icon = phase.status === 'completed' ? paint(c.green, '✓') : phase.status === 'stub' ? paint(c.gray, '○') : paint(c.yellow, '◐');
        return `  ${icon} ${String(phase.id).padEnd(9, ' ')} ${String(phase.name).padEnd(24, ' ')} ${paint(c.gray, `[${phase.status}, weight ${phase.weight}]`)}`;
      }),
      '',
      heading('tasks needing attention'),
      ...(tasks.tasks ?? []).filter((t) => ['blocked', 'failed', 'running', 'planned', 'ready'].includes(t.status)).slice(0, 8)
        .map((t) => `  ${paint(t.status === 'blocked' || t.status === 'failed' ? c.red : c.cyan, t.status.padEnd(9, ' '))} ${t.id} · ${t.title}`),
      '',
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  },
};

COMMANDS.doctor = {
  description: 'Health check of the whole system',
  usage: 'genesis doctor [--json]',
  async run({ flags, bus }) {
    const checks = [];
    const check = (name, fn) => {
      try {
        const detail = fn();
        checks.push({ name, ok: true, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
      } catch (error) {
        checks.push({ name, ok: false, detail: error.message });
      }
    };

    check('node version >= 22.5', () => {
      const [major, minor] = process.versions.node.split('.').map(Number);
      if (major < 22 || (major === 22 && minor < 5)) throw new Error(`node ${process.versions.node} is too old for node:sqlite`);
      return process.versions.node;
    });
    check('node:sqlite built-in available', () => {
      // ES: importamos de forma síncrona el módulo nativo y lo ejercitamos de verdad.
      // EN: we synchronously import the native module and actually exercise it.
      // PT: importamos de forma síncrona o módulo nativo e o exercitamos de verdade.
      const { DatabaseSync } = require$node_sqlite();
      const probe = new DatabaseSync(':memory:');
      probe.exec('CREATE VIRTUAL TABLE probe USING fts5(body)');
      probe.prepare('INSERT INTO probe VALUES (?)').run('genesis fts5 probe');
      const hit = probe.prepare("SELECT COUNT(*) AS n FROM probe WHERE probe MATCH 'fts5'").get();
      const version = probe.prepare('SELECT sqlite_version() AS v').get().v;
      probe.close();
      if (Number(hit?.n ?? 0) !== 1) throw new Error('FTS5 MATCH returned no rows');
      return `sqlite ${version}, FTS5 verified`;
    });
    check('zero npm dependencies', () => {
      const deps = Object.keys(readJson(path.join(ROOT, 'package.json'), {})?.dependencies ?? {});
      if (deps.length) throw new Error(`core has dependencies: ${deps.join(', ')}`);
      return '0 dependencies (POL-0005 satisfied)';
    });
    check('manifest exists and validates', () => {
      const result = loadManifest();
      if (!result.ok) throw new Error(result.error.message);
      return `${result.value.project.name} v${result.value.project.version}`;
    });
    check('control plane complete', () => {
      const required = [PATHS.manifest, PATHS.state, PATHS.tasks, PATHS.roadmap, PATHS.policies, PATHS.decisions];
      const missing = required.filter((file) => !fs.existsSync(file)).map(toProjectRelative);
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
      return `${required.length} control files present`;
    });
    check('five-level directories', () => {
      const missing = WRITABLE_DIRS.filter((dir) => !fs.existsSync(dir)).map(toProjectRelative);
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
      return `${WRITABLE_DIRS.length} directories present`;
    });
    check('database opens and migrates', () => {
      const db = openDatabase();
      const stats = dbStats(db);
      return `schema v${stats.schema_version}, ${stats.tables} tables`;
    });
    check('FTS5 full-text search works', () => {
      const db = openDatabase();
      const row = db.prepare("SELECT COUNT(*) AS n FROM fts_index").get();
      return `${row?.n ?? 0} entities indexed`;
    });
    check('state reconciles', () => {
      const result = reconcile({ bus });
      if (!result.ok) throw new Error(result.error.message);
      return `progress ${result.value.progress.percent}%`;
    });
    check('checkpoints readable', () => `${listCheckpoints().length} checkpoints on disk`);
    check('event sink writable', () => {
      ensureDir(PATHS.rawEvents);
      return toProjectRelative(PATHS.rawEvents);
    });

    if (asJson(flags, { ok: checks.every((item) => item.ok), checks })) return checks.every((item) => item.ok) ? 0 : 1;

    process.stdout.write(heading('genesis doctor'));
    for (const item of checks) {
      process.stdout.write(`  ${item.ok ? paint(c.green, '✓') : paint(c.red, '✗')} ${item.name.padEnd(38, ' ')} ${paint(c.gray, item.detail)}\n`);
    }
    const failed = checks.filter((item) => !item.ok);
    process.stdout.write(`\n  ${failed.length ? paint(c.red, `${failed.length} problem(s) found`) : paint(c.green, 'all checks passed')}\n\n`);
    return failed.length ? 1 : 0;
  },
};

COMMANDS.capture = {
  description: 'Ingest a conversation transcript into the RAW level',
  usage: 'genesis capture <file|--text "..."> [--title T] [--process] [--duplicate]',
  async run({ flags, positional, bus, logger }) {
    const file = positional[0] && fs.existsSync(path.resolve(positional[0])) ? path.resolve(positional[0]) : null;
    const text = flags.text ?? (file ? null : positional[0]);
    if (!file && !text) {
      logger.error('Provide a transcript file or --text "..."');
      return 1;
    }
    // ES: `--duplicate` permite re-capturar contenido idéntico; `--force` solo reprocesa.
    // EN: `--duplicate` allows re-capturing identical content; `--force` only reprocesses.
    // PT: `--duplicate` permite recapturar conteúdo idêntico; `--force` só reprocessa.
    const result = ingestSession({ file, text, title: flags.title ?? null, source: flags.source ?? 'cli', bus, force: Boolean(flags.duplicate) });
    if (!result.ok) {
      logger.error(result.error.message);
      return 1;
    }
    const { session, messages, duplicated } = result.value;
    if (asJson(flags, result.value)) return 0;

    process.stdout.write(heading('capture'));
    process.stdout.write(`${bullet(`${duplicated ? paint(c.yellow, 'DUPLICATE (already captured)') : paint(c.green, 'CAPTURED')} ${session.id}`)}\n`);
    process.stdout.write(`${row('title', session.title ?? '—')}\n`);
    process.stdout.write(`${row('source', session.source ?? '—')}\n`);
    process.stdout.write(`${row('format detected', session.format ?? '—')}\n`);
    process.stdout.write(`${row('messages', messages.length || session.message_count || 0)}\n`);
    process.stdout.write(`${row('raw hash', session.raw_hash_short ?? session.raw_hash?.slice(0, 12) ?? '—')}\n`);
    process.stdout.write(`${row('stored at', toProjectRelative(session._file ?? path.join(PATHS.rawSessions, session.id)))}\n`);

    if (!duplicated && flags.process !== false) {
      const processed = processSession(session.id, { bus, force: Boolean(flags.force) });
      if (processed.ok) {
        process.stdout.write(`\n${heading('extracted knowledge')}\n`);
        for (const [key, value] of Object.entries(processed.value.extracted)) {
          process.stdout.write(`${row(key, value > 0 ? paint(c.green, String(value)) : paint(c.gray, '0'))}\n`);
        }
      } else {
        logger.warn(`processing failed: ${processed.error.message}`);
      }
    }
    process.stdout.write('\n');
    return 0;
  },
};

COMMANDS.process = {
  description: 'Run the full knowledge pipeline (RAW → entities → graph)',
  usage: 'genesis process [--force] [--json]',
  async run({ flags, bus, logger }) {
    const started = Date.now();
    const result = processAll({ bus, force: Boolean(flags.force) });
    if (!result.ok) {
      logger.error(result.error.message);
      return 1;
    }
    if (asJson(flags, result.value)) return 0;

    const summary = result.value;
    process.stdout.write(heading('knowledge pipeline'));
    process.stdout.write(`${row('duration', `${summary.duration_ms} ms`)}\n`);
    process.stdout.write(`${row('sessions processed', `${summary.sessions_processed} (${summary.sessions_failed} failed)`)}\n`);
    for (const [key, value] of Object.entries(summary.totals)) {
      process.stdout.write(`${row(key, value > 0 ? paint(c.green, String(value)) : paint(c.gray, '0'))}\n`);
    }
    process.stdout.write(`${row('graph nodes / edges', `${summary.graph?.nodes ?? 0} / ${summary.graph?.edges ?? 0}`)}\n`);
    process.stdout.write(`${row('indexed entities', `${summary.database?.indexed_entities ?? 0}`)}\n`);
    if (summary.proposed_rules?.length) {
      process.stdout.write(`\n${heading('proposed rules (need approval)')}\n`);
      for (const rule of summary.proposed_rules) {
        process.stdout.write(`${bullet(`${paint(c.yellow, rule.key ?? rule.statement)} ${paint(c.gray, `← ${rule.origin ?? ''}`)}`)}\n`);
      }
    }
    process.stdout.write(`\n  ${paint(c.gray, `total wall time ${(Date.now() - started)}ms · summary written to data/processed/summary.json`)}\n\n`);
    return 0;
  },
};

COMMANDS.reprocess = {
  description: 'Delete derived data and rebuild everything from RAW',
  usage: 'genesis reprocess [--json]',
  async run({ flags, bus, logger }) {
    const checkpoint = createCheckpoint({ label: 'before-reprocess', bus });
    if (!flags.quiet) process.stdout.write(`  ${paint(c.gray, `safety checkpoint: ${checkpoint.ok ? checkpoint.value.id : 'FAILED'}`)}\n`);
    const result = reprocess({ bus });
    if (!result.ok) {
      logger.error(result.error.message);
      return 1;
    }
    if (asJson(flags, result.value)) return 0;
    process.stdout.write(`\n  ${paint(c.green, '✓')} reprocessed from RAW in ${result.value.duration_ms}ms — ${JSON.stringify(result.value.totals)}\n\n`);
    return 0;
  },
};

COMMANDS.search = {
  description: 'Full-text search across every knowledge entity',
  usage: 'genesis search <query> [--type decision,message] [--limit 20] [--messages]',
  async run({ flags, positional }) {
    const query = positional.join(' ').trim();
    if (!query) { process.stdout.write('  Usage: genesis search <query>\n'); return 1; }
    const db = openDatabase();
    const types = flags.type ? String(flags.type).split(',').filter(Boolean) : null;
    const limit = Number(flags.limit ?? 15);
    const result = search(query, { db, types, limit, mode: flags.mode ?? 'or' });

    if (asJson(flags, result)) return 0;

    process.stdout.write(heading(`search: "${query}"`));
    process.stdout.write(`  ${paint(c.gray, `engine ${result.engine} · ${result.count} hit(s)`)}\n\n`);
    if (!result.results.length) {
      process.stdout.write(`  ${paint(c.yellow, 'no results')}. Try a shorter query or run: genesis process\n\n`);
      return 0;
    }
    for (const hit of result.results) {
      process.stdout.write(`  ${paint(c.green, String(hit.rank).padStart(2, '.'))} ${paint(c.magenta, hit.type.padEnd(12, ' '))} ${paint(c.bold, hit.id)}\n`);
      process.stdout.write(`     ${hit.title ?? ''}\n`);
      if (hit.snippet) process.stdout.write(`     ${paint(c.gray, hit.snippet.replace(/\[\[/g, paint(c.yellow, '')).replace(/\]\]/g, '').slice(0, 220))}\n`);
      process.stdout.write('\n');
    }
    if (flags.messages) {
      const messages = search(query, { db, types: ['message'], limit });
      process.stdout.write(`  ${paint(c.gray, `${messages.count} message hit(s)`)}\n`);
    }
    return 0;
  },
};

COMMANDS.context = {
  description: 'Print the SESSION CONTEXT produced by the Context Engine',
  usage: 'genesis context [--query TEXT] [--md] [--json] [--compact]',
  async run({ flags, positional, bus }) {
    return COMMANDS.resume.run({ flags: { ...flags, query: flags.query ?? (positional.join(' ') || null) }, positional: [], bus, logger: createLogger({ scope: 'context' }) });
  },
};

COMMANDS.timeline = {
  description: 'Chronological history of observable events',
  usage: 'genesis timeline [--limit 60] [--type DECISION_MADE] [--session SES-00001]',
  async run({ flags }) {
    const db = openDatabase();
    const result = timeline({ db, limit: Number(flags.limit ?? 80), sessionId: flags.session ?? null, types: flags.type ? String(flags.type).split(',') : null, layer: flags.layer ?? null });
    if (asJson(flags, result)) return 0;

    process.stdout.write(heading('timeline'));
    if (!result.events.length) {
      process.stdout.write('  No events yet. Events appear as soon as you run init/capture/process.\n\n');
      return 0;
    }
    const iconFor = (type) => ({
      SESSION_STARTED: paint(c.cyan, '▶'), SESSION_ENDED: paint(c.gray, '■'), MESSAGE_RECEIVED: paint(c.gray, '✉'),
      DECISION_MADE: paint(c.magenta, '◆'), PLAN_CREATED: paint(c.blue, '▤'), SEARCH_PERFORMED: paint(c.cyan, '⌕'),
      ERROR_DETECTED: paint(c.red, '✗'), LESSON_CREATED: paint(c.green, '★'), CHECKPOINT_CREATED: paint(c.yellow, '⛉'),
      INTERRUPTION_RAISED: paint(c.red, '⚡'), RECOVERY_COMPLETED: paint(c.green, '↺'), KNOWLEDGE_EXTRACTED: paint(c.green, '⚙'),
      STATE_UPDATED: paint(c.gray, '↻'), TOOL_EXECUTED: paint(c.gray, '⚒'), BUILD_COMPLETED: paint(c.green, '✓'),
    }[type] ?? paint(c.gray, '·'));

    let lastDay = null;
    for (const event of result.events.slice(-Number(flags.limit ?? 80))) {
      const day = String(event.ts).slice(0, 10);
      if (day !== lastDay) {
        process.stdout.write(`\n  ${paint(c.bold, day)}\n`);
        lastDay = day;
      }
      const payload = event.payload ?? {};
      const detail = payload.title ?? payload.decision ?? payload.id ?? payload.reason ?? payload.message ?? payload.query ?? payload.kind ?? '';
      process.stdout.write(`   ${paint(c.gray, String(event.ts).slice(11, 19))} ${iconFor(event.type)} ${event.type.padEnd(22, ' ')} ${paint(c.gray, String(detail).slice(0, 74))}\n`);
    }
    process.stdout.write(`\n  ${paint(c.gray, `${result.count} events across ${result.days.length} day(s)`)}\n\n`);
    return 0;
  },
};

COMMANDS.decisions = {
  description: 'List Decision Traces or render one in detail',
  usage: 'genesis decisions [id] [--lang en|es|pt] [--why TERM]',
  async run({ flags, positional }) {
    const db = openDatabase();
    const id = positional[0];

    if (flags.why) {
      const chain = whyDidWeChoose(String(flags.why), { db, limit: 5 });
      if (asJson(flags, chain)) return 0;
      process.stdout.write(heading(`why did we choose "${flags.why}"?`));
      for (const item of chain.chains) {
        process.stdout.write(`\n  ${paint(c.bold, item.decision.id)} · ${item.decision.decision}\n`);
        process.stdout.write(`${row('status', item.decision.status ?? '—')}\n`);
        process.stdout.write(`${row('justification', (item.decision.justification ?? '—').slice(0, 160))}\n`);
        process.stdout.write(`${row('searches', item.searches.length ? item.searches.map((s) => s.id).join(', ') : '—')}\n`);
        process.stdout.write(`${row('sources', item.sources.length ? item.sources.slice(0, 3).join(' · ') : '—')}\n`);
        process.stdout.write(`${row('implementation', item.implementation.length ? `${item.implementation.length} action(s)` : '—')}\n`);
      }
      process.stdout.write('\n');
      return 0;
    }

    if (id) {
      const decision = loadDecision(db, id);
      if (!decision) { process.stdout.write(`  Decision ${id} not found.\n`); return 1; }
      if (asJson(flags, decision)) return 0;
      process.stdout.write(`\n${renderDecisionTrace(decision, flags.lang ?? 'en')}\n\n`);
      return 0;
    }

    const rows = all(db, 'SELECT id, layer, status, decision, created_at FROM decisions ORDER BY id');
    const fromControl = readJson(PATHS.decisions, { decisions: [] })?.decisions ?? [];
    const merged = rows.length ? rows : fromControl.map((d) => ({ id: d.id, layer: d.layer, status: d.status, decision: d.decision }));

    if (asJson(flags, { count: merged.length, decisions: merged })) return 0;

    process.stdout.write(heading(`decision traces (${merged.length})`));
    for (const decision of merged) {
      const statusColor = decision.status === 'approved' ? c.green : decision.status === 'blocked' ? c.red : c.yellow;
      process.stdout.write(`  ${paint(c.bold, String(decision.id).padEnd(10, ' '))} ${paint(statusColor, String(decision.status ?? '?').padEnd(10, ' '))} ${paint(c.gray, String(decision.layer ?? '').padEnd(16, ' '))} ${String(decision.decision ?? '').slice(0, 88)}\n`);
    }
    process.stdout.write(`\n  ${paint(c.gray, 'Detail:')} genesis decisions DEC-00002 ${paint(c.gray, '· Provenance:')} genesis decisions --why sqlite\n\n`);
    return 0;
  },
};

COMMANDS.graph = {
  description: 'Knowledge graph statistics, node profiles and neighbourhoods',
  usage: 'genesis graph [nodeIdOrLabel] [--depth 2] [--export file.json]',
  async run({ flags, positional }) {
    const db = openDatabase();
    const target = positional.join(' ').trim();

    if (flags.export) {
      const graph = exportGraph(db, Number(flags.limit ?? 300));
      writeJson(path.resolve(String(flags.export)), graph);
      process.stdout.write(`  ${paint(c.green, '✓')} graph exported: ${graph.nodes.length} nodes, ${graph.edges.length} edges\n`);
      return 0;
    }

    if (target) {
      const profile = nodeProfile(db, target);
      if (!profile) { process.stdout.write(`  Node "${target}" not found. Run: genesis process\n`); return 1; }
      if (asJson(flags, profile)) return 0;
      process.stdout.write(heading(`node ${profile.id} — ${profile.label}`));
      process.stdout.write(`${row('kind', profile.kind)}\n`);
      process.stdout.write(`${row('what is', profile.what_is ?? '—')}\n`);
      process.stdout.write(`${row('why exists', profile.why_exists ?? '—')}\n`);
      process.stdout.write(`${row('where used', profile.where_used ?? '—')}\n`);
      process.stdout.write(`${row('how built', profile.how_built ?? '—')}\n`);
      process.stdout.write(`${row('problems', profile.problems ?? '—')}\n`);
      process.stdout.write(`${row('learned', profile.learned ?? '—')}\n`);
      process.stdout.write(`${row('code refs', (profile.code_refs ?? []).join(', ') || '—')}\n`);
      process.stdout.write(`${row('sessions', (profile.sessions ?? []).join(', ') || '—')}\n`);
      process.stdout.write(`${row('sources', (profile.sources ?? []).join(' ') || '—')}\n`);
      process.stdout.write(`\n  ${paint(c.bold, 'RELATIONS')}\n`);
      for (const edge of [...profile.relations.outgoing, ...profile.relations.incoming].slice(0, Number(flags.depth ?? 12))) {
        const arrow = edge.direction === 'out' ? '→' : '←';
        process.stdout.write(`   ${arrow} ${paint(c.cyan, edge.relation.padEnd(15, ' '))} ${edge.node.label} ${paint(c.gray, `(w${edge.weight})`)}\n`);
      }
      process.stdout.write('\n');
      return 0;
    }

    const stats = graphStats(db);
    if (asJson(flags, stats)) return 0;
    process.stdout.write(heading('knowledge graph'));
    process.stdout.write(`${row('nodes', stats.nodes)}\n`);
    process.stdout.write(`${row('edges', stats.edges)}\n`);
    process.stdout.write(`${row('density', stats.density)}\n`);
    process.stdout.write(`\n  ${paint(c.bold, 'NODES BY KIND')}\n`);
    for (const [kind, n] of Object.entries(stats.by_kind)) process.stdout.write(`   ${kind.padEnd(14, ' ')} ${n}\n`);
    process.stdout.write(`\n  ${paint(c.bold, 'RELATIONS')}\n`);
    for (const [relation, n] of Object.entries(stats.by_relation)) process.stdout.write(`   ${relation.padEnd(14, ' ')} ${n}\n`);
    process.stdout.write(`\n  ${paint(c.bold, 'HUBS (most connected)')}\n`);
    for (const hub of stats.hubs) process.stdout.write(`   ${String(hub.degree).padStart(3, ' ')}× ${paint(c.gray, `(${hub.kind})`)} ${hub.label}\n`);
    process.stdout.write('\n');
    return 0;
  },
};

COMMANDS.tasks = {
  description: 'List tasks and their state machine position',
  usage: 'genesis tasks [--set ID:status] [--machine]',
  async run({ flags, positional, bus, logger }) {
    const db = openDatabase();

    if (flags.machine) {
      printJson(describeStateMachine());
      return 0;
    }
    if (flags.set) {
      const [id, status] = String(flags.set).split(':');
      const result = transitionTask(id, status, { bus, reason: 'cli' });
      if (!result.ok) { logger.error(result.error.message); return 1; }
      reconcile({ bus });
      process.stdout.write(`  ${paint(c.green, '✓')} ${id}: ${result.value.from} → ${result.value.to}\n`);
      return 0;
    }

    const data = loadTasks().value ?? { tasks: [] };
    if (asJson(flags, data)) return 0;
    process.stdout.write(heading(`tasks (${data.tasks?.length ?? 0})`));
    for (const task of data.tasks ?? []) {
      const color = task.status === 'completed' ? c.green : ['blocked', 'failed'].includes(task.status) ? c.red : task.status === 'running' ? c.cyan : c.gray;
      const bar = '█'.repeat(Math.round((Number(task.progress) || 0) / 10)).padEnd(10, '░');
      process.stdout.write(`  ${paint(c.bold, task.id.padEnd(11, ' '))} ${paint(color, String(task.status).padEnd(10, ' '))} ${paint(c.gray, bar)} ${String(task.phase ?? '').padEnd(9, ' ')} ${task.title}\n`);
    }
    process.stdout.write(`\n  ${paint(c.gray, 'Change state:')} genesis tasks --set TSK-00006:ready ${paint(c.gray, '· Legal transitions:')} genesis tasks --machine\n\n`);
    return 0;
  },
};

COMMANDS.events = {
  description: 'Show recent observable events',
  usage: 'genesis events [--limit 40] [--type ERROR_DETECTED]',
  async run({ flags }) {
    const events = EventBus.loadFromDisk({ limit: Number(flags.limit ?? 40), type: flags.type ?? undefined });
    if (asJson(flags, { count: events.length, events })) return 0;
    process.stdout.write(heading(`events (${events.length})`));
    for (const event of events.slice().reverse()) {
      process.stdout.write(`  ${paint(c.gray, String(event.ts).slice(5, 19))} ${paint(c.cyan, String(event.type).padEnd(22, ' '))} ${paint(c.gray, JSON.stringify(event.payload ?? {}).slice(0, 90))}\n`);
    }
    process.stdout.write('\n');
    return 0;
  },
};

COMMANDS.checkpoint = {
  description: 'Create a snapshot of the control plane',
  usage: 'genesis checkpoint [label] [--note TEXT]',
  async run({ flags, positional, bus, logger }) {
    const result = createCheckpoint({ label: positional.join('-') || 'manual', note: flags.note ?? null, bus });
    if (!result.ok) { logger.error(result.error.message); return 1; }
    if (asJson(flags, result.value)) return 0;
    process.stdout.write(`\n  ${paint(c.green, '✓')} checkpoint ${paint(c.bold, result.value.id)} created\n`);
    process.stdout.write(`${row('file', toProjectRelative(result.value.file))}\n`);
    process.stdout.write(`${row('progress', `${result.value.summary.progress_percent ?? 0}%`)}\n`);
    process.stdout.write(`${row('task', result.value.summary.current_task ?? '—')}\n\n`);
    return 0;
  },
};

COMMANDS.checkpoints = {
  description: 'List available checkpoints',
  usage: 'genesis checkpoints [--json]',
  async run({ flags }) {
    const list = listCheckpoints();
    if (asJson(flags, { count: list.length, checkpoints: list })) return 0;
    process.stdout.write(heading(`checkpoints (${list.length})`));
    if (!list.length) { process.stdout.write('  None yet. Run: genesis checkpoint\n\n'); return 0; }
    for (const item of list) {
      process.stdout.write(`  ${paint(c.bold, item.id.padEnd(10, ' '))} ${String(item.label ?? '').padEnd(22, ' ')} ${paint(c.gray, String(item.created_at ?? '').slice(0, 19))} ${paint(c.gray, `progress ${item.summary?.progress_percent ?? '?'}%`)}\n`);
    }
    process.stdout.write(`\n  ${paint(c.gray, 'Restore:')} genesis rollback CHK-00001 ${paint(c.gray, '· Compare:')} genesis diff CHK-00001 CHK-00002\n\n`);
    return 0;
  },
};

COMMANDS.rollback = {
  description: 'Restore a checkpoint (rollback the control plane)',
  usage: 'genesis rollback <checkpointId> [--only manifest,state]',
  async run({ flags, positional, bus, logger }) {
    const id = positional[0];
    if (!id) { logger.error('Usage: genesis rollback <checkpointId>'); return 1; }
    const only = flags.only ? String(flags.only).split(',') : null;
    const safety = createCheckpoint({ label: `before-rollback-${id}`, bus });
    const result = restoreCheckpoint(id, { bus, only });
    if (!result.ok) { logger.error(result.error.message); return 1; }
    reconcile({ bus });
    if (asJson(flags, result.value)) return 0;
    process.stdout.write(`\n  ${paint(c.green, '✓')} restored ${paint(c.bold, id)}\n`);
    process.stdout.write(`${row('files restored', result.value.restored.map((r) => r.key).join(', '))}\n`);
    process.stdout.write(`${row('safety snapshot', safety.ok ? safety.value.id : 'failed')}\n\n`);
    return 0;
  },
};

COMMANDS.diff = {
  description: 'Compare two checkpoints',
  usage: 'genesis diff <idA> <idB>',
  async run({ flags, positional, logger }) {
    const [a, b] = positional;
    if (!a || !b) { logger.error('Usage: genesis diff <idA> <idB>'); return 1; }
    const result = diffCheckpoints(a, b);
    if (!result.ok) { logger.error(result.error.message); return 1; }
    if (asJson(flags, result.value)) return 0;
    process.stdout.write(heading(`diff ${a} → ${b}`));
    if (!result.value.changed_files.length) { process.stdout.write('  No differences.\n\n'); return 0; }
    for (const [file, diff] of Object.entries(result.value.per_file)) {
      process.stdout.write(`\n  ${paint(c.bold, file)} ${paint(c.gray, `(${diff.changed.length} changed, ${diff.added.length} added, ${diff.removed.length} removed)`)}\n`);
      for (const line of diff.lines) process.stdout.write(`    ${line.startsWith('+') ? paint(c.green, line) : line.startsWith('-') ? paint(c.red, line) : paint(c.yellow, line)}\n`);
    }
    process.stdout.write('\n');
    return 0;
  },
};

COMMANDS.serve = {
  description: 'Start the zero-dependency API + offline console',
  usage: 'genesis serve [--port 4321] [--host 0.0.0.0]',
  async run({ flags, bus, logger }) {
    const port = Number(flags.port ?? process.env.PORT ?? 4321);
    const host = flags.host ?? '0.0.0.0';
    const started = await startServer({ port, host, bus, logger });

    process.stdout.write(`\n${heading('genesis serve')}\n`);
    // ES: mostramos la interfaz real (0.0.0.0 = cualquier red) además de la URL
    //     local. En entornos con proxy/preview, 0.0.0.0 es lo que permite que la
    //     página se vea desde el navegador del usuario.
    // EN: we show the real interface (0.0.0.0 = any network) plus the local URL.
    //     In proxy/preview environments, 0.0.0.0 is what makes the page visible
    //     from the user's browser.
    // PT: mostramos a interface real (0.0.0.0 = qualquer rede) além da URL local.
    process.stdout.write(`${row('listening on', `${started.host ?? host}:${started.port ?? port}`)}\n`);
    process.stdout.write(`${row('API', `${started.url}/api`)}\n`);
    process.stdout.write(`${row('offline console', `${started.url}/`)}\n`);
    process.stdout.write(`${row('health', `${started.url}/api/health`)}\n`);
    process.stdout.write(`${row('context engine', `${started.url}/api/context?format=md`)}\n`);
    process.stdout.write(`${row('routes', started.routes)}\n`);
    process.stdout.write(`${row('dependencies', paint(c.green, '0'))}\n`);
    process.stdout.write(`\n  ${paint(c.gray, 'Press Ctrl+C to stop.')}\n\n`);

    // ES: cerramos limpiamente con Ctrl+C, guardando la base.
    // EN: we close cleanly on Ctrl+C, saving the database.
    // PT: fechamos limpiamente com Ctrl+C, salvando o banco.
    const shutdown = async () => {
      bus.emit('SESSION_ENDED', { kind: 'serve-stopped' }, { layer: 'application' });
      await started.close();
      closeDatabase();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await new Promise(() => {}); // ES: mantiene el proceso vivo | EN: keeps the process alive
    return 0;
  },
};

COMMANDS.routes = {
  description: 'List every HTTP route of the API',
  usage: 'genesis routes [--json]',
  async run({ flags }) {
    const { createRoutes, describeRoutes } = await import('../api/routes.js');
    const routes = describeRoutes(createRoutes({}));
    if (asJson(flags, routes)) return 0;
    process.stdout.write(heading(`api routes (${routes.length})`));
    for (const route of routes) {
      process.stdout.write(`  ${paint(route.method === 'GET' ? c.green : c.yellow, route.method.padEnd(5, ' '))} ${paint(c.bold, route.pattern.padEnd(38, ' '))} ${paint(c.gray, route.description)}\n`);
    }
    process.stdout.write('\n');
    return 0;
  },
};

COMMANDS.demo = {
  description: 'Capture and process the bundled sample founding session',
  usage: 'genesis demo [--force] [--duplicate]',
  async run({ flags, bus, logger }) {
    const sample = path.join(PATHS.samples, 'session-001-architecture.md');
    if (!fs.existsSync(sample)) { logger.error(`Sample not found: ${toProjectRelative(sample)}`); return 1; }
    process.stdout.write(`  ${paint(c.gray, `ingesting ${toProjectRelative(sample)}`)}\n`);
    // ES: ⚠️ SEMÁNTICA CORREGIDA: `--force` fuerza el REPROCESADO del conocimiento,
    //     NUNCA duplica la captura RAW. Duplicar sesiones rompería la idempotencia
    //     del nivel RAW (append-only) y duplicaría todas las entidades derivadas.
    //     Para duplicar a propósito existe `--duplicate`.
    // EN: ⚠️ SEMANTICS FIXED: `--force` forces REPROCESSING of knowledge, it NEVER
    //     duplicates the RAW capture. Duplicating sessions would break RAW
    //     idempotency (append-only) and duplicate every derived entity.
    //     Use `--duplicate` to duplicate on purpose.
    // PT: ⚠️ SEMÂNTICA CORRIGIDA: `--force` força o REPROCESSAMENTO do
    //     conhecimento, NUNCA duplica a captura RAW. Duplicar sessões quebraria a
    //     idempotência do nível RAW e duplicaria todas as entidades derivadas.
    //     Use `--duplicate` para duplicar de propósito.
    const captured = ingestSession({ file: sample, title: 'Session 001 — Genesis architecture definition', bus, force: Boolean(flags.duplicate) });
    if (!captured.ok) { logger.error(captured.error.message); return 1; }
    const processed = processSession(captured.value.session.id, { bus, force: true });
    if (!processed.ok) { logger.error(processed.error.message); return 1; }
    process.stdout.write(`\n  ${paint(c.green, '✓')} ${captured.value.session.id}: ${captured.value.messages.length || captured.value.session.message_count} messages\n`);
    process.stdout.write(`  ${paint(c.gray, 'extracted:')} ${JSON.stringify(processed.value.extracted)}\n`);
    process.stdout.write(`\n  ${paint(c.gray, 'Now try:')} genesis status ${paint(c.gray, '·')} genesis search sqlite ${paint(c.gray, '·')} genesis serve\n\n`);
    return 0;
  },
};

COMMANDS.reset = {
  description: 'Delete the derived database (RAW data and control plane stay intact)',
  usage: 'genesis reset --yes',
  async run({ flags, logger }) {
    if (flags.yes !== true && flags.yes !== 'true') {
      logger.error('Refusing to reset without --yes. RAW history and the control plane are NOT deleted, only the derived index.');
      return 1;
    }
    const result = destroyDatabase();
    process.stdout.write(`  ${paint(c.yellow, '⚠')} database removed: ${result.value.removed.join(', ') || 'nothing'}\n`);
    process.stdout.write(`  ${paint(c.gray, 'Rebuild with: genesis process')}\n`);
    return 0;
  },
};

/* ── Arranque / Entry point ──────────────────────────────────────────────── */

async function main() {
  const argv = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  const command = positional.shift() ?? 'help';

  if (flags.version || flags.v) {
    const manifest = readJson(PATHS.manifest, {});
    process.stdout.write(`${manifest?.project?.name ?? 'genesis'} v${manifest?.project?.version ?? '0.0.0'} · node ${process.versions.node}\n`);
    return 0;
  }

  const entry = COMMANDS[command];
  if (!entry) {
    process.stdout.write(`\n  ${paint(c.red, 'Unknown command:')} ${command}\n\n`);
    COMMANDS.help.run({ positional: [], flags: {} });
    return 1;
  }

  const logger = createLogger({ scope: command, level: flags.quiet ? 'error' : flags.verbose ? 'debug' : 'info', file: flags.quiet ? null : path.join(PATHS.rawEvents, 'genesis.log') });
  const bus = new EventBus({ logger, sessionId: flags.session ?? null });

  // ES: el bus de la CLI suscribe un contador para el resumen final.
  // EN: the CLI bus subscribes a counter for the final summary.
  // PT: o bus da CLI assina um contador para o resumo final.
  bus.on('*', () => {});

  ensureDir(PATHS.rawEvents);
  try {
    const code = await entry.run({ positional, flags, bus, logger });
    if (!flags.quiet) {
      const counts = bus.counts();
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      if (total > 0 && !flags.json) {
        process.stdout.write(`  ${paint(c.gray, `${total} observable event(s) emitted → ${toProjectRelative(PATHS.rawEvents)}`)}\n`);
      }
    }
    closeDatabase();
    return code ?? 0;
  } catch (error) {
    logger.error(error.message);
    if (flags.verbose) process.stderr.write(`${error.stack}\n`);
    bus.emit('ERROR_DETECTED', { command, message: error.message }, { layer: 'application', severity: 'critical' });
    closeDatabase();
    return 1;
  }
}

const exitCode = await main();
process.exitCode = exitCode;

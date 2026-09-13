/* ═══════════════════════════════════════════════════════════════════════════
 * core/executor/index.js — PHASE 5 · EXECUTOR (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: ejecuta planes paso a paso siguiendo el protocolo de
 *     mutación POL-0002 (READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY →
 *     COMMIT) y la red de seguridad POL-0003 (checkpoint antes de mutar).
 *     SEGURIDAD POR CONSTRUCCIÓN: solo ejecuta herramientas internas registradas
 *     en TOOLS (docs.generate, tests.run, checkpoint.create…). NO existe
 *     ejecución de código arbitrario: runCommand() valida contra una whitelist
 *     fija de scripts del proyecto y usa execFileSync SIN shell, así ni un
 *     comando inyectado con "; rm -rf" puede colarse. applyPatch() hace parches
 *     literales de UNA sola ocurrencia y rechaza parches que toquen más del 60%
 *     de las líneas del archivo (nunca reescribir archivos enteros, POL-0002).
 *     Cada paso ejecutado queda registrado en la tabla `actions` (auditoría).
 *
 * 🇬🇧 EN — WHAT IT DOES: executes plans step by step following the mutation
 *     protocol (READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT) and
 *     the safety net (checkpoint before mutating). SAFE BY CONSTRUCTION: only
 *     registered internal tools run; runCommand() validates against a fixed
 *     whitelist and uses execFileSync WITHOUT a shell, so injected commands
 *     cannot slip in. applyPatch() does literal single-occurrence patches and
 *     refuses patches touching more than 60% of a file's lines (never rewrite
 *     whole files). Every executed step is recorded in the `actions` table.
 *
 * 🇧🇷 PT — O QUE FAZ: executa planos passo a passo seguindo o protocolo de
 *     mutação e a rede de segurança (checkpoint antes de mutar). SEGURO POR
 *     CONSTRUÇÃO: só ferramentas internas registradas rodam; runCommand() valida
 *     contra whitelist fixa e usa execFileSync SEM shell. applyPatch() faz
 *     patches literais de UMA ocorrência e recusa reescritas inteiras.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • execFileSync sin shell ES/EN/PT: cuando NO pasas {shell:true}, Node ejecuta
 *     el binario con sus argumentos directamente: no hay intérprete que expanda
 *     `;`, `|` ni `$()`. Un argumento malicioso es solo un argumento inválido.
 *     Without a shell there is no interpreter to expand metacharacters.
 *   • dryRun ES/EN/PT: executePlan({dryRun:true}) recorre el plan y devuelve qué
 *     haría, sin tocar nada. Es el modo por defecto del agente: primero se mira,
 *     después se dispara. The agent's default mode: look first, shoot later.
 *   • actions como caja negra ES/EN/PT: cada paso guarda tool, resultado, status
 *     y verificación en la tabla `actions`. Si algo rompe mañana, la autopsia
 *     empieza ahí. Every executed step leaves an autopsy-ready record.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ok, fail, attempt } from '../shared/result.js';
import { PATHS, toProjectRelative, ROOT } from '../shared/paths.js';
import { nextId, ID_PREFIX } from '../shared/ids.js';
import { run as dbRun } from '../../knowledge/db/index.js';
import { createCheckpoint } from '../checkpoint/index.js';
import { reconcile } from '../state/index.js';
import { generateAll as generateDocs, verifyDocumentation } from '../../documentation/engine/index.js';
import { TOOL_WHITELIST } from '../planner/index.js';

/** ES/EN/PT: protocolo de mutación (POL-0002), en orden. Mutation protocol. */
export const MUTATION_PROTOCOL = Object.freeze(['READ', 'UNDERSTAND', 'DIFF', 'PLAN', 'PATCH', 'VERIFY', 'COMMIT']);

/*
 * ES: whitelist de comandos externos. Solo scripts Node del propio proyecto.
 * EN: external command whitelist. Only the project's own Node scripts.
 * PT: whitelist de comandos externos. Só scripts Node do próprio projeto.
 */
const COMMAND_WHITELIST = Object.freeze([
  'node --disable-warning=ExperimentalWarning --test tests/*.test.js',
  'node scripts/export-console-snapshot.js',
  'node core/cli/genesis.js',
]);

/**
 * ES: registro de herramientas internas. Cada clave está en TOOL_WHITELIST y
 *     mapea a código REAL del proyecto. Añadir una herramienta = añadir una
 *     entrada aquí + una en TOOL_WHITELIST + un test. Nada más puede ejecutarse.
 * EN: internal tool registry. Every key is in TOOL_WHITELIST and maps to REAL
 *     project code. Adding a tool = an entry here + one in TOOL_WHITELIST + a
 *     test. Nothing else can ever run.
 * PT: registro de ferramentas internas; nada fora dele é executado.
 */
export const TOOLS = Object.freeze({
  'docs.generate': ({ db, bus }) => generateDocs({ db, bus }),
  'docs.verify': ({ db }) => verifyDocumentation({ db }),
  'tests.run': ({ bus }) => runTestSuite({ bus }),
  'checkpoint.create': ({ bus, label }) => createCheckpoint({ label: label ?? 'agent-mutation', bus }),
  'state.reconcile': ({ bus }) => reconcile({ bus }),
  'rules.promote': async ({ db, bus }) => (await import('../../skills/index.js')).promoteRules({ db, bus }),
  'courses.generate': async ({ db, bus }) => (await import('../../documentation/courses/index.js')).buildCurriculum({ db, bus }),
  'snapshot.export': ({ bus }) => runWhitelistedCommand('node scripts/export-console-snapshot.js', { bus }),
  'db.stats': ({ db }) => ok({ kind: 'db-stats', ...(db ? { tables: Number(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()?.n ?? 0) } : {}) }),
});

/**
 * ES: ejecuta un plan completo, paso a paso, con protocolo de mutación.
 *     dryRun (por defecto true) devuelve qué haría SIN tocar nada.
 * EN: executes a whole plan step by step with the mutation protocol. dryRun
 *     (default true) reports what it WOULD do without touching anything.
 * PT: executa um plano passo a passo; dryRun (padrão) não toca em nada.
 *
 * @param {{ plan: object, db?: object, bus?: object, dryRun?: boolean, checkpointFirst?: boolean, label?: string }} options
 */
export async function executePlan(options = {}) {
  const { plan = null, bus = null, dryRun = true, checkpointFirst = true, label = null } = options;
  const db = options.db ?? null;

  if (!plan || !Array.isArray(plan.steps)) return fail('executePlan requires a plan with steps', { code: 'plan_missing', interruptionType: 'ambiguity' });

  const { validatePlan } = await import('../planner/index.js');
  const validation = validatePlan({ plan });
  if (!validation.ok) return validation;

  if (dryRun) {
    return ok({
      mode: 'dry-run', plan: plan.id,
      would_execute: plan.steps.map((step) => ({ order: step.order, tool: step.tool, action: step.action, acceptance: step.acceptance })),
      mutations: plan.steps.filter((step) => isMutating(step.tool)).map((step) => step.tool),
      checkpoint_required: checkpointFirst && plan.steps.some((step) => isMutating(step.tool)),
    });
  }

  /*
   * ES: POL-0003 en acción: si algún paso muta, checkpoint ANTES del primero.
   * EN: POL-0003 in action: if any step mutates, checkpoint BEFORE the first.
   * PT: POL-0003 em ação: checkpoint ANTES do primeiro passo que muta.
   */
  let checkpointId = null;
  if (checkpointFirst && plan.steps.some((step) => isMutating(step.tool))) {
    const checkpoint = createCheckpoint({ label: label ?? `before-${plan.id}`, bus });
    if (!checkpoint.ok) return checkpoint;
    checkpointId = checkpoint.value.id;
  }

  const results = [];
  for (const step of plan.steps) {
    bus?.emit('TOOL_EXECUTED', { kind: 'step-start', plan: plan.id, order: step.order, tool: step.tool }, { layer: 'agents' });
    const result = await executeStep({ step, db, bus, plan });
    results.push({ order: step.order, tool: step.tool, ok: result.ok, value: result.ok ? summarizeValue(result.value) : null, error: result.ok ? null : result.error });
    // COMMIT — auditoría: cada paso queda en la tabla actions (si hay db).
    // COMMIT — auditability: every step lands in the actions table (when a db exists).
    // COMMIT — auditoria: cada passo cai na tabela actions (quando há db).
    try { recordAction(db, { plan, step, result }); } catch { /* audit never breaks execution */ }
    if (!result.ok) {
      bus?.emit('ERROR_DETECTED', { tool: step.tool, plan: plan.id, order: step.order, message: result.error.message }, { layer: 'agents', severity: 'high' });
      return fail(`Step ${step.order} (${step.tool}) failed: ${result.error.message}`, {
        code: 'plan_step_failed', interruptionType: 'failed', layer: 'agents',
        details: { plan: plan.id, failed_step: step.order, results, checkpoint: checkpointId },
      });
    }
  }

  return ok({ mode: 'executed', plan: plan.id, checkpoint: checkpointId, steps: results });
}

/** ES/EN/PT: ejecuta UN paso contra el registro de herramientas. Runs ONE step. */
async function executeStep({ step, db, bus, plan }) {
  if (!TOOLS[step.tool]) {
    return fail(`Tool "${step.tool}" is not registered — the executor only runs whitelisted internal tools`, { code: 'tool_not_allowed', interruptionType: 'security_stop' });
  }
  try {
    /*
     * ES: los tools pueden ser sync (devuelven Result) o async (Promise<Result>,
     *     como rules.promote que hace import dinámico). Se resuelven ambos aquí;
     *     attempt() NO sirve para promesas (devolvería ok(promise) sin resolver).
     * EN: tools may be sync (Result) or async (Promise<Result>). Both resolve
     *     here; attempt() does NOT work for promises (it would return
     *     ok(promise) unresolved).
     * PT: tools podem ser sync ou async; ambos são resolvidos aqui.
     */
    let value = TOOLS[step.tool]({ db, bus, label: plan?.id ? `plan-${plan.id}-step-${step.order}` : null, step });
    if (value instanceof Promise) value = await value;
    return value && typeof value.ok === 'boolean' ? value : ok(value ?? null);
  } catch (error) {
    return fail(error.message, { code: 'tool_execution_failed', layer: 'agents', interruptionType: 'tool_error' });
  }
}

/** ES/EN/PT: ¿este tool muta el proyecto? Does this tool mutate the project? */
export function isMutating(tool) {
  return ['docs.generate', 'checkpoint.create', 'state.reconcile', 'rules.promote', 'courses.generate', 'snapshot.export'].includes(tool);
}

/**
 * ES: parche literal de UNA ocurrencia con protocolo de mutación. Rechaza:
 *     archivo inexistente, find vacío, find ausente o ambiguo (>1 ocurrencia),
 *     y parches que cambien más del 60% de las líneas (POL-0002: nunca
 *     reescribir archivos enteros).
 * EN: literal single-occurrence patch with the mutation protocol. Refuses:
 *     missing file, empty/absent/ambiguous find, and patches changing more than
 *     60% of the lines (POL-0002: never rewrite whole files).
 * PT: patch literal de UMA ocorrência; recusa reescritas inteiras (POL-0002).
 *
 * @param {{ file: string, find: string, replace: string, bus?: object, dryRun?: boolean }} options
 */
export function applyPatch(options = {}) {
  const { file = null, find = null, replace = null, bus = null, dryRun = false } = options;
  return attempt(() => {
    // READ — el archivo debe existir y estar dentro del proyecto.
    if (!file || !find || typeof replace !== 'string') throw new Error('applyPatch requires { file, find, replace }');
    const absolute = path.resolve(ROOT, file);
    if (!absolute.startsWith(ROOT + path.sep) && absolute !== ROOT) throw new Error('applyPatch refuses files outside the project root');
    if (!fs.existsSync(absolute)) throw new Error(`applyPatch: file not found: ${file}`);
    const content = fs.readFileSync(absolute, 'utf8');

    // UNDERSTAND + DIFF — una sola ocurrencia; nada de ambigüedad.
    const occurrences = content.split(find).length - 1;
    if (occurrences === 0) throw new Error(`applyPatch: find text not present in ${file}`);
    if (occurrences > 1) throw new Error(`applyPatch: find text is ambiguous (${occurrences} occurrences) in ${file}`);

    const patched = content.replace(find, replace);
    const changedLines = content.split('\n').filter((line, index) => line !== patched.split('\n')[index]).length;
    const totalLines = Math.max(content.split('\n').length, 1);
    if (changedLines / totalLines > 0.6) {
      throw new Error(`applyPatch refused: the patch rewrites ${changedLines}/${totalLines} lines — POL-0002 forbids wholesale rewrites; patch smaller regions`);
    }

    if (!dryRun) {
      // PATCH + COMMIT
      fs.writeFileSync(absolute, patched, 'utf8');
      bus?.emit('FILE_CHANGED', { tool: 'applyPatch', file: toProjectRelative(absolute), changed_lines: changedLines }, { layer: 'core-engine' });
    }
    return { file: toProjectRelative(absolute), changed_lines: changedLines, dry_run: dryRun, protocol: MUTATION_PROTOCOL };
  }, { code: 'patch_failed', layer: 'core-engine', interruptionType: 'conflict' });
}

/**
 * ES: ejecuta un comando SOLO si está en la whitelist, con execFileSync y SIN
 *     shell (sin intérprete no hay inyección posible).
 * EN: runs a command ONLY if whitelisted, with execFileSync and NO shell
 *     (no interpreter, no injection).
 * PT: executa um comando SOMENTE se estiver na whitelist, SEM shell.
 */
export function runCommand(options = {}) {
  const { command = null, bus = null } = options;
  if (!command || !COMMAND_WHITELIST.includes(command)) {
    return fail(`Command not allowed: "${command ?? '—'}". Whitelist: ${COMMAND_WHITELIST.join(' | ')}`, { code: 'command_not_allowed', interruptionType: 'security_stop', layer: 'agents' });
  }
  return runWhitelistedCommand(command, { bus });
}

/** ES/EN/PT: ejecución real (ya validada) sin shell. Actual shell-free run. */
function runWhitelistedCommand(command, { bus = null } = {}) {
  return attempt(() => {
    const [binary, ...args] = command.split(' ');
    const resolved = binary === 'node' ? process.execPath : binary;
    // ES: los globs (tests/*.test.js) los expande el runner de node --test, no un
    //     shell: se pasa el patrón literal como argumento.
    // EN: globs are expanded by node's test runner, not a shell: the literal
    //     pattern is passed as an argument.
    // PT: os globs são expandidos pelo test runner do node, não por um shell.
    const stdout = execFileSync(resolved, args, { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
    bus?.emit('TOOL_EXECUTED', { tool: 'runCommand', command }, { layer: 'agents' });
    return { command, stdout: stdout.slice(-2000), exit_code: 0 };
  }, { code: 'command_failed', layer: 'agents' });
}

/** ES/EN/PT: corre la suite de verificación y parsea el resumen TAP. */
export function runTestSuite({ bus = null } = {}) {
  return attempt(() => {
    bus?.emit('TEST_STARTED', { suite: 'tests/*.test.js' }, { layer: 'verification' });
    let stdout = '';
    let exitCode = 0;
    try {
      stdout = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', 'tests/*.test.js'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
    } catch (error) {
      exitCode = error.status ?? 1;
      stdout = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    const pass = Number(/^# pass (\d+)$/m.exec(stdout)?.[1] ?? 0);
    const failCount = Number(/^# fail (\d+)$/m.exec(stdout)?.[1] ?? 0);
    const summary = { suite: 'tests/*.test.js', pass, fail: failCount, exit_code: exitCode, ok: exitCode === 0 && failCount === 0 };
    bus?.emit(summary.ok ? 'TEST_PASSED' : 'TEST_FAILED', summary, { layer: 'verification' });
    if (!summary.ok) throw new Error(`test suite failed: ${failCount} failure(s)`);
    return summary;
  }, { code: 'tests_failed', layer: 'verification' });
}

/**
 * ES: registra el artefacto producido (auditoría nivel 2).
 * EN: records the produced artifact (level-2 auditability).
 * PT: registra o artefato produzido.
 */
export function recordArtifact(options = {}) {
  const { db = null, kind = 'file', file = null, buildId = null, sessionId = null } = options;
  if (!db) return fail('recordArtifact requires a db handle', { code: 'db_missing' });
  return attempt(() => {
    const absolute = path.resolve(ROOT, file ?? '');
    const exists = fs.existsSync(absolute);
    const id = nextId(ID_PREFIX.artifact, db.prepare('SELECT id FROM artifacts').all().map((r) => r.id), 5);
    dbRun(db, `INSERT INTO artifacts (id, kind, path, build_id, session_id, hash, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, kind, file ?? null, buildId ?? null, sessionId ?? null, exists ? String(fs.statSync(absolute).size) : null, exists ? fs.statSync(absolute).size : null, new Date().toISOString()]);
    return { id, kind, path: file, exists };
  }, { code: 'artifact_record_failed', layer: 'core-engine' });
}

/** ES/EN/PT: registra la acción ejecutada en la tabla actions. */
export function recordAction(db, { plan = null, step = null, result = null }) {
  if (!db) return null;
  const id = nextId(ID_PREFIX.action, db.prepare('SELECT id FROM actions').all().map((r) => r.id), 5);
  dbRun(db, `INSERT INTO actions (id, session_id, task, layer, action, tool, result, status, artifact, verification, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, null, plan?.task ?? null, plan?.layer ?? 'agents', step?.action ?? '—', step?.tool ?? null,
      result?.ok ? 'success' : String(result?.error?.message ?? '').slice(0, 400), result?.ok ? 'success' : 'failed',
      null, step?.acceptance ?? null, new Date().toISOString()]);
  return id;
}

/** ES/EN/PT: resume valores grandes para el reporte del plan. */
function summarizeValue(value) {
  if (value === null || value === undefined) return value;
  const json = JSON.stringify(value);
  return json.length > 400 ? `${json.slice(0, 400)}…` : JSON.parse(json);
}

export default { MUTATION_PROTOCOL, TOOLS, executePlan, applyPatch, runCommand, runTestSuite, recordArtifact, recordAction, isMutating };

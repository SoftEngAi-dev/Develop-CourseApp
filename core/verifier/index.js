/* ═══════════════════════════════════════════════════════════════════════════
 * core/verifier/index.js — PHASE 5 · VERIFIER (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: las cuatro compuertas de verificación del sistema.
 *     verifyChange   → corre la suite (node --test) y parsea el resumen TAP:
 *                      pass/fail reales, no opiniones.
 *     verifyAcceptance → comprueba criterios de aceptación concretos: existencia
 *                      de archivos, conteos mínimos, texto presente.
 *     verifyPolicies → políticas verificables a máquina: POL-0001 (cero
 *                      dependencias npm), POL-0011 (la consola offline tiene
 *                      snapshot + service worker), y los prechecks instalados
 *                      por la Fase 7 (control/prechecks.json).
 *     verifyReversibility → ¿existe un checkpoint cargable ANTES de mutar?
 *     Cada verificación devuelve evidencia ({checks, passed, failed}), nunca un
 *     simple true/false: si falla, el reporte dice QUÉ y con QUÉ número.
 *
 * 🇬🇧 EN — WHAT IT DOES: the system's four verification gates. verifyChange
 *     runs the test suite and parses the real TAP summary; verifyAcceptance
 *     checks concrete acceptance criteria (files exist, minimum counts, text
 *     present); verifyPolicies machine-checks policies (POL-0001 zero npm
 *     dependencies, POL-0011 offline console has snapshot + service worker) plus
 *     the prechecks installed by Phase 7; verifyReversibility proves a loadable
 *     checkpoint exists BEFORE mutating. Every gate returns EVIDENCE, never a
 *     bare true/false.
 *
 * 🇧🇷 PT — O QUE FAZ: as quatro comportas de verificação. Cada uma devolve
 *     EVIDÊNCIA ({checks, passed, failed}), nunca um simples verdadeiro/falso.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Verificar = medir ES/EN/PT: "creo que funciona" no es verificación.
 *     Verificación es: ejecuto, cuento pass/fail, comparo contra un umbral
 *     declarado ANTES de ejecutar. El umbral va primero; si no, siempre se puede
 *     mover la vara después. Declare the threshold before running, or the bar
 *     will move after.
 *   • Evidencia serializable ES/EN/PT: cada check es {name, passed, detail}.
 *     Eso se puede guardar en la base, imprimir en la consola y diffear entre
 *     corridas. Un booleano pelado se pierde; la evidencia se audita.
 *     Every check is a serializable record: booleans get lost, evidence is audited.
 *   • Políticas a máquina ES/EN/PT: una política que no se puede comprobar con
 *     código es un póster motivacional. POL-0001 se verifica leyendo
 *     package.json; POL-0011, existence-checkando sw.js y snapshot.json.
 *     A policy you cannot machine-check is a motivational poster.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, attempt } from '../shared/result.js';
import { PATHS, ROOT } from '../shared/paths.js';
import { readJson } from '../shared/json.js';
import { latestCheckpoint, loadCheckpoint } from '../checkpoint/index.js';
import { runTestSuite } from '../executor/index.js';

/** ES/EN/PT: los cuatro niveles declarados en control/manifest.json. */
export const VERIFICATION_LEVELS = Object.freeze(['unit', 'integration', 'pipeline', 'mutation-safety']);

/**
 * ES: compuerta 1 — ¿el cambio pasa la suite de verificación?
 * EN: gate 1 — does the change pass the verification suite?
 * PT: comporta 1 — a mudança passa na suíte de verificação?
 *
 * @param {{ level?: string, bus?: object, minPass?: number }} [options]
 */
export function verifyChange(options = {}) {
  const { bus = null, minPass = 1 } = options;
  const level = options.level ?? 'integration';
  if (!VERIFICATION_LEVELS.includes(level)) {
    return fail(`Unknown verification level "${level}" — allowed: ${VERIFICATION_LEVELS.join(', ')}`, { code: 'level_unknown', interruptionType: 'ambiguity' });
  }
  const suite = runTestSuite({ bus });
  if (!suite.ok) {
    return ok({ verified: false, level, checks: [{ name: 'test-suite', passed: false, detail: suite.error.message }], passed: 0, failed: 1 });
  }
  const value = suite.value;
  const checks = [{ name: 'test-suite', passed: value.ok && value.pass >= minPass, detail: `pass=${value.pass} fail=${value.fail} exit=${value.exit_code}` }];
  return ok({ verified: checks.every((check) => check.passed), level, checks, passed: value.pass, failed: value.fail });
}

/**
 * ES: compuerta 2 — criterios de aceptación CONCRETOS. Cada criterio es uno de:
 *     {kind:'file-exists', path} · {kind:'min-bytes', path, min} ·
 *     {kind:'contains', path, text} · {kind:'count-json', path, key, min}.
 * EN: gate 2 — CONCRETE acceptance criteria of four kinds (file exists, minimum
 *     bytes, contains text, JSON array/count minimum).
 * PT: comporta 2 — critérios de aceitação CONCRETOS de quatro tipos.
 *
 * @param {{ criteria?: object[], task?: string|null }} [options]
 */
export function verifyAcceptance(options = {}) {
  const { criteria = [], task = null } = options;
  return attempt(() => {
    const checks = criteria.map((criterion) => {
      const target = path.isAbsolute(criterion.path ?? '') ? criterion.path : path.join(ROOT, criterion.path ?? '');
      try {
        switch (criterion.kind) {
          case 'file-exists':
            return { name: `file-exists ${criterion.path}`, passed: fs.existsSync(target), detail: criterion.path };
          case 'min-bytes': {
            const bytes = fs.existsSync(target) ? fs.statSync(target).size : 0;
            return { name: `min-bytes ${criterion.path}`, passed: bytes >= Number(criterion.min ?? 1), detail: `${bytes} >= ${criterion.min ?? 1}` };
          }
          case 'contains': {
            const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
            return { name: `contains ${criterion.path}`, passed: content.includes(criterion.text ?? ''), detail: `"${String(criterion.text ?? '').slice(0, 60)}"` };
          }
          case 'count-json': {
            const data = readJson(target, null);
            const count = data ? (Array.isArray(data[criterion.key ?? '']) ? data[criterion.key].length : Number(data[criterion.key ?? ''] ?? 0)) : 0;
            return { name: `count-json ${criterion.path}`, passed: count >= Number(criterion.min ?? 1), detail: `${criterion.key ?? '?'}=${count} >= ${criterion.min ?? 1}` };
          }
          default:
            return { name: `unknown criterion ${criterion.kind}`, passed: false, detail: 'supported: file-exists, min-bytes, contains, count-json' };
        }
      } catch (error) {
        return { name: `criterion error ${criterion.kind}`, passed: false, detail: error.message };
      }
    });
    const passed = checks.filter((check) => check.passed).length;
    return { verified: checks.length > 0 && passed === checks.length, task, checks, passed, failed: checks.length - passed };
  }, { code: 'acceptance_verification_failed', layer: 'verification' });
}

/**
 * ES: compuerta 3 — políticas verificables a máquina + prechecks instalados.
 * EN: gate 3 — machine-checkable policies + installed prechecks (Phase 7).
 * PT: comporta 3 — políticas verificáveis + prechecks instalados.
 *
 * @param {{ bus?: object }} [options]
 */
export function verifyPolicies(options = {}) {
  return attempt(() => {
    const checks = [];

    // POL-0001: cero dependencias npm en el núcleo. Zero npm deps in the core.
    const pkg = readJson(path.join(ROOT, 'package.json'), {});
    const deps = Object.keys(pkg?.dependencies ?? {}).length + Object.keys(pkg?.devDependencies ?? {}).length;
    checks.push({ name: 'POL-0001 zero-npm-dependencies', passed: deps === 0, detail: `root package.json has ${deps} dependencies` });

    // POL-0011: la consola offline funciona sin red (snapshot + service worker).
    const sw = fs.existsSync(path.join(PATHS.consoleApp, 'sw.js'));
    const snapshot = fs.existsSync(path.join(PATHS.consoleApp, 'snapshot.json'));
    checks.push({ name: 'POL-0011 offline-console', passed: sw && snapshot, detail: `sw.js=${sw} snapshot.json=${snapshot}` });

    // POL-0003: existe al menos un checkpoint cargable (red de seguridad viva).
    const checkpoint = latestCheckpoint();
    checks.push({ name: 'POL-0003 checkpoint-available', passed: Boolean(checkpoint), detail: checkpoint ? checkpoint.id : 'no checkpoints' });

    // Prechecks instalados por la Fase 7 (control/prechecks.json), si existen.
    const prechecks = readJson(path.join(PATHS.control, 'prechecks.json'), { prechecks: [] });
    for (const precheck of prechecks.prechecks ?? []) {
      if (precheck.kind === 'zero-dependencies') {
        checks.push({ name: `precheck ${precheck.id}`, passed: deps === 0, detail: `origin: ${precheck.origin ?? '—'}` });
      } else if (precheck.kind === 'file-exists') {
        const exists = fs.existsSync(path.join(ROOT, precheck.path ?? ''));
        checks.push({ name: `precheck ${precheck.id}`, passed: exists, detail: `${precheck.path} exists=${exists}` });
      } else {
        checks.push({ name: `precheck ${precheck.id}`, passed: true, detail: `advisory rule (not machine-checkable): ${precheck.statement ?? ''}`.slice(0, 160) });
      }
    }

    const passed = checks.filter((check) => check.passed).length;
    return { verified: passed === checks.length, checks, passed, failed: checks.length - passed };
  }, { code: 'policy_verification_failed', layer: 'verification' });
}

/**
 * ES: compuerta 4 — reversibilidad: ¿hay un checkpoint cargable al que volver?
 * EN: gate 4 — reversibility: is there a loadable checkpoint to go back to?
 * PT: comporta 4 — reversibilidade: existe um checkpoint carregável?
 *
 * @param {{ checkpointId?: string|null }} [options]
 */
export function verifyReversibility(options = {}) {
  const { checkpointId = null } = options;
  return attempt(() => {
    const target = checkpointId ?? latestCheckpoint()?.id ?? null;
    if (!target) return { reversible: false, checkpoint: null, detail: 'no checkpoint exists — any mutation now would be irreversible' };
    const loaded = loadCheckpoint(target);
    const files = loaded.ok ? Object.keys(loaded.value.files ?? {}).length : 0;
    return {
      reversible: loaded.ok && files >= 4,
      checkpoint: target,
      detail: loaded.ok ? `${files} control-plane files restorable` : loaded.error.message,
    };
  }, { code: 'reversibility_verification_failed', layer: 'verification' });
}

export default { VERIFICATION_LEVELS, verifyChange, verifyAcceptance, verifyPolicies, verifyReversibility };

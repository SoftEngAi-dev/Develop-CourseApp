/* ═══════════════════════════════════════════════════════════════════════════
 * tests/evolution.test.js — VERIFICATION LEVEL: integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 7 (Autonomous Evolution) — el criterio de
 *     salida completo: "un error produce una lección y una NUEVA REGLA DE
 *     POLÍTICA que evita el mismo fallo la próxima vez". Con DB temporal y
 *     copias temporales de policies/skills/prechecks: promoteRules convierte la
 *     regla de una lección en POL-nueva con origen LES-xxxx y es IDEMPOTENTE;
 *     installPrechecks genera comprobaciones ejecutables (2 blocking mínimo)
 *     que verifyPolicies() consume; registerSkill guarda procedimientos
 *     reutilizables sin duplicar; evolutionMetrics responde is_learning con
 *     números; proposeArchitectureEvolution PROPONE sin aplicar (el documento
 *     dice requires_human_approval y las decisiones reales no cambian).
 * 🇬🇧 EN — WHAT IT TESTS: Phase 7 (Autonomous Evolution) — the full exit
 *     criterion: "an error produces a lesson and a NEW POLICY RULE preventing
 *     the same failure next time". Over a temp db and temp copies of
 *     policies/skills/prechecks: promoteRules turns a lesson rule into a new POL
 *     with LES-xxxx origin and is IDEMPOTENT; installPrechecks produces
 *     executable checks (≥2 blocking) consumed by verifyPolicies();
 *     registerSkill stores reusable procedures without duplication;
 *     evolutionMetrics answers is_learning with numbers; the architecture
 *     evolution PROPOSES without applying (requires_human_approval, real
 *     decisions untouched).
 * 🇧🇷 PT — O QUE TESTA: a Fase 7: promoteRules idempotente com origem LES,
 *     prechecks executáveis, skills sem duplicação, métricas de aprendizagem e
 *     proposta de evolução que NUNCA se auto-aplica.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • La cadena completa en un test ES/EN/PT: el test reproduce el ciclo real:
 *     INSERT de un error → su lección con future_rule → promoteRules → precheck
 *     instalado → métrica is_learning=true. Cada eslabón se afirma por separado:
 *     si uno se rompe, el nombre del assert dice cuál.
 *     The test walks the whole chain link by link: error → lesson → rule →
 *     policy → precheck → metric.
 *   • Proponer sin aplicar ES/EN/PT: el test cuenta las decisiones de la DB
 *     ANTES y DESPUÉS de la propuesta: deben ser iguales. La evolución autónoma
 *     que se auto-aplica es el camino más rápido a un proyecto incomprensible.
 *     The decision count must not change: proposing is not applying.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, closeDatabase, scalar, run as dbRun } from '../knowledge/db/index.js';
import { readJson, writeJson } from '../core/shared/json.js';
import { promoteRules, installPrechecks, registerSkill, evolutionMetrics, proposeArchitectureEvolution, EVOLUTION_CYCLE } from '../skills/index.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-evolve-'));

/** ES/EN/PT: copia temporal de las políticas reales como base de las pruebas. */
function tempPolicies(dir) {
  const file = path.join(dir, 'policies.json');
  writeJson(file, readJson(path.join(process.cwd(), 'control', 'policies.json'), null));
  return file;
}

test('phase 7: error → lesson → rule → policy → precheck (the full learning chain)', () => {
  const dir = tmp();
  const db = openDatabase({ file: path.join(dir, 'evolve.db'), reuse: false });
  const policiesFile = tempPolicies(dir);
  const prechecksFile = path.join(dir, 'prechecks.json');
  const bus = { emitted: [], emit(type, payload) { this.emitted.push({ type, payload }); } };

  try {
    // Eslabón 1-2: un error real produce una lección con regla futura.
    dbRun(db, `INSERT INTO errors (id, layer, message, analysis, recovery, lesson, severity, resolved, ts)
               VALUES ('ERR-90001', 'verification', 'tests were run before the db was migrated', 'the runner assumed a migrated db', 'migrate first, then run', 'Always migrate before verifying', 'medium', 1, ?)`, [new Date().toISOString()]);
    dbRun(db, `INSERT INTO lessons (id, source_type, source_id, lesson, future_rule, layer, created_at)
               VALUES ('LES-90001', 'error', 'ERR-90001', 'Always migrate before verifying', 'verification.migrate_before_verify=true', 'verification', ?)`, [new Date().toISOString()]);

    // Eslabón 3: promoteRules convierte la regla en política nueva.
    const promoted = promoteRules({ db, bus, policiesFile, approvedBy: 'test-operator', enforcement: 'hard' });
    assert.equal(promoted.ok, true, JSON.stringify(promoted.error ?? {}));
    assert.equal(promoted.value.promoted >= 1, true, 'the lesson rule became a policy');
    const pol = promoted.value.policies.find((policy) => policy.key === 'verification.migrate_before_verify');
    assert.ok(pol, 'our test rule was promoted');
    assert.match(pol.id, /^POL-\d{4}$/, 'policies keep the 4-digit POL id format');
    assert.equal(pol.origin, 'LES-90001', 'the policy remembers the lesson it was born from');
    assert.equal(pol.enforcement, 'hard');
    assert.equal(pol.approved_by, 'test-operator', 'human approval is recorded');

    // Idempotencia: promover de nuevo NO duplica (no se aprende dos veces).
    const again = promoteRules({ db, bus, policiesFile, approvedBy: 'test-operator' });
    assert.equal(again.ok, true);
    assert.equal(again.value.promoted, 0, 'the same lesson is never learned twice');
    const policies = readJson(policiesFile, null);
    assert.equal(policies.rules.filter((rule) => rule.key === 'verification.migrate_before_verify').length, 1);

    // Eslabón 4: installPrechecks genera comprobaciones ejecutables.
    const prechecks = installPrechecks({ policiesFile, prechecksFile, bus });
    assert.equal(prechecks.ok, true, JSON.stringify(prechecks.error ?? {}));
    assert.ok(prechecks.value.installed >= 10, 'every hard policy becomes a precheck');
    assert.ok(prechecks.value.blocking >= 2, 'at least zero-dependencies and offline-console block mutations');
    const saved = readJson(prechecksFile, null);
    assert.ok(saved.prechecks.some((precheck) => precheck.kind === 'zero-dependencies' && precheck.blocking), 'POL-0005 is machine-checkable');
    assert.ok(saved.prechecks.some((precheck) => precheck.kind === 'file-exists' && precheck.path === 'apps/console/sw.js'), 'POL-0011 checks the service worker exists');
    assert.equal(saved.consumed_by.includes('verifyPolicies'), true, 'the verifier consumes the prechecks');

    // Eslabón 5: evolutionMetrics responde con números.
    const metrics = evolutionMetrics({ db, policiesFile, prechecksFile, skillsFile: path.join(dir, 'no-skills.json') });
    assert.equal(metrics.ok, true, JSON.stringify(metrics.error ?? {}));
    assert.equal(metrics.value.is_learning, true, 'a promoted lesson + installed prechecks = the system learns');
    assert.ok(metrics.value.policies_born_from_lessons >= 1);
    assert.equal(metrics.value.lessons >= 1, true);
    assert.deepEqual(EVOLUTION_CYCLE, ['LESSON', 'RULE', 'PRECHECK', 'SKILL', 'OPTIMIZATION', 'ARCHITECTURE EVOLUTION']);
    assert.ok(bus.emitted.some((event) => event.type === 'STATE_UPDATED'), 'evolution is observable (POL-0001)');
  } finally {
    closeDatabase(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('phase 7: skills are reusable procedures, registered without duplication', () => {
  const dir = tmp();
  const skillsFile = path.join(dir, 'skills.json');
  const manifestFile = path.join(dir, 'manifest.json');
  writeJson(manifestFile, { skills: [] });

  try {
    const noSteps = registerSkill({ name: 'wishful', skillsFile, manifestFile });
    assert.equal(noSteps.ok, false, 'a skill without steps is a wish');
    assert.match(noSteps.error.message, /steps/);

    const skill = registerSkill({
      name: 'safe-release', trigger: 'before any push', skillsFile, manifestFile,
      steps: ['genesis status', 'genesis checkpoint', 'node --test tests/*.test.js'],
      verification: 'all tests pass and a fresh checkpoint exists',
      failureExamples: ['pushed without running the suite (never again)'],
    });
    assert.equal(skill.ok, true, JSON.stringify(skill.error ?? {}));
    assert.equal(skill.value.skill.steps.length, 3);

    registerSkill({ name: 'safe-release', steps: ['a', 'b'], skillsFile, manifestFile });
    const registry = readJson(skillsFile, null);
    assert.equal(registry.skills.length, 1, 're-registering updates, never duplicates');
    assert.equal(registry.skills[0].steps.length, 2, 'the newest definition wins');

    const manifest = readJson(manifestFile, null);
    assert.deepEqual(manifest.skills, ['safe-release'], 'the manifest mirrors the skill');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('phase 7: architecture evolution PROPOSES and never self-applies', () => {
  const dir = tmp();
  const db = openDatabase({ file: path.join(dir, 'propose.db'), reuse: false });
  try {
    // Dos errores repetidos en la misma capa = la señal más fuerte.
    for (const id of ['ERR-91001', 'ERR-91002']) {
      dbRun(db, `INSERT INTO errors (id, layer, message, severity, resolved, ts) VALUES (?, 'knowledge', 'FTS returned nothing', 'high', 1, ?)`, [id, new Date().toISOString()]);
    }
    const decisionsBefore = Number(scalar(db, 'SELECT COUNT(*) n FROM decisions'));

    const proposal = proposeArchitectureEvolution({ db, outDir: dir });
    assert.equal(proposal.ok, true, JSON.stringify(proposal.error ?? {}));
    assert.equal(proposal.value.requires_human_approval, true, 'the system proposes; humans approve');
    assert.match(proposal.value.proposal.status, /PROPOSED/);
    assert.match(proposal.value.proposal.decision_trace_shape.decision, /knowledge/, 'the proposal targets the layer with repeated failures');
    assert.ok(proposal.value.proposal.evidence.repeated_failure_groups.length >= 1, 'the proposal carries its evidence');

    const file = path.join(dir, 'EVOLUTION-PROPOSAL.json');
    assert.ok(fs.existsSync(file), 'the proposal is a durable generated document');
    const decisionsAfter = Number(scalar(db, 'SELECT COUNT(*) n FROM decisions'));
    assert.equal(decisionsAfter, decisionsBefore, 'proposing never mutates the real decision record');
  } finally {
    closeDatabase(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

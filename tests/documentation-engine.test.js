/* ═══════════════════════════════════════════════════════════════════════════
 * tests/documentation-engine.test.js — VERIFICATION LEVEL: integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 3 (Documentation Engine) de punta a punta sobre
 *     la base REAL y un directorio de salida TEMPORAL: los cuatro generadores
 *     producen archivos reales con datos reales (12 Decision Traces, eventos,
 *     planes, lecciones), generateAll escribe su manifiesto, y
 *     verifyDocumentation detecta DRIFT cuando falta un archivo o cuando la
 *     carpeta de decisiones no matchea la base. También prueba la idempotencia:
 *     generar dos veces produce el mismo conjunto de archivos.
 * 🇬🇧 EN — WHAT IT TESTS: Phase 3 (Documentation Engine) end to end over the
 *     REAL database and a TEMPORARY output dir: the four generators produce real
 *     files with real data, generateAll writes its manifest, verifyDocumentation
 *     detects DRIFT (missing file / decisions mismatch), and generating twice
 *     yields the same file set (idempotent).
 * 🇧🇷 PT — O QUE TESTA: a Fase 3 ponta a ponta sobre o banco REAL e um diretório
 *     TEMPORÁRIO: geradores produzem arquivos reais, o manifesto é gravado, o
 *     DRIFT é detectado e a geração é idempotente.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • outDir temporal ES/EN/PT: los generadores aceptan {outDir}. El test usa un
 *     directorio tmp para no ensuciar documentation/generated/ con cada corrida.
 *     Tests point generators at a tmp dir so runs never dirty the real docs.
 *   • Drift como contrato ES/EN/PT: "documentación consistente" NO es una
 *     opinión: es decisions_in_db === decisions_on_disk. El test rompe la
 *     igualdad a propósito (borra un archivo) y exige que el verificador lo note.
 *     Consistency is an equation, and the test breaks it on purpose.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, closeDatabase, scalar } from '../knowledge/db/index.js';
import {
  generateAll, generateArchitectureDocs, generateTimeline,
  generateDecisionDocs, generateTutorials, verifyDocumentation,
} from '../documentation/engine/index.js';

const db = openDatabase({ readOnly: true, reuse: false });
test.after(() => closeDatabase(db));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-docs-'));

test('the four generators produce real files with real data', () => {
  const dir = tmp();

  const arch = generateArchitectureDocs({ db, outDir: dir });
  assert.equal(arch.ok, true, JSON.stringify(arch.error ?? {}));
  const archContent = fs.readFileSync(path.join(dir, 'ARCHITECTURE.generated.md'), 'utf8');
  assert.match(archContent, /five data levels/i, 'architecture doc explains the levels');
  assert.match(archContent, /eleven build layers/i);
  assert.ok(arch.value.graph.nodes >= 70, 'graph stats come from the real database');

  const time = generateTimeline({ db, outDir: dir });
  assert.equal(time.ok, true);
  assert.ok(time.value.events >= 10, 'the timeline carries real observable events');

  const decisions = generateDecisionDocs({ db, outDir: dir });
  assert.equal(decisions.ok, true);
  const expected = Number(scalar(db, 'SELECT COUNT(*) AS n FROM decisions'));
  assert.equal(decisions.value.decisions, expected, 'one file per Decision Trace');
  const dec2 = fs.readFileSync(path.join(dir, 'decisions', 'DEC-00002.generated.md'), 'utf8');
  assert.match(dec2, /DECISION TRACE DEC-00002/, 'the trace renders in the official format');
  assert.match(dec2, /Provenance/, 'provenance section exists');

  const tutorials = generateTutorials({ db, outDir: dir });
  assert.equal(tutorials.ok, true);
  const tut = fs.readFileSync(path.join(dir, 'TUTORIALS.generated.md'), 'utf8');
  assert.match(tut, /Tutorial 1/, 'plans become tutorials');
  assert.match(tut, /lessons/i, 'lessons become pitfalls');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('generateAll writes the manifest and reports consistency', () => {
  const dir = tmp();
  const result = generateAll({ db, outDir: dir });
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}));

  assert.ok(result.value.files.length >= 15, 'index + 12 traces + timeline + tutorials + architecture');
  assert.ok(fs.existsSync(path.join(dir, 'doc-manifest.json')), 'the manifest is written');
  assert.equal(result.value.verification.consistent, true, `drift: ${JSON.stringify(result.value.verification.drift)}`);

  // ES: idempotencia — generar de nuevo produce el mismo conjunto de archivos.
  // EN: idempotency — generating again yields the same file set.
  // PT: idempotência — gerar de novo produz o mesmo conjunto.
  const second = generateAll({ db, outDir: dir });
  assert.equal(second.ok, true);
  assert.deepEqual(second.value.files, result.value.files, 'same input, same documents');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('verifyDocumentation detects drift when docs no longer match the database', () => {
  const dir = tmp();
  const generated = generateAll({ db, outDir: dir });
  assert.equal(generated.ok, true);

  // ES: borramos UN archivo de decisión → la ecuación decisions_in_db ===
  //     decisions_on_disk se rompe y el verificador DEBE notarlo.
  // EN: delete ONE decision file → the equation breaks and the verifier MUST notice.
  // PT: apagamos UM arquivo de decisão → o verificador DEVE perceber.
  fs.rmSync(path.join(dir, 'decisions', 'DEC-00002.generated.md'));
  const drifted = verifyDocumentation({ db, outDir: dir });
  assert.equal(drifted.ok, true);
  assert.equal(drifted.value.consistent, false, 'missing decision file is drift');
  assert.ok(drifted.value.drift.some((d) => /decision docs out of date/.test(d)));

  fs.rmSync(path.join(dir, 'TIMELINE.generated.md'));
  const worse = verifyDocumentation({ db, outDir: dir });
  assert.ok(worse.value.drift.some((d) => /missing: TIMELINE/.test(d)), 'missing top-level file is drift too');

  fs.rmSync(dir, { recursive: true, force: true });
});

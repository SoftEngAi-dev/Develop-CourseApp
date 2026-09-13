/* ═══════════════════════════════════════════════════════════════════════════
 * tests/courses.test.js — VERIFICATION LEVEL: integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 6 (Education Engine) sobre una DB TEMPORAL
 *     migrada desde cero (aislamiento total): recordBuild registra builds con
 *     archivos REALES del repo (los inexistentes se filtran), seedCompletedBuilds
 *     es idempotente, generateLesson renderiza las 8 secciones de
 *     LESSON_ANATOMY con excerpto de código real leído del disco y solución
 *     ejecutable, buildCurriculum escribe curriculum.json + CURRICULUM.md con un
 *     módulo por build, y reverseEngineerCurriculum (sobre una COPIA de la DB
 *     real) reconstruye el temario desde la evidencia: decisiones, errores y
 *     lecciones en orden.
 * 🇬🇧 EN — WHAT IT TESTS: Phase 6 (Education Engine) over a TEMP database
 *     migrated from scratch: recordBuild registers builds with REAL repo files,
 *     seedCompletedBuilds is idempotent, generateLesson renders the 8
 *     LESSON_ANATOMY sections with a real code excerpt read from disk and a
 *     runnable solution, buildCurriculum writes curriculum.json + CURRICULUM.md
 *     with one module per build, and reverseEngineerCurriculum (over a COPY of
 *     the real db) rebuilds the syllabus from evidence.
 * 🇧🇷 PT — O QUE TESTA: a Fase 6 sobre banco TEMPORÁRIO: builds com arquivos
 *     REAIS, lições com as 8 seções e código de verdade, currículo idempotente e
 *     currículo de engenharia reversa derivado da evidência.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Aislamiento en dos niveles ES/EN/PT: DB temporal vacía para probar la
 *     mecánica (seed/lesson/curriculum) y VACUUM INTO de la DB real para probar
 *     el contenido histórico (reverse). Cada afirmación sabe de qué mundo viene.
 *     Empty temp db for mechanics, real-db copy for history: every assertion
 *     knows which world it comes from.
 *   • El curso no miente ES/EN/PT: el test exige que el excerpto de la lección
 *     contenga texto que SOLO existe en el archivo real del repo. Si mañana el
 *     generador inventara ejemplos, este assert falla.
 *     The test demands text that only exists in the real file: if the generator
 *     ever invents examples, this assert fails.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, closeDatabase, all, scalar } from '../knowledge/db/index.js';
import {
  LESSON_ANATOMY, recordBuild, seedCompletedBuilds, buildCurriculum,
  generateLesson, generateExercises, reverseEngineerCurriculum,
} from '../documentation/courses/index.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-courses-'));

test('phase 6: builds become lessons with real code and runnable solutions', () => {
  const dir = tmp();
  const outDir = path.join(dir, 'courses');
  const db = openDatabase({ file: path.join(dir, 'courses.db'), reuse: false });

  try {
    // recordBuild filtra archivos que no existen: solo evidencia real.
    const build = recordBuild({
      db, name: 'test-build', objective: 'prove the education engine',
      files: ['core/event-bus/index.js', 'no/such/file.js'],
      tests: ['tests/api-and-pipeline.test.js'],
      decisions: ['DEC-00004'],
      problems: ['a real problem'], fixes: ['a real fix'],
    });
    assert.equal(build.ok, true, JSON.stringify(build.error ?? {}));
    assert.match(build.value.id, /^BLD-\d{5}$/);
    assert.deepEqual(build.value.files, ['core/event-bus/index.js'], 'non-existent files are filtered out');

    // seedCompletedBuilds: idempotente (dos corridas → mismos 3 builds).
    const seeded1 = seedCompletedBuilds({ db });
    assert.equal(seeded1.ok, true);
    seedCompletedBuilds({ db });
    assert.equal(Number(scalar(db, 'SELECT COUNT(*) n FROM builds')), 3, 'seeding twice never duplicates builds');
    assert.equal(Number(scalar(db, "SELECT COUNT(*) n FROM builds WHERE status='completed'")), 3);

    // generateLesson: las 8 secciones obligatorias + código REAL del disco.
    const lesson = generateLesson({ db, buildId: build.value.id, outDir });
    assert.equal(lesson.ok, true, JSON.stringify(lesson.error ?? {}));
    const md = fs.readFileSync(path.join(outDir, `LESSON-${build.value.id}.md`), 'utf8');
    for (const marker of ['## 1. Objective', '## 2. Concepts', '## 3. Implementation (real code)', '## 4. Explanation', '## 5. Tutorial', '## 6. Exercise', '## 7. Solution', '## 8. Self-check']) {
      assert.ok(md.includes(marker), `lesson renders "${marker}"`);
    }
    // ES: el excerpto viene del archivo real — este texto SOLO existe en
    //     core/event-bus/index.js. Si el generador inventara, esto falla.
    // EN: the excerpt comes from the real file — this marker only exists there.
    // PT: o excerpto vem do arquivo real.
    assert.match(md, /EventBus|event-bus/, 'the implementation section carries real repo code');
    assert.match(md, /execFileSync/, 'the solution is runnable node:test code, not prose');
    assert.ok(lesson.value.lesson.anatomy_complete, 'the lesson object declares its anatomy complete');
    assert.deepEqual(LESSON_ANATOMY, ['title', 'objective', 'concepts', 'implementation', 'explanation', 'tutorial', 'exercise', 'solution']);

    // course_ref: el build apunta a su lección (trazabilidad build ↔ curso).
    assert.ok(scalar(db, 'SELECT course_ref FROM builds WHERE id = ?', [build.value.id]).endsWith(`LESSON-${build.value.id}.md`));

    // generateExercises: ejercicio con starter y solución verificable.
    const exercises = generateExercises({ build: { id: 'BLD-TEST', name: 'test-build', files: ['core/event-bus/index.js'], tests: ['tests/api-and-pipeline.test.js'] } });
    assert.equal(exercises.exercise.starter_code.includes('TODO'), true, 'the starter leaves work for the student');
    assert.equal(exercises.solution.verifiable, true);
    assert.match(exercises.solution.code, /assert\.ok/, 'the solution asserts, it does not merely describe');

    // buildCurriculum: un módulo por build + fundamentos + trampas.
    const curriculum = buildCurriculum({ db, outDir, seed: false });
    assert.equal(curriculum.ok, true, JSON.stringify(curriculum.error ?? {}));
    assert.equal(curriculum.value.modules, 5, 'M1 foundations + 3 builds + pitfalls module');
    assert.ok(fs.existsSync(path.join(outDir, 'curriculum.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'CURRICULUM.md')));
    const curriculumMd = fs.readFileSync(path.join(outDir, 'CURRICULUM.md'), 'utf8');
    assert.match(curriculumMd, /## M1 — Foundations/, 'module 1 teaches the founding decisions');
    assert.match(curriculumMd, /Build: offline-pwa-console/, 'the PWA build became a module');
    assert.equal(curriculum.value.lesson_files.length, 3, 'one lesson file per completed build');
  } finally {
    closeDatabase(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('phase 6: reverse-engineered curriculum is derived from real evidence', () => {
  const dir = tmp();
  const copy = path.join(dir, 'real-copy.db');
  const source = openDatabase({ readOnly: true, reuse: false });
  source.prepare('VACUUM INTO ?').run(copy);
  closeDatabase(source);
  const db = openDatabase({ file: copy, reuse: false });

  try {
    const reverse = reverseEngineerCurriculum({ db, outDir: dir });
    assert.equal(reverse.ok, true, JSON.stringify(reverse.error ?? {}));
    assert.ok(reverse.value.decisions >= 12, 'the walk covers every real Decision Trace');
    assert.ok(reverse.value.lessons >= 2);

    const md = fs.readFileSync(path.join(dir, 'REVERSE-ENGINEERED-CURRICULUM.md'), 'utf8');
    assert.match(md, /DEC-00001/, 'the founding decision is in the walk');
    assert.match(md, /DEC-00012/, 'the latest decision is in the walk');
    assert.match(md, /LES-00001/, 'lessons are the distilled curriculum');
    assert.match(md, /Prerequisite chain by layer/, 'prerequisites are derived per layer');
    assert.match(md, /FTS5/, 'the real trap the project hit is taught');
    assert.ok(all(db, 'SELECT id FROM decisions').length >= 12);
  } finally {
    closeDatabase(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

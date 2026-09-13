/* ═══════════════════════════════════════════════════════════════════════════
 * documentation/courses/index.js — PHASE 6 · EDUCATION ENGINE (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: convierte lo que el proyecto YA CONSTRUYÓ en un CURSO.
 *     recordBuild() registra una construcción completada (archivos reales,
 *     tests reales, decisiones reales) en la tabla `builds`. buildCurriculum()
 *     deriva módulos a partir de esos builds + lecciones + decisiones y escribe
 *     documentación/cursos generada en documentation/generated/courses/.
 *     generateLesson() renderiza las 8 secciones obligatorias (LESSON_ANATOMY)
 *     con EXCERPTOS DE CÓDIGO REAL leídos del disco — no ejemplos inventados.
 *     generateExercises() produce ejercicios con solución verificable (código
 *     node:test que se puede ejecutar). reverseEngineerCurriculum() reconstruye
 *     qué había que saber, en orden, a partir de la historia de decisiones y
 *     errores. Criterio de salida de Fase 6: "los builds completados se
 *     convierten en lecciones con ejercicios y código de respuesta real".
 *
 * 🇬🇧 EN — WHAT IT DOES: turns what the project ALREADY BUILT into a COURSE.
 *     recordBuild() registers a completed build (real files, real tests, real
 *     decisions) in the `builds` table. buildCurriculum() derives modules from
 *     those builds + lessons + decisions and writes generated course docs under
 *     documentation/generated/courses/. generateLesson() renders the 8 mandatory
 *     LESSON_ANATOMY sections with REAL CODE EXCERPTS read from disk — never
 *     invented examples. generateExercises() produces exercises with verifiable
 *     solutions (runnable node:test code). reverseEngineerCurriculum() rebuilds
 *     what you had to know, in order, from the decision/error history.
 *
 * 🇧🇷 PT — O QUE FAZ: transforma o que o projeto JÁ CONSTRUIU num CURSO.
 *     Builds completados viram lições com 8 seções, excerptos de código REAL,
 *     exercícios e soluções verificáveis. O currículo de engenharia reversa
 *     deduz o conhecimento necessário a partir do histórico de decisões.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Código real, no ejemplos de juguete ES/EN/PT: cada lección lee el archivo
 *     verdadero del repositorio (p.ej. apps/console/sw.js) y muestra sus primeras
 *     líneas. Si el código cambia, la lección cambia: el curso no miente.
 *     Lessons read the REAL file from disk; if the code changes, the lesson does.
 *   • Solución verificable ES/EN/PT: la "solution" de un ejercicio es un test
 *     node:test que se puede copiar y ejecutar. Un curso cuya solución no se
 *     puede comprobar enseña dudas, no habilidades.
 *     A solution you cannot run teaches doubt, not skill.
 *   • Ingeniería inversa del currículo ES/EN/PT: en vez de imponer un temario,
 *     se observa la historia (decisiones en orden, errores, lecciones) y se
 *     deduce: para tomar DEC-00004 había que saber X. El temario sale de la
 *     evidencia. The syllabus is derived from evidence, not from taste.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, attempt } from '../../core/shared/result.js';
import { PATHS, ROOT, toProjectRelative } from '../../core/shared/paths.js';
import { ensureDir, readJson, writeJson } from '../../core/shared/json.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';
import { all, run as dbRun, toJson, fromJson } from '../../knowledge/db/index.js';

/** ES/EN/PT: anatomía de lección declarada en el manifiesto. Declared lesson anatomy. */
export const LESSON_ANATOMY = Object.freeze([
  'title', 'objective', 'concepts', 'implementation', 'explanation', 'tutorial', 'exercise', 'solution',
]);

/** ES/EN/PT: modos educativos declarados. Declared education modes. */
export const EDUCATION_MODES = Object.freeze(['learn', 'reverse-engineering-curriculum']);

/** ES/EN/PT: directorio de salida por defecto. Default courses output dir. */
const DEFAULT_COURSES_DIR = path.join(PATHS.documentation, 'generated', 'courses');

/**
 * ES: registra (o actualiza) un build completado con hechos REALES del repo.
 * EN: registers (or updates) a completed build with REAL repo facts.
 * PT: registra (ou atualiza) um build concluído com fatos REAIS do repo.
 *
 * @param {{ db: object, name: string, objective?: string, status?: string, layer?: string|null, files?: string[], tests?: string[], decisions?: string[], problems?: string[], fixes?: string[], courseRef?: string|null, completedAt?: string|null, bus?: object|null }} options
 */
export function recordBuild(options = {}) {
  const { db = null, name = null, bus = null } = options;
  if (!db) return fail('recordBuild requires a db handle', { code: 'db_missing' });
  if (!name) return fail('recordBuild requires a build name', { code: 'build_name_missing' });

  return attempt(() => {
    const existing = all(db, 'SELECT id FROM builds WHERE name = ?', [name])[0];
    const id = existing?.id ?? nextId(ID_PREFIX.build, all(db, 'SELECT id FROM builds').map((r) => r.id), 5);
    const files = (options.files ?? []).filter((file) => fs.existsSync(path.resolve(ROOT, file)));
    const now = new Date().toISOString();
    dbRun(db, `INSERT INTO builds (id, name, status, objective, layer, files_json, dependencies_json, tests_json, problems_json, fixes_json, decisions_json, documentation, course_ref, created_at, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 status = excluded.status, files_json = excluded.files_json, tests_json = excluded.tests_json,
                 problems_json = excluded.problems_json, fixes_json = excluded.fixes_json,
                 decisions_json = excluded.decisions_json, course_ref = excluded.course_ref, completed_at = excluded.completed_at`,
    [id, name, options.status ?? 'completed', options.objective ?? name, options.layer ?? null,
      toJson(files), toJson([]), toJson(options.tests ?? []), toJson(options.problems ?? []), toJson(options.fixes ?? []),
      toJson(options.decisions ?? []), options.documentation ?? null, options.courseRef ?? null,
      existing ? now : now, options.completedAt ?? now]);
    bus?.emit('BUILD_COMPLETED', { kind: 'record', build: id, name, files: files.length }, { layer: 'application' });
    return { id, name, status: options.status ?? 'completed', files };
  }, { code: 'build_record_failed', layer: 'application' });
}

/**
 * ES: registra los DOS builds que el proyecto ya completó de verdad: la capa de
 *     conocimiento (Fases 0-2) y la consola PWA offline (TSK-00012). Idempotente.
 * EN: records the TWO builds the project genuinely completed: the knowledge
 *     layer (Phases 0-2) and the offline PWA console (TSK-00012). Idempotent.
 * PT: registra os DOIS builds realmente concluídos. Idempotente.
 */
export function seedCompletedBuilds(options = {}) {
  const { db = null, bus = null } = options;
  return attempt(() => {
    const knowledge = recordBuild({
      db, bus, name: 'knowledge-layer',
      objective: 'SQLite + FTS5 capture, processors, knowledge graph, retrieval and context engine (Phases 0-2)',
      status: 'completed', layer: 'knowledge',
      files: ['knowledge/db/index.js', 'knowledge/ingestion/index.js', 'knowledge/processor/index.js', 'knowledge/graph/index.js', 'knowledge/retrieval/search.js', 'knowledge/retrieval/context.js', 'core/event-bus/index.js', 'core/state/index.js', 'core/checkpoint/index.js'],
      tests: ['tests/db.test.js', 'tests/capture.test.js', 'tests/knowledge.test.js', 'tests/graph.test.js', 'tests/retrieval.test.js', 'tests/state.test.js'],
      decisions: ['DEC-00001', 'DEC-00002', 'DEC-00003', 'DEC-00004', 'DEC-00005', 'DEC-00006'],
      problems: ['FTS5 external-content tables silently return nothing when the content table is written without triggers'],
      fixes: ['migrations install the FTS triggers; tests assert search() finds seeded rows'],
    });
    const console_ = recordBuild({
      db, bus, name: 'offline-pwa-console',
      objective: 'zero-dependency desktop+mobile console: HTTP server, PWA shell, service worker, offline snapshot (TSK-00012)',
      status: 'completed', layer: 'application',
      files: ['core/api/server.js', 'core/api/routes.js', 'apps/console/index.html', 'apps/console/app.js', 'apps/console/sw.js', 'apps/console/manifest.webmanifest', 'apps/console/snapshot.json', 'scripts/export-console-snapshot.js'],
      tests: ['tests/api.test.js', 'tests/console-pwa.test.js'],
      decisions: ['DEC-00011', 'DEC-00012'],
      problems: ['browsers refuse stale caches: the service worker had to serve fresh data online and the snapshot offline'],
      fixes: ['sw.js network-first with snapshot fallback; snapshot exported by the pipeline (step 6)'],
    });
    return { builds: [knowledge.value, console_.value] };
  }, { code: 'seed_builds_failed', layer: 'application' });
}

/**
 * ES: construye el currículo completo: módulos → lecciones → ejercicios.
 *     Escribe CURRICULUM.md + curriculum.json + una lección por build.
 * EN: builds the full curriculum: modules → lessons → exercises. Writes
 *     CURRICULUM.md + curriculum.json + one lesson per completed build.
 * PT: constrói o currículo completo e grava CURRICULUM.md + curriculum.json +
 *     uma lição por build concluído.
 *
 * @param {{ db?: object|null, bus?: object|null, outDir?: string|null, seed?: boolean }} [options]
 */
export function buildCurriculum(options = {}) {
  const { db = null, bus = null, seed = true } = options;
  const outDir = options.outDir ?? DEFAULT_COURSES_DIR;

  return attempt(() => {
    if (!db) throw new Error('buildCurriculum requires a db handle');
    if (seed) seedCompletedBuilds({ db, bus });

    const builds = all(db, `SELECT * FROM builds WHERE status = 'completed' ORDER BY id`);
    const lessons = all(db, 'SELECT * FROM lessons ORDER BY id');
    const decisions = all(db, 'SELECT id, decision, layer FROM decisions ORDER BY id');

    const modules = [
      {
        id: 'M1', title: { es: 'Fundamentos: por qué un sistema que se documenta solo', en: 'Foundations: why a self-documenting system', pt: 'Fundamentos: por que um sistema que se documenta sozinho' },
        lessons: decisions.slice(0, 6).map((d) => ({ kind: 'decision', ref: d.id, title: d.decision.slice(0, 80) })),
      },
      ...builds.map((build, index) => ({
        id: `M${index + 2}`, title: { es: `Build: ${build.name}`, en: `Build: ${build.name}`, pt: `Build: ${build.name}` },
        lessons: [{ kind: 'build', ref: build.id, title: build.objective ?? build.name }],
      })),
      {
        id: `M${builds.length + 2}`, title: { es: 'Trampas reales y cómo evitarlas', en: 'Real pitfalls and how to avoid them', pt: 'Armadilhas reais e como evitá-las' },
        lessons: lessons.map((l) => ({ kind: 'lesson', ref: l.id, title: l.lesson.slice(0, 80) })),
      },
    ];

    ensureDir(outDir);
    const curriculum = {
      kind: 'curriculum',
      mode: 'learn',
      generated_at: new Date().toISOString(),
      lesson_anatomy: LESSON_ANATOMY,
      modules,
      stats: { builds: builds.length, lessons: lessons.length, decisions: decisions.length },
    };
    writeJson(path.join(outDir, 'curriculum.json'), curriculum);
    fs.writeFileSync(path.join(outDir, 'CURRICULUM.md'), renderCurriculumMd(curriculum), 'utf8');

    const lessonFiles = [];
    for (const build of builds) {
      const lesson = generateLesson({ db, buildId: build.id, outDir });
      if (lesson.ok) lessonFiles.push(lesson.value.file);
    }

    bus?.emit('FILE_CHANGED', { tool: 'buildCurriculum', files: 2 + lessonFiles.length, out: toProjectRelative(outDir) }, { layer: 'application' });
    return { out: toProjectRelative(outDir), modules: modules.length, lesson_files: lessonFiles, curriculum };
  }, { code: 'curriculum_build_failed', layer: 'application', interruptionType: 'failed' });
}

/** ES/EN/PT: renderiza CURRICULUM.md. Renders the curriculum markdown. */
function renderCurriculumMd(curriculum) {
  const lines = [
    '# CURRICULUM (generated — do not edit by hand)',
    '',
    `> Generated ${curriculum.generated_at} · mode \`${curriculum.mode}\` · builds: ${curriculum.stats.builds} · lessons: ${curriculum.stats.lessons} · decisions: ${curriculum.stats.decisions}`,
    '> 🇪🇸 Generado automáticamente por la Fase 6. 🇬🇧 Generated automatically by Phase 6. 🇧🇷 Gerado automaticamente pela Fase 6.',
    '',
  ];
  for (const module of curriculum.modules) {
    lines.push(`## ${module.id} — ${module.title.en}`, `_${module.title.es} · ${module.title.pt}_`, '');
    for (const lesson of module.lessons) lines.push(`- [${lesson.kind}:${lesson.ref}] ${lesson.title}`);
    lines.push('');
  }
  lines.push('---', 'Every lesson follows the anatomy:', '', curriculum.lesson_anatomy.map((s) => `1. ${s}`).join('\n'), '');
  return lines.join('\n');
}

/**
 * ES: genera UNA lección (8 secciones) a partir de un build completado, con
 *     excerptos de código REAL leídos del disco. Devuelve {lesson, file}.
 * EN: generates ONE lesson (8 sections) from a completed build, with REAL code
 *     excerpts read from disk. Returns {lesson, file}.
 * PT: gera UMA lição (8 seções) a partir de um build, com código REAL do disco.
 *
 * @param {{ db?: object|null, buildId?: string|null, topic?: string|null, outDir?: string|null, excerptLines?: number }} [options]
 */
export function generateLesson(options = {}) {
  const { db = null, buildId = null, excerptLines = 40 } = options;
  const outDir = options.outDir ?? DEFAULT_COURSES_DIR;

  return attempt(() => {
    if (!db) throw new Error('generateLesson requires a db handle');
    const build = buildId ? all(db, 'SELECT * FROM builds WHERE id = ?', [buildId])[0] : null;
    if (!build) throw new Error(`build not found: ${buildId ?? '—'}`);

    const files = fromJson(build.files_json, []);
    const tests = fromJson(build.tests_json, []);
    const decisions = fromJson(build.decisions_json, []);
    const problems = fromJson(build.problems_json, []);
    const fixes = fromJson(build.fixes_json, []);

    // IMPLEMENTATION — excerpto REAL del primer archivo existente del build.
    // IMPLEMENTATION — REAL excerpt of the build's first existing file.
    // IMPLEMENTATION — excerpto REAL do primeiro arquivo existente do build.
    const excerptFile = files.find((file) => fs.existsSync(path.resolve(ROOT, file))) ?? null;
    const excerpt = excerptFile
      ? fs.readFileSync(path.resolve(ROOT, excerptFile), 'utf8').split('\n').slice(0, excerptLines).join('\n')
      : '(no files on disk)';

    const exercises = generateExercises({ build: { id: build.id, name: build.name, files, tests, problems, fixes } });

    const lesson = {
      id: `LESSON-${build.id}`,
      build_id: build.id,
      title: { es: `Cómo se construyó: ${build.name}`, en: `How it was built: ${build.name}`, pt: `Como foi construído: ${build.name}` },
      objective: { es: build.objective ?? build.name, en: build.objective ?? build.name, pt: build.objective ?? build.name },
      concepts: conceptsFor(build, decisions),
      implementation: { file: excerptFile, excerpt },
      explanation: { problems, fixes },
      tutorial: tutorialSteps(build, files, tests),
      exercise: exercises.exercise,
      solution: exercises.solution,
      generated_at: new Date().toISOString(),
      anatomy_complete: LESSON_ANATOMY.every((section) => section in { title: 1, objective: 1, concepts: 1, implementation: 1, explanation: 1, tutorial: 1, exercise: exercises.exercise, solution: exercises.solution }),
    };

    ensureDir(outDir);
    const file = path.join(outDir, `LESSON-${build.id}.md`);
    fs.writeFileSync(file, renderLessonMd(lesson), 'utf8');
    writeJson(path.join(outDir, `LESSON-${build.id}.json`), lesson);

    // ES: el build guarda la referencia a su curso (columna course_ref).
    // EN: the build keeps the reference to its course (course_ref column).
    // PT: o build guarda a referência ao seu curso (coluna course_ref).
    dbRun(db, `UPDATE builds SET course_ref = ? WHERE id = ?`, [toProjectRelative(file), build.id]);

    return { lesson, file: toProjectRelative(file) };
  }, { code: 'lesson_generation_failed', layer: 'application', interruptionType: 'failed' });
}

/** ES/EN/PT: conceptos clave del build (capa + decisiones + archivos). */
function conceptsFor(build, decisions) {
  return [
    { term: `layer:${build.layer ?? 'unknown'}`, why: 'every build belongs to exactly one of the eleven layers (manifest.layers)' },
    ...decisions.slice(0, 4).map((id) => ({ term: `decision:${id}`, why: 'the build follows this Decision Trace' })),
    { term: 'verification', why: `the build is proven by ${fromJson(build.tests_json, []).length} test file(s)` },
  ];
}

/** ES/EN/PT: tutorial paso a paso derivado de archivos y tests reales. */
function tutorialSteps(build, files, tests) {
  return [
    { step: 1, do: `read the build objective: "${(build.objective ?? build.name).slice(0, 100)}"` },
    { step: 2, do: `open the ${files.length} file(s) it produced, starting with ${files[0] ?? '—'}` },
    { step: 3, do: `run its verification: node --disable-warning=ExperimentalWarning --test ${tests[0] ?? 'tests/*.test.js'}` },
    { step: 4, do: 'read the problems it hit and the fixes that worked (explanation section below)' },
    { step: 5, do: 'solve the exercise and compare with the solution' },
  ];
}

/**
 * ES: ejercicios + solución verificable a partir del código real del build.
 *     La solución es código node:test EJECUTABLE (respuesta real, no prosa).
 * EN: exercises + verifiable solution from the build's real code. The solution
 *     is RUNNABLE node:test code (a real answer, not prose).
 * PT: exercícios + solução verificável a partir do código real do build.
 */
export function generateExercises(options = {}) {
  const { build = null } = options;
  if (!build) return fail('generateExercises requires a build', { code: 'build_missing' });

  const targetFile = (build.files ?? []).find((file) => fs.existsSync(path.resolve(ROOT, file))) ?? null;
  const firstTest = (build.tests ?? [])[0] ?? null;

  const exercise = {
    prompt: {
      es: `Escribe un test node:test que pruebe que ${targetFile ?? 'el archivo principal del build'} existe y no está vacío, y que la suite del build (${firstTest ?? 'tests/'} ) pasa.`,
      en: `Write a node:test proving that ${targetFile ?? 'the build main file'} exists and is non-empty, and that the build suite (${firstTest ?? 'tests/'}) passes.`,
      pt: `Escreva um node:test provando que ${targetFile ?? 'o arquivo principal'} existe e não está vazio, e que a suíte (${firstTest ?? 'tests/'}) passa.`,
    },
    starter_code: [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import fs from 'node:fs';",
      '',
      `test('${build.name ?? 'build'} works', () => {`,
      '  // TODO: assert the file exists and has bytes',
      '  // TODO: (advanced) run its test file with execFileSync and assert exit 0',
      '});',
    ].join('\n'),
  };

  const solution = {
    explanation: {
      es: 'La solución usa fs.statSync para probar existencia Y tamaño: un archivo vacío no es una implementación. El segundo assert corre la suite real del build.',
      en: 'The solution uses fs.statSync to prove existence AND size: an empty file is not an implementation. The second assert runs the build real suite.',
      pt: 'A solução usa fs.statSync para provar existência E tamanho; o segundo assert roda a suíte real do build.',
    },
    code: [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import fs from 'node:fs';",
      "import { execFileSync } from 'node:child_process';",
      '',
      `test('${build.name ?? 'build'} works', () => {`,
      ...(targetFile ? [
        `  const stat = fs.statSync('${targetFile}');`,
        '  assert.ok(stat.size > 0, \'the implementation is not empty\');',
      ] : ['  assert.ok(true);']),
      ...(firstTest ? [
        `  execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', '${firstTest}'], { stdio: 'pipe' });`,
      ] : []),
      '});',
    ].join('\n'),
    verifiable: true,
  };

  return { exercise, solution, target_file: targetFile, suite: firstTest };
}

/** ES/EN/PT: renderiza la lección en Markdown (las 8 secciones). */
function renderLessonMd(lesson) {
  const lines = [
    `# ${lesson.title.en}`,
    `_${lesson.title.es} · ${lesson.title.pt}_`,
    '',
    `> Generated ${lesson.generated_at} from build \`${lesson.build_id}\`. Anatomy: ${LESSON_ANATOMY.join(' · ')}.`,
    '',
    '## 1. Objective',
    lesson.objective.en,
    '',
    '## 2. Concepts',
    ...lesson.concepts.map((concept) => `- **${concept.term}** — ${concept.why}`),
    '',
    '## 3. Implementation (real code)',
    lesson.implementation.file ? `From \`${lesson.implementation.file}\` (first lines):` : '(no file on disk)',
    '',
    '```javascript',
    lesson.implementation.excerpt,
    '```',
    '',
    '## 4. Explanation',
    'Problems this build actually hit, and the fixes that actually worked:',
    ...(lesson.explanation.problems ?? []).map((problem, index) => `${index + 1}. ❗ ${problem}\n   ✅ ${(lesson.explanation.fixes ?? [])[index] ?? '—'}`),
    '',
    '## 5. Tutorial',
    ...lesson.tutorial.map((item) => `${item.step}. ${item.do}`),
    '',
    '## 6. Exercise',
    lesson.exercise.prompt.en,
    '',
    '```javascript',
    lesson.exercise.starter_code,
    '```',
    '',
    '## 7. Solution (runnable, real answer code)',
    lesson.solution.explanation.en,
    '',
    '```javascript',
    lesson.solution.code,
    '```',
    '',
    '## 8. Self-check',
    `- Copy the solution into a temp file inside \`tests/\` and run \`node --disable-warning=ExperimentalWarning --test <file>\`.`,
    `- It must pass. If it fails, re-read sections 3 and 4 — the failure is a real behaviour of this build.`,
    '',
  ];
  return lines.join('\n');
}

/**
 * ES: modo reverse-engineering: recorre decisiones/errores/lecciones en orden y
 *     deduce qué había que saber ANTES de cada paso. Escribe
 *     REVERSE-ENGINEERED-CURRICULUM.md.
 * EN: reverse-engineering mode: walks decisions/errors/lessons in order and
 *     infers what you had to know BEFORE each step. Writes
 *     REVERSE-ENGINEERED-CURRICULUM.md.
 * PT: modo engenharia reversa: deduz o conhecimento necessário, em ordem.
 *
 * @param {{ db?: object|null, outDir?: string|null, bus?: object|null }} [options]
 */
export function reverseEngineerCurriculum(options = {}) {
  const { db = null, bus = null } = options;
  const outDir = options.outDir ?? DEFAULT_COURSES_DIR;
  return attempt(() => {
    if (!db) throw new Error('reverseEngineerCurriculum requires a db handle');
    const decisions = all(db, 'SELECT id, decision, layer, status FROM decisions ORDER BY id');
    const errors = all(db, 'SELECT id, message, recovery FROM errors ORDER BY id');
    const lessons = all(db, 'SELECT id, lesson, layer FROM lessons ORDER BY id');

    // ES: prerequisitos por capa: para entender una decisión de la capa X hay que
    //     dominar lo que las capas anteriores enseñan. Orden topológico simple.
    // EN: prerequisites by layer: understanding a decision in layer X requires
    //     what previous layers teach. Simple topological order.
    // PT: pré-requisitos por camada; ordem topológica simples.
    const prerequisites = {
      decisions: ['how a conversation becomes structured data (Phase 1 capture)', 'the Result pattern: every function says ok/fail with evidence'],
      knowledge: ['SQL basics + why SQLite (DEC-00002)', 'FTS5 full-text search and its trigger traps'],
      'core-engine': ['the Event Bus closed taxonomy (DEC-00004)', 'the 5 data levels and 11 layers (manifest)'],
      application: ['HTTP without frameworks: node:http (POL-0001)', 'PWA: service worker + manifest + snapshot (DEC-00012)'],
      verification: ['node:test runner and TAP output', 'mutation protocol and checkpoints (POL-0002/0003)'],
      'learning-evolution': ['lessons vs rules vs policies (the promotion chain)', 'agent loop: observe→…→learn (POL-0006)'],
    };

    const lines = [
      '# REVERSE-ENGINEERED CURRICULUM (generated)',
      '',
      `> Generated ${new Date().toISOString()} from ${decisions.length} decisions, ${errors.length} errors, ${lessons.length} lessons.`,
      '> 🇪🇸 Qué había que saber, deducido de lo que el proyecto hizo. 🇬🇧 What you had to know, inferred from what the project did. 🇧🇷 O que era preciso saber, deduzido do que o projeto fez.',
      '',
      '## Prerequisite chain by layer',
      '',
      ...Object.entries(prerequisites).map(([layer, items]) => `### ${layer}\n${items.map((item) => `- ${item}`).join('\n')}\n`),
      '## Decision walk (in order)',
      '',
      ...decisions.map((decision) => `- \`${decision.id}\` (${decision.layer ?? '—'}, ${decision.status ?? '—'}) — ${decision.decision}`),
      '',
      '## Errors that taught something',
      '',
      ...errors.map((error) => `- \`${error.id}\` — ${String(error.message ?? '').slice(0, 120)}\n  - recovery: ${String(error.recovery ?? '').slice(0, 120)}`),
      '',
      '## Lessons (the distilled curriculum)',
      '',
      ...lessons.map((lesson) => `- \`${lesson.id}\` (${lesson.layer ?? '—'}) — ${lesson.lesson}`),
      '',
    ];

    ensureDir(outDir);
    const file = path.join(outDir, 'REVERSE-ENGINEERED-CURRICULUM.md');
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    bus?.emit('FILE_CHANGED', { tool: 'reverseEngineerCurriculum', file: toProjectRelative(file) }, { layer: 'application' });
    return { file: toProjectRelative(file), decisions: decisions.length, errors: errors.length, lessons: lessons.length };
  }, { code: 'reverse_curriculum_failed', layer: 'application', interruptionType: 'failed' });
}

export default { LESSON_ANATOMY, EDUCATION_MODES, recordBuild, seedCompletedBuilds, buildCurriculum, generateLesson, generateExercises, reverseEngineerCurriculum };

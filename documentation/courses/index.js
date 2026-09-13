/* ═══════════════════════════════════════════════════════════════════════════
 * documentation/courses/index.js — PHASE 6 · EDUCATION ENGINE (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: convertir el proyecto en un CURSO. Dos modos declarados en
 *     control/manifest.json → education.modes:
 *       – learn                       (aprender el proyecto desde cero)
 *       – reverse-engineering-curriculum
 *         (reconstruir el currículo a partir de lo que el proyecto YA hizo)
 *     Anatomía obligatoria de cada lección (education.lesson_anatomy):
 *       title · objective · concepts · implementation · explanation ·
 *       tutorial · exercise · solution
 *     Y la política de comentarios (education.comment_policy) que YA se cumple
 *     en todo el código escrito: cabecera trilingüe ES/EN/PT + bloque
 *     BEGINNER COURSE en cada archivo.
 *     ESTADO: ESQUELETO (DEC-00009).
 *     QUÉ SÍ EXISTE: el material pedagógico ya está dentro del código — cada
 *     módulo explica sus conceptos como si el lector nunca hubiera programado.
 *     Falta el generador que lo ordene en lecciones, ejercicios y soluciones.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: turn the project into a COURSE. Two modes declared in
 *     control/manifest.json → education.modes:
 *       – learn                       (learn the project from scratch)
 *       – reverse-engineering-curriculum
 *         (rebuild the curriculum from what the project ALREADY did)
 *     Mandatory anatomy of every lesson (education.lesson_anatomy):
 *       title · objective · concepts · implementation · explanation ·
 *       tutorial · exercise · solution
 *     And the comment policy (education.comment_policy) ALREADY honoured by every
 *     file written so far: trilingual ES/EN/PT header + BEGINNER COURSE block.
 *     STATUS: SKELETON (DEC-00009).
 *     WHAT ALREADY EXISTS: the pedagogical material is inside the code — every
 *     module explains its concepts as if the reader had never programmed before.
 *     What is missing is the generator that orders it into lessons, exercises and
 *     solutions.
 *
 * 🇧🇷 PT — O QUE FARÁ: transformar o projeto num CURSO. Dois modos: learn e
 *     reverse-engineering-curriculum. Anatomia obrigatória da lição: title ·
 *     objective · concepts · implementation · explanation · tutorial · exercise ·
 *     solution. ESTADO: ESQUELETO (DEC-00009). O material pedagógico já está nos
 *     comentários trilingues de cada módulo.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Currículo por ingeniería inversa ES/EN/PT: en vez de inventar un temario,
 *     se OBSERVA lo que el proyecto hizo (decisiones, búsquedas, errores,
 *     lecciones) y de ahí se deduce qué había que saber para hacerlo. El temario
 *     sale de la evidencia, no de la opinión.
 *     Derive the syllabus from what the project actually did, not from taste.
 *   • Por qué el ejercicio va con la solución ES/EN/PT: un ejercicio sin solución
 *     verificable genera frustración y abandono. La solución permite autocomprobarse,
 *     que es justo lo que hace un buen curso. Every exercise ships its solution.
 *   • Trilingüe de verdad ES/EN/PT: no es traducir al final. Los campos
 *     `{es, en, pt}` se guardan JUNTO al dato (ver docs/GLOSSARY.md), así ninguna
 *     lengua es "la copia". Trilingual is a data model, not a translation step.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../../core/shared/stub.js';

const MODULE = 'documentation/courses/index.js';
const SPEC = 'documentation/courses/SPEC.md';
const PHASE = 'phase-6';
const TASK = 'TSK-00009';

/** ES/EN/PT: anatomía de lección declarada en el manifiesto. Declared lesson anatomy. */
export const LESSON_ANATOMY = Object.freeze([
  'title', 'objective', 'concepts', 'implementation', 'explanation', 'tutorial', 'exercise', 'solution',
]);

/** ES/EN/PT: modos educativos declarados. Declared education modes. */
export const EDUCATION_MODES = Object.freeze(['learn', 'reverse-engineering-curriculum']);

/** ES: genera el currículo completo a partir del conocimiento del proyecto. */
export function buildCurriculum(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'derive a full curriculum (modules → lessons → exercises) from the knowledge base',
    available: 'the raw material is already queryable: `genesis decisions`, `genesis search <term>`, memory/lessons → lessonMemory(), and the BEGINNER COURSE block inside every source file.',
    lesson_anatomy: LESSON_ANATOMY,
    details_requested: Object.keys(options),
  });
}

/** ES: genera UNA lección con las 8 secciones obligatorias. */
export function generateLesson(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'render one lesson with all 8 mandatory sections in es/en/pt',
    available: 'docs/GLOSSARY.md already models the trilingual concept table the lessons will reuse.',
    details_requested: Object.keys(options),
  });
}

/** ES: genera ejercicios + soluciones verificables a partir de código real. */
export function generateExercises(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'generate exercises with machine-checkable solutions from real project code',
    available: 'tests/ already shows the pattern: assertions that prove a behaviour. Exercises will reuse that runner (`node --test`).',
    details_requested: Object.keys(options),
  });
}

/** ES: modo reverse-engineering — reconstruye qué había que saber para llegar aquí. */
export function reverseEngineerCurriculum(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'walk the decision/error/lesson history backwards and infer the prerequisite knowledge',
    available: 'the history exists and is complete for Phases 0-2: 11 Decision Traces, 4 plans, 1 error with its full ERROR→ANALYSIS→RECOVERY→LESSON cycle, 2 lessons, 1 search with provenance.',
    details_requested: Object.keys(options),
  });
}

export default { LESSON_ANATOMY, EDUCATION_MODES, buildCurriculum, generateLesson, generateExercises, reverseEngineerCurriculum };

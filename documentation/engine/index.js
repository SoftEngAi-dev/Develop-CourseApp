/* ═══════════════════════════════════════════════════════════════════════════
 * documentation/engine/index.js — PHASE 3 · DOCUMENTATION ENGINE (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: generar documentación Markdown SIN que nadie la pida.
 *     Cuatro generadores: (1) arquitectura, (2) línea de tiempo, (3) trazas de
 *     decisión y (4) tutoriales/curso. Todos leen del Knowledge Engine (Fase 2)
 *     y escriben en documentation/generated.
 *     ESTADO: ESQUELETO. Las funciones existen con su firma real y devuelven
 *     `notImplemented(...)`. No hay implementación porque el alcance acordado es
 *     "esqueleto de las 8 fases + Fases 0-2 ejecutables" (DEC-00009).
 *     QUÉ SÍ PUEDES USAR HOY: `genesis resume` (Context Engine, Fase 2) ya
 *     produce el texto de contexto y su versión Markdown para pegar en un chat.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: generate Markdown documentation WITHOUT being asked.
 *     Four generators: (1) architecture, (2) timeline, (3) decision traces and
 *     (4) tutorials/course. All read from the Knowledge Engine (Phase 2) and
 *     write into documentation/generated.
 *     STATUS: SKELETON. Functions exist with their real signature and return
 *     `notImplemented(...)`. No implementation, because the agreed scope is
 *     "skeleton of all 8 phases + Phases 0-2 executable" (DEC-00009).
 *     WHAT YOU CAN USE TODAY: `genesis resume` (Context Engine, Phase 2) already
 *     produces the context text and its Markdown version to paste into a chat.
 *
 * 🇧🇷 PT — O QUE FARÁ: gerar documentação Markdown SEM que ninguém peça. Quatro
 *     geradores: arquitetura, linha do tempo, trilhas de decisão e tutoriais.
 *     ESTADO: ESQUELETO. As funções existem com assinatura real e devolvem
 *     `notImplemented(...)` (DEC-00009).
 *     O QUE JÁ FUNCIONA: `genesis resume` produz o contexto e sua versão Markdown.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • "Documentación por diseño" ES/EN/PT: la documentación NO es un paso final
 *     que se olvida. Aquí es un subproducto automático de datos que ya existen
 *     (decisiones, eventos, tareas). Si un dato no está en la base, no puede
 *     documentarse: por eso la Fase 2 se construyó antes que la Fase 3.
 *     Documentation is a by-product of data that already exists, not a final step.
 *   • Por qué firmar funciones que no hacen nada ES/EN/PT: la firma ES el
 *     contrato. Cuando la Fase 3 se implemente, quien la llame (CLI, API, tests)
 *     no cambiará ni una línea. Adelantar el contrato ahorra refactorizaciones.
 *     The signature is the contract; implementing later changes no caller.
 *   • Generadores deterministas ES/EN/PT: la documentación se REGENERA, no se
 *     edita a mano. Si alguien corrige un .md generado, el arreglo se pierde en
 *     la siguiente generación. La fuente de verdad es la base, no el Markdown.
 *     Generated docs are regenerated, never hand-edited: the DB is the truth.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../../core/shared/stub.js';

const MODULE = 'documentation/engine/index.js';
const SPEC = 'documentation/SPEC.md';
const PHASE = 'phase-3';
const TASK = 'TSK-00006';

/**
 * ES: genera TODA la documentación (arquitectura + timeline + decisiones + tutoriales).
 * EN: generates ALL documentation (architecture + timeline + decisions + tutorials).
 * PT: gera TODA a documentação.
 *
 * @param {object} [options]
 * @param {object} [options.db] manejador de la base de conocimiento
 * @param {string} [options.outDir='documentation/generated']
 * @param {string[]} [options.formats=['markdown','json']]
 * @param {string[]} [options.languages=['es','en','pt']]
 * @returns {{ok:false,error:object}} siempre `not_implemented` en esta fase
 */
export function generateAll(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'generate the whole documentation set (architecture, timeline, decision traces, tutorials)',
    available: 'knowledge/retrieval/context.js → renderContextMarkdown() already renders the session context as Markdown; `genesis resume` prints it.',
    details_requested: Object.keys(options),
  });
}

/**
 * ES: documentación de arquitectura: niveles, capas, pipeline, módulos, dependencias.
 * EN: architecture documentation: levels, layers, pipeline, modules, dependencies.
 * PT: documentação de arquitetura: níveis, camadas, pipeline, módulos, dependências.
 */
export function generateArchitectureDocs(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'render architecture documentation from control/manifest.json + the knowledge graph',
    available: '`genesis graph` prints node/edge statistics; /api/manifest exposes levels, layers and pipeline as JSON; docs/ARCHITECTURE.md is the hand-written version.',
    details_requested: Object.keys(options),
  });
}

/**
 * ES: línea de tiempo legible del proyecto (día → eventos → decisiones → entregas).
 * EN: readable project timeline (day → events → decisions → deliveries).
 * PT: linha do tempo legível do projeto.
 */
export function generateTimeline(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'render the project timeline as Markdown',
    available: 'knowledge/retrieval/search.js → timeline() already groups events by day as JSON; `genesis timeline` prints it in the terminal.',
    details_requested: Object.keys(options),
  });
}

/**
 * ES: un documento por Decision Trace, con su procedencia (búsqueda → fuentes → decisión).
 * EN: one document per Decision Trace, with its provenance (search → sources → decision).
 * PT: um documento por Trilha de Decisão, com sua procedência.
 */
export function generateDecisionDocs(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'render every Decision Trace as a standalone Markdown document with provenance',
    available: 'knowledge/processor/decisions.js → renderDecisionTrace() renders ONE trace as text; `genesis decisions --why <term>` answers "why did we choose X"; docs/DECISIONS.md lists all 11 seeded decisions.',
    details_requested: Object.keys(options),
  });
}

/**
 * ES: tutoriales generados a partir de lo que el proyecto ya hizo (Fase 6 los convertirá en curso).
 * EN: tutorials generated from what the project already did (Phase 6 turns them into a course).
 * PT: tutoriais gerados a partir do que o projeto já fez.
 */
export function generateTutorials(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'turn plans, searches and lessons into step-by-step tutorials',
    available: 'the pedagogical material already exists inside the code: every module carries a trilingual header and a BEGINNER COURSE block (see docs/CONVENTIONS.md).',
    details_requested: Object.keys(options),
  });
}

/**
 * ES: comprueba que la documentación generada siga siendo fiel a la base de conocimiento.
 * EN: checks that generated documentation is still faithful to the knowledge base.
 * PT: verifica se a documentação gerada continua fiel à base de conhecimento.
 */
export function verifyDocumentation(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'detect documentation drift (docs that no longer match the database)',
    available: 'core/validation/schema.js validates the control plane JSON files today.',
    details_requested: Object.keys(options),
  });
}

export default {
  generateAll, generateArchitectureDocs, generateTimeline,
  generateDecisionDocs, generateTutorials, verifyDocumentation,
};

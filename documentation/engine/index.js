/* ═══════════════════════════════════════════════════════════════════════════
 * documentation/engine/index.js — PHASE 3 · DOCUMENTATION ENGINE (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: convierte el conocimiento almacenado (Fase 2) en
 *     documentación legible SIN que nadie la pida. Cuatro generadores
 *     deterministas que leen de la base y del plano de control y escriben
 *     Markdown + JSON en documentation/generated/:
 *       1. generateArchitectureDocs — niveles, capas, pipeline, roadmap, grafo
 *       2. generateTimeline         — historia observable agrupada por día
 *       3. generateDecisionDocs     — un archivo por Decision Trace + índice,
 *                                     con su cadena de procedencia (búsquedas)
 *       4. generateTutorials        — planes, búsquedas y lecciones → how-tos
 *     generateAll() ejecuta todo y escribe doc-manifest.json;
 *     verifyDocumentation() detecta DRIFT: docs que ya no matchean la base.
 *     Se ejecuta automáticamente al final de `npm run pipeline` (paso "docs").
 *
 * 🇬🇧 EN — WHAT IT DOES: turns stored knowledge (Phase 2) into human-readable
 *     documentation WITHOUT being asked. Four deterministic generators read the
 *     database + control plane and write Markdown/JSON into
 *     documentation/generated/. generateAll() runs everything and writes
 *     doc-manifest.json; verifyDocumentation() detects drift between docs and
 *     database. Wired into `npm run pipeline` as the final "docs" step.
 *
 * 🇧🇷 PT — O QUE FAZ: converte o conhecimento armazenado (Fase 2) em
 *     documentação legível SEM que ninguém peça. Quatro geradores determinísticos
 *     escrevem Markdown/JSON em documentation/generated/. generateAll() roda tudo;
 *     verifyDocumentation() detecta drift. Integrado ao `npm run pipeline`.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • "Documentación por diseño" ES/EN/PT: la documentación NO es un paso final
 *     que se olvida. Aquí es un subproducto automático de datos que ya existen
 *     (decisiones, eventos, tareas). Si un dato no está en la base, no puede
 *     documentarse: por eso la Fase 2 se construyó antes que la Fase 3.
 *     Documentation is a byproduct of data that already exists, not a chore.
 *   • Generadores deterministas ES/EN/PT: misma base → mismos documentos. Nada de
 *     "redactar de nuevo cada vez": los .generated.md se REGENERAN enteros y se
 *     pueden diffear en git. Si alguien edita a mano un archivo generado, el
 *     arreglo se pierde en la siguiente generación — la fuente de verdad es la
 *     base, no el Markdown. Same input → same output, always.
 *   • Drift ES/EN/PT: la documentación miente cuando la base crece y los docs no.
 *     verifyDocumentation() compara conteos (decisiones en DB vs archivos .md) y
 *     devuelve la lista de desvíos. Un doc que no se puede verificar es un doc
 *     que ya está muerto. Docs you cannot verify are docs already lying.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { PATHS, toProjectRelative } from '../../core/shared/paths.js';
import { attempt } from '../../core/shared/result.js';
import { ensureDir, readJson, writeJson } from '../../core/shared/json.js';
import { openDatabase, all, get, fromJson } from '../../knowledge/db/index.js';
import { timeline } from '../../knowledge/retrieval/search.js';
import { graphStats } from '../../knowledge/graph/index.js';
import { provenanceChain } from '../../knowledge/processor/searches.js';
import { renderDecisionTrace, loadDecision } from '../../knowledge/processor/decisions.js';
import { loadRoadmap, loadTasks, loadState, summarize } from '../../core/state/index.js';

const MODULE = 'documentation/engine/index.js';

/** ES/EN/PT: directorio por defecto de salida (declarado en control/manifest.json). */
function generatedDir(options = {}) {
  return options.outDir ?? path.join(PATHS.root, 'documentation', 'generated');
}

/** ES/EN/PT: escribe un archivo y devuelve su ruta relativa + bytes. */
function write(outDir, name, content) {
  const file = path.join(outDir, name);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
  return { file: toProjectRelative(file), bytes: Buffer.byteLength(content) };
}

/* ══════════════════════ 1) ARQUITECTURA ══════════════════════ */

/**
 * ES: documentación de arquitectura: niveles, capas, pipeline, roadmap, grafo y
 *     progreso — todo leído del plano de control y de la base (nunca inventado).
 * EN: architecture documentation: levels, layers, pipeline, roadmap, graph and
 *     progress — all read from the control plane and the DB (never invented).
 * PT: documentação de arquitetura lida do plano de controle e do banco.
 *
 * @param {{ db?: object, outDir?: string, bus?: object }} [options]
 * @returns {import('../../core/shared/result.js').Result}
 */
export function generateArchitectureDocs(options = {}) {
  const { bus = null } = options;
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    const manifest = readJson(PATHS.manifest, {});
    const arch = manifest?.architecture ?? {};
    const roadmap = loadRoadmap().value ?? { phases: [] };
    const tasks = loadTasks().value ?? { tasks: [] };
    const state = loadState().value ?? {};
    const summary = summarize(state, tasks);
    const graph = graphStats(db);

    const lines = [
      '# GENESIS — Architecture (auto-generated)',
      '',
      '> 🤖 Generated by `documentation/engine/index.js` — do not edit by hand.',
      `> Source of truth: control/manifest.json + control/roadmap.json + knowledge graph (${graph.nodes} nodes / ${graph.edges} edges).`,
      '',
      `**Central rule:** ${manifest?.project?.central_rule ?? '—'}`,
      '',
      `**Progress:** ${summary.progress_percent ?? 0}% · phase ${summary.current_phase ?? '—'} · task ${summary.current_task?.id ?? '—'}`,
      '',
      '## The five data levels',
      '',
      '| Level | Id | Path | Purpose |',
      '| --- | --- | --- | --- |',
      ...(arch.levels ?? []).map((l) => `| ${l.level} | ${l.id} | \`${l.path}\` | ${l.purpose} |`),
      '',
      '## The eleven build layers',
      '',
      ...(arch.layers ?? []).map((l) => `- **${l.layer}. ${l.id}**`),
      '',
      '## The pipeline',
      '',
      (arch.pipeline ?? []).map((stage, i) => `${i + 1}. \`${stage}\``).join('\n'),
      '',
      '## Roadmap',
      '',
      '| Phase | Name | Weight | Status |',
      '| --- | --- | --- | --- |',
      ...(roadmap.phases ?? []).map((p) => `| ${p.id} | ${p.name} | ${p.weight}% | ${p.status} |`),
      '',
      '## Knowledge graph hubs',
      '',
      '| Node | Kind | Degree |',
      '| --- | --- | --- |',
      ...(graph.hubs ?? []).map((h) => `| ${h.label} | ${h.kind} | ${h.degree} |`),
      '',
      `Node kinds: ${Object.entries(graph.by_kind ?? {}).map(([k, n]) => `${k} (${n})`).join(', ') || '—'}`,
      '',
    ];

    const md = write(outDir, 'ARCHITECTURE.generated.md', lines.join('\n'));
    const json = write(outDir, 'architecture.generated.json', JSON.stringify({
      generated_at: new Date().toISOString(),
      levels: arch.levels ?? [], layers: arch.layers ?? [], pipeline: arch.pipeline ?? [],
      roadmap: roadmap.phases ?? [], graph: { nodes: graph.nodes, edges: graph.edges, by_kind: graph.by_kind ?? {} },
      progress_percent: summary.progress_percent ?? 0,
    }, null, 2));
    bus?.emit('FILE_CHANGED', { tool: 'documentation-engine', files: [md.file, json.file] }, { layer: 'documentation' });
    return { generated: [md, json], graph: { nodes: graph.nodes, edges: graph.edges } };
  }, { code: 'docs_architecture_failed', layer: 'documentation' });
}

/* ══════════════════════ 2) LÍNEA DE TIEMPO ══════════════════════ */

/**
 * ES: línea de tiempo legible: día → eventos → decisiones → entregas.
 * EN: readable timeline: day → events → decisions → deliveries.
 * PT: linha do tempo legível: dia → eventos → decisões → entregas.
 *
 * @param {{ db?: object, outDir?: string, from?: string, to?: string, granularity?: 'day', limit?: number, bus?: object }} [options]
 */
export function generateTimeline(options = {}) {
  const { bus = null, from = null, to = null, limit = 1000 } = options;
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    const data = timeline({ db, limit, since: from, until: to });

    const lines = [
      '# GENESIS — Project timeline (auto-generated)',
      '',
      '> 🤖 Generated by `documentation/engine/index.js` — every observable event, grouped by day.',
      '',
      `Total: **${data.count}** events across **${data.days.length}** day(s).`,
      '',
    ];
    for (const day of data.days) {
      lines.push(`## ${day}`, '');
      const byType = {};
      for (const event of data.by_day[day] ?? []) byType[event.type] = (byType[event.type] ?? 0) + 1;
      lines.push(Object.entries(byType).map(([type, n]) => `- \`${type}\` × ${n}`).join('\n'), '');
      for (const event of (data.by_day[day] ?? []).slice(-12)) {
        const summary = JSON.stringify(event.payload ?? {}).slice(0, 120);
        lines.push(`  - ${String(event.ts ?? '').slice(11, 19)} **${event.type}** ${summary}`);
      }
      lines.push('');
    }

    const md = write(outDir, 'TIMELINE.generated.md', lines.join('\n'));
    bus?.emit('FILE_CHANGED', { tool: 'documentation-engine', files: [md.file] }, { layer: 'documentation' });
    return { generated: [md], events: data.count, days: data.days.length };
  }, { code: 'docs_timeline_failed', layer: 'documentation' });
}

/* ══════════════════════ 3) DECISION TRACES ══════════════════════ */

/**
 * ES: un Markdown por Decision Trace (con procedencia: búsquedas y fuentes que la
 *     alimentaron) + índice general. Formato idéntico al de la sección 4 del spec.
 * EN: one Markdown per Decision Trace (with provenance: the searches and sources
 *     that fed it) + a global index. Same format as section 4 of the spec.
 * PT: um Markdown por Decision Trace (com procedência) + índice geral.
 *
 * @param {{ db?: object, outDir?: string, languages?: string[], bus?: object }} [options]
 */
export function generateDecisionDocs(options = {}) {
  const { bus = null, languages = ['en'] } = options;
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    const rows = all(db, 'SELECT id, layer, status, decision, created_at FROM decisions ORDER BY id');
    const files = [];
    const index = [
      '# GENESIS — Decision Traces (auto-generated)',
      '',
      '> 🤖 Generated by `documentation/engine/index.js` — one file per trace, with provenance.',
      '',
      '| Id | Layer | Status | Decision |',
      '| --- | --- | --- | --- |',
    ];

    for (const row of rows) {
      const decision = loadDecision(db, row.id);
      if (!decision) continue;
      const chain = provenanceChain(db, row.id);
      const body = [
        `# ${row.id} — Decision Trace`,
        '',
        '```text',
        renderDecisionTrace(decision, languages[0] ?? 'en'),
        '```',
        '',
        '## Provenance (searches that informed this decision)',
        '',
        (chain?.searches ?? []).length
          ? (chain.searches ?? []).map((s) => `- **${s.id}** "${s.query}" → selected: ${s.selected ?? '—'} · sources: ${(s.sources ?? []).join(', ') || '—'}`).join('\n')
          : '- none recorded',
        '',
        (chain?.sources ?? []).length ? `All sources: ${chain.sources.join(' · ')}` : '',
      ].filter(Boolean).join('\n');
      files.push(write(outDir, `decisions/${row.id}.generated.md`, body));
      index.push(`| [${row.id}](decisions/${row.id}.generated.md) | ${row.layer ?? '—'} | ${row.status ?? '—'} | ${String(row.decision ?? '').replace(/\|/g, '\\|').slice(0, 90)} |`);
    }

    index.push('', `Total: **${files.length}** decision trace(s).`, '');
    const md = write(outDir, 'DECISIONS.generated.md', index.join('\n'));
    bus?.emit('FILE_CHANGED', { tool: 'documentation-engine', files: [md.file, ...files.map((f) => f.file)] }, { layer: 'documentation' });
    return { generated: [md, ...files], decisions: files.length };
  }, { code: 'docs_decisions_failed', layer: 'documentation' });
}

/* ══════════════════════ 4) TUTORIALES ══════════════════════ */

/**
 * ES: convierte planes, búsquedas y lecciones en tutoriales paso a paso: cómo se
 *     planifica, cómo se investiga y qué errores ya se pagaron (lecciones).
 * EN: turns plans, searches and lessons into step-by-step tutorials: how this
 *     project plans, how it researches, which mistakes were already paid for.
 * PT: transforma planos, buscas e lições em tutoriais passo a passo.
 *
 * @param {{ db?: object, outDir?: string, audience?: string, bus?: object }} [options]
 */
export function generateTutorials(options = {}) {
  const { bus = null, audience = 'beginner' } = options;
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    const plans = all(db, 'SELECT id, objective, steps_json, status FROM plans ORDER BY id');
    const searches = all(db, 'SELECT id, query, reason, selected, why, sources_json FROM searches ORDER BY id');
    const lessons = all(db, 'SELECT id, lesson, future_rule FROM lessons ORDER BY id');

    const lines = [
      '# GENESIS — Tutorials (auto-generated)',
      '',
      `> 🤖 Generated for audience: **${audience}**. Real plans, real searches, real lessons.`,
      '',
      '## Tutorial 1 — How this project plans work',
      '',
      ...plans.flatMap((plan) => {
        const steps = fromJson(plan.steps_json, []);
        return [
          `### ${plan.id} · ${plan.objective}`,
          '',
          ...(Array.isArray(steps) && steps.length
            ? steps.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : (s.action ?? s.step ?? JSON.stringify(s))}`)
            : ['1. (no steps recorded)']),
          '',
        ];
      }),
      '## Tutorial 2 — How this project researches before deciding',
      '',
      ...searches.map((s) => `- **${s.query}** — why: ${s.reason ?? '—'} → chose: ${s.selected ?? '—'} (${s.why ?? '—'})`),
      '',
      '## Tutorial 3 — Mistakes already paid for (lessons → rules)',
      '',
      ...lessons.map((l) => `- **${l.lesson}**${l.future_rule ? ` → rule: \`${l.future_rule}\`` : ''}`),
      '',
    ];

    const md = write(outDir, 'TUTORIALS.generated.md', lines.join('\n'));
    bus?.emit('FILE_CHANGED', { tool: 'documentation-engine', files: [md.file] }, { layer: 'documentation' });
    return { generated: [md], plans: plans.length, searches: searches.length, lessons: lessons.length };
  }, { code: 'docs_tutorials_failed', layer: 'documentation' });
}

/* ══════════════════════ ORQUESTADOR + VERIFICACIÓN ══════════════════════ */

/**
 * ES: genera TODO el set de documentación y su manifiesto. Es el paso final de
 *     `npm run pipeline`: la documentación ocurre sin que nadie la pida.
 * EN: generates the WHOLE documentation set plus its manifest. Final step of
 *     `npm run pipeline`: documentation happens without being asked.
 * PT: gera TODO o conjunto de documentação e seu manifesto.
 *
 * @param {{ db?: object, outDir?: string, formats?: string[], languages?: string[], bus?: object }} [options]
 */
export function generateAll(options = {}) {
  const { bus = null } = options;
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    ensureDir(outDir);
    bus?.emit('BUILD_STARTED', { kind: 'documentation' }, { layer: 'documentation' });

    const results = {
      architecture: generateArchitectureDocs({ ...options, db, outDir, bus }),
      timeline: generateTimeline({ ...options, db, outDir, bus }),
      decisions: generateDecisionDocs({ ...options, db, outDir, bus }),
      tutorials: generateTutorials({ ...options, db, outDir, bus }),
    };
    const failedStep = Object.entries(results).find(([, r]) => !r.ok);
    if (failedStep) throw new Error(`${failedStep[0]}: ${failedStep[1].error.message}`);

    const verification = verifyDocumentation({ db, outDir });
    const manifest = {
      generated_at: new Date().toISOString(),
      generator: MODULE,
      formats: options.formats ?? ['markdown', 'json'],
      languages: options.languages ?? ['en'],
      files: Object.values(results).flatMap((r) => r.value.generated.map((g) => g.file)),
      counts: {
        decisions: results.decisions.value.decisions,
        events: results.timeline.value.events,
        plans: results.tutorials.value.plans,
        lessons: results.tutorials.value.lessons,
      },
      verification: verification.ok ? verification.value : { consistent: false, error: verification.error },
    };
    write(outDir, 'doc-manifest.json', JSON.stringify(manifest, null, 2));
    bus?.emit('BUILD_COMPLETED', { kind: 'documentation', files: manifest.files.length }, { layer: 'documentation' });
    return manifest;
  }, { code: 'docs_generate_all_failed', layer: 'documentation' });
}

/**
 * ES: detecta DRIFT: ¿la documentación generada sigue matcheando la base?
 *     Compara existencia de archivos y conteos (decisiones DB vs archivos).
 * EN: drift detection: do generated docs still match the database? Compares file
 *     existence and counts (DB decisions vs generated files).
 * PT: detecta DRIFT entre a documentação gerada e o banco.
 *
 * @param {{ db?: object, outDir?: string }} [options]
 */
export function verifyDocumentation(options = {}) {
  const outDir = generatedDir(options);
  return attempt(() => {
    const db = options.db ?? openDatabase();
    const drift = [];
    const expect = (file) => {
      if (!fs.existsSync(path.join(outDir, file))) drift.push(`missing: ${file}`);
    };
    expect('ARCHITECTURE.generated.md');
    expect('TIMELINE.generated.md');
    expect('DECISIONS.generated.md');
    expect('TUTORIALS.generated.md');
    /*
     * ES: doc-manifest.json NO se exige aquí: lo escribe generateAll() DESPUÉS de
     *     verificar (el manifiesto registra el resultado de esta verificación).
     *     Exigirlo antes crearía un huevo-y-gallina: nunca podría ser consistente.
     * EN: doc-manifest.json is NOT required here: generateAll() writes it AFTER
     *     verifying (the manifest records this verification's result). Requiring it
     *     beforehand would be a chicken-and-egg: never consistent on first run.
     * PT: doc-manifest.json NÃO é exigido aqui: é gravado DEPOIS da verificação.
     */

    const decisionsInDb = Number(get(db, 'SELECT COUNT(*) AS n FROM decisions')?.n ?? 0);
    const decisionsDir = path.join(outDir, 'decisions');
    const decisionsOnDisk = fs.existsSync(decisionsDir)
      ? fs.readdirSync(decisionsDir).filter((n) => n.endsWith('.generated.md')).length
      : 0;
    if (decisionsInDb !== decisionsOnDisk) {
      drift.push(`decision docs out of date: database has ${decisionsInDb}, generated folder has ${decisionsOnDisk}`);
    }

    return { consistent: drift.length === 0, drift, decisions_in_db: decisionsInDb, decisions_on_disk: decisionsOnDisk };
  }, { code: 'docs_verify_failed', layer: 'documentation' });
}

export default {
  generateAll, generateArchitectureDocs, generateTimeline,
  generateDecisionDocs, generateTutorials, verifyDocumentation,
};

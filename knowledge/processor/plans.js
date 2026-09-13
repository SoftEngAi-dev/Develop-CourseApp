/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/plans.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: detecta PLANES en el texto (sección 3.C de la
 *     arquitectura): objetivo, pasos ordenados, dependencias y riesgos.
 *     Reconoce listas numeradas bajo títulos tipo "Plan", "Fase 2", "Roadmap",
 *     "Pasos", "Steps", "Etapas".
 *     POR QUÉ EXISTE: un plan escrito en prosa se olvida; un plan en la base de
 *     datos se puede comparar con lo que realmente se ejecutó. Esa diferencia
 *     (plan vs acciones) es exactamente lo que permite evaluar si el agente
 *     cumple lo que promete.
 *
 * 🇬🇧 EN — WHAT IT DOES: detects PLANS in text (architecture section 3.C):
 *     objective, ordered steps, dependencies and risks. It recognizes numbered
 *     lists under titles like "Plan", "Phase 2", "Roadmap", "Steps".
 *     WHY IT EXISTS: a plan written in prose is forgotten; a plan in the database
 *     can be compared with what was actually executed. That gap (plan vs
 *     actions) is precisely what lets us evaluate whether the agent delivers
 *     what it promises.
 *
 * 🇧🇷 PT — O QUE FAZ: detecta PLANOS no texto (seção 3.C da arquitetura):
 *     objetivo, passos ordenados, dependências e riscos. Reconhece listas
 *     numeradas sob títulos como "Plano", "Fase 2", "Roadmap", "Etapas".
 *     POR QUE EXISTE: um plano escrito em prosa é esquecido; um plano no banco
 *     pode ser comparado com o que realmente foi executado. Essa diferença
 *     (plano vs ações) é o que permite avaliar se o agente cumpre o que promete.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Lookahead en regex `(?=\n#{1,6}\s|$)` ES/EN/PT: "mira lo que viene pero no
 *     lo consumas". Nos sirve para cortar un bloque justo ANTES del siguiente
 *     título, sin borrar ese título.
 *     Lookahead inspects what comes next without consuming it.
 *   • Array ordenado ES/EN/PT: en un plan, el ORDEN de los pasos es información.
 *     Por eso guardamos un array (que conserva orden) y no un Set (que no).
 *     Order matters in a plan, so we keep an array, not a Set.
 *   • Estado del plan ES/EN/PT: proposed → approved → in_progress → done /
 *     abandoned. Guardar el estado permite saber qué planes quedaron en el aire.
 *     Storing plan status reveals plans that were left hanging.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, toJson, indexEntity } from '../db/index.js';
import { normalizeText } from '../../core/capture/message-parser.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

const PLAN_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:plan(?:es|ificación|ificacion|ejamento)?|fase\s+\d+|phase\s+\d+|etapa\s+\d+|roadmap|hoja de ruta|pasos|steps|pr[oó]ximas acciones|next actions)\b\s*(?:\d*\s*)?(?:[-—:]\s*)?(?<title>.*)$/i;
const STEP_LINE = /^\s*(?:(?<num>\d{1,3})[.)\-]|[-*•>])\s+(?<text>.{3,300}?)\s*$/;
const DEPENDENCY_LINE = /\bdepend(?:e|encia|encies|ency|ências)\b\s*(?:de|on|:)?\s*(?<deps>[^\n]{2,160})/i;
const RISK_LINE = /\b(?:riesgo|risk|risco|peligro|danger|cuidado|warning)\b\s*(?:[:\-]\s*)?(?<risk>[^\n]{2,200})/i;

/**
 * ES: extrae planes de un texto. Cada plan = título + pasos + dependencias + riesgos.
 * EN: extracts plans from a text. Each plan = title + steps + dependencies + risks.
 * PT: extrai planos de um texto. Cada plano = título + passos + dependências + riscos.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function extractPlans(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const headings = [];
  let match;
  const re = new RegExp(PLAN_HEADING.source, 'gim');
  while ((match = re.exec(normalized)) !== null) {
    const title = (match.groups?.title ?? '').replace(/\*\*/g, '').trim();
    // ES: exigimos que el título no sea una frase larguísima (sería prosa, no plan).
    // EN: we require the title not to be a very long sentence (that is prose, not a plan).
    // PT: exigimos que o título não seja uma frase longuíssima (seria prosa, não plano).
    if (title.length > 90) continue;
    headings.push({ index: match.index, end: re.lastIndex, title });
  }
  if (!headings.length) return [];

  const plans = [];
  headings.forEach((heading, position) => {
    const stop = headings[position + 1]?.index ?? normalized.length;
    const block = normalized.slice(heading.end, stop);
    const lines = block.split('\n');

    const steps = [];
    const dependencies = [];
    const risks = [];

    for (const line of lines) {
      const stepMatch = STEP_LINE.exec(line);
      if (stepMatch) {
        const stepText = stepMatch.groups.text.replace(/\*\*/g, '').replace(/```/g, '').trim();
        if (stepText.length >= 3 && steps.length < 60) {
          steps.push({ order: steps.length + 1, text: stepText, done: /\b(listo|done|completed|hecho|✓|feito)\b/i.test(stepText) });
        }
      }
      const depMatch = DEPENDENCY_LINE.exec(line);
      if (depMatch) {
        dependencies.push(...depMatch.groups.deps.split(/,|;|\sy\s/).map((d) => d.trim()).filter((d) => d.length > 1));
      }
      const riskMatch = RISK_LINE.exec(line);
      if (riskMatch) risks.push(riskMatch.groups.risk.trim());
    }

    if (steps.length < 1) return;

    const doneCount = steps.filter((s) => s.done).length;
    plans.push({
      id: null,
      objective: heading.title || steps[0].text,
      steps,
      dependencies: [...new Set(dependencies)].slice(0, 20),
      risks: [...new Set(risks)].slice(0, 20),
      status: doneCount === steps.length ? 'done' : doneCount > 0 ? 'in_progress' : 'proposed',
      step_count: steps.length,
      source_excerpt: block.trim().slice(0, 800),
    });
  });

  return plans;
}

/**
 * ES: guarda planes en la base asignando PLN-##### y los indexa para búsqueda.
 * EN: stores plans in the DB assigning PLN-##### and indexes them for search.
 * PT: guarda planos no banco atribuindo PLN-##### e os indexa para busca.
 */
export function persistPlans(plans, options = {}) {
  const { bus = null, sessionId = null, task = null, layer = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(plans) || !plans.length) return { persisted: 0, ids: [] };

  // ES: ⚠️ IDEMPOTENCIA CORREGIDA: los planes no tienen ID explícito en el texto,
  //     así que se duplicaban en cada reprocesado. Ahora comparamos objetivo +
  //     número de pasos + texto del primer paso: si coincide, actualizamos.
  // EN: ⚠️ IDEMPOTENCY FIXED: plans carry no explicit ID in the text, so they were
  //     duplicated on every reprocess. We now compare objective + step count +
  //     first step text: on a match we update instead of inserting.
  // PT: ⚠️ IDEMPOTÊNCIA CORRIGIDA: os planos não têm ID explícito no texto, então
  //     eram duplicados a cada reprocessamento. Comparamos objetivo + número de
  //     passos + texto do primeiro passo: se coincidir, atualizamos.
  const existingRows = db.prepare('SELECT id, objective, steps_json FROM plans').all();
  const existing = existingRows.map((r) => r.id);
  const fingerprint = (plan) => {
    const steps = plan.steps ?? [];
    return `${String(plan.objective ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 90)}|${steps.length}|${String(steps[0]?.text ?? '').toLowerCase().slice(0, 60)}`;
  };
  const existingPrints = new Map(existingRows.map((row) => {
    const steps = (() => { try { return JSON.parse(row.steps_json ?? '[]'); } catch { return []; } })();
    return [`${String(row.objective ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 90)}|${steps.length}|${String(steps[0]?.text ?? '').toLowerCase().slice(0, 60)}`, row.id];
  }));
  const ids = [];
  const now = new Date().toISOString();

  const result = tx(db, (handle) => {
    for (const plan of plans) {
      const print = fingerprint(plan);
      let id = existingPrints.get(print) ?? null;
      if (!id) {
        id = nextId(ID_PREFIX.plan, existing);
        while (existing.includes(id)) id = nextId(ID_PREFIX.plan, [...existing, id]);
        existingPrints.set(print, id);
      }
      if (!existing.includes(id)) existing.push(id);
      ids.push(id);
      handle.prepare(`INSERT INTO plans (id, session_id, task, layer, objective, steps_json, dependencies_json, risks_json, status, created_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET objective = excluded.objective, steps_json = excluded.steps_json, status = excluded.status`).run(
        id, sessionId, task, layer, plan.objective ?? id, toJson(plan.steps ?? []), toJson(plan.dependencies ?? []), toJson(plan.risks ?? []), plan.status ?? 'proposed', now,
      );
      indexEntity(handle, {
        entityType: 'plan', entityId: id,
        title: `${id} · ${plan.objective ?? ''}`.slice(0, 400),
        body: (plan.steps ?? []).map((s) => `${s.order}. ${s.text}`).join('\n'),
        tags: ['plan', plan.status, layer, ...(plan.dependencies ?? [])],
      });
      bus?.emit('PLAN_CREATED', { id, objective: (plan.objective ?? '').slice(0, 200), steps: plan.step_count ?? (plan.steps ?? []).length, status: plan.status ?? 'proposed' }, { layer: layer ?? 'requirements', task });
    }
    return ids.length;
  });

  return { persisted: result.ok ? result.value : 0, ids, error: result.ok ? null : result.error };
}

export default { extractPlans, persistPlans };

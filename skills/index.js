/* ═══════════════════════════════════════════════════════════════════════════
 * skills/index.js — PHASE 7 · AUTONOMOUS EVOLUTION (implemented)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: cierra el ciclo de aprendizaje de verdad:
 *       LESSON → RULE → PRECHECK → SKILL → OPTIMIZATION → ARCHITECTURE EVOLUTION
 *     promoteRules() toma las reglas propuestas por las lecciones y las
 *     convierte en políticas activas en control/policies.json (idempotente: una
 *     clave ya promovida no se duplica; cada política guarda su origen LES-xxxx
 *     — las reglas nacen de fallos reales, con evidencia y fecha).
 *     installPrechecks() convierte las políticas hard en comprobaciones
 *     automáticas ANTES de mutar (control/prechecks.json), que
 *     core/verifier.verifyPolicies() ejecuta en cada vuelta.
 *     registerSkill() guarda procedimientos reutilizables (nombre, disparador,
 *     pasos, verificación) en control/skills.json + manifest.skills.
 *     evolutionMetrics() responde "¿el sistema está aprendiendo?" con números.
 *     proposeArchitectureEvolution() PROPONE (nunca aplica) un cambio de
 *     arquitectura como Decision Trace en forma de documento generado.
 *     Diferencia clave entre recordar y aprender: una regla escrita es
 *     literatura; una regla que se comprueba ANTES de cada acción cambia el
 *     comportamiento del sistema.
 *
 * 🇬🇧 EN — WHAT IT DOES: truly closes the learning loop. promoteRules() turns
 *     lesson-proposed rules into active policies in control/policies.json
 *     (idempotent; every policy keeps its LES-xxxx origin — rules are born from
 *     real failures, with evidence and date). installPrechecks() converts hard
 *     policies into automatic pre-mutation checks (control/prechecks.json) that
 *     core/verifier.verifyPolicies() runs every turn. registerSkill() stores
 *     reusable procedures. evolutionMetrics() answers "is the system learning?"
 *     with numbers. proposeArchitectureEvolution() PROPOSES (never applies) an
 *     architecture change as a generated Decision Trace document.
 *
 * 🇧🇷 PT — O QUE FAZ: fecha o ciclo de aprendizagem de verdade. promoteRules()
 *     transforma regras propostas em políticas ativas (idempotente, com origem
 *     LES-xxxx); installPrechecks() converte políticas hard em verificações
 *     automáticas ANTES de mutar; registerSkill() guarda procedimentos
 *     reutilizáveis; evolutionMetrics() mede a aprendizagem; e a evolução de
 *     arquitetura é sempre PROPOSTA, nunca aplicada sozinha.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Precheck ES/EN/PT: comprobación ANTES de actuar, no después. "¿Hay
 *     dependencias npm en el núcleo?" se responde en milisegundos y evita horas.
 *     Las comprobaciones baratas van primero. Cheapest checks first.
 *   • Idempotencia ES/EN/PT: promover dos veces la misma regla NO crea POL-0012
 *     y POL-0013 idénticas: la segunda corrida reporta promoted:0. Un sistema que
 *     aprende no debe aprender dos veces la misma lección.
 *     Promoting twice must not duplicate: the system must not learn the same
 *     lesson twice.
 *   • Proponer ≠ aplicar ES/EN/PT: la evolución de arquitectura genera un
 *     documento de propuesta; modificar la arquitectura real exige aprobación
 *     humana (DEC-00003: las decisiones viven en el plano de control, firmadas).
 *     Architecture evolution proposes; humans approve.
 * ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { ok, fail, attempt } from '../core/shared/result.js';
import { PATHS, toProjectRelative } from '../core/shared/paths.js';
import { ensureDir, readJson, writeJson } from '../core/shared/json.js';
import { pendingRules, lessonMemory, repeatedFailures } from '../memory/lessons/index.js';

/** ES/EN/PT: ciclo completo de evolución. Full evolution cycle. */
export const EVOLUTION_CYCLE = Object.freeze([
  'LESSON', 'RULE', 'PRECHECK', 'SKILL', 'OPTIMIZATION', 'ARCHITECTURE EVOLUTION',
]);

/**
 * ES: promueve reglas candidatas a políticas activas. Idempotente por clave.
 *     Cada política nueva conserva el origen (LES-xxxx) y la aprobación.
 * EN: promotes candidate rules into active policies. Idempotent by key. Each new
 *     policy keeps its origin (LES-xxxx) and the approval record.
 * PT: promove regras candidatas a políticas ativas. Idempotente por chave.
 *
 * @param {{ db?: object|null, bus?: object|null, policiesFile?: string|null, approvedBy?: string|null, enforcement?: 'hard'|'soft'|null }} [options]
 */
export function promoteRules(options = {}) {
  const { bus = null, approvedBy = null, enforcement = null } = options;
  const policiesFile = options.policiesFile ?? PATHS.policies;

  return attempt(() => {
    const pending = pendingRules(options); // usa options.db si viene; si no, el real
    if (!pending.ok) throw new Error(pending.error.message);

    const policies = readJson(policiesFile, null);
    if (!policies || !Array.isArray(policies.rules)) throw new Error(`policies file is malformed or missing: ${policiesFile}`);

    const existingKeys = new Set(policies.rules.map((rule) => rule.key ?? rule.id));
    let nextNumber = policies.rules.reduce((max, rule) => Math.max(max, Number(/^POL-(\d+)$/.exec(rule.id ?? '')?.[1] ?? 0)), 0) + 1;

    const promoted = [];
    for (const rule of pending.value.rules) {
      if (existingKeys.has(rule.key)) continue; // ES: idempotencia — no se aprende dos veces.
      const policy = {
        id: `POL-${String(nextNumber).padStart(4, '0')}`,
        key: rule.key,
        value: rule.value,
        enforcement: enforcement ?? (approvedBy ? 'hard' : rule.enforcement ?? 'soft'),
        statement: rule.lesson ?? rule.statement ?? rule.key,
        origin: rule.origin ?? rule.lesson_id,
        approved_by: approvedBy ?? 'pending-human-approval',
        promoted_at: new Date().toISOString(),
      };
      policies.rules.push(policy);
      existingKeys.add(rule.key);
      promoted.push(policy);
      nextNumber += 1;
    }

    if (promoted.length) writeJson(policiesFile, policies);
    bus?.emit('STATE_UPDATED', { kind: 'rules-promoted', count: promoted.length, ids: promoted.map((p) => p.id) }, { layer: 'learning-evolution' });
    return { kind: 'promote-rules', promoted: promoted.length, policies: promoted, total_active: policies.rules.length, file: toProjectRelative(policiesFile) };
  }, { code: 'rule_promotion_failed', layer: 'learning-evolution', interruptionType: 'failed' });
}

/**
 * ES: instala PRECHECKS a partir de las políticas hard activas: comprobaciones
 *     automáticas que verifyPolicies() corre ANTES de aceptar una mutación.
 * EN: installs PRECHECKS from the active hard policies: automatic checks that
 *     verifyPolicies() runs BEFORE accepting a mutation.
 * PT: instala PRECHECKS a partir das políticas hard ativas.
 *
 * @param {{ policiesFile?: string|null, prechecksFile?: string|null, bus?: object|null }} [options]
 */
export function installPrechecks(options = {}) {
  const { bus = null } = options;
  const policiesFile = options.policiesFile ?? PATHS.policies;
  const prechecksFile = options.prechecksFile ?? path.join(PATHS.control, 'prechecks.json');

  return attempt(() => {
    const policies = readJson(policiesFile, null);
    if (!policies || !Array.isArray(policies.rules)) throw new Error(`policies file is malformed or missing: ${policiesFile}`);

    /*
     * ES: mapa clave → tipo de precheck ejecutable. Las políticas sin forma
     *     máquina quedan como advisory (se muestran, no bloquean).
     * EN: key → executable precheck kind. Policies without a machine form stay
     *     advisory (shown, never blocking).
     * PT: chave → tipo de precheck executável; o resto fica advisory.
     */
    const prechecks = policies.rules
      .filter((rule) => rule.enforcement === 'hard')
      .map((rule, index) => {
        const base = { id: `PRE-${String(index + 1).padStart(4, '0')}`, origin: rule.id, key: rule.key, statement: rule.statement ?? rule.key };
        if (rule.key === 'core.zero_dependencies' || rule.key === 'core.no_npm_dependencies') return { ...base, kind: 'zero-dependencies', blocking: true };
        if (rule.key === 'ui.offline_first_dual_mode') return { ...base, kind: 'file-exists', path: 'apps/console/sw.js', blocking: true };
        if (rule.key === 'observability.everything_is_an_event') return { ...base, kind: 'file-exists', path: 'data/events.jsonl', blocking: false };
        return { ...base, kind: 'advisory', blocking: false };
      });

    ensureDir(path.dirname(prechecksFile));
    writeJson(prechecksFile, {
      kind: 'prechecks',
      installed_at: new Date().toISOString(),
      consumed_by: 'core/verifier/index.js → verifyPolicies()',
      prechecks,
    });
    bus?.emit('STATE_UPDATED', { kind: 'prechecks-installed', count: prechecks.length, blocking: prechecks.filter((p) => p.blocking).length }, { layer: 'learning-evolution' });
    return { kind: 'install-prechecks', installed: prechecks.length, blocking: prechecks.filter((precheck) => precheck.blocking).length, file: toProjectRelative(prechecksFile), prechecks };
  }, { code: 'precheck_install_failed', layer: 'learning-evolution', interruptionType: 'failed' });
}

/**
 * ES: registra una habilidad reutilizable (procedimiento que el sistema sabe
 *     ejecutar solo). Idempotente por nombre. Escribe control/skills.json y
 *     refleja la habilidad en manifest.skills.
 * EN: registers a reusable skill (a procedure the system knows how to run by
 *     itself). Idempotent by name. Writes control/skills.json and mirrors the
 *     skill into manifest.skills.
 * PT: registra uma habilidade reutilizável. Idempotente por nome.
 *
 * @param {{ name: string, trigger?: string, steps?: string[], verification?: string|null, failureExamples?: string[], skillsFile?: string|null, manifestFile?: string|null, bus?: object|null }} options
 */
export function registerSkill(options = {}) {
  const { name = null, bus = null } = options;
  const skillsFile = options.skillsFile ?? path.join(PATHS.control, 'skills.json');
  const manifestFile = options.manifestFile ?? PATHS.manifest;
  if (!name) return fail('registerSkill requires a name', { code: 'skill_name_missing' });
  if (!Array.isArray(options.steps) || !options.steps.length) return fail('registerSkill requires steps[] — a skill without steps is a wish', { code: 'skill_steps_missing' });

  return attempt(() => {
    const skill = {
      name,
      trigger: options.trigger ?? 'manual',
      steps: options.steps,
      verification: options.verification ?? null,
      failure_examples: options.failureExamples ?? [],
      registered_at: new Date().toISOString(),
      status: 'active',
    };

    ensureDir(path.dirname(skillsFile));
    const registry = readJson(skillsFile, { kind: 'skills-registry', skills: [] });
    registry.skills = [...(registry.skills ?? []).filter((item) => item.name !== name), skill];
    writeJson(skillsFile, registry);

    const manifest = readJson(manifestFile, null);
    if (manifest && Array.isArray(manifest.skills)) {
      manifest.skills = [...manifest.skills.filter((item) => (typeof item === 'string' ? item !== name : item?.name !== name)), name];
      writeJson(manifestFile, manifest);
    }

    bus?.emit('STATE_UPDATED', { kind: 'skill-registered', name, steps: skill.steps.length }, { layer: 'learning-evolution' });
    return { kind: 'register-skill', skill, file: toProjectRelative(skillsFile) };
  }, { code: 'skill_registration_failed', layer: 'learning-evolution' });
}

/**
 * ES: métricas de evolución — ¿el sistema aprende? Números, no opiniones:
 *     lecciones, reglas promovidas, prechecks instalados, skills, fallos
 *     repetidos y el veredicto is_learning.
 * EN: evolution metrics — is the system learning? Numbers, not opinions.
 * PT: métricas de evolução — o sistema aprende? Números, não opiniões.
 *
 * @param {{ db?: object|null, skillsFile?: string|null, prechecksFile?: string|null, policiesFile?: string|null }} [options]
 */
export function evolutionMetrics(options = {}) {
  return attempt(() => {
    const memory = lessonMemory(options);
    if (!memory.ok) throw new Error(memory.error.message);
    const totals = memory.value.totals;
    const repeated = repeatedFailures(options);
    const policies = readJson(options.policiesFile ?? PATHS.policies, { rules: [] });
    const promotedFromLessons = (policies.rules ?? []).filter((rule) => String(rule.origin ?? '').startsWith('LES-'));
    const prechecks = readJson(options.prechecksFile ?? path.join(PATHS.control, 'prechecks.json'), { prechecks: [] });
    const skills = readJson(options.skillsFile ?? path.join(PATHS.control, 'skills.json'), { skills: [] });

    return {
      kind: 'evolution-metrics',
      cycle: EVOLUTION_CYCLE,
      lessons: totals.lessons ?? 0,
      errors: totals.errors ?? 0,
      unresolved_errors: totals.unresolved_errors ?? 0,
      proposed_rules: totals.proposed_rules ?? 0,
      active_policies: (policies.rules ?? []).length,
      policies_born_from_lessons: promotedFromLessons.length,
      prechecks_installed: (prechecks.prechecks ?? []).length,
      skills_registered: (skills.skills ?? []).length,
      repeated_failure_groups: repeated.ok ? repeated.value.count : null,
      // ES: "aprender" = al menos una lección promovida a política Y un precheck
      //     instalado. Si no, el ciclo se quedó a mitad.
      // EN: "learning" = at least one lesson promoted to policy AND one precheck
      //     installed. Otherwise the loop stopped halfway.
      // PT: "aprender" = ao menos uma lição promovida E um precheck instalado.
      is_learning: promotedFromLessons.length > 0 && (prechecks.prechecks ?? []).length > 0,
    };
  }, { code: 'evolution_metrics_failed', layer: 'learning-evolution' });
}

/**
 * ES: PROPONE (nunca aplica) una evolución de arquitectura a partir de la
 *     evidencia: fallos repetidos por capa o métricas estancadas. Genera un
 *     documento con forma de Decision Trace en documentation/generated/.
 * EN: PROPOSES (never applies) an architecture evolution from evidence: repeated
 *     failures per layer or stalled metrics. Emits a Decision-Trace-shaped
 *     document under documentation/generated/.
 * PT: PROPÕE (nunca aplica) uma evolução de arquitetura a partir de evidência.
 *
 * @param {{ db?: object|null, outDir?: string|null, bus?: object|null }} [options]
 */
export function proposeArchitectureEvolution(options = {}) {
  const { db = null, bus = null } = options;
  const outDir = options.outDir ?? path.join(PATHS.documentation, 'generated');

  return attempt(() => {
    if (!db) throw new Error('proposeArchitectureEvolution requires a db handle');
    const repeated = repeatedFailures({ db });
    const metrics = evolutionMetrics(options);
    if (!metrics.ok) throw new Error(metrics.error.message);

    const groups = repeated.ok ? repeated.value.groups : [];
    // ES: la propuesta nace de evidencia: la capa con más fallos repetidos, o
    //     "todo va bien → no hay nada que proponer" (propuesta vacía honesta).
    // EN: the proposal is born from evidence: the layer with the most repeated
    //     failures, or an honest empty proposal when nothing repeats.
    // PT: a proposta nasce da evidência: camada com mais falhas repetidas.
    const hot = groups[0] ?? null;

    const proposal = {
      kind: 'architecture-evolution-proposal',
      status: 'PROPOSED — requires human approval (never self-applied)',
      proposed_at: new Date().toISOString(),
      evidence: {
        repeated_failure_groups: groups,
        metrics: metrics.ok ? metrics.value : metrics,
      },
      decision_trace_shape: {
        objective: hot ? `reduce repeated failures in layer "${hot.layer}" (${hot.occurrences} occurrences)` : 'no repeated failures detected — no architectural change proposed',
        context: hot ? `errors ${hot.error_ids.join(', ')} repeat in the same layer` : 'the learning loop reports no recurring pattern',
        alternatives: hot
          ? [
              { option: `add layer-specific prechecks for "${hot.layer}"`, selected: true },
              { option: 'ignore and hope', selected: false },
            ]
          : [{ option: 'keep the current architecture', selected: true }],
        decision: hot ? `propose targeted prechecks + a regression test for layer "${hot.layer}"` : 'no change',
        justification: hot ? 'repeated failure is the strongest signal that a rule is missing (Phase 7 premise)' : 'evolution without evidence is churn',
      },
    };

    ensureDir(outDir);
    const file = path.join(outDir, 'EVOLUTION-PROPOSAL.json');
    writeJson(file, proposal);
    bus?.emit('DECISION_MADE', { kind: 'evolution-proposal', status: 'proposed', needs_approval: true }, { layer: 'learning-evolution' });
    return { kind: 'propose-evolution', proposal, file: toProjectRelative(file), requires_human_approval: true };
  }, { code: 'evolution_proposal_failed', layer: 'learning-evolution' });
}

export default { EVOLUTION_CYCLE, promoteRules, installPrechecks, registerSkill, evolutionMetrics, proposeArchitectureEvolution };

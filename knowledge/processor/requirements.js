/* ═══════════════════════════════════════════════════════════════════════════
 * knowledge/processor/requirements.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: consolida los REQUISITOS detectados en los mensajes y los
 *     guarda en la base, registrando además sus CAMBIOS en el tiempo
 *     (tabla `requirement_changes`). Si un requisito cambia de prioridad o de
 *     estado, se emite una interrupción de tipo `scope_change`.
 *     POR QUÉ EXISTE: el requisito más caro de un proyecto no es el difícil, es
 *     el que cambió sin que nadie lo notara. Guardar el historial de cambios
 *     permite responder "¿este requisito siempre fue así?" y detectar derrape
 *     de alcance (scope creep) antes de que destruya el cronograma.
 *
 * 🇬🇧 EN — WHAT IT DOES: consolidates the REQUIREMENTS detected in messages and
 *     stores them in the database, also recording their CHANGES over time
 *     (the `requirement_changes` table). If a requirement changes priority or
 *     status, a `scope_change` interruption is emitted.
 *     WHY IT EXISTS: the most expensive requirement in a project is not the hard
 *     one, it is the one that changed without anybody noticing. Storing the
 *     change history answers "was this requirement always like this?" and
 *     detects scope creep before it destroys the schedule.
 *
 * 🇧🇷 PT — O QUE FAZ: consolida os REQUISITOS detectados nas mensagens e os
 *     guarda no banco, registrando também suas MUDANÇAS ao longo do tempo
 *     (tabela `requirement_changes`). Se um requisito muda de prioridade ou
 *     status, uma interrupção `scope_change` é emitida.
 *     POR QUE EXISTE: o requisito mais caro de um projeto não é o difícil, é o
 *     que mudou sem ninguém perceber. Guardar o histórico de mudanças responde
 *     "este requisito sempre foi assim?" e detecta scope creep.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Criterio de aceptación ES/EN/PT: frase que permite comprobar si el
 *     requisito se cumplió. "La app debe ser rápida" no es un requisito, es un
 *     deseo. "La búsqueda debe responder en menos de 300 ms con 10.000
 *     registros" sí lo es. Sin criterio de aceptación no hay verificación posible.
 *     An acceptance criterion makes a requirement testable.
 *   • Similitud de texto ES/EN/PT: para saber si dos requisitos son "el mismo"
 *     usamos el coeficiente de Jaccard sobre conjuntos de palabras:
 *     intersección / unión. 0 = nada que ver, 1 = idénticos. Es simple, no
 *     necesita IA y funciona sorprendentemente bien para frases cortas.
 *     Jaccard similarity = intersection/union of word sets; simple and effective.
 *   • Normalizar antes de comparar ES/EN/PT: minúsculas, sin tildes, sin
 *     puntuación. Si no, "SQLite" y "sqlite" serían dos requisitos distintos.
 *     Normalize case and accents before comparing, or you get fake duplicates.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { openDatabase, tx, toJson, indexEntity } from '../db/index.js';
import { nextId, ID_PREFIX } from '../../core/shared/ids.js';

/** ES/EN/PT: texto → conjunto de palabras normalizadas. Text → normalized word set. */
export function wordSet(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

/**
 * ES: similitud de Jaccard entre dos textos (0 = nada en común, 1 = idénticos).
 * EN: Jaccard similarity between two texts (0 = nothing in common, 1 = identical).
 * PT: similaridade de Jaccard entre dois textos (0 = nada em comum, 1 = idênticos).
 */
export function similarity(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 1000) / 1000;
}

/**
 * ES: reúne requisitos desde mensajes ya interpretados, deduplicando por similitud.
 * EN: gathers requirements from already interpreted messages, deduplicating by similarity.
 * PT: reúne requisitos de mensagens já interpretadas, deduplicando por similaridade.
 *
 * @param {object[]} messages parsed messages (from core/capture/message-parser)
 * @param {{ threshold?: number }} [options]
 */
export function extractRequirements(messages, options = {}) {
  const { threshold = 0.72 } = options;
  const collected = [];

  for (const message of messages ?? []) {
    const sentences = message?.interpretation?.requirements ?? [];
    for (const sentence of sentences) {
      const clean = String(sentence).replace(/\s+/g, ' ').trim();
      if (clean.length < 8 || clean.length > 400) continue;

      // ES: buscamos si ya tenemos un requisito "parecido" y lo fusionamos.
      // EN: we look for an already "similar" requirement and merge into it.
      // PT: procuramos um requisito já "parecido" e o mesclamos.
      const duplicate = collected.find((item) => similarity(item.title, clean) >= threshold);
      if (duplicate) {
        duplicate.sources.push({ session_id: message.session_id ?? null, message_id: message.id ?? null });
        duplicate.mentions += 1;
        continue;
      }

      collected.push({
        id: null,
        title: clean,
        layer: guessLayer(clean),
        priority: guessPriority(clean),
        status: 'discovered',
        acceptance: guessAcceptance(clean),
        sources: [{ session_id: message.session_id ?? null, message_id: message.id ?? null }],
        mentions: 1,
      });
    }
  }
  return collected;
}

/** ES/EN/PT: capa más probable según palabras clave. Most likely layer by keywords. */
export function guessLayer(text) {
  const lower = String(text).toLowerCase();
  if (/\b(interfaz|ui|dashboard|web|pantalla|visual|frontend|interface)\b/.test(lower)) return 'application';
  if (/\b(agente|agent|aut[oó]nomo|autonomous|orquestador|orchestrator)\b/.test(lower)) return 'agents';
  if (/\b(documentaci|documentation|tutorial|curso|course|lecci|lesson)\b/.test(lower)) return 'documentation';
  if (/\b(test|prueba|verificaci|verification|calidad|quality)\b/.test(lower)) return 'verification';
  if (/\b(sqlite|base de datos|database|almacen|storage|offline|dependencia)\b/.test(lower)) return 'infrastructure';
  if (/\b(aprend|learn|evoluci|evolution|regla|rule|lecci)\b/.test(lower)) return 'learning-evolution';
  if (/\b(script|automatizaci|automation|worker|cron|pipeline)\b/.test(lower)) return 'automation';
  if (/\b(requisito|requirement|debe|must|vision|visi)\b/.test(lower)) return 'requirements';
  if (/\b(arquitectura|architecture|nivel|layer|m[oó]dulo|module)\b/.test(lower)) return 'architecture';
  return 'core-engine';
}

/** ES/EN/PT: prioridad según lenguaje de urgencia. Priority by urgency language. */
export function guessPriority(text) {
  const lower = String(text).toLowerCase();
  if (/\b(cr[ií]tico|critical|nunca|never|jam[aá]s|obligatorio|mandatory|siempre|always|seguridad|security)\b/.test(lower)) return 'critical';
  if (/\b(importante|important|muy|must|debe|tiene que|esencial|essential|clave|key)\b/.test(lower)) return 'high';
  if (/\b(opcional|optional|ser[ií]a bueno|nice to have|futuro|future|algún d|someday|podr[ií]a|could)\b/.test(lower)) return 'low';
  return 'medium';
}

/** ES/EN/PT: intenta derivar un criterio de aceptación medible. Tries to derive a measurable acceptance criterion. */
export function guessAcceptance(text) {
  const lower = String(text).toLowerCase();
  const numeric = /\b(\d+(?:[.,]\d+)?)\s*(ms|segundos?|seconds?|minutos?|minutes?|%|por ?ciento|veces|times|registros|records|archivos|files)\b/i.exec(String(text));
  if (numeric) return `Verifiable: the constraint "${numeric[0]}" must hold.`;
  if (/\b(offline|sin conexi|sem conex|no requiere)\b/.test(lower)) return 'Verifiable: works with no network access and an empty node_modules.';
  if (/\b(triling|es\/en\/pt|tres idiomas|three languages)\b/.test(lower)) return 'Verifiable: the artifact exposes content in es, en and pt.';
  if (/\b(evento|event|registrar|register|traz|trace)\b/.test(lower)) return 'Verifiable: an observable event is written for the operation.';
  return 'Pending: define a measurable acceptance criterion.';
}

/**
 * ES: guarda requisitos y registra sus cambios. Devuelve también los cambios
 *     detectados (para emitir scope_change).
 * EN: stores requirements and records their changes. Also returns the detected
 *     changes (to emit scope_change).
 * PT: guarda requisitos e registra suas mudanças. Devolve também as mudanças
 *     detectadas (para emitir scope_change).
 */
export function persistRequirements(requirements, options = {}) {
  const { bus = null, sessionId = null } = options;
  const db = options.db ?? openDatabase();
  if (!Array.isArray(requirements) || !requirements.length) return { persisted: 0, changes: [], ids: [] };

  const existing = db.prepare('SELECT id, title, priority, status, layer, acceptance FROM requirements').all();
  const ids = [];
  const changes = [];
  const now = new Date().toISOString();

  const result = tx(db, (handle) => {
    for (const requirement of requirements) {
      // ES: ¿ya existe uno parecido? Entonces es una ACTUALIZACIÓN, no uno nuevo.
      // EN: does a similar one already exist? Then it is an UPDATE, not a new one.
      // PT: já existe um parecido? Então é uma ATUALIZAÇÃO, não um novo.
      const match = existing.find((row) => similarity(row.title, requirement.title) >= 0.72);
      const id = match?.id ?? requirement.id ?? nextId(ID_PREFIX.requirement, [...existing.map((r) => r.id), ...ids]);

      if (match) {
        for (const field of ['priority', 'status', 'layer', 'acceptance']) {
          const before = match[field];
          const after = requirement[field] ?? before;
          if (before && after && String(before) !== String(after)) {
            changes.push({ requirement_id: id, field, before, after });
          }
        }
      } else {
        existing.push({ id, title: requirement.title, priority: requirement.priority, status: requirement.status, layer: requirement.layer, acceptance: requirement.acceptance });
      }
      ids.push(id);

      handle.prepare(`INSERT INTO requirements (id, layer, title, priority, status, acceptance, source_id, session_id, created_at, updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET title = excluded.title, priority = excluded.priority, status = excluded.status, layer = excluded.layer, acceptance = excluded.acceptance, updated_at = excluded.updated_at`).run(
        id, requirement.layer ?? null, String(requirement.title).slice(0, 400), requirement.priority ?? 'medium',
        requirement.status ?? 'discovered', requirement.acceptance ?? null,
        toJson(requirement.sources ?? []), sessionId, now, now,
      );

      indexEntity(handle, {
        entityType: 'requirement', entityId: id,
        title: `${id} · ${requirement.title}`.slice(0, 400),
        body: `${requirement.acceptance ?? ''}\nlayer: ${requirement.layer ?? '—'}\npriority: ${requirement.priority ?? '—'}`,
        tags: ['requirement', requirement.layer, requirement.priority, requirement.status],
      });
    }

    // ES: cada cambio queda auditado en requirement_changes.
    // EN: every change is audited in requirement_changes.
    // PT: cada mudança fica auditada em requirement_changes.
    let changeNumber = handle.prepare('SELECT COUNT(*) AS n FROM requirement_changes').get()?.n ?? 0;
    for (const change of changes) {
      changeNumber += 1;
      const changeId = `RCH-${String(changeNumber).padStart(5, '0')}`;
      handle.prepare('INSERT INTO requirement_changes (id, requirement_id, field, before_value, after_value, reason, ts) VALUES (?,?,?,?,?,?,?)')
        .run(changeId, change.requirement_id, change.field, String(change.before), String(change.after), 'detected during reprocessing', now);
    }

    return { persisted: ids.length, changes: changes.length };
  });

  if (!result.ok) return { persisted: 0, changes: [], ids: [], error: result.error };

  for (const change of changes) {
    bus?.emit('STATE_UPDATED', { kind: 'requirement_change', ...change }, { layer: 'requirements' });
    if (change.field === 'priority' || change.field === 'status') {
      // ES: un cambio de prioridad/estado es un cambio de alcance: se documenta.
      // EN: a priority/status change is a scope change: it gets documented.
      // PT: uma mudança de prioridade/status é uma mudança de escopo: é documentada.
      bus?.interruption?.({
        type: 'scope_change',
        reason: `Requirement ${change.requirement_id} changed ${change.field}: ${change.before} -> ${change.after}`,
        layer: 'requirements',
        impact: 'medium',
        recoverable: true,
        existingIds: [],
      });
    }
  }

  return { persisted: result.value.persisted, changes, ids };
}

/** ES/EN/PT: histograma de requisitos por estado y prioridad. Requirements histogram. */
export function requirementCoverage(db) {
  const byStatus = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM requirements GROUP BY status').all().map((r) => [r.status ?? 'unknown', Number(r.n)]));
  const byPriority = Object.fromEntries(db.prepare('SELECT priority, COUNT(*) AS n FROM requirements GROUP BY priority').all().map((r) => [r.priority ?? 'unknown', Number(r.n)]));
  const byLayer = Object.fromEntries(db.prepare('SELECT layer, COUNT(*) AS n FROM requirements GROUP BY layer').all().map((r) => [r.layer ?? 'unknown', Number(r.n)]));
  return { by_status: byStatus, by_priority: byPriority, by_layer: byLayer, changes_recorded: Number(db.prepare('SELECT COUNT(*) AS n FROM requirement_changes').get()?.n ?? 0) };
}

export default { wordSet, similarity, extractRequirements, guessLayer, guessPriority, guessAcceptance, persistRequirements, requirementCoverage };

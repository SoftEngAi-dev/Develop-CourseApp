/* ═══════════════════════════════════════════════════════════════════════════
 * core/manifest/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: carga, valida y consulta el Project Manifest
 *     (control/manifest.json), el contrato central del proyecto. También
 *     permite actualizarlo de forma segura (parche, no reescritura).
 *     POR QUÉ EXISTE (sección 17): el Manifest no es documentación decorativa,
 *     es EJECUTABLE. El orquestador lo lee para saber qué fases existen, qué
 *     requisitos están pendientes y qué políticas son obligatorias. Una nueva
 *     sesión lee el Manifest y ya sabe dónde está parada sin releer el universo.
 *
 * 🇬🇧 EN — WHAT IT DOES: loads, validates and queries the Project Manifest
 *     (control/manifest.json), the project's central contract. It also allows
 *     safely updating it (patching, never rewriting).
 *     WHY IT EXISTS (section 17): the Manifest is not decorative documentation,
 *     it is EXECUTABLE. The orchestrator reads it to know which phases exist,
 *     which requirements are pending and which policies are mandatory. A new
 *     session reads the Manifest and immediately knows where it stands.
 *
 * 🇧🇷 PT — O QUE FAZ: carrega, valida e consulta o Project Manifest
 *     (control/manifest.json), o contrato central do projeto. Também permite
 *     atualizá-lo de forma segura (patch, nunca reescrita).
 *     POR QUE EXISTE (seção 17): o Manifest não é documentação decorativa, é
 *     EXECUTÁVEL. O orquestrador o lê para saber quais fases existem, quais
 *     requisitos estão pendentes e quais políticas são obrigatórias. Uma nova
 *     sessão lê o Manifest e já sabe onde está sem reler o universo.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • ¿Qué es un "manifest"? ES/EN/PT: un archivo que DECLARA cómo es el
 *     sistema, en vez de programarlo. Comparación: el plano de una casa no es
 *     la casa, pero sin plano nadie sabe qué pared se puede tirar. Kubernetes,
 *     npm (package.json) y Android (AndroidManifest.xml) funcionan igual.
 *     A file that DECLARES what the system is, instead of programming it.
 *   • Caché con invalidación ES/EN/PT: `loadManifest()` guarda el resultado en
 *     una variable para no leer el disco 50 veces. Pero si alguien edita el
 *     archivo a mano, la caché quedaría obsoleta: por eso comparamos
 *     `mtimeMs` (fecha de modificación) y recargamos si cambió.
 *     Caching avoids 50 disk reads; comparing mtimeMs invalidates stale caches.
 *   • `structuredClone` ES/EN/PT: devuelve una copia independiente. Si no
 *     copiáramos, un módulo podría modificar el manifest en memoria y otro
 *     módulo vería ese cambio fantasma sin haberlo guardado en disco.
 *     Returns an independent copy, preventing ghost in-memory mutations.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import { PATHS } from '../shared/paths.js';
import { readJson, writeJson } from '../shared/json.js';
import { deepGet, deepSet, deepDiff } from '../shared/deep.js';
import { ok, fail, attempt } from '../shared/result.js';
import { ProjectManifestSchema } from '../validation/schema.js';

let CACHE = null; // ES: { mtimeMs, manifest } | EN: cached parse | PT: cache

function mtimeOf(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * ES: carga y valida el manifest. Devuelve una copia (no el objeto en caché).
 * EN: loads and validates the manifest. Returns a copy (not the cached object).
 * PT: carrega e valida o manifest. Devolve uma cópia (não o objeto em cache).
 *
 * @param {{ file?: string, validate?: boolean, fresh?: boolean }} [options]
 * @returns {Result<object>}
 */
export function loadManifest(options = {}) {
  const { file = PATHS.manifest, validate = true, fresh = false } = options;

  return attempt(() => {
    if (!fs.existsSync(file)) {
      throw new Error(`Project Manifest not found at ${file}. Run "genesis init" first.`);
    }
    const mtime = mtimeOf(file);
    if (!fresh && CACHE && CACHE.file === file && CACHE.mtimeMs === mtime) {
      return structuredClone(CACHE.manifest);
    }
    const manifest = readJson(file);
    if (!manifest || typeof manifest !== 'object') {
      throw new Error(`Project Manifest at ${file} is empty or not an object.`);
    }
    if (validate) {
      const result = ProjectManifestSchema.safeParse(manifest, 'manifest');
      if (!result.ok) {
        const errors = result.errors ?? [result];
        throw new Error(`Project Manifest is invalid:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`);
      }
    }
    CACHE = { file, mtimeMs: mtime, manifest };
    return structuredClone(manifest);
  }, { code: 'manifest_load_failed', layer: 'vision', interruptionType: 'dependency_missing' });
}

/**
 * ES: lee un valor del manifest por ruta ("architecture.pipeline").
 * EN: reads a manifest value by path ("architecture.pipeline").
 * PT: lê um valor do manifest por caminho ("architecture.pipeline").
 */
export function getManifestValue(route, fallback = undefined, options = {}) {
  const result = loadManifest(options);
  if (!result.ok) return fallback;
  return deepGet(result.value, route, fallback);
}

/**
 * ES: aplica un parche parcial al manifest (rutas → valores), valida y guarda.
 *     NUNCA reescribe el archivo completo desde cero: eso es POL-0002.
 * EN: applies a partial patch to the manifest (paths → values), validates and
 *     saves it. It NEVER rewrites the whole file from scratch: that is POL-0002.
 * PT: aplica um patch parcial ao manifest (caminhos → valores), valida e salva.
 *     NUNCA reescreve o arquivo inteiro do zero: isso é POL-0002.
 *
 * @param {Record<string, any>} patches e.g. { "project.version": "0.2.0" }
 * @param {{ bus?: object, reason?: string }} [options]
 */
export function patchManifest(patches, options = {}) {
  const { bus = null, reason = 'manual patch' } = options;
  const loaded = loadManifest({ fresh: true });
  if (!loaded.ok) return loaded;

  const before = loaded.value;
  const after = structuredClone(before);
  for (const [route, value] of Object.entries(patches ?? {})) deepSet(after, route, value);

  const validation = ProjectManifestSchema.safeParse(after, 'manifest');
  if (!validation.ok) {
    const errors = validation.errors ?? [validation];
    // ES: el parche se rechaza ANTES de tocar el disco. Nunca dejamos el
    //     contrato central en un estado inválido.
    // EN: the patch is rejected BEFORE touching the disk. We never leave the
    //     central contract in an invalid state.
    // PT: o patch é rejeitado ANTES de tocar o disco. Nunca deixamos o contrato
    //     central num estado inválido.
    return fail(`Patch rejected, manifest would become invalid:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`, {
      code: 'manifest_patch_invalid',
      interruptionType: 'conflict',
      layer: 'vision',
      recoverable: true,
      details: { patches, errors },
    });
  }

  const diff = deepDiff(before, after);
  const write = writeJson(PATHS.manifest, after);
  CACHE = null;

  bus?.emit('FILE_CHANGED', {
    file: 'control/manifest.json',
    reason,
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
  }, { layer: 'vision' });

  return ok({ manifest: after, diff, bytes: write.bytes, backedUp: write.backedUp });
}

/** ES/EN/PT: resumen legible del manifest para `genesis status`. Human-readable summary. */
export function describeManifest(manifest) {
  const phases = getManifestValue('architecture.pipeline', [], {});
  return {
    project: manifest?.project?.name ?? 'unknown',
    version: manifest?.project?.version ?? '0.0.0',
    central_rule: manifest?.vision?.central_rule ?? null,
    levels: (manifest?.architecture?.levels ?? []).map((l) => `${l.level}:${l.id}`),
    layers: (manifest?.architecture?.layers ?? []).length,
    pipeline_steps: phases.length,
    requirements_total: (manifest?.requirements ?? []).length,
    requirements_completed: (manifest?.requirements ?? []).filter((r) => r.status === 'completed').length,
  };
}

/** ES/EN/PT: requisitos por estado. Requirements grouped by status. */
export function requirementsByStatus(manifest) {
  const grouped = {};
  for (const requirement of manifest?.requirements ?? []) {
    const status = requirement.status ?? 'unknown';
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(requirement);
  }
  return grouped;
}

/** ES/EN/PT: políticas activas del manifest. Active policies referenced by the manifest. */
export function policyFile() { return PATHS.policies; }

export function loadPolicies(options = {}) {
  return attempt(() => readJson(options.file ?? PATHS.policies, { rules: [] }), { code: 'policies_load_failed' });
}

export default { loadManifest, getManifestValue, patchManifest, describeManifest, requirementsByStatus, loadPolicies };

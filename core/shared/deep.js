/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/deep.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: utilidades para trabajar con objetos JSON anidados:
 *     leer una ruta ("architecture.pipeline[0].id"), aplanar un objeto a una
 *     lista de pares clave→valor, y comparar dos versiones para saber EXACTAMENTE
 *     qué cambió.
 *     POR QUÉ EXISTE: el checkpoint necesita decir "entre CHK-00003 y CHK-00004
 *     cambiaron estas 5 claves". Sin diff no hay rollback seguro: restaurar a
 *     ciegas puede deshacer trabajo bueno. Esto implementa POL-0002
 *     (READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT).
 *
 * 🇬🇧 EN — WHAT IT DOES: utilities for nested JSON objects: read a path
 *     ("architecture.pipeline[0].id"), flatten an object into key→value pairs,
 *     and compare two versions to know EXACTLY what changed.
 *     WHY IT EXISTS: checkpoints must say "between CHK-00003 and CHK-00004 these
 *     5 keys changed". Without a diff there is no safe rollback: restoring
 *     blindly can undo good work. This implements POL-0002.
 *
 * 🇧🇷 PT — O QUE FAZ: utilidades para objetos JSON aninhados: ler um caminho
 *     ("architecture.pipeline[0].id"), achatar um objeto em pares chave→valor e
 *     comparar duas versões para saber EXATAMENTE o que mudou.
 *     POR QUE EXISTE: o checkpoint precisa dizer "entre CHK-00003 e CHK-00004
 *     mudaram estas 5 chaves". Sem diff não há rollback seguro: restaurar às
 *     cegas pode desfazer trabalho bom. Isso implementa POL-0002.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Recursividad ES/EN/PT: una función que se llama a sí misma para resolver
 *     un problema más pequeño. `flatten({a:{b:1}})` se llama con `{b:1}` y luego
 *     con `1`. SIEMPRE necesita un "caso base" (aquí: cuando el valor ya no es
 *     un objeto) o entraría en un bucle infinito.
 *     A function calling itself on a smaller problem; it ALWAYS needs a base case.
 *   • `Object.entries(obj)` ES/EN/PT: convierte `{a:1,b:2}` en
 *     `[['a',1],['b',2]]`. Útil para recorrer claves y valores a la vez.
 *     Turns an object into an array of [key, value] pairs.
 *   • `Array.isArray(v) && v.every(isScalar)` ES/EN/PT: tratamos los arrays de
 *     valores simples (["a","b"]) como un valor único en el diff, porque
 *     compararlos elemento a elemento genera ruido inútil.
 *     Arrays of scalars are treated as a single value to keep diffs readable.
 *   • Optional chaining `a?.b?.c` ES/EN/PT: si `a` o `b` es null/undefined, la
 *     expresión vale undefined en vez de lanzar "Cannot read properties of
 *     undefined". Cadena opcional: evita errores en datos incompletos.
 * ═══════════════════════════════════════════════════════════════════════════ */

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ES: lee un valor profundo usando una ruta con puntos e índices.
 * EN: reads a deep value using a dotted path with indexes.
 * PT: lê um valor profundo usando um caminho com pontos e índices.
 *
 * @param {any} source
 * @param {string} route e.g. "architecture.levels[0].id"
 * @param {any} [fallback=undefined]
 */
export function deepGet(source, route, fallback = undefined) {
  if (!route) return source ?? fallback;
  // ES: "a.b[0].c" -> ["a","b","0","c"]
  const parts = String(route).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    current = current[part];
  }
  return current === undefined ? fallback : current;
}

/**
 * ES: escribe un valor profundo, creando los objetos intermedios que falten.
 * EN: writes a deep value, creating any missing intermediate objects.
 * PT: escreve um valor profundo, criando os objetos intermediários que faltarem.
 *
 * @param {object} target mutable object
 * @param {string} route
 * @param {any} value
 */
export function deepSet(target, route, value) {
  const parts = String(route).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!isPlainObject(current[key]) && !Array.isArray(current[key])) current[key] = {};
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
  return target;
}

/**
 * ES: aplana un objeto anidado a {"a.b.c": valor}. Los arrays de valores
 *     simples se guardan enteros; los arrays de objetos se recorren.
 * EN: flattens a nested object into {"a.b.c": value}. Arrays of scalars are
 *     kept whole; arrays of objects are traversed.
 * PT: achata um objeto aninhado em {"a.b.c": valor}. Arrays de valores simples
 *     são mantidos inteiros; arrays de objetos são percorridos.
 *
 * @param {any} source
 * @param {string} [prefix='']
 * @param {Record<string, any>} [out={}]
 */
export function flatten(source, prefix = '', out = {}) {
  if (isPlainObject(source)) {
    const entries = Object.entries(source);
    if (entries.length === 0) out[prefix || '$'] = {};
    for (const [key, value] of entries) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (Array.isArray(source)) {
    if (source.length === 0) out[prefix || '$'] = [];
    const allScalar = source.every(isScalar);
    if (allScalar) {
      out[prefix || '$'] = source;
    } else {
      source.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    }
    return out;
  }
  out[prefix || '$'] = source;
  return out;
}

/**
 * ES: compara dos objetos y devuelve las diferencias clasificadas.
 * EN: compares two objects and returns classified differences.
 * PT: compara dois objetos e devolve as diferenças classificadas.
 *
 * @returns {{ added: object[], removed: object[], changed: object[], same: number }}
 */
export function deepDiff(before, after) {
  const flatBefore = flatten(before);
  const flatAfter = flatten(after);
  const added = [];
  const removed = [];
  const changed = [];
  let same = 0;

  for (const [key, value] of Object.entries(flatAfter)) {
    if (!(key in flatBefore)) added.push({ path: key, value });
    else if (JSON.stringify(flatBefore[key]) !== JSON.stringify(value)) changed.push({ path: key, before: flatBefore[key], after: value });
    else same += 1;
  }
  for (const [key, value] of Object.entries(flatBefore)) {
    if (!(key in flatAfter)) removed.push({ path: key, value });
  }
  return { added, removed, changed, same };
}

/** ES/EN/PT: resumen corto para mostrar en pantalla. Short human summary for the screen. */
export function summarizeDiff(diff, limit = 12) {
  const lines = [];
  for (const item of diff.changed.slice(0, limit)) {
    lines.push(`~ ${item.path}: ${JSON.stringify(item.before)} -> ${JSON.stringify(item.after)}`);
  }
  for (const item of diff.added.slice(0, limit)) lines.push(`+ ${item.path}: ${JSON.stringify(item.value)}`);
  for (const item of diff.removed.slice(0, limit)) lines.push(`- ${item.path}: ${JSON.stringify(item.value)}`);
  const total = diff.changed.length + diff.added.length + diff.removed.length;
  if (total > limit) lines.push(`… and ${total - limit} more changes`);
  if (total === 0) lines.push('no changes');
  return lines;
}

export { isScalar, isPlainObject };
export default { deepGet, deepSet, flatten, deepDiff, summarizeDiff, isScalar, isPlainObject };

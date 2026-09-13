/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/result.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: define un tipo "Result": una cajita que o bien contiene
 *     un valor correcto (`ok: true, value`) o bien un error (`ok: false,
 *     error`). Las funciones del sistema devuelven Results en lugar de lanzar
 *     excepciones para los fallos esperados.
 *     POR QUÉ EXISTE: este proyecto trata el error como información de primera
 *     clase (DEC-00004). Si un fallo se pierde en un `try/catch` vacío, no hay
 *     lección posible. Un Result obliga a quien llama a mirar el error, y ese
 *     error se convierte en un INTERRUPTION EVENT documentado.
 *
 * 🇬🇧 EN — WHAT IT DOES: defines a "Result" type: a small box that either
 *     holds a successful value (`ok: true, value`) or an error (`ok: false,
 *     error`). System functions return Results instead of throwing for
 *     expected failures.
 *     WHY IT EXISTS: this project treats errors as first-class information
 *     (DEC-00004). If a failure is lost inside an empty try/catch, no lesson is
 *     possible. A Result forces the caller to look at the error, and that error
 *     becomes a documented INTERRUPTION EVENT.
 *
 * 🇧🇷 PT — O QUE FAZ: define um tipo "Result": uma caixinha que ou contém um
 *     valor de sucesso (`ok: true, value`) ou um erro (`ok: false, error`).
 *     As funções devolvem Results em vez de lançar exceções para falhas
 *     esperadas.
 *     POR QUE EXISTE: este projeto trata o erro como informação de primeira
 *     classe (DEC-00004). Se uma falha se perde num try/catch vazio, não há
 *     lição possível. Um Result obriga quem chama a olhar o erro.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • `throw` vs `return` ES/EN/PT: `throw new Error(...)` interrumpe el
 *     programa hasta que alguien lo atrape con `try/catch`; si nadie lo atrapa,
 *     el programa muere. Devolver un objeto `{ok:false}` NO interrumpe nada:
 *     el flujo continúa y tú decides qué hacer. Para fallos previsibles
 *     (archivo que no existe, entrada inválida) el return es más robusto.
 *     throw aborts until caught; returning a Result keeps control flow.
 *   • `Object.freeze(obj)` ES/EN/PT: congela el objeto para que nadie pueda
 *     modificarlo después. Así un Result no se corrompe al pasar por 10
 *     funciones. Freezes the object so it cannot be mutated later.
 *   • Parámetro por defecto `error = {}` ES/EN/PT: si llamas `fail()` sin
 *     argumentos, `error` vale `{}` en vez de `undefined`. Default parameters
 *     avoid undefined values. Parâmetros padrão evitam undefined.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ES: crea un Result exitoso. EN: creates a successful Result. PT: cria um Result de sucesso.
 * @template T
 * @param {T} value
 */
export function ok(value) {
  return Object.freeze({ ok: true, value, error: null });
}

/**
 * ES: crea un Result fallido con información rica (no solo un mensaje).
 * EN: creates a failed Result with rich information (not just a message).
 * PT: cria um Result falho com informação rica (não apenas uma mensagem).
 *
 * @param {string|Error} errorOrMessage
 * @param {{ code?: string, interruptionType?: string, layer?: string, task?: string, recoverable?: boolean, details?: any }} [meta]
 */
export function fail(errorOrMessage, meta = {}) {
  const message = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
  const stack = errorOrMessage instanceof Error ? errorOrMessage.stack : undefined;
  return Object.freeze({
    ok: false,
    value: null,
    error: Object.freeze({
      message,
      code: meta.code ?? 'unknown_error',
      // ES: este campo conecta el fallo con la taxonomía de interrupciones.
      // EN: this field connects the failure with the interruption taxonomy.
      // PT: este campo conecta a falha com a taxonomia de interrupções.
      interruptionType: meta.interruptionType ?? 'failed',
      layer: meta.layer ?? null,
      task: meta.task ?? null,
      recoverable: meta.recoverable ?? true,
      details: meta.details ?? null,
      stack,
    }),
  });
}

/**
 * ES: ejecuta una función y convierte cualquier excepción en un Result fallido.
 *     Es la forma más segura de envolver código que no controlas.
 * EN: runs a function and converts any exception into a failed Result. It is
 *     the safest way to wrap code you do not control.
 * PT: executa uma função e converte qualquer exceção em um Result falho. É a
 *     forma mais segura de envolver código que você não controla.
 *
 * @template T
 * @param {() => T} fn
 * @param {object} [meta]
 */
export function attempt(fn, meta = {}) {
  try {
    return ok(fn());
  } catch (error) {
    return fail(error, meta);
  }
}

/** ES/EN/PT: ¿es un Result válido? Type guard. Verificador de tipo. */
export function isResult(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.ok === 'boolean';
}

/**
 * ES: desenvuelve un Result o lanza si falló (para scripts donde fallar está bien).
 * EN: unwraps a Result or throws if it failed (for scripts where failing is fine).
 * PT: desempacota um Result ou lança se falhou (para scripts onde falhar é ok).
 */
export function unwrap(result) {
  if (result?.ok) return result.value;
  throw new Error(result?.error?.message ?? 'Result failed without a message');
}

export default { ok, fail, attempt, isResult, unwrap };

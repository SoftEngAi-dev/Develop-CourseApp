/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/stub.js — honest "not implemented yet" contract
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: define la forma ÚNICA en que este proyecto dice "esto
 *     todavía no existe". Cada módulo de las Fases 3-7 devuelve
 *     `notImplemented({...})` en lugar de inventar comportamiento o dejar una
 *     función vacía que devuelve `undefined`.
 *     POR QUÉ EXISTE: el alcance acordado fue "esqueleto físico de las 8 fases +
 *     Fases 0-2 realmente ejecutables" (DEC-00009). Un esqueleto honesto tiene
 *     que gritar que es un esqueleto: si un stub devuelve `undefined`, alguien
 *     descubrirá el hueco en producción. Si devuelve un Result con
 *     `code: 'not_implemented'`, fase, capacidad y ruta al SPEC.md, el hueco se
 *     ve en la primera llamada y en los tests.
 *
 * 🇬🇧 EN — WHAT IT DOES: defines the SINGLE way this project says "this does not
 *     exist yet". Every Phase 3-7 module returns `notImplemented({...})` instead
 *     of inventing behaviour or leaving an empty function returning `undefined`.
 *     WHY IT EXISTS: the agreed scope was "physical skeleton of all 8 phases +
 *     Phases 0-2 truly executable" (DEC-00009). An honest skeleton must shout
 *     that it is a skeleton: if a stub returns `undefined`, somebody discovers
 *     the hole in production. If it returns a Result with `code:'not_implemented'`,
 *     phase, capability and the path to SPEC.md, the hole is visible on the very
 *     first call and in the tests.
 *
 * 🇧🇷 PT — O QUE FAZ: define a forma ÚNICA de dizer "isto ainda não existe".
 *     POR QUE EXISTE: o escopo acordado foi "esqueleto físico das 8 fases +
 *     Fases 0-2 realmente executáveis" (DEC-00009). Um esqueleto honesto deve
 *     gritar que é esqueleto: um stub que devolve `undefined` esconde o buraco;
 *     um Result com `code:'not_implemented'` o mostra na primeira chamada.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Stub vs mock vs fake ES/EN/PT: un STUB tiene la firma correcta y una
 *     respuesta fija (esto). Un MOCK además registra cómo lo llamaste. Un FAKE
 *     sí implementa algo (como un SQLite en memoria). Confundirlos lleva a tests
 *     que pasan sin probar nada. A stub has the right signature and a canned
 *     answer; a mock records calls; a fake really implements something.
 *   • "Fail loud, not silent" ES/EN/PT: el peor error no es el que rompe el
 *     programa, es el que NO lo rompe y devuelve datos vacíos. Fallar pronto y
 *     con mensaje claro ahorra horas. Failing loudly beats failing silently.
 *   • Por qué devolver Result y no `throw` ES/EN/PT: con `throw`, el programa se
 *     detiene salvo que alguien recuerde el try/catch. Con Result, el que llama
 *     DECIDE qué hacer: mostrarlo, saltarlo o abortar. Caller decides.
 *   • Metadatos de interrupción ES/EN/PT: `interruptionType: 'dependency_missing'`
 *     conecta el stub con la taxonomía de 11 "cortes" de DEC-00004. Así un stub
 *     invocado por error se registra como evento observable, no como misterio.
 *     Stubs plug into the 11-type interruption taxonomy (DEC-00004).
 * ═══════════════════════════════════════════════════════════════════════════ */

import { fail } from './result.js';

/** ES/EN/PT: código único y estable que los tests y la UI buscan. */
export const STUB_CODE = 'not_implemented';

/**
 * ES: mapa fase → qué entrega. Es la misma información que control/roadmap.json,
 *     copiada aquí como texto para que el mensaje de error sea autocontenido
 *     (un error que obliga a abrir otro archivo para entenderse es un mal error).
 * EN: phase → deliverables map. Same information as control/roadmap.json, copied
 *     here as text so the error message is self-contained (an error that forces
 *     you to open another file to be understood is a bad error).
 * PT: mapa fase → entregas, copiado para que a mensagem seja autocontida.
 */
export const PHASE_SCOPE = Object.freeze({
  'phase-0': 'Bootstrap: manifest, state, events, logger, checkpoints — IMPLEMENTED',
  'phase-1': 'Capture: session ingestion, raw storage, message parser — IMPLEMENTED',
  'phase-2': 'Knowledge Engine: requirements, plans, decisions, actions, errors, searches — IMPLEMENTED',
  'phase-3': 'Documentation Engine: automatic Markdown, tutorials, timeline, decision traces — SKELETON',
  'phase-4': 'Web App (Next.js): dashboard, sessions, knowledge, documentation, timeline — SKELETON',
  'phase-5': 'Agent: context, planner, executor, verifier, recovery — SKELETON',
  'phase-6': 'Education: courses, lessons, exercises, reverse-engineering curriculum — SKELETON',
  'phase-7': 'Autonomous Evolution: learning, rules, skill generation, optimization — SKELETON',
});

/**
 * ES: construye el Result de "todavía no".
 * EN: builds the "not yet" Result.
 * PT: constrói o Result de "ainda não".
 *
 * @param {object} info
 * @param {string} info.phase        fase que lo entregará ('phase-5')
 * @param {string} info.capability   nombre legible ('plan the next mutation')
 * @param {string} info.module       ruta del módulo que lo declara
 * @param {string} [info.spec]       ruta al SPEC.md con el diseño previsto
 * @param {string} [info.plannedIn]  tarea que lo implementa ('TSK-00008')
 * @param {string} [info.reason]     por qué aún no existe
 * @param {object} [info.available]  qué SÍ se puede usar hoy en su lugar
 * @returns {{ok:false,error:object}}
 */
export function notImplemented(info = {}) {
  const {
    phase = null,
    capability = 'this capability',
    module = null,
    spec = null,
    plannedIn = null,
    reason = 'Deliberately left as a skeleton: the agreed scope is a physical skeleton of all 8 phases with Phases 0-2 executable (DEC-00009).',
    available = null,
  } = info;

  const scope = phase ? PHASE_SCOPE[phase] ?? null : null;

  return fail(`NOT IMPLEMENTED — ${capability}${phase ? ` (planned in ${phase})` : ''}`, {
    code: STUB_CODE,
    interruptionType: 'dependency_missing',
    recoverable: true,
    layer: null,
    task: plannedIn,
    details: {
      phase,
      phase_scope: scope,
      capability,
      module,
      spec,
      planned_in: plannedIn,
      reason,
      available_now: available,
    },
  });
}

/**
 * ES: mensaje humano de un stub, listo para imprimir en terminal o UI.
 * EN: human message of a stub, ready to print in a terminal or UI.
 * PT: mensagem humana de um stub, pronta para terminal ou UI.
 */
export function explainStub(result) {
  if (!result || result.ok !== false || result.error?.code !== STUB_CODE) return null;
  const details = result.error.details ?? {};
  return [
    result.error.message,
    details.phase_scope ? `  phase scope : ${details.phase_scope}` : null,
    details.spec ? `  design      : ${details.spec}` : null,
    details.planned_in ? `  planned in  : ${details.planned_in}` : null,
    details.available_now ? `  use today   : ${details.available_now}` : null,
    details.reason ? `  why         : ${details.reason}` : null,
  ].filter(Boolean).join('\n');
}

/** ES/EN/PT: ¿es este Result un stub? Is this Result a stub? */
export function isStub(result) {
  return Boolean(result && result.ok === false && result.error?.code === STUB_CODE);
}

export default { STUB_CODE, PHASE_SCOPE, notImplemented, explainStub, isStub };

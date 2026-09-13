/* ═══════════════════════════════════════════════════════════════════════════
 * core/event-bus/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: el Event Bus. Es el sistema nervioso del proyecto.
 *     Cualquier cosa que ocurra (llegó un mensaje, se tomó una decisión, falló
 *     un test, se creó un checkpoint) se publica aquí con `bus.emit(...)`.
 *     El bus hace TRES cosas a la vez:
 *       1. AVISA a los suscriptores en memoria (patrón observer).
 *       2. GUARDA el evento en disco como JSONL (nivel RAW, inmutable).
 *       3. LO RETIENE en un búfer para poder inspeccionarlo en la misma ejecución.
 *     POR QUÉ EXISTE: es la implementación literal de la regla central del
 *     proyecto — "Nothing happens without leaving an observable project event"
 *     (POL-0001). Sin bus, la documentación dependería de que alguien recuerde
 *     escribirla. Con bus, documentar es un efecto secundario automático.
 *
 * 🇬🇧 EN — WHAT IT DOES: the Event Bus. It is the project's nervous system.
 *     Anything that happens (a message arrived, a decision was made, a test
 *     failed, a checkpoint was created) is published here with `bus.emit(...)`.
 *     The bus simultaneously does THREE things:
 *       1. NOTIFIES in-memory subscribers (observer pattern).
 *       2. STORES the event on disk as JSONL (RAW level, immutable).
 *       3. KEEPS it in a buffer so this run can inspect it.
 *     WHY IT EXISTS: it is the literal implementation of the project's central
 *     rule — "Nothing happens without leaving an observable project event"
 *     (POL-0001). Without a bus, documentation depends on somebody remembering
 *     to write it. With a bus, documenting is an automatic side effect.
 *
 * 🇧🇷 PT — O QUE FAZ: o Event Bus. É o sistema nervoso do projeto.
 *     Qualquer coisa que aconteça (chegou uma mensagem, uma decisão foi tomada,
 *     um teste falhou, um checkpoint foi criado) é publicada aqui com
 *     `bus.emit(...)`. O bus faz TRÊS coisas ao mesmo tempo:
 *       1. AVISA os assinantes em memória (padrão observer).
 *       2. GUARDA o evento em disco como JSONL (nível RAW, imutável).
 *       3. O RETÉM num buffer para inspeção na mesma execução.
 *     POR QUE EXISTE: é a implementação literal da regra central do projeto —
 *     "Nothing happens without leaving an observable project event" (POL-0001).
 *     Sem o bus, documentar depende de alguém lembrar. Com o bus, documentar é
 *     um efeito colateral automático.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Patrón Observer / Publicador-Suscriptor ES/EN/PT: en vez de que A llame
 *     directamente a B, C y D (acoplamiento duro), A publica "pasó esto" y
 *     quien quiera se suscribe. Mañana puedes añadir E sin tocar A. Esa es la
 *     diferencia entre un sistema que crece y uno que se enreda.
 *     Instead of A calling B, C and D directly, A publishes "this happened" and
 *     whoever cares subscribes. You can add E tomorrow without touching A.
 *   • `Map<string, Set<Function>>` ES/EN/PT: el Map guarda la lista de
 *     suscriptores por tipo de evento; el Set evita suscripciones duplicadas y
 *     permite borrar una con `set.delete(fn)`.
 *     The Map holds subscribers per event type; the Set avoids duplicates.
 *   • `'*'` como comodín ES/EN/PT: quien se suscribe a '*' recibe TODOS los
 *     eventos. Es exactamente lo que necesita el módulo de documentación.
 *     Subscribing to '*' receives EVERY event — what documentation needs.
 *   • `structuredClone(x)` ES/EN/PT: copia profunda nativa de Node. La usamos
 *     para que un suscriptor no pueda modificar por accidente el payload que
 *     otro suscriptor va a leer. Copia profunda = aislamiento entre módulos.
 *     Native deep copy, so one subscriber cannot mutate another's payload.
 *   • JSONL ES/EN/PT: un archivo de texto con UN JSON por línea. Se puede
 *     añadir sin reescribir el archivo entero y se puede leer línea a línea
 *     aunque tenga 2 GB. Es el formato estándar de logs y eventos.
 *     One JSON object per line: append-only, streamable, standard for logs.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../shared/paths.js';
import { appendJsonLine, readJsonLines, ensureDir } from '../shared/json.js';
import { eventId, nextId, ID_PREFIX } from '../shared/ids.js';
import { isEventType, isInterruptionType, INTERRUPTION_TYPES, IMPACT_LEVELS } from './event-types.js';
import { silentLogger } from '../logger/index.js';

/** ES/EN/PT: archivo JSONL del día actual. Today's JSONL event file. */
export function dailySinkFile(date = new Date(), sinkDir = PATHS.rawEvents) {
  const day = date.toISOString().slice(0, 10);
  return path.join(sinkDir, `events-${day}.jsonl`);
}

export class EventBus {
  /**
   * @param {{ sinkDir?: string, persist?: boolean, logger?: object, sessionId?: string|null, bufferSize?: number, strict?: boolean }} [options]
   */
  constructor(options = {}) {
    const {
      sinkDir = PATHS.rawEvents,
      persist = true,
      logger = silentLogger('event-bus'),
      sessionId = null,
      bufferSize = 2000,
      strict = false,
    } = options;

    this.sinkDir = sinkDir;
    this.persist = persist;
    this.logger = logger;
    this.sessionId = sessionId;
    this.bufferSize = bufferSize;
    this.strict = strict;

    // ES: Map<tipoDeEvento, Set<funcionesSuscriptoras>>
    // EN: Map<eventType, Set<subscriberFunctions>>
    // PT: Map<tipoDeEvento, Set<funçõesAssinantes>>
    this._subscribers = new Map();
    this._buffer = [];
    this._sequence = 0;
    this._counts = new Map();
    this._errors = [];

    if (this.persist) ensureDir(this.sinkDir);
  }

  /**
   * ES: suscribe una función a un tipo de evento (o '*' para todos).
   *     Devuelve una función que, al llamarla, cancela la suscripción.
   * EN: subscribes a function to an event type (or '*' for all). Returns a
   *     function that cancels the subscription when called.
   * PT: assina uma função a um tipo de evento (ou '*' para todos). Devolve uma
   *     função que, ao ser chamada, cancela a assinatura.
   *
   * @param {string} type
   * @param {(event: object) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(type, handler) {
    if (typeof handler !== 'function') throw new TypeError('EventBus.on requires a function handler');
    if (!this._subscribers.has(type)) this._subscribers.set(type, new Set());
    this._subscribers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  /** ES/EN/PT: suscribe una sola vez. Subscribe for a single invocation. */
  once(type, handler) {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      handler(event);
    });
    return unsubscribe;
  }

  /** ES/EN/PT: elimina una suscripción. Removes a subscription. */
  off(type, handler) {
    const set = this._subscribers.get(type);
    if (!set) return false;
    const removed = set.delete(handler);
    if (set.size === 0) this._subscribers.delete(type);
    return removed;
  }

  /**
   * ES: publica un evento. Este es el método más importante del proyecto.
   * EN: publishes an event. This is the most important method in the project.
   * PT: publica um evento. Este é o método mais importante do projeto.
   *
   * @param {string} type one of EVENT_TYPES
   * @param {object} [payload] free-form data describing what happened
   * @param {{ layer?: string|null, task?: string|null, sessionId?: string|null, actor?: string, severity?: string }} [meta]
   * @returns {object} the persisted event
   */
  emit(type, payload = {}, meta = {}) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new TypeError('EventBus.emit requires a non-empty event type');
    }
    if (this.strict && !isEventType(type)) {
      throw new Error(`Unknown event type "${type}". Add it to core/event-bus/event-types.js first.`);
    }

    this._sequence += 1;
    const event = {
      id: eventId(this._sequence),
      type,
      ts: new Date().toISOString(),
      layer: meta.layer ?? null,
      task: meta.task ?? null,
      actor: meta.actor ?? 'system',
      severity: meta.severity ?? null,
      session_id: meta.sessionId ?? this.sessionId ?? null,
      payload: payload ?? {},
    };

    // ES: contador por tipo, para el dashboard y `genesis status`.
    // EN: per-type counter, for the dashboard and `genesis status`.
    // PT: contador por tipo, para o dashboard e `genesis status`.
    this._counts.set(type, (this._counts.get(type) ?? 0) + 1);

    // ES: búfer circular: si supera el tamaño, quitamos el más antiguo.
    // EN: ring buffer: if it exceeds the size, drop the oldest entry.
    // PT: buffer circular: se exceder o tamanho, removemos o mais antigo.
    this._buffer.push(event);
    if (this._buffer.length > this.bufferSize) this._buffer.shift();

    // ES: persistencia primero, suscriptores después. Si el disco falla, el
    //     evento queda registrado en `_errors` pero no perdemos la ejecución.
    // EN: persistence first, subscribers after. If the disk fails, the event is
    //     recorded in `_errors` but we do not lose the run.
    // PT: persistência primeiro, assinantes depois. Se o disco falhar, o evento
    //     fica em `_errors` mas não perdemos a execução.
    if (this.persist) {
      try {
        appendJsonLine(dailySinkFile(new Date(event.ts), this.sinkDir), event);
      } catch (error) {
        this._errors.push({ at: event.ts, event: event.id, message: error.message });
        this.logger.error(`Failed to persist event ${event.id}: ${error.message}`);
      }
    }

    this._dispatch(event);
    return event;
  }

  /** @internal ES/EN/PT: notifica a suscriptores específicos + comodín '*'. */
  _dispatch(event) {
    for (const type of [event.type, '*']) {
      const set = this._subscribers.get(type);
      if (!set) continue;
      for (const handler of set) {
        try {
          // ES: copia profunda para aislar suscriptores entre sí.
          // EN: deep copy to isolate subscribers from each other.
          // PT: cópia profunda para isolar os assinantes entre si.
          handler(structuredClone(event));
        } catch (error) {
          this._errors.push({ at: event.ts, event: event.id, handler: type, message: error.message });
          this.logger.error(`Subscriber for "${type}" failed on ${event.id}: ${error.message}`);
        }
      }
    }
  }

  /**
   * ES: atajo para registrar una INTERRUPCIÓN ("corte") como evento de primera
   *     clase, con su taxonomía, impacto y plan de recuperación (DEC-00004).
   * EN: shortcut to record an INTERRUPTION ("corte") as a first-class event,
   *     with its taxonomy, impact and recovery plan (DEC-00004).
   * PT: atalho para registrar uma INTERRUPÇÃO ("corte") como evento de primeira
   *     classe, com sua taxonomia, impacto e plano de recuperação (DEC-00004).
   *
   * @param {{ type: string, reason: string, layer?: string, task?: string, impact?: string, recoverable?: boolean, recoveryPlan?: string[], existingIds?: string[], status?: string }} spec
   */
  interruption(spec) {
    const type = spec?.type ?? 'failed';
    if (!isInterruptionType(type)) {
      // ES: error explícito con la lista válida: mejor que un fallo silencioso.
      // EN: explicit error listing valid values: better than a silent failure.
      // PT: erro explícito com a lista válida: melhor que uma falha silenciosa.
      throw new Error(`Unknown interruption type "${type}". Allowed types: ${INTERRUPTION_TYPES.join(', ')}.`);
    }
    const impact = IMPACT_LEVELS.includes(spec?.impact) ? spec.impact : 'medium';
    const id = nextId(ID_PREFIX.interruption, spec?.existingIds ?? [], 4);
    const payload = {
      id,
      type,
      layer: spec?.layer ?? null,
      task: spec?.task ?? null,
      reason: String(spec?.reason ?? 'unspecified'),
      detected_at: new Date().toISOString(),
      impact,
      recoverable: spec?.recoverable ?? true,
      recovery_plan: Array.isArray(spec?.recoveryPlan) ? spec.recoveryPlan : [],
      status: spec?.status ?? 'open',
    };
    const event = this.emit('INTERRUPTION_RAISED', payload, {
      layer: payload.layer,
      task: payload.task,
      severity: impact,
    });
    return { interruption: payload, event };
  }

  /** ES/EN/PT: eventos en memoria de esta ejecución. In-memory events of this run. */
  history() { return [...this._buffer]; }

  /** ES/EN/PT: recuento por tipo. Per-type counts. */
  counts() { return Object.fromEntries([...this._counts.entries()].sort((a, b) => b[1] - a[1])); }

  /** ES/EN/PT: total emitido. Total emitted. */
  get size() { return this._buffer.length; }

  /** ES/EN/PT: fallos internos del bus (suscriptores rotos, disco lleno...). */
  failures() { return [...this._errors]; }

  /**
   * ES: recarga TODOS los eventos históricos desde disco (todos los días).
   *     Es lo que permite reconstruir el timeline en una sesión nueva.
   * EN: reloads ALL historical events from disk (every day file). This is what
   *     makes it possible to rebuild the timeline in a new session.
   * PT: recarrega TODOS os eventos históricos do disco (todos os arquivos de
   *     dia). É o que permite reconstruir o timeline numa sessão nova.
   *
   * @param {{ limit?: number, type?: string, since?: string, until?: string }} [filter]
   */
  static loadFromDisk(filter = {}, sinkDir = PATHS.rawEvents) {
    if (!fs.existsSync(sinkDir)) return [];
    const files = fs.readdirSync(sinkDir)
      .filter((name) => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .sort();
    let events = [];
    for (const name of files) {
      events.push(...readJsonLines(path.join(sinkDir, name)));
    }
    if (filter.type) events = events.filter((e) => e.type === filter.type);
    if (filter.since) events = events.filter((e) => e.ts >= filter.since);
    if (filter.until) events = events.filter((e) => e.ts <= filter.until);
    events.sort((a, b) => (a.ts === b.ts ? String(a.id).localeCompare(String(b.id)) : a.ts.localeCompare(b.ts)));
    if (filter.limit && events.length > filter.limit) events = events.slice(-filter.limit);
    return events;
  }
}

let SYSTEM_BUS = null;

/**
 * ES: bus global del proceso (singleton perezoso). Se crea la primera vez que
 *     se pide, no al importar el módulo: así los tests pueden usar buses aislados.
 * EN: the process-wide global bus (lazy singleton). Created the first time it
 *     is requested, not at import time: so tests can use isolated buses.
 * PT: bus global do processo (singleton preguiçoso). Criado na primeira vez que
 *     é pedido, não ao importar o módulo: assim os testes podem usar buses isolados.
 */
export function systemBus(options = {}) {
  if (!SYSTEM_BUS) SYSTEM_BUS = new EventBus(options);
  return SYSTEM_BUS;
}

/** ES/EN/PT: reinicia el bus global (solo para tests). Resets the global bus (tests only). */
export function resetSystemBus() { SYSTEM_BUS = null; }

export default EventBus;

/* ═══════════════════════════════════════════════════════════════════════════
 * tests/event-bus.test.js — VERIFICATION LEVEL: unit + integration
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la regla central del proyecto —"nada ocurre sin dejar un
 *     evento observable"— en tres frentes: (1) la taxonomía declarada existe y
 *     está cerrada (19 tipos de evento, 11 tipos de interrupción, 11 capas,
 *     13 estados de tarea); (2) el bus entrega eventos a sus suscriptores y los
 *     cuenta; (3) el sink de disco escribe JSONL y `loadFromDisk` lo reconstruye
 *     con filtros. Todo en directorios temporales: el sink real no se toca.
 * 🇬 EN — WHAT IT TESTS: the project's central rule —"nothing happens without
 *     leaving an observable project event"— on three fronts: (1) the declared
 *     taxonomy exists and is closed (19 event types, 11 interruption types, 11
 *     layers, 13 task states); (2) the bus delivers events to subscribers and
 *     counts them; (3) the disk sink writes JSONL and `loadFromDisk` rebuilds it
 *     with filters. All in temp directories: the real sink is untouched.
 * 🇧🇷 PT — O QUE TESTA: a regra central —"nada acontece sem deixar um evento
 *     observável"— em três frentes: taxonomia fechada, entrega a assinantes e
 *     sink JSONL reconstruível com filtros. Tudo em diretórios temporários.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Taxonomía cerrada ES/EN/PT: si cualquiera pudiera inventar tipos de evento
 *     sobre la marcha, el timeline sería un cementerio de sinónimos. Los tipos
 *     viven en UN archivo y los tests vigilan que nadie los duplique.
 *     Event types live in one file; tests guard against synonym graveyards.
 *   • Publicar-subscribir ES/EN/PT: `bus.on(type, fn)` registra un suscriptor;
 *     `bus.emit(type, payload)` los llama a todos. El emisor no sabe quién
 *     escucha: por eso añadir un listener nuevo no toca ningún emisor.
 *     Publishers never know their subscribers: adding a listener changes nothing.
 *   • JSONL ES/EN/PT: un JSON por línea. Se puede AÑADIR sin reescribir el
 *     archivo (append), que es justo lo que necesita un registro de eventos que
 *     nunca se edita. One JSON per line = append-only log.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventBus } from '../core/event-bus/index.js';
import { EVENT_TYPES, INTERRUPTION_TYPES, LAYERS, TASK_STATES, TASK_TRANSITIONS } from '../core/event-bus/event-types.js';
import { createLogger } from '../core/logger/index.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-bus-'));
const quietBus = (sinkDir) => new EventBus({ logger: createLogger({ scope: 'test-bus', quiet: true }), sinkDir });

test('the declared taxonomy is closed and complete', () => {
  assert.equal(new Set(EVENT_TYPES).size, EVENT_TYPES.length, 'no duplicated event types');
  assert.ok(EVENT_TYPES.length >= 19, 'the architecture declares 19+ event types');

  assert.equal(INTERRUPTION_TYPES.length, 11, 'DEC-00004 fixes eleven interruption types');
  for (const expected of ['blocked', 'failed', 'interrupted', 'waiting_user', 'dependency_missing', 'tool_error', 'ambiguity', 'conflict', 'resource_limit', 'security_stop', 'scope_change']) {
    assert.ok(INTERRUPTION_TYPES.includes(expected), `missing interruption type ${expected}`);
  }

  assert.equal(LAYERS.length, 11, 'eleven build layers');
  assert.equal(TASK_STATES.length, 13, 'thirteen task states');
  assert.ok(Object.keys(TASK_TRANSITIONS).length > 0);
});

test('emit delivers to subscribers and counts what happened', () => {
  const bus = quietBus(tmp());
  const seen = [];
  bus.on('DECISION_MADE', (event) => seen.push(event.payload.id));
  bus.on('*', (event) => seen.push(`any:${event.type}`));

  bus.emit('DECISION_MADE', { id: 'DEC-00001' }, { layer: 'architecture' });
  assert.deepEqual(seen, ['DEC-00001', 'any:DECISION_MADE']);
  assert.equal(bus.counts().DECISION_MADE, 1);
});

test('the sink persists JSONL and loadFromDisk rebuilds it with filters', () => {
  const sink = tmp();
  const bus = quietBus(sink);
  bus.emit('SESSION_STARTED', { n: 1 }, { layer: 'core-engine' });
  bus.emit('DECISION_MADE', { n: 2 }, { layer: 'architecture' });
  bus.emit('ERROR_DETECTED', { n: 3 }, { layer: 'infrastructure', severity: 'high' });

  const files = fs.readdirSync(sink).filter((name) => name.startsWith('events-'));
  assert.equal(files.length, 1, 'one file per day');

  const all = EventBus.loadFromDisk({}, sink);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((event) => event.type), ['SESSION_STARTED', 'DECISION_MADE', 'ERROR_DETECTED']);

  const onlyErrors = EventBus.loadFromDisk({ type: 'ERROR_DETECTED' }, sink);
  assert.equal(onlyErrors.length, 1);
  assert.equal(onlyErrors[0].payload.n, 3);

  const limited = EventBus.loadFromDisk({ limit: 2 }, sink);
  assert.equal(limited.length, 2, 'limit keeps the most recent');

  for (const event of all) {
    assert.ok(event.id, 'every stored event carries an id');
    assert.ok(event.ts, 'every stored event carries a timestamp');
  }
  fs.rmSync(sink, { recursive: true, force: true });
});

test('a broken subscriber cannot kill the bus nor the emitter', () => {
  const bus = quietBus(tmp());
  bus.on('DECISION_MADE', () => { throw new Error('subscriber exploded'); });
  const delivered = [];
  bus.on('DECISION_MADE', (event) => delivered.push(event.payload.n));

  assert.doesNotThrow(() => bus.emit('DECISION_MADE', { n: 7 }, { layer: 'architecture' }));
  assert.deepEqual(delivered, [7], 'the healthy subscriber still receives the event');
  assert.ok(bus.failures().length >= 1, 'the failure is recorded, not swallowed');
});

test('persist:false keeps the bus in memory (used by tests and dry runs)', () => {
  const sink = tmp();
  const bus = new EventBus({ persist: false, sinkDir: sink, logger: createLogger({ scope: 'test', quiet: true }) });
  bus.emit('STATE_UPDATED', { n: 1 }, { layer: 'infrastructure' });
  assert.equal(EventBus.loadFromDisk({}, sink).length, 0, 'nothing may reach the disk');
  assert.equal(bus.counts().STATE_UPDATED, 1);
  fs.rmSync(sink, { recursive: true, force: true });
});

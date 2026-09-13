/* ═══════════════════════════════════════════════════════════════════════════
 * tests/core-primitives.test.js — VERIFICATION LEVEL: unit
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪 ES — QUÉ PRUEBA: las piezas mínimas sobre las que se apoya TODO lo demás:
 *     Result (ok/fail/attempt/unwrap), ids (ancho heredado, slugs seguros),
 *     json (lectura/escritura/append atómico), deep (get/set/diff) y el
 *     validador de esquemas estilo Zod del plano de control.
 *     POR QUÉ IMPORTA: un bug en `nextId()` o en `writeJson()` no rompe un test:
 *     rompe el proyecto entero en silencio. Estas son las pruebas más baratas y
 *     más rentables que existen.
 * 🇬 EN — WHAT IT TESTS: the minimal pieces everything else leans on: Result
 *     (ok/fail/attempt/unwrap), ids (inherited width, safe slugs), json (atomic
 *     read/write/append), deep (get/set/diff) and the Zod-like control-plane
 *     schema validator.
 *     WHY IT MATTERS: a bug in `nextId()` or `writeJson()` does not break one
 *     test: it breaks the whole project silently. These are the cheapest and most
 *     profitable tests that exist.
 * 🇧🇷 PT — O QUE TESTA: as peças mínimas de tudo: Result, ids, json, deep e o
 *     validador de esquemas. Um bug aqui quebra o projeto inteiro em silêncio.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Tests de unidad ES/EN/PT: prueban UNA función con entradas pequeñas y sin
 *     tocar disco ni red cuando es posible. Aquí usamos `fs.mkdtempSync` para los
 *     casos que sí necesitan archivo: cada test deja su basura en /tmp, no en el
 *     repositorio. Unit tests: one function, tiny inputs, temp dirs for I/O.
 *   • El ancho de un id ES/EN/PT: `REQ-0001` tiene 4 dígitos y `REQ-00011` cinco.
 *     Si el generador ignorara los ids existentes, crearía `REQ-00001` al lado de
 *     `REQ-0001`: dos formatos para la misma entidad. nextId hereda el ancho.
 *     nextId inherits the digit width of the ids that already exist.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ok, fail, attempt, isResult, unwrap } from '../core/shared/result.js';
import { nextId, formatId, safeSlug, compactTimestamp } from '../core/shared/ids.js';
import { readJson, writeJson, appendJsonLine, readJsonLines, ensureDir } from '../core/shared/json.js';
import { deepGet, deepSet, deepDiff, flatten } from '../core/shared/deep.js';
import { s, ProjectManifestSchema, EventSchema } from '../core/validation/schema.js';
import { PATHS } from '../core/shared/paths.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-test-'));

test('Result: ok/fail carry values and typed errors', () => {
  const good = ok({ n: 1 });
  assert.equal(good.ok, true);
  assert.equal(good.value.n, 1);

  const bad = fail('boom', { code: 'boom_code', interruptionType: 'failed' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.message, 'boom');
  assert.equal(bad.error.code, 'boom_code');
  assert.equal(bad.error.recoverable, true, 'errors default to recoverable');

  assert.equal(isResult(good), true);
  assert.equal(isResult({}), false);
  assert.equal(unwrap(good).n, 1);
  assert.throws(() => unwrap(bad));
});

test('Result: attempt converts thrown errors into fail, not crashes', () => {
  const crashed = attempt(() => { throw new Error('kaboom'); });
  assert.equal(crashed.ok, false);
  assert.match(crashed.error.message, /kaboom/);

  const fine = attempt(() => 42);
  assert.equal(fine.ok, true);
  assert.equal(fine.value, 42);
});

test('ids: nextId inherits the width of existing ids (REQ-0001 vs REQ-00011)', () => {
  assert.equal(nextId('REQ', ['REQ-0001', 'REQ-0002']), 'REQ-0003');
  assert.equal(nextId('REQ', ['REQ-00011']), 'REQ-00012');
  assert.equal(nextId('DEC', []), 'DEC-00001', 'empty history starts at width 5');
  assert.equal(formatId('NOD', 77, 5), 'NOD-00077');
});

test('ids: safeSlug refuses to smuggle paths or punctuation', () => {
  assert.equal(safeSlug('Hello World!'), 'hello-world');
  assert.equal(safeSlug('../../etc/passwd'), 'etc-passwd');
  assert.ok(safeSlug('x'.repeat(200)).length <= 60, 'slugs are capped');
  assert.match(compactTimestamp(new Date('2026-09-13T10:20:30Z')), /^20260913T102030Z$/);
});

test('json: write is atomic enough to survive a read right after', () => {
  const dir = tmp();
  const file = path.join(dir, 'nested', 'state.json');
  ensureDir(path.dirname(file));
  writeJson(file, { a: 1, b: [1, 2] });
  assert.deepEqual(readJson(file), { a: 1, b: [1, 2] });
  assert.equal(readJson(path.join(dir, 'missing.json'), { fallback: true }).fallback, true);

  const lines = path.join(dir, 'events.jsonl');
  appendJsonLine(lines, { n: 1 });
  appendJsonLine(lines, { n: 2 });
  assert.deepEqual(readJsonLines(lines).map((row) => row.n), [1, 2]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('deep: get/set/diff power the checkpoint diffs', () => {
  const target = {};
  deepSet(target, 'a.b.c', 7);
  assert.equal(deepGet(target, 'a.b.c'), 7);
  assert.equal(deepGet(target, 'a.x.y', 'dflt'), 'dflt');
  assert.deepEqual(flatten({ a: { b: 1 }, c: 2 }), { 'a.b': 1, c: 2 });

  const diff = deepDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 20, d: 4 });
  assert.deepEqual(diff.changed.map((entry) => entry.path), ['b'], 'only b changed');
  assert.deepEqual(diff.added.map((entry) => entry.path), ['d'], 'd was added');
  assert.deepEqual(diff.removed.map((entry) => entry.path), ['c'], 'c was removed');
  assert.equal(diff.same, 1, 'a stayed equal');
});

test('schema: the real manifest validates against ProjectManifestSchema', () => {
  const manifest = readJson(PATHS.manifest);
  const result = ProjectManifestSchema.safeParse(manifest);
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []).slice(0, 400));
});

test('schema: rejects a manifest without its central rule', () => {
  const manifest = readJson(PATHS.manifest);
  delete manifest.vision.central_rule;
  const result = ProjectManifestSchema.safeParse(manifest);
  assert.equal(result.ok, false);
});

test('schema: EventSchema enforces type and timestamp', () => {
  const good = EventSchema.safeParse({ id: 'EVT-00001', type: 'DECISION_MADE', ts: new Date().toISOString(), payload: {} });
  assert.equal(good.ok, true, JSON.stringify(good.errors ?? []).slice(0, 300));
  const bad = EventSchema.safeParse({ id: 'EVT-00001', ts: new Date().toISOString() });
  assert.equal(bad.ok, false, 'an event without type is not an event');
});

test('schema: trilingual fields accept a plain string and expand it', () => {
  const schema = s.object({ title: s.trilingual() });
  const result = schema.safeParse({ title: 'hola' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.title, { es: 'hola', en: 'hola', pt: 'hola' });
  const missing = schema.safeParse({ title: { es: 'hola' } });
  assert.equal(missing.ok, false, 'en is required by default');
});

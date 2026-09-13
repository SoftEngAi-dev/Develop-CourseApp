/* ═══════════════════════════════════════════════════════════════════════════
 * tests/console-pwa.test.js — the offline/installable promise, under test
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: que la promesa de POL-0011 y DEC-00012 es REAL y no
 *     marketing: manifiesto válido con iconos existentes, service worker con las
 *     estrategias declaradas, snapshot congelado que cubre las rutas que la app
 *     pide al arrancar, y un servidor que sirve todo con los Content-Type y
 *     Cache-Control correctos.
 *     POR QUÉ IMPORTA: "funciona offline" es exactamente el tipo de afirmación que
 *     se rompe en silencio (un icono que falta y el móvil no instala; un sw.js
 *     cacheado para siempre y la app queda congelada). Estos tests convierten la
 *     promesa en algo que `npm test` defiende.
 *
 * 🇬 EN — WHAT IT TESTS: that the POL-0011 / DEC-00012 promise is REAL and not
 *     marketing: a valid manifest with existing icons, a service worker with the
 *     declared strategies, a frozen snapshot covering the routes the app requests
 *     on boot, and a server serving everything with the right Content-Type and
 *     Cache-Control.
 *     WHY IT MATTERS: "works offline" is exactly the kind of claim that breaks
 *     silently (a missing icon and the phone refuses to install; an sw.js cached
 *     forever and the app freezes on an old version). These tests turn the promise
 *     into something `npm test` defends.
 *
 * 🇧🇷 PT — O QUE TESTA: que a promessa de POL-0011/DEC-00012 é REAL: manifesto
 *     válido com ícones existentes, service worker com as estratégias declaradas,
 *     snapshot congelado cobrindo as rotas do boot e servidor com Content-Type e
 *     Cache-Control corretos.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • node:test ES/EN/PT: el runner de tests QUE VIENE CON NODE (>=18). Cero
 *     dependencias, como manda POL-0001. `test()` registra un caso; `assert`
 *     comprueba. Se ejecuta con `node --test tests/`.
 *     Node ships its own test runner: zero dependencies, as POL-0001 demands.
 *   • Servidor efímero (puerto 0) ES/EN/PT: pedir el puerto 0 deja que el sistema
 *     elija uno LIBRE. Así los tests no chocan con el `genesis serve` que el
 *     usuario tenga abierto. Port 0 = "any free port", no collisions.
 *   • Leer el PNG a mano ES/EN/PT: los bytes 16-23 de un PNG son ancho y alto en
 *     big-endian. Comprobarlos detecta un icono corrupto sin ninguna librería de
 *     imágenes. PNG width/height live at bytes 16..23.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATHS } from '../core/shared/paths.js';
import { startServer } from '../core/api/server.js';
import { createLogger } from '../core/logger/index.js';
import { EventBus } from '../core/event-bus/index.js';
import { closeDatabase } from '../knowledge/db/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONSOLE = path.join(ROOT, 'apps', 'console');

const read = (relative) => fs.readFileSync(path.join(CONSOLE, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(CONSOLE, relative));

test('manifest.webmanifest is valid JSON with the icons that a PWA needs', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name.includes('GENESIS'), true);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url, 'start_url is required to install');
  assert.ok(manifest.theme_color, 'theme_color is required for the OS chrome');
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'), 'installability requires a 192px icon');
  assert.ok(sizes.includes('512x512'), 'installability requires a 512px icon');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'Android needs a maskable icon');
  for (const icon of manifest.icons) {
    assert.ok(exists(icon.src.replace('./', '')), `icon declared in the manifest must exist: ${icon.src}`);
  }
});

test('icons are real PNGs with the declared dimensions', () => {
  const cases = [
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/maskable-512.png', 512],
    ['icons/apple-touch-icon.png', 180],
  ];
  for (const [file, expected] of cases) {
    const buffer = fs.readFileSync(path.join(CONSOLE, file));
    assert.equal(buffer.slice(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} must carry the PNG signature`);
    assert.equal(buffer.readUInt32BE(16), expected, `${file} width`);
    assert.equal(buffer.readUInt32BE(20), expected, `${file} height`);
    assert.equal(buffer[25], 6, `${file} must be RGBA (colour type 6)`);
  }
});

test('service worker declares the three cache strategies the app relies on', () => {
  const sw = read('sw.js');
  assert.match(sw, /CACHE-FIRST|cache-first/, 'shell must be cache-first');
  assert.match(sw, /NETWORK-FIRST|network-first/i, 'api must be network-first');
  assert.ok(sw.includes('X-Genesis-Offline'), 'the SW must tag cached responses so the UI can flag them');
  assert.ok(sw.includes("self.addEventListener('fetch'"), 'a SW that does not intercept fetch cannot serve offline');
  for (const shellFile of ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'snapshot.json']) {
    assert.ok(sw.includes(`'./${shellFile}'`), `the app shell must precache ${shellFile}`);
  }
});

test('snapshot.json covers every route the app requests while booting', () => {
  const snapshot = JSON.parse(read('snapshot.json'));
  assert.ok(snapshot.meta.generated_at, 'the snapshot must say when it was frozen');
  assert.equal(snapshot.meta.failures.length, 0, 'the snapshot must freeze cleanly');
  const keys = new Set(Object.keys(snapshot.data));
  for (const key of ['health', 'stats', 'state', 'manifest', 'roadmap', 'tasks', 'decisions', 'requirements', 'sessions', 'timeline?limit=400', 'lessons', 'interruptions', 'checkpoints', 'graph?limit=220', 'context', 'context?format=text', 'context?format=md', 'recent?limit=5']) {
    assert.ok(keys.has(key), `snapshot must include ${key}`);
  }
  assert.ok(snapshot.data.stats?.processing?.decisions > 0, 'the snapshot must carry real data, not empty shells');
  assert.ok(Array.isArray(snapshot.data['decisions']?.decisions), 'decisions list must survive the freeze');
});

test('the zero-dependency server serves the PWA with correct types and cache rules', async (t) => {
  const logger = createLogger({ scope: 'test-pwa', quiet: true });
  const bus = new EventBus({ logger });
  const started = await startServer({ port: 0, host: '127.0.0.1', logger, bus });
  t.after(() => { started.server.close(); closeDatabase(); });
  const base = `http://127.0.0.1:${started.port}`;

  const cases = [
    ['/manifest.webmanifest', 'application/manifest+json', 'no-cache'],
    ['/sw.js', 'text/javascript', 'no-cache'],
    ['/snapshot.json', 'application/json', 'no-cache'],
    ['/index.html', 'text/html', 'no-cache'],
    ['/icons/icon-512.png', 'image/png', 'max-age=3600'],
  ];
  for (const [route, type, cache] of cases) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.ok(response.headers.get('content-type').includes(type), `${route} content-type`);
    assert.ok(response.headers.get('cache-control').includes(cache), `${route} cache-control`);
  }

  const spa = await fetch(`${base}/graph`);
  assert.equal(spa.status, 200, 'SPA fallback must serve the app shell for client routes');
  assert.ok(spa.headers.get('content-type').includes('text/html'));
});

test('every element id the console reads exists in its HTML', () => {
  const html = read('index.html');
  const js = read('app.js');
  const used = [...new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map((match) => match[1]))];
  for (const id of used) {
    assert.ok(html.includes(`id="${id}"`), `index.html must define #${id}`);
  }
});

test('offline assets stay inside the console folder (no build output in git)', () => {
  for (const forbidden of ['node_modules', 'dist', 'build', '.next']) {
    assert.ok(!exists(forbidden), `apps/console must not contain ${forbidden}`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, '.gitignore')), 'the repo must keep a .gitignore');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /data\/indexes/, 'the derived database must stay out of git');
});

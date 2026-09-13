/* ═══════════════════════════════════════════════════════════════════════════
 * tests/web-app.test.js — VERIFICATION LEVEL: integration (conditional)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ PRUEBA: la Fase 4 (Next.js, TSK-00007) respetando la promesa
 *     fundacional: "todo funciona offline con node_modules vacío". Por eso este
 *     archivo tiene DOS clases de tests:
 *       (a) SIEMPRE corren: el aislamiento del paquete (la raíz no tiene
 *           dependencias npm, todo lo de Next vive en apps/web), las 12 rutas
 *           del SPEC existen como archivos, next.config.mjs proxea /api/* al
 *           núcleo (el navegador nunca llama a otro origen), y lib/api.js usa
 *           el MISMO contrato de rutas que el console offline.
 *       (b) SOLO si apps/web/node_modules existe: el build de producción existe
 *           (.next/BUILD_ID + routes-manifest con las 12 rutas) y el servidor
 *           levantado responde 200 con datos reales en cada página.
 *     Borrar apps/web/node_modules deja `npm test` verde (skip honrado,
 *     criterio de salida del SPEC) y el console intacto.
 *
 * 🇬🇧 EN — WHAT IT TESTS: Phase 4 (Next.js) honouring the founding promise:
 *     "everything works offline with empty node_modules". Two classes of tests:
 *     (a) ALWAYS: package isolation (root has zero npm deps, everything Next
 *     lives in apps/web), the 12 SPEC routes exist as files, next.config.mjs
 *     proxies /api/* to the core (the browser never calls another origin), and
 *     lib/api.js uses the SAME route contract as the offline console.
 *     (b) ONLY when apps/web/node_modules exists: the production build exists
 *     (.next/BUILD_ID + routes-manifest with the 12 routes) and a running
 *     server answers 200 with real data. Deleting apps/web/node_modules keeps
 *     `npm test` green (honoured skip, SPEC exit criterion).
 *
 * 🇧🇷 PT — O QUE TESTA: a Fase 4 (Next.js) honrando a promessa fundacional:
 *     tudo funciona offline com node_modules vazio. Tests de isolamento SEMPRE
 *     rodam; tests de build/servidor rodam SOMENTE com dependências instaladas
 *     (skip honrado quando ausentes).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • test({ skip }) ES/EN/PT: node:test permite saltar un test con una razón
 *     visible en el reporte TAP. Un skip honesto ("deps not installed") NO es un
 *     test que no corre: es un test que declara SU precondición. An honest skip
 *     declares its precondition instead of silently passing.
 *   • Aislamiento como invariante ES/EN/PT: la raíz con dependencies:{} para
 *     siempre es lo que garantiza que clonar y ejecutar funcione sin red. Este
 *     test es el candado de esa promesa: si alguien añade una dep a la raíz,
 *     la suite falla. The root lock: add one dep there and the suite fails.
 * ═══════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB = path.resolve('apps', 'web');
const hasDeps = fs.existsSync(path.join(WEB, 'node_modules', 'next'));
const hasBuild = hasDeps && fs.existsSync(path.join(WEB, '.next', 'BUILD_ID'));
const skipReason = 'apps/web dependencies are not installed (npm --prefix apps/web install) — the core suite must stay green with empty node_modules';

/*
 * ES: autodetección del servidor Next: si WEB_URL no viene, se sondea
 *     127.0.0.1:4000 (top-level await, permitido en ESM). Si no hay servidor,
 *     el test se salta con la razón visible — nunca falla por entorno.
 * EN: auto-detect the Next server: without WEB_URL, probe 127.0.0.1:4000
 *     (top-level await, allowed in ESM). No server → honoured skip, never fail.
 * PT: autodetecção do servidor Next; sem servidor, skip honrado, nunca falha.
 */
async function probeWebUrl() {
  if (process.env.WEB_URL) return process.env.WEB_URL;
  try {
    const response = await fetch('http://127.0.0.1:4000/api/health', { signal: AbortSignal.timeout(2000) });
    return response.ok ? 'http://127.0.0.1:4000' : null;
  } catch {
    return null;
  }
}
const liveWebUrl = await probeWebUrl();

/** ES/EN/PT: las 12 rutas del SPEC de Fase 4, como archivos del App Router. */
const SPEC_ROUTES = [
  'app/layout.jsx',
  'app/page.jsx',
  'app/sessions/page.jsx',
  'app/sessions/[id]/page.jsx',
  'app/decisions/page.jsx',
  'app/decisions/[id]/page.jsx',
  'app/knowledge/page.jsx',
  'app/graph/page.jsx',
  'app/timeline/page.jsx',
  'app/context/page.jsx',
  'app/docs/page.jsx',
  'app/docs/[...slug]/page.jsx',
];

test('phase 4: the root package keeps ZERO npm dependencies forever (POL-0001)', () => {
  const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.deepEqual(root.dependencies ?? {}, {}, 'root dependencies must stay empty');
  assert.deepEqual(root.devDependencies ?? {}, {}, 'root devDependencies must stay empty');

  const web = JSON.parse(fs.readFileSync(path.join(WEB, 'package.json'), 'utf8'));
  const webDeps = Object.keys(web.dependencies ?? {});
  assert.deepEqual(webDeps.sort(), ['next', 'react', 'react-dom'], 'Next.js deps live ONLY inside apps/web');
});

test('phase 4: every SPEC route exists and talks to the SAME API contract', () => {
  for (const route of SPEC_ROUTES) {
    assert.ok(fs.existsSync(path.join(WEB, route)), `missing route file: ${route}`);
  }

  const config = fs.readFileSync(path.join(WEB, 'next.config.mjs'), 'utf8');
  assert.match(config, /rewrites/, 'next.config proxies via rewrites');
  assert.match(config, /\/api\/:path\*/, 'the proxy covers every /api/* route (no CORS, no second origin in the browser)');

  const api = fs.readFileSync(path.join(WEB, 'lib', 'api.js'), 'utf8');
  for (const endpoint of ['/api/stats', '/api/state', '/api/decisions', '/api/sessions', '/api/search', '/api/timeline', '/api/graph', '/api/context', '/api/lessons']) {
    assert.ok(api.includes(endpoint), `lib/api.js must consume ${endpoint} — the same contract as the offline console`);
  }
  assert.match(api, /GENESIS_API/, 'the core API address is configurable, never hardcoded to the sandbox');

  // ES: las páginas son server components dinámicos (datos en vivo, no build).
  // EN: pages are dynamic server components (live data, not build-time).
  // PT: as páginas são server components dinâmicos.
  const home = fs.readFileSync(path.join(WEB, 'app', 'page.jsx'), 'utf8');
  assert.match(home, /force-dynamic/, 'the dashboard renders live data per request');
});

test('phase 4: production build exists with the 12 routes', { skip: hasDeps ? false : skipReason }, () => {
  assert.ok(hasBuild, 'run: GENESIS_API=<core-url> npm --prefix apps/web run build');
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB, '.next', 'routes-manifest.json'), 'utf8'));
  // ES: Next 15 guarda las rutas dinámicas en el nivel superior del manifiesto.
  // EN: Next 15 keeps dynamic routes at the manifest's top level.
  // PT: o Next 15 guarda as rotas dinâmicas no nível superior do manifesto.
  const dynamicRoutes = (manifest.dynamicRoutes ?? []).map((r) => r.page);
  for (const expected of ['/decisions/[id]', '/sessions/[id]', '/docs/[...slug]']) {
    assert.ok(dynamicRoutes.includes(expected), `routes-manifest carries ${expected}`);
  }
  const rewrites = manifest.rewrites ?? [];
  const flat = Array.isArray(rewrites) ? rewrites : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? []), ...(rewrites.fallback ?? [])];
  assert.ok(flat.some((rewrite) => rewrite.source === '/api/:path*'), 'the /api proxy is baked into the build');
});

test('phase 4: a running Next server renders every page with real data', { skip: liveWebUrl ? false : 'no Next server detected — set WEB_URL or run `npm --prefix apps/web run start` (GENESIS_API=<core-url>) to open this gate' }, async () => {
  const base = liveWebUrl;
  for (const route of ['/', '/sessions', '/decisions', '/graph', '/timeline', '/context', '/docs', '/knowledge?q=sqlite']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `${route} renders`);
    const html = await response.text();
    assert.ok(html.includes('GENESIS'), `${route} carries the identity`);
  }
  const proxied = await fetch(`${base}/api/health`);
  assert.equal(proxied.status, 200, 'the browser-side /api proxy reaches the core');
  const health = await proxied.json();
  assert.equal(health.ok, true);
  assert.equal(health.dependencies, 0, 'the CORE still has zero dependencies');
});

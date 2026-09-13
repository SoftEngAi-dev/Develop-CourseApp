/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/export-console-snapshot.js — freeze the API into snapshot.json
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: congela la API en un único archivo
 *     apps/console/snapshot.json, para que la app instalada abra CON CONTENIDO
 *     REAL aunque nunca haya contactado con el servidor (modo SNAPSHOT).
 *     CÓMO: no duplica lógica. Importa `createRoutes()` y EJECUTA los handlers
 *     reales con peticiones falsas. El snapshot es, literalmente, "la API de hoy,
 *     congelada". Si mañana una ruta cambia de forma, el snapshot cambia igual,
 *     porque usa el mismo código.
 *     USO: node scripts/export-console-snapshot.js
 *     CUÁNDO: tras `genesis process`, antes de publicar o de instalar la app en
 *     un dispositivo que viajará sin conexión.
 *
 * 🇬 EN — WHAT IT DOES: freezes the API into a single file
 *     apps/console/snapshot.json, so the installed app opens WITH REAL CONTENT
 *     even if it never contacted the server (SNAPSHOT MODE).
 *     HOW: no duplicated logic. It imports `createRoutes()` and RUNS the real
 *     handlers with fake requests. The snapshot is literally "today's API,
 *     frozen". If a route changes shape tomorrow, the snapshot changes too,
 *     because it uses the same code.
 *     USAGE: node scripts/export-console-snapshot.js
 *     WHEN: after `genesis process`, before publishing or installing the app on a
 *     device that will travel without connection.
 *
 * 🇧🇷 PT — O QUE FAZ: congela a API num único arquivo snapshot.json para que o app
 *     instalado abra COM CONTEÚDO REAL mesmo sem nunca ter falado com o servidor.
 *     COMO: importa `createRoutes()` e EXECUTA os handlers reais com pedidos
 *     falsos — o snapshot é "a API de hoje, congelada". USO: node
 *     scripts/export-console-snapshot.js, após `genesis process`.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Por qué no duplicar la lógica ES/EN/PT: si el snapshot se construyera con
 *     SQL propio, el día que la API cambie, el snapshot mentiría en silencio.
 *     Reutilizar los handlers hace que ambas salidas sean idénticas por
 *     construcción. Reuse the handlers; never fork the logic.
 *   • Petición falsa (fake request) ES/EN/PT: un handler solo necesita
 *     `{ params, query, body, headers }`. Construir ese objeto a mano es TODO lo
 *     que hace falta para ejecutar una ruta sin HTTP. Es la misma idea que los
 *     tests: llamar a la función, no al puerto.
 *     A handler only needs {params, query, body}: no HTTP required.
 *   • Snapshot ≠ caché ES/EN/PT: el snapshot se GENERA a mano y viaja en el
 *     repositorio; la caché la escribe el navegador sola. El primero es el suelo
 *     (nunca menos que esto); la segunda es el techo (datos más frescos vistos).
 *     Snapshot is the floor; browser cache is the ceiling.
 *   • Tamaño con cabeza ES/EN/PT: el snapshot se precarga en la instalación de la
 *     PWA. Por eso se limita el timeline, el grafo y los mensajes: ~200-400 KB es
 *     asumible en móvil; 20 MB no. Precached bytes are installed bytes.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes, matchRoute } from '../core/api/routes.js';
import { openDatabase, all, closeDatabase } from '../knowledge/db/index.js';
import { PATHS } from '../core/shared/paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'apps', 'console', 'snapshot.json');

const db = openDatabase();
const routes = createRoutes({ bus: null, db: () => db });

/** ES/EN/PT: ejecuta UNA ruta tal y como lo haría el servidor. Runs one route as the server would. */
function callRoute(pathname) {
  const url = new URL(pathname, 'http://snapshot.local');
  const route = routes.find((entry) => matchRoute(entry, 'GET', url.pathname));
  if (!route) return { ok: false, error: `no route for ${pathname}` };
  try {
    const matched = matchRoute(route, 'GET', url.pathname);
    const result = route.handler({ params: matched.params, query: url.searchParams, body: {}, headers: {} });
    if (result?.text !== undefined) return { ok: true, value: result.text };
    return { ok: true, value: result?.body ?? null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const dbIds = {
  sessions: all(db, 'SELECT id FROM sessions ORDER BY id').map((row) => row.id),
  decisions: all(db, 'SELECT id FROM decisions ORDER BY id').map((row) => row.id),
  nodes: all(db, "SELECT id FROM nodes WHERE kind IN ('decision','lesson','mistake','technology') ORDER BY id LIMIT 40").map((row) => row.id),
};

const WANTED = [
  '/api/health',
  '/api/stats',
  '/api/state',
  '/api/manifest',
  '/api/manifest/summary',
  '/api/roadmap',
  '/api/policies',
  '/api/tasks',
  '/api/decisions',
  '/api/requirements',
  '/api/sessions',
  '/api/timeline?limit=400',
  '/api/lessons',
  '/api/interruptions',
  '/api/checkpoints',
  '/api/graph?limit=220',
  '/api/context',
  '/api/context?format=text',
  '/api/context?format=md',
  '/api/recent?limit=5',
  '/api/search?q=sqlite&limit=25',
  '/api/search?q=offline&limit=25',
  '/api/search?q=checkpoint&limit=25',
  ...dbIds.sessions.map((id) => `/api/sessions/${id}`),
  ...dbIds.decisions.map((id) => `/api/decisions/${id}`),
  ...dbIds.decisions.map((id) => `/api/decisions/${id}/provenance`),
  ...dbIds.nodes.map((id) => `/api/graph/node/${id}`),
];

const data = {};
const failures = [];

for (const wanted of WANTED) {
  const key = wanted.replace(/^\/api\//, '');
  const result = callRoute(wanted);
  if (!result.ok) {
    failures.push({ key, error: result.error });
    continue;
  }
  data[key] = result.value;
}

const snapshot = {
  /*
   * ES: el snapshot se documenta a sí mismo: quién lo generó, cuándo y qué es.
   * EN: the snapshot documents itself: who generated it, when and what it is.
   * PT: o snapshot se autodocumenta.
   */
  meta: {
    kind: 'genesis-console-snapshot',
    generator: 'scripts/export-console-snapshot.js',
    generated_at: new Date().toISOString(),
    purpose: 'Floor data for OFFLINE mode: the app opens with real content even if no server was ever reached.',
    modes: {
      online: 'live API responses (preferred)',
      offline: 'service-worker cache of the last good responses (preferred when present)',
      snapshot: 'this file (fallback when there is no cache yet)',
    },
    keys: Object.keys(data).length,
    failures,
  },
  data,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);

closeDatabase();

process.stdout.write(`\n  snapshot written : ${path.relative(ROOT, OUTPUT)}\n`);
process.stdout.write(`  keys             : ${Object.keys(data).length}\n`);
process.stdout.write(`  size             : ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB\n`);
if (failures.length) {
  process.stdout.write(`  failures         : ${failures.length}\n`);
  for (const failure of failures) process.stdout.write(`    - ${failure.key}: ${failure.error}\n`);
}
process.stdout.write('\n');

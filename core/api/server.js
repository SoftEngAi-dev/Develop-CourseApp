/* ═══════════════════════════════════════════════════════════════════════════
 * core/api/server.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: el servidor HTTP del proyecto, escrito SOLO con `node:http`.
 *     Sirve la API JSON y, además, los archivos estáticos del console offline
 *     (apps/console). Es lo que arranca `genesis serve`.
 *     POR QUÉ EXISTE (REQ-0006 y DEC-00005): la exigencia fue "completo Y
 *     totalmente offline". Con este servidor, clonar el repositorio y ejecutar
 *     `node core/cli/genesis.js serve` da una aplicación funcionando SIN npm
 *     install, sin red y sin compilación. Next.js se enchufa después a la misma API.
 *
 * 🇬🇧 EN — WHAT IT DOES: the project's HTTP server, written ONLY with `node:http`.
 *     It serves the JSON API and also the static files of the offline console
 *     (apps/console). This is what `genesis serve` starts.
 *     WHY IT EXISTS (REQ-0006 and DEC-00005): the requirement was "full AND
 *     totally offline". With this server, cloning the repo and running
 *     `node core/cli/genesis.js serve` gives you a working application with NO
 *     npm install, no network and no build step. Next.js plugs into the same API.
 *
 * 🇧🇷 PT — O QUE FAZ: o servidor HTTP do projeto, escrito SOMENTE com `node:http`.
 *     Serve a API JSON e também os arquivos estáticos do console offline
 *     (apps/console). É o que `genesis serve` inicia.
 *     POR QUE EXISTE (REQ-0006 e DEC-00005): a exigência foi "completo E
 *     totalmente offline". Com este servidor, clonar o repositório e executar
 *     `node core/cli/genesis.js serve` dá uma aplicação funcionando SEM npm
 *     install, sem rede e sem build. O Next.js se conecta depois à mesma API.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • `0.0.0.0` vs `127.0.0.1` ES/EN/PT: `127.0.0.1` (localhost) solo acepta
 *     conexiones de la propia máquina; `0.0.0.0` acepta conexiones desde
 *     cualquier interfaz de red. En entornos con preview/proxy (como este) es
 *     OBLIGATORIO usar 0.0.0.0 o la vista previa queda en blanco.
 *     Bind 0.0.0.0 to accept external connections; 127.0.0.1 only local ones.
 *   • CORS ES/EN/PT: los navegadores bloquean que una página de un origen llame
 *     a una API de otro origen. Las cabeceras `Access-Control-Allow-*` son el
 *     permiso explícito del servidor. Aquí abrimos `*` porque es una herramienta
 *     local de desarrollo; en producción se restringe al dominio real.
 *     CORS headers explicitly allow cross-origin calls from the browser.
 *   • Path traversal ES/EN/PT: si sirves archivos estáticos, alguien puede pedir
 *     `/../../etc/passwd`. La defensa es resolver la ruta y comprobar que sigue
 *     dentro de la carpeta permitida. Aquí lo hace `resolveStatic()`.
 *     Static servers must block `../../` escapes; resolveStatic() does that.
 *   • MIME type ES/EN/PT: la cabecera Content-Type le dice al navegador qué es
 *     el archivo (.html se renderiza, .js se ejecuta, .json se parsea). Si
 *     mandas HTML como text/plain, verás el código en pantalla en vez de la página.
 *     Content-Type tells the browser how to treat the bytes.
 *   • `server.listen(port, host, cb)` ES/EN/PT: el callback se ejecuta cuando el
 *     puerto ya está escuchando. Sin esperar ese momento, un script podría
 *     intentar conectarse antes de que el servidor exista.
 *     The listen callback fires when the port is actually ready.
 * ═══════════════════════════════════════════════════════════════════════════ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../shared/paths.js';
import { createLogger } from '../logger/index.js';
import { EventBus } from '../event-bus/index.js';
import { createRoutes, matchRoute, describeRoutes } from './routes.js';

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
});

const MAX_BODY_BYTES = 8 * 1024 * 1024; // ES: 8 MB de límite razonable | EN: reasonable 8 MB cap

/** ES/EN/PT: cabeceras CORS + seguridad básica. CORS + basic security headers. */
function applyHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Genesis-Session');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * ES: resuelve una ruta estática DENTRO de apps/console, bloqueando escapes.
 * EN: resolves a static path INSIDE apps/console, blocking escapes.
 * PT: resolve um caminho estático DENTRO de apps/console, bloqueando escapes.
 */
export function resolveStatic(urlPath, rootDir = PATHS.consoleApp) {
  const decoded = decodeURIComponent(String(urlPath).split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const absolute = path.resolve(rootDir, relative);
  if (absolute !== rootDir && !absolute.startsWith(rootDir + path.sep)) return null;
  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    const indexFile = path.join(absolute, 'index.html');
    return fs.existsSync(indexFile) ? indexFile : null;
  }
  return fs.existsSync(absolute) ? absolute : null;
}

/** ES/EN/PT: lee el cuerpo de la petición con límite de tamaño. Reads the request body with a size cap. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request body too large (max ${MAX_BODY_BYTES} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        // ES: también aceptamos formularios urlencoded, por si se usa desde curl.
        // EN: we also accept urlencoded forms, in case it is used from curl.
        // PT: também aceitamos formulários urlencoded, caso seja usado a partir do curl.
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/**
 * ES: crea y arranca el servidor. Devuelve el objeto server y la URL real.
 * EN: creates and starts the server. Returns the server object and the real URL.
 * PT: cria e inicia o servidor. Devolve o objeto server e a URL real.
 *
 * @param {{ port?: number, host?: string, bus?: object, logger?: object, static?: boolean }} [options]
 */
export async function startServer(options = {}) {
  const { port = Number(process.env.PORT ?? 4321), host = '0.0.0.0', static: serveStatic = true } = options;
  const logger = options.logger ?? createLogger({ scope: 'api' });
  const bus = options.bus ?? new EventBus({ logger });

  const routes = createRoutes({ bus });

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    applyHeaders(res);

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ES: índice auto-documentado de la API en /api y /api/routes.
      // EN: self-documenting API index at /api and /api/routes.
      // PT: índice auto-documentado da API em /api e /api/routes.
      if (pathname === '/api' || pathname === '/api/routes') {
        sendJson(res, 200, {
          service: 'GENESIS Project Knowledge & Autonomous Engine',
          rule: 'Nothing happens without leaving an observable project event.',
          dependencies: 0,
          offline_capable: true,
          // ES: la lista se describe a sí misma: añadimos esta propia ruta, que
          //     vive aquí (en el servidor) y no en routes.js.
          // EN: the list describes itself: we add this very route, which lives
          //     here (in the server) rather than in routes.js.
          // PT: a lista se autodescreve: adicionamos esta própria rota.
          routes: [
            ...describeRoutes(routes),
            { method: 'GET', pattern: '/api/routes', description: 'This self-description index (also served at /api).' },
          ],
        });
        return;
      }

      if (pathname.startsWith('/api/')) {
        for (const route of routes) {
          const matched = matchRoute(route, req.method, pathname);
          if (!matched) continue;
          const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
          const result = await route.handler({ params: matched.params, query: url.searchParams, body, headers: req.headers });
          const status = result?.status ?? 200;
          if (result?.text !== undefined) sendText(res, status, result.text, result.contentType ?? 'text/plain; charset=utf-8');
          else sendJson(res, status, result?.body ?? {});

          bus.emit('TOOL_EXECUTED', { tool: 'http-api', method: req.method, path: pathname, status, ms: Date.now() - started }, { layer: 'application' });
          logger.debug(`${req.method} ${pathname} → ${status} (${Date.now() - started}ms)`);
          return;
        }
        sendJson(res, 404, { error: { message: `No API route for ${req.method} ${pathname}`, hint: 'GET /api lists every available route.' } });
        return;
      }

      // ES: archivos estáticos del console offline.
      // EN: static files of the offline console.
      // PT: arquivos estáticos do console offline.
      if (serveStatic) {
        const file = resolveStatic(pathname);
        if (file) {
          const ext = path.extname(file).toLowerCase();
          const content = fs.readFileSync(file);
          /*
           * ES: estrategia de caché por tipo de recurso, acordada con el service
           *     worker (apps/console/sw.js):
           *       – sw.js / index.html / manifest / snapshot → SIEMPRE revalidar:
           *         son los que cambian de versión; servirlos viejos rompe la app.
           *       – iconos, css, js → 1 hora: el SW los refresca en segundo plano.
           *     Sin esto, el navegador podría guardar un sw.js viejo para siempre
           *     y la app quedaría congelada en una versión anterior.
           * EN: cache strategy per resource type, agreed with the service worker:
           *     sw.js / index.html / manifest / snapshot always revalidate (they
           *     are the version carriers); icons/css/js one hour (the SW refreshes
           *     them in background). Without this the browser could freeze the app
           *     on an old sw.js forever.
           * PT: estratégia de cache por tipo de recurso, combinada com o SW.
           */
          const base = path.basename(file);
          const cacheControl = ['sw.js', 'index.html', 'manifest.webmanifest', 'snapshot.json'].includes(base)
            ? 'no-cache'
            : 'public, max-age=3600';
          res.writeHead(200, {
            'Content-Type': MIME[ext] ?? 'application/octet-stream',
            'Content-Length': content.length,
            'Cache-Control': cacheControl,
          });
          res.end(content);
          return;
        }
        // ES: SPA fallback: cualquier ruta desconocida sirve index.html.
        // EN: SPA fallback: any unknown route serves index.html.
        // PT: SPA fallback: qualquer rota desconhecida serve index.html.
        const indexFile = path.join(PATHS.consoleApp, 'index.html');
        if (fs.existsSync(indexFile)) {
          const content = fs.readFileSync(indexFile);
          // ES: el fallback SPA también se revalida siempre (es index.html).
          // EN: the SPA fallback always revalidates too (it is index.html).
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': content.length, 'Cache-Control': 'no-cache' });
          res.end(content);
          return;
        }
      }

      sendText(res, 404, `404 — Nothing at ${pathname}\n\nTry: /api (route index) or /api/health\n`);
    } catch (error) {
      logger.error(`${req.method} ${pathname} failed: ${error.message}`);
      bus.emit('ERROR_DETECTED', { tool: 'http-api', path: pathname, message: error.message }, { layer: 'application', severity: 'high' });
      sendJson(res, 500, { error: { message: error.message, code: 'api_handler_failed' } });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  bus.emit('BUILD_COMPLETED', { kind: 'api-server', port: actualPort, host, routes: routes.length }, { layer: 'application' });
  logger.success(`GENESIS API listening on http://${host}:${actualPort} (${routes.length} routes, 0 dependencies)`);

  return {
    server,
    bus,
    logger,
    port: actualPort,
    host,
    url: `http://127.0.0.1:${actualPort}`,
    routes: routes.length,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      logger.info('API server stopped');
    },
  };
}

export default { startServer, resolveStatic, MIME };

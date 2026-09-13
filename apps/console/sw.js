/* ═══════════════════════════════════════════════════════════════════════════
 * apps/console/sw.js — SERVICE WORKER: the offline half of the app
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪 ES — QUÉ HACE: es el "servidor dentro del navegador". Intercepta cada
 *     petición de la página y decide de dónde sale la respuesta:
 *       – shell (HTML/CSS/JS/iconos) → CACHE-FIRST: se sirve del caché y se
 *         refresca en segundo plano. Por eso la app ABRE sin conexión.
 *       – navegación (cambiar de vista/recargar) → NETWORK-FIRST con caída al
 *         index.html cacheado.
 *       – /api/* GET → NETWORK-FIRST: si hay servidor, datos vivos; si no, la
 *         última respuesta buena guardada. Ese es el MODO OFFLINE con datos
 *         reales, no una pantalla de "sin conexión".
 *     Con esto la app cumple el requisito de los DOS modos: con conexión muestra
 *     datos en vivo; sin conexión muestra el último estado conocido, marcado
 *     como tal por la interfaz.
 *     POR QUÉ UN SERVICE WORKER Y NO localStorage: localStorage guarda strings
 *     pequeños y no intercepta peticiones. El SW sí puede responder CUALQUIER
 *     petición, incluidas las de la API, y funciona para toda la app instalada.
 *
 * 🇬 EN — WHAT IT DOES: it is the "server inside the browser". It intercepts
 *     every request from the page and decides where the response comes from:
 *       – shell (HTML/CSS/JS/icons) → CACHE-FIRST: served from cache and
 *         refreshed in the background. That is why the app OPENS without network.
 *       – navigations (changing view/reloading) → NETWORK-FIRST falling back to
 *         the cached index.html.
 *       – /api/* GET → NETWORK-FIRST: live data when the server is reachable;
 *         otherwise the last good response stored. That is OFFLINE MODE with real
 *         data, not a "you are offline" screen.
 *     With this the app satisfies BOTH modes: online shows live data; offline
 *     shows the last known state, flagged as such by the interface.
 *     WHY A SERVICE WORKER AND NOT localStorage: localStorage stores small strings
 *     and cannot intercept requests. The SW can answer ANY request, including API
 *     ones, and works for the whole installed app.
 *
 * 🇧🇷 PT — O QUE FAZ: é o "servidor dentro do navegador". Intercepta cada pedido e
 *     decide de onde vem a resposta: shell em CACHE-FIRST, navegação em
 *     NETWORK-FIRST com fallback, e /api/* GET em NETWORK-FIRST com a última
 *     resposta boa guardada. Assim o app cumpre os DOIS modos: online ao vivo,
 *     offline com o último estado conhecido, sinalizado pela interface.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • El SW es un archivo APARTE ES/EN/PT: no puede compartir variables con
 *     app.js. Se comunica por mensajes (postMessage) y por el caché compartido.
 *     Cada cambio de lógica exige subir SHELL_VERSION para que los clientes lo
 *     noten. A service worker is a separate world: version it explicitly.
 *   • Cache Storage vs caché HTTP ES/EN/PT: `caches.open('x')` crea una base de
 *     respuestas NOMBRADA que TÚ controlas (añades, borras, listas). El caché
 *     HTTP lo decide el navegador con las cabeceras. Aquí usamos el primero.
 *     Cache Storage is a named, scriptable response database you control.
 *   • NETWORK-FIRST vs CACHE-FIRST ES/EN/PT: network-first = fresco cuando se
 *     puede, viejo cuando no (ideal para datos). Cache-first = instantáneo
 *     siempre, fresco en segundo plano (ideal para CSS/JS versionados). Elegir
 *     mal la estrategia es el error nº1 de las PWA.
 *     Pick the strategy per resource type; mixing them up is the nº1 PWA bug.
 *   • `event.respondWith()` ES/EN/PT: es la forma de decir "yo respondo a esta
 *     petición". Si no lo llamas, el navegador hace lo de siempre (ir a la red).
 *     respondWith() is how you take over a request.
 *   • Solo HTTPS o localhost ES/EN/PT: un SW puede reescribir TODO el tráfico de
 *     su origen; por seguridad el navegador lo prohíbe en HTTP plano. En este
 *     entorno el preview viaja por HTTPS, así que funciona.
 *     Service workers require HTTPS (or localhost) because they are powerful.
 *   • Skip waiting ES/EN/PT: tras actualizar el SW, el viejo sigue sirviendo a las
 *     pestañas abiertas hasta que se cierran. `clients.claim()` + el mensaje
 *     SKIP_WAITING hacen que la nueva versión tome el mando enseguida.
 *     claim() + SKIP_WAITING let the new worker take over immediately.
 * ═══════════════════════════════════════════════════════════════════════════ */

const SHELL_VERSION = 'v3';
const SHELL_CACHE = `genesis-shell-${SHELL_VERSION}`;
const API_CACHE = `genesis-api-${SHELL_VERSION}`;

/* ES: lo mínimo para que la app abra sin red. EN: the minimum to open with no network. */
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './snapshot.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

/* ES: rutas de la API que se precargan para el primer arranque offline.
 * EN: API routes precached so the very first offline boot has real data.
 * PT: rotas da API pré-carregadas para o primeiro boot offline. */
const API_PRECACHE = [
  './api/health',
  './api/stats',
  './api/state',
  './api/manifest',
  './api/roadmap',
  './api/tasks',
  './api/policies',
  './api/decisions',
  './api/requirements',
  './api/sessions',
  './api/timeline?limit=400',
  './api/lessons',
  './api/interruptions',
  './api/checkpoints',
  './api/graph?limit=220',
  './api/context',
  './api/context?format=text',
  './api/context?format=md',
  './api/recent?limit=5',
  './api/search?q=sqlite&limit=25',
];

/* ── Instalación / Install ────────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // ES: precargamos el shell SIN fallar la instalación si algo falta.
      // EN: we precache the shell WITHOUT failing the install if something is missing.
      // PT: pré-carregamos o shell SEM falhar a instalação se algo faltar.
      await cache.addAll(APP_SHELL).catch(async () => {
        for (const item of APP_SHELL) {
          try { await cache.add(item); } catch { /* ES: un icono opcional no debe romper nada | EN: an optional icon must not break anything */ }
        }
      });
      // ES: la API se precarga "mejor esfuerzo": sin servidor todavía no hay datos,
      //     y eso es normal (la app también funciona en modo snapshot).
      // EN: the API is precached best-effort: without a server there is no data yet,
      //     which is fine (the app also works in snapshot mode).
      // PT: a API é pré-carregada no modo "melhor esforço".
      const apiCache = await caches.open(API_CACHE);
      for (const item of API_PRECACHE) {
        try {
          const response = await fetch(item, { cache: 'no-store' });
          if (response.ok) await apiCache.put(item, response.clone());
        } catch { /* offline during install: acceptable */ }
      }
      await self.skipWaiting();
    })(),
  );
});

/* ── Activación / Activation ──────────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // ES: borramos cachés de versiones anteriores (si no, el móvil acumula MB).
      // EN: we delete caches from previous versions (otherwise phones accumulate MB).
      // PT: apagamos caches de versões anteriores.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('genesis-') && key !== SHELL_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ── Intercepción / Fetch interception ────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // ES: POST/PUT nunca se cachean | EN: never cache writes

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ES: solo nuestro origen | EN: same origin only

  // ES: navegación (recargas, cambiar de vista con F5) → network-first + fallback al shell.
  // EN: navigations (reloads) → network-first with fallback to the cached shell.
  // PT: navegações → network-first com fallback ao shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request, { cache: 'no-store' });
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match('./index.html');
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  // ES: llamadas a la API → network-first; si cae la red, última respuesta buena.
  // EN: API calls → network-first; when the network drops, the last good response.
  // PT: chamadas à API → network-first; sem rede, a última resposta boa.
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('/snapshot.json')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(request);
        try {
          const fresh = await fetch(request, { cache: 'no-store' });
          if (fresh.ok) await cache.put(request, fresh.clone());
          return fresh;
        } catch {
          if (cached) {
            // ES: marcamos la respuesta como servida desde caché para que la UI lo muestre.
            // EN: we tag the response as served from cache so the UI can show it.
            // PT: marcamos a resposta como vinda do cache para a UI exibir.
            const headers = new Headers(cached.headers);
            headers.set('X-Genesis-Offline', 'cached');
            return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
          }
          return new Response(
            JSON.stringify({ error: { code: 'offline_no_cache', message: 'Offline and no cached copy of this request yet.' } }),
            { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Genesis-Offline': 'none' } },
          );
        }
      })(),
    );
    return;
  }

  // ES: resto de archivos estáticos → cache-first con refresco en segundo plano
  //     (stale-while-revalidate): abre al instante y se actualiza solo.
  // EN: everything else (static files) → cache-first with background refresh
  //     (stale-while-revalidate): opens instantly and updates itself.
  // PT: demais arquivos estáticos → cache-first com refresco em segundo plano.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request, { cache: 'no-store' })
        .then(async (fresh) => {
          if (fresh.ok) await cache.put(request, fresh.clone());
          return fresh;
        })
        .catch(() => null);
      if (cached) {
        networkPromise.then((fresh) => { if (fresh) fresh.body?.cancel?.(); });
        return cached;
      }
      const fresh = await networkPromise;
      return fresh ?? Response.error();
    })(),
  );
});

/* ── Mensajes desde la página / Messages from the page ────────────────────── */

self.addEventListener('message', (event) => {
  const { type } = event.data ?? {};
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'PURGE_API_CACHE') {
    event.waitUntil(
      (async () => {
        await caches.delete(API_CACHE);
        const client = event.source;
        client?.postMessage?.({ type: 'API_CACHE_PURGED' });
      })(),
    );
  }
  if (type === 'CACHE_STATUS') {
    event.waitUntil(
      (async () => {
        const shell = await caches.open(SHELL_CACHE);
        const api = await caches.open(API_CACHE);
        const shellKeys = await shell.keys();
        const apiKeys = await api.keys();
        event.source?.postMessage?.({
          type: 'CACHE_STATUS',
          shell_entries: shellKeys.length,
          api_entries: apiKeys.length,
          version: SHELL_VERSION,
        });
      })(),
    );
  }
});

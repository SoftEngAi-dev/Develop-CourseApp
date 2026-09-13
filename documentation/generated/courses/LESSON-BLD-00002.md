# How it was built: offline-pwa-console
_Cómo se construyó: offline-pwa-console · Como foi construído: offline-pwa-console_

> Generated 2026-09-13T18:07:17.244Z from build `BLD-00002`. Anatomy: title · objective · concepts · implementation · explanation · tutorial · exercise · solution.

## 1. Objective
zero-dependency desktop+mobile console: HTTP server, PWA shell, service worker, offline snapshot (TSK-00012)

## 2. Concepts
- **layer:application** — every build belongs to exactly one of the eleven layers (manifest.layers)
- **decision:DEC-00011** — the build follows this Decision Trace
- **decision:DEC-00012** — the build follows this Decision Trace
- **verification** — the build is proven by 2 test file(s)

## 3. Implementation (real code)
From `core/api/server.js` (first lines):

```javascript
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
```

## 4. Explanation
Problems this build actually hit, and the fixes that actually worked:
1. ❗ browsers refuse stale caches: the service worker had to serve fresh data online and the snapshot offline
   ✅ sw.js network-first with snapshot fallback; snapshot exported by the pipeline (step 6)

## 5. Tutorial
1. read the build objective: "zero-dependency desktop+mobile console: HTTP server, PWA shell, service worker, offline snapshot (TS"
2. open the 8 file(s) it produced, starting with core/api/server.js
3. run its verification: node --disable-warning=ExperimentalWarning --test tests/api.test.js
4. read the problems it hit and the fixes that worked (explanation section below)
5. solve the exercise and compare with the solution

## 6. Exercise
Write a node:test proving that core/api/server.js exists and is non-empty, and that the build suite (tests/api.test.js) passes.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('offline-pwa-console works', () => {
  // TODO: assert the file exists and has bytes
  // TODO: (advanced) run its test file with execFileSync and assert exit 0
});
```

## 7. Solution (runnable, real answer code)
The solution uses fs.statSync to prove existence AND size: an empty file is not an implementation. The second assert runs the build real suite.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('offline-pwa-console works', () => {
  const stat = fs.statSync('core/api/server.js');
  assert.ok(stat.size > 0, 'the implementation is not empty');
  execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', 'tests/api.test.js'], { stdio: 'pipe' });
});
```

## 8. Self-check
- Copy the solution into a temp file inside `tests/` and run `node --disable-warning=ExperimentalWarning --test <file>`.
- It must pass. If it fails, re-read sections 3 and 4 — the failure is a real behaviour of this build.

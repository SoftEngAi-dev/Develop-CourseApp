/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/paths.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: calcula, una sola vez, todas las rutas absolutas del
 *     proyecto (carpetas raw, processed, control, indexes...). El resto del
 *     código importa estas rutas en vez de escribir "../.." a mano.
 *     POR QUÉ EXISTE: si cada módulo inventa sus rutas, un día alguien mueve
 *     una carpeta y el sistema se rompe en 40 sitios distintos. Centralizar
 *     las rutas hace que mover el proyecto sea un cambio de una línea.
 *
 * 🇬🇧 EN — WHAT IT DOES: computes, once, every absolute path in the project
 *     (raw, processed, control, indexes...). The rest of the code imports
 *     these paths instead of hand-writing "../..".
 *     WHY IT EXISTS: if every module invents its own paths, moving a folder
 *     breaks the system in 40 places. Centralizing paths makes relocation a
 *     one-line change.
 *
 * 🇧🇷 PT — O QUE FAZ: calcula, uma única vez, todos os caminhos absolutos do
 *     projeto (raw, processed, control, indexes...). O resto do código importa
 *     esses caminhos em vez de escrever "../.." à mão.
 *     POR QUE EXISTE: se cada módulo inventa seus caminhos, mover uma pasta
 *     quebra o sistema em 40 lugares. Centralizar torna a mudança de uma linha.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • `import.meta.url` ES/EN/PT: es la URL de ESTE archivo, por ejemplo
 *     "file:///home/user/Develop-CourseApp/core/shared/paths.js".
 *     It is the URL of THIS file. É a URL DESTE arquivo.
 *   • `fileURLToPath()` convierte esa URL en una ruta normal del sistema
 *     operativo (Windows usa C:\..., Linux usa /...). Sin esta conversión,
 *     las rutas de Node no funcionan bien en Windows.
 *     Converts that URL into a normal OS path. Converte essa URL em caminho.
 *   • `path.join(a, b)` une pedazos de ruta usando el separador correcto y
 *     normaliza "subir carpetas" (..). Nunca concatenes rutas con "+" o
 *     template strings: en Windows el separador es "\" y no "/".
 *     Joins path pieces with the right separator. Une trechos de caminho.
 *   • `export const` significa "esta variable se puede importar desde otros
 *     archivos". `const` significa "no se puede reasignar".
 *     export = importable elsewhere; const = cannot be reassigned.
 * ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ES: __filename no existe en módulos ESM, así que lo reconstruimos.
// EN: __filename does not exist in ESM modules, so we rebuild it.
// PT: __filename não existe em módulos ESM, então o recriamos.
const THIS_FILE = fileURLToPath(import.meta.url);

// ES: este archivo vive en <root>/core/shared/, así que subimos 2 niveles.
// EN: this file lives in <root>/core/shared/, so we go up 2 levels.
// PT: este arquivo vive em <root>/core/shared/, então subimos 2 níveis.
export const ROOT = path.resolve(path.dirname(THIS_FILE), '..', '..');

/** Absolute paths of the five architectural levels (DEC-00001). */
export const PATHS = Object.freeze({
  root: ROOT,

  // --- Level 5: CONTROL (the operational brain) ---------------------------
  control: path.join(ROOT, 'control'),
  checkpoints: path.join(ROOT, 'control', 'checkpoints'),
  manifest: path.join(ROOT, 'control', 'manifest.json'),
  state: path.join(ROOT, 'control', 'state.json'),
  tasks: path.join(ROOT, 'control', 'tasks.json'),
  roadmap: path.join(ROOT, 'control', 'roadmap.json'),
  policies: path.join(ROOT, 'control', 'policies.json'),
  agentState: path.join(ROOT, 'control', 'agent-state.json'),
  decisions: path.join(ROOT, 'control', 'decisions.json'),

  // --- Level 1: RAW (never interpreted) -----------------------------------
  raw: path.join(ROOT, 'data', 'raw'),
  rawSessions: path.join(ROOT, 'data', 'raw', 'sessions'),
  rawMessages: path.join(ROOT, 'data', 'raw', 'messages'),
  rawSearches: path.join(ROOT, 'data', 'raw', 'searches'),
  rawFiles: path.join(ROOT, 'data', 'raw', 'files'),
  rawOutputs: path.join(ROOT, 'data', 'raw', 'outputs'),
  rawEvents: path.join(ROOT, 'data', 'raw', 'events'),

  // --- Level 2: PROCESSED -------------------------------------------------
  processed: path.join(ROOT, 'data', 'processed'),
  samples: path.join(ROOT, 'data', 'samples'),

  // --- Level 3: KNOWLEDGE (database & indexes) ----------------------------
  indexes: path.join(ROOT, 'data', 'indexes'),
  database: path.join(ROOT, 'data', 'indexes', 'genesis.db'),

  // --- Level 4: PROJECT ---------------------------------------------------
  core: path.join(ROOT, 'core'),
  knowledge: path.join(ROOT, 'knowledge'),
  memory: path.join(ROOT, 'memory'),
  documentation: path.join(ROOT, 'documentation'),
  apps: path.join(ROOT, 'apps'),
  consoleApp: path.join(ROOT, 'apps', 'console'),
  webApp: path.join(ROOT, 'apps', 'web'),
  agents: path.join(ROOT, 'agents'),
  skills: path.join(ROOT, 'skills'),
  mcp: path.join(ROOT, 'mcp'),
  scripts: path.join(ROOT, 'scripts'),
  automation: path.join(ROOT, 'automation'),
  tests: path.join(ROOT, 'tests'),
});

// ES: cada directorio que el sistema escribe debe existir antes de escribir.
// EN: every directory the system writes to must exist before writing.
// PT: cada diretório que o sistema escreve deve existir antes de escrever.
export const WRITABLE_DIRS = Object.freeze([
  PATHS.control,
  PATHS.checkpoints,
  PATHS.raw,
  PATHS.rawSessions,
  PATHS.rawMessages,
  PATHS.rawSearches,
  PATHS.rawFiles,
  PATHS.rawOutputs,
  PATHS.rawEvents,
  PATHS.processed,
  PATHS.indexes,
  PATHS.documentation,
]);

/**
 * ES: convierte una ruta relativa al proyecto en absoluta (y valida que no
 *     intente escapar del proyecto, un ataque clásico llamado "path traversal").
 * EN: turns a project-relative path into an absolute one (and validates it does
 *     not try to escape the project — the classic "path traversal" attack).
 * PT: converte um caminho relativo ao projeto em absoluto (e valida que não
 *     tente sair do projeto — o clássico ataque "path traversal").
 *
 * @param {string} relativePath
 * @returns {string} absolute path inside the project
 */
export function resolveInProject(relativePath) {
  const absolute = path.resolve(ROOT, relativePath);
  // ES: si la ruta resuelta no empieza por la raíz, alguien intentó salir.
  // EN: if the resolved path does not start at the root, someone tried to escape.
  // PT: se o caminho resolvido não começa na raiz, alguém tentou sair.
  if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) {
    throw new Error(`Path traversal blocked: "${relativePath}" escapes the project root.`);
  }
  return absolute;
}

/** ES/EN/PT: ruta relativa legible, para logs y documentación. Readable relative path for logs and docs. */
export function toProjectRelative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join('/');
}

export default PATHS;

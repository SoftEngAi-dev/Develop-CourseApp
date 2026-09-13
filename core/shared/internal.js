/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/internal.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: reexporta utilidades de bajo nivel (rutas + asegurar
 *     carpetas) para que módulos como el logger no tengan que importar fs/path
 *     y duplicar lógica. Es un archivo "pegamento".
 *     POR QUÉ EXISTE: evita dependencias circulares. `paths.js` no importa nada
 *     del proyecto; `internal.js` sí puede hacerlo. Así el logger importa
 *     `internal.js` y nunca crea un ciclo logger → paths → logger.
 *
 * 🇬🇧 EN — WHAT IT DOES: re-exports low-level utilities (paths + ensuring
 *     directories) so modules like the logger do not have to import fs/path and
 *     duplicate logic. It is a "glue" file.
 *     WHY IT EXISTS: it prevents circular dependencies. `paths.js` imports
 *     nothing from the project; `internal.js` may. So the logger imports
 *     `internal.js` and never creates a logger → paths → logger cycle.
 *
 * 🇧🇷 PT — O QUE FAZ: reexporta utilidades de baixo nível (caminhos + garantir
 *     pastas) para que módulos como o logger não precisem importar fs/path e
 *     duplicar lógica. É um arquivo "cola".
 *     POR QUE EXISTE: evita dependências circulares. `paths.js` não importa nada
 *     do projeto; `internal.js` pode. Assim o logger importa `internal.js` e
 *     nunca cria um ciclo logger → paths → logger.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Dependencia circular ES/EN/PT: A importa B y B importa A. En JavaScript
 *     eso produce `undefined` silenciosos y errores rarísimos de encontrar.
 *     La cura: crear un tercer módulo C con lo común, y que A y B importen C.
 *     Circular imports produce silent undefined values; break them with a third module.
 *   • `export { X }` ES/EN/PT: reexportar algo que ya importaste. Permite
 *     ofrecer una fachada estable aunque muevas el archivo original.
 *     Re-exporting lets you offer a stable facade.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import { PATHS, ROOT, resolveInProject, toProjectRelative } from './paths.js';

/** ES/EN/PT: versión tolerante de ensureDir para uso interno. Tolerant ensureDir for internal use. */
export function ensureDirIfNeeded(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ES: si no podemos crearla, no rompemos el logger: seguimos sin archivo.
    // EN: if we cannot create it, we do not break the logger: continue without a file.
    // PT: se não pudermos criá-la, não quebramos o logger: seguimos sem arquivo.
  }
  return dir;
}

export { PATHS, ROOT, resolveInProject, toProjectRelative };
export default { PATHS, ROOT, ensureDirIfNeeded, resolveInProject, toProjectRelative };

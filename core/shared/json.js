/* ═══════════════════════════════════════════════════════════════════════════
 * core/shared/json.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: lee y escribe archivos JSON de forma SEGURA.
 *     "Segura" significa tres cosas: (1) crea las carpetas si no existen,
 *     (2) escribe en un archivo temporal y luego lo renombra (así un corte de
 *     luz a mitad de escritura no deja un JSON corrupto), y (3) guarda una
 *     copia .bak del contenido anterior antes de reemplazarlo.
 *     POR QUÉ EXISTE: implementa la política POL-0002 y POL-0003 del proyecto:
 *     nunca sobrescribir a ciegas. El estado del proyecto es su memoria; si se
 *     corrompe, se pierde todo el conocimiento.
 *
 * 🇬🇧 EN — WHAT IT DOES: reads and writes JSON files SAFELY.
 *     "Safe" means three things: (1) it creates missing directories,
 *     (2) it writes to a temporary file and then renames it (so a power cut
 *     mid-write cannot leave a corrupt JSON), and (3) it keeps a .bak copy of
 *     the previous content before replacing it.
 *     WHY IT EXISTS: it implements policies POL-0002 and POL-0003: never
 *     overwrite blindly. Project state is its memory; corrupting it loses
 *     every piece of knowledge.
 *
 * 🇧🇷 PT — O QUE FAZ: lê e escreve arquivos JSON de forma SEGURA.
 *     "Segura" significa três coisas: (1) cria as pastas se não existirem,
 *     (2) escreve em um arquivo temporário e depois o renomeia (assim uma
 *     queda de energia no meio não deixa um JSON corrompido) e (3) guarda uma
 *     cópia .bak do conteúdo anterior antes de substituí-lo.
 *     POR QUE EXISTE: implementa as políticas POL-0002 e POL-0003: nunca
 *     sobrescrever às cegas. O estado do projeto é sua memória.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • JSON (JavaScript Object Notation) ES/EN/PT: formato de texto para
 *     guardar datos estructurados. `JSON.stringify(obj)` convierte un objeto
 *     en texto; `JSON.parse(texto)` convierte texto en objeto.
 *     Text format for structured data. Formato de texto para dados.
 *   • `fs.mkdirSync(dir, { recursive: true })` crea la carpeta y TODAS las
 *     carpetas padre que falten, y no falla si ya existe. `Sync` = síncrono =
 *     "espera a terminar antes de seguir". En servidores reales se prefiere la
 *     versión asíncrona (`mkdir`), pero en una CLI síncrona es más simple.
 *     Creates the folder and all missing parents. Cria a pasta e os pais.
 *   • `fs.renameSync(a, b)` renombra/mueve un archivo. En el mismo disco es
 *     una operación ATÓMICA: o sucede completa o no sucede. Por eso el patrón
 *     "escribir temporal + renombrar" protege contra archivos a medias.
 *     Atomic when on the same disk. Atômico quando no mesmo disco.
 *   • `JSON.stringify(valor, null, 2)` formatea con 2 espacios de sangría para
 *     que un humano pueda leer el archivo y hacer diff en Git.
 *     Pretty-prints with 2-space indentation for humans and Git diffs.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';

/**
 * ES/EN/PT: asegura que un directorio exista. Ensures a directory exists.
 * @param {string} dir
 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * ES: lee un archivo JSON. Si no existe, devuelve `fallback` (por defecto null)
 *     en lugar de lanzar un error: muchos archivos son opcionales al inicio.
 * EN: reads a JSON file. If it does not exist, returns `fallback` (null by
 *     default) instead of throwing: many files are optional at the beginning.
 * PT: lê um arquivo JSON. Se não existir, devolve `fallback` (null por padrão)
 *     em vez de lançar erro: muitos arquivos são opcionais no início.
 *
 * @param {string} file absolute path
 * @param {any} [fallback=null]
 */
export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  const text = fs.readFileSync(file, 'utf8');
  if (text.trim() === '') return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    // ES: un JSON corrupto es grave, pero intentamos recuperar desde el .bak.
    // EN: a corrupt JSON is serious, but we try to recover from the .bak.
    // PT: um JSON corrompido é grave, mas tentamos recuperar do .bak.
    const backup = `${file}.bak`;
    if (fs.existsSync(backup)) {
      try {
        return JSON.parse(fs.readFileSync(backup, 'utf8'));
      } catch {
        /* fallthrough to the real error below */
      }
    }
    throw new Error(`Corrupt JSON at ${file}: ${error.message}`);
  }
}

/**
 * ES: escribe JSON de forma atómica y con copia de seguridad previa.
 * EN: writes JSON atomically, keeping a previous backup copy.
 * PT: escreve JSON de forma atômica e com cópia de segurança prévia.
 *
 * @param {string} file absolute path
 * @param {any} value serializable value
 * @param {{ indent?: number, backup?: boolean }} [options]
 * @returns {{ file: string, bytes: number, backedUp: boolean }}
 */
export function writeJson(file, value, options = {}) {
  const { indent = 2, backup = true } = options;

  ensureDir(path.dirname(file));

  const text = JSON.stringify(value, null, indent) + '\n';
  const temporary = `${file}.tmp`;

  let backedUp = false;
  if (backup && fs.existsSync(file)) {
    // ES: guardamos el estado anterior ANTES de tocar nada (POL-0003).
    // EN: we save the previous state BEFORE touching anything (POL-0003).
    // PT: guardamos o estado anterior ANTES de tocar em nada (POL-0003).
    fs.copyFileSync(file, `${file}.bak`);
    backedUp = true;
  }

  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, file);

  return { file, bytes: Buffer.byteLength(text, 'utf8'), backedUp };
}

/**
 * ES: añade una línea JSON a un archivo JSONL (un JSON por línea).
 *     Es el formato ideal para eventos: nunca reescribes el pasado, solo
 *     agregas. Y si la última línea queda cortada, las anteriores siguen válidas.
 * EN: appends one JSON line to a JSONL file (one JSON per line).
 *     Ideal for events: you never rewrite the past, you only append. If the
 *     last line gets truncated, previous lines remain valid.
 * PT: acrescenta uma linha JSON a um arquivo JSONL (um JSON por linha).
 *     Ideal para eventos: nunca reescrevemos o passado, só acrescentamos.
 *
 * @param {string} file
 * @param {any} value
 */
export function appendJsonLine(file, value) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
  return file;
}

/**
 * ES: lee un archivo JSONL y devuelve un array. Ignora líneas vacías o rotas.
 * EN: reads a JSONL file and returns an array. Ignores empty or broken lines.
 * PT: lê um arquivo JSONL e devolve um array. Ignora linhas vazias ou quebradas.
 *
 * @param {string} file
 * @returns {any[]}
 */
export function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // ES: toleramos una línea final truncada (escritura interrumpida).
      // EN: we tolerate a truncated final line (interrupted write).
      // PT: toleramos uma linha final truncada (escrita interrompida).
      continue;
    }
  }
  return out;
}

/** ES/EN/PT: escribe texto plano asegurando la carpeta. Writes plain text, ensuring the folder. */
export function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, 'utf8');
  return { file, bytes: Buffer.byteLength(text, 'utf8') };
}

/** ES/EN/PT: lee texto plano o devuelve fallback. Reads plain text or returns fallback. */
export function readText(file, fallback = '') {
  if (!fs.existsSync(file)) return fallback;
  return fs.readFileSync(file, 'utf8');
}

export default { ensureDir, readJson, writeJson, appendJsonLine, readJsonLines, writeText, readText };

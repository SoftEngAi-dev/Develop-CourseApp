/* ═══════════════════════════════════════════════════════════════════════════
 * core/logger/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: escribe mensajes de diagnóstico por pantalla y en un
 *     archivo JSONL, con niveles (debug < info < warn < error) y colores ANSI.
 *     POR QUÉ EXISTE: cuando algo falla a las 3 de la mañana, el log es lo
 *     único que queda. Y aquí el log tiene doble vida: te lo muestra a ti Y
 *     alimenta el historial crudo del proyecto (nivel RAW).
 *     NOTA DE DISEÑO: el logger NO depende del Event Bus (sería un ciclo:
 *     el bus usa el logger para avisar de problemas). Dependencia unidireccional.
 *
 * 🇬🇧 EN — WHAT IT DOES: writes diagnostic messages to the screen and to a
 *     JSONL file, with levels (debug < info < warn < error) and ANSI colours.
 *     WHY IT EXISTS: when something fails at 3 a.m., the log is all that
 *     remains. Here the log has a double life: it shows you the message AND it
 *     feeds the project's raw history (RAW level).
 *     DESIGN NOTE: the logger does NOT depend on the Event Bus (that would be a
 *     cycle: the bus uses the logger to report problems). One-way dependency.
 *
 * 🇧🇷 PT — O QUE FAZ: escreve mensagens de diagnóstico na tela e num arquivo
 *     JSONL, com níveis (debug < info < warn < error) e cores ANSI.
 *     POR QUE EXISTE: quando algo falha às 3 da manhã, o log é o que resta.
 *     Aqui o log tem vida dupla: mostra a mensagem para você E alimenta o
 *     histórico bruto do projeto (nível RAW).
 *     NOTA DE DESIGN: o logger NÃO depende do Event Bus (seria um ciclo: o bus
 *     usa o logger para avisar de problemas). Dependência unidirecional.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Niveles de log ES/EN/PT: `debug` = detalle para desarrolladores;
 *     `info` = "esto pasó y es normal"; `warn` = "raro pero seguimos";
 *     `error` = "algo se rompió". Filtrar por nivel evita que la pantalla se
 *     llene de ruido. Log levels let you filter noise.
 *   • Códigos ANSI ES/EN/PT: `"\x1b[32m"` pinta el texto en verde en la
 *     terminal; `"\x1b[0m"` lo devuelve a normal. `\x1b` es el carácter ESC.
 *     Si la salida no es una terminal (por ejemplo, un archivo), hay que
 *     desactivarlos o el texto queda lleno de símbolos raros.
 *     ANSI codes colour terminal text; disable them when not a TTY.
 *   • `process.stdout.isTTY` ES/EN/PT: es `true` solo cuando la salida es una
 *     terminal interactiva. Es la comprobación estándar para decidir si usar
 *     colores. True only when output is an interactive terminal.
 *   • Plantilla de literales / template literal ES/EN/PT: las comillas invertidas
 *     ` permiten ${expresiones} dentro del texto. Backticks allow ${expressions}.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ensureDirIfNeeded } from '../shared/internal.js';
import { LOG_LEVELS } from '../event-bus/event-types.js';

const USE_COLOR = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;

const COLORS = Object.freeze({
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
});

const LEVEL_STYLE = Object.freeze({
  debug: { color: COLORS.gray, symbol: '·', rank: 4 },
  info: { color: COLORS.cyan, symbol: '•', rank: 3 },
  success: { color: COLORS.green, symbol: '✓', rank: 3 },
  warn: { color: COLORS.yellow, symbol: '⚠', rank: 2 },
  error: { color: COLORS.red, symbol: '✗', rank: 1 },
});

function rankOf(level) {
  const index = LOG_LEVELS.indexOf(level);
  // ES: silent=0 significa "nada"; cuanto menor el índice, menos verboso.
  // EN: silent=0 means "nothing"; the lower the index, the less verbose.
  // PT: silent=0 significa "nada"; quanto menor o índice, menos verboso.
  return index <= 0 ? -1 : 5 - index;
}

/**
 * ES: crea un logger con un "scope" (etiqueta de módulo, p.ej. "capture").
 * EN: creates a logger with a "scope" (module tag, e.g. "capture").
 * PT: cria um logger com um "scope" (etiqueta de módulo, ex.: "capture").
 *
 * @param {{ scope?: string, level?: string, file?: string|null, quiet?: boolean }} [options]
 */
export function createLogger(options = {}) {
  const {
    scope = 'genesis',
    level = process.env.GENESIS_LOG_LEVEL ?? 'info',
    file = null,
    quiet = false,
  } = options;

  const maxRank = rankOf(level);

  function write(entry) {
    if (!quiet) {
      const style = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.info;
      const time = entry.ts.slice(11, 23);
      if (USE_COLOR) {
        process.stdout.write(
          `${COLORS.gray}${time}${COLORS.reset} ${style.color}${style.symbol}${COLORS.reset} ` +
          `${COLORS.magenta}${entry.scope}${COLORS.reset} ${entry.message}\n`,
        );
      } else {
        process.stdout.write(`${time} ${style.symbol} ${entry.scope} ${entry.message}\n`);
      }
    }
    if (file) {
      ensureDirIfNeeded(path.dirname(file));
      fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
    }
  }

  function log(entryLevel, message, meta) {
    const style = LEVEL_STYLE[entryLevel] ?? LEVEL_STYLE.info;
    if (maxRank >= 0 && style.rank > maxRank) return null;
    const entry = {
      ts: new Date().toISOString(),
      level: entryLevel,
      scope,
      message: String(message),
      meta: meta ?? null,
    };
    write(entry);
    return entry;
  }

  return {
    scope,
    level,
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    success: (message, meta) => log('success', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    /** ES/EN/PT: crea un logger hijo con scope más específico. Child logger with a narrower scope. */
    child(childScope) {
      return createLogger({ ...options, scope: `${scope}:${childScope}` });
    },
  };
}

/** ES/EN/PT: logger que no escribe nada (para tests silenciosos). A logger that writes nothing (for quiet tests). */
export function silentLogger(scope = 'silent') {
  const noop = () => null;
  return { scope, level: 'silent', debug: noop, info: noop, success: noop, warn: noop, error: noop, child: () => silentLogger(scope) };
}

/** ES/EN/PT: logger por defecto del proyecto, escribe también en data/raw/events/genesis.log. */
export function projectLogger(scope = 'genesis', level) {
  return createLogger({ scope, level, file: path.join(PATHS.rawEvents, 'genesis.log') });
}

export { COLORS };
export default { createLogger, silentLogger, projectLogger, COLORS };

/* ═══════════════════════════════════════════════════════════════════════════
 * mcp/index.js — MCP / EXTERNAL TOOL ADAPTER LAYER (skeleton)
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HARÁ: conectar herramientas y modelos externos (MCP servers,
 *     LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise, Langflow) SIN que el núcleo
 *     dependa de ellos. La regla es de dirección de dependencia:
 *       adapter → API HTTP del núcleo      ✅ permitido
 *       núcleo   → import de un framework  ❌ prohibido (anti-goal + POL-0001)
 *     ESTADO: ESQUELETO. control/manifest.json → mcp.status =
 *     "adapter-layer-planned", con la nota "MCP is treated as a pluggable adapter
 *     layer, never as a core dependency".
 *     QUÉ SÍ EXISTE: la costura ya está construida y probada — 31 rutas HTTP con
 *     CORS abierto, servidas por node:http sin dependencias (`genesis serve`,
 *     `genesis routes`, /api/routes). Un adaptador externo solo necesita HTTP.
 *
 * 🇬🇧 EN — WHAT IT WILL DO: connect external tools and models (MCP servers,
 *     LangGraph, CrewAI, AutoGen, n8n, Dify, Flowise, Langflow) WITHOUT the core
 *     depending on them. The rule is about dependency direction:
 *       adapter → core HTTP API            ✅ allowed
 *       core    → importing a framework    ❌ forbidden (anti-goal + POL-0001)
 *     STATUS: SKELETON. control/manifest.json → mcp.status =
 *     "adapter-layer-planned", noting "MCP is treated as a pluggable adapter
 *     layer, never as a core dependency".
 *     WHAT ALREADY EXISTS: the seam is built and tested — 31 HTTP routes with open
 *     CORS served by node:http with zero dependencies (`genesis serve`,
 *     `genesis routes`, /api/routes). An external adapter only needs HTTP.
 *
 * 🇧🇷 PT — O QUE FARÁ: conectar ferramentas e modelos externos SEM que o núcleo
 *     dependa deles. adapter → API HTTP ✅ ; núcleo → framework ❌ (POL-0001).
 *     ESTADO: ESQUELETO (mcp.status = "adapter-layer-planned"). A costura já
 *     existe: 31 rotas HTTP servidas por node:http sem dependências.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Dirección de dependencia ES/EN/PT: si A importa B, A necesita B para
 *     existir. Quien importa es quien depende. Mantener el núcleo SIN imports
 *     externos es lo único que garantiza que funcione con node_modules vacío y
 *     sin red. Whoever imports, depends.
 *   • Por qué HTTP y no librería ES/EN/PT: una librería se instala, se versiona y
 *     se rompe. Un contrato HTTP se documenta y se prueba con curl. Además cruza
 *     lenguajes: un adaptador en Python funciona igual. HTTP contracts cross
 *     languages and can be tested with curl.
 *   • CORS ES/EN/PT: el navegador bloquea peticiones entre orígenes distintos.
 *     Aquí se abre `*` porque es una herramienta LOCAL de desarrollo; en
 *     producción se restringe al dominio real. Open CORS locally, restrict it in
 *     production.
 *   • Adapter degradado ES/EN/PT: si el adaptador no está, el núcleo debe seguir
 *     funcionando (quizá con menos capacidades). Eso se prueba DESINSTALANDO el
 *     adaptador, no imaginándolo. Prove degradation by removing the adapter.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { notImplemented } from '../core/shared/stub.js';

const MODULE = 'mcp/index.js';
const SPEC = 'mcp/SPEC.md';
const PHASE = 'phase-5';
const TASK = 'TSK-00008';

/** ES/EN/PT: frameworks externos previstos, siempre como adaptadores. */
export const EXTERNAL_FRAMEWORKS = Object.freeze([
  'MCP servers', 'LangGraph', 'CrewAI', 'AutoGen', 'n8n', 'Dify', 'Flowise', 'Langflow',
]);

/** ES: registra un adaptador externo contra la API HTTP del núcleo. */
export function registerAdapter(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'register an external tool/model adapter that talks to the core only through HTTP',
    available: 'the contract is live: `genesis serve` exposes 31 routes (/api/health, /api/context, /api/capture, /api/process, /api/search, /api/graph…); list them with `genesis routes`.',
    frameworks: EXTERNAL_FRAMEWORKS,
    details_requested: Object.keys(options),
  });
}

/** ES: expone el conocimiento del proyecto COMO herramienta MCP para otros agentes. */
export function exposeAsMcpTools(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'expose project knowledge as MCP tools (search, recall, context, decision trace) for external agents',
    available: 'every future MCP tool already has a working HTTP equivalent: /api/search, /api/context, /api/decisions/:id/provenance, /api/graph/node/:id.',
    details_requested: Object.keys(options),
  });
}

/** ES: comprueba que el núcleo NO importa nada externo (POL-0001 como precheck). */
export function assertCoreIsDependencyFree(options = {}) {
  return notImplemented({
    phase: PHASE, plannedIn: TASK, module: MODULE, spec: SPEC,
    capability: 'statically assert that no core module imports a third-party package',
    available: '`genesis doctor` already probes the practical side (node:sqlite present, zero npm deps, FTS5 working); the static scan is the missing half.',
    details_requested: Object.keys(options),
  });
}

export default { EXTERNAL_FRAMEWORKS, registerAdapter, exposeAsMcpTools, assertCoreIsDependencyFree };

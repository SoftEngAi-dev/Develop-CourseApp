SESSION: Session 001 — Genesis architecture definition
DATE: 2026-09-13
PARTICIPANTS: user, assistant
NOTE: Real founding conversation of this project. Ingested verbatim as the first
      sample so the system documents its own genesis (dogfooding).

USER:

No construiría esto como una simple "app que muestra el chat". Lo convertiría en un
sistema de documentación, trazabilidad, aprendizaje y ejecución del proyecto, donde
cada conversación se transforma en conocimiento estructurado y cada nueva sesión
puede continuar desde ese estado.

La arquitectura correcta es: Chat → Captura → Normalización → Análisis → Grafo de
conocimiento → Documentación → Aplicación → Agente → Ejecución → Verificación →
Aprendizaje → actualización del sistema.

Requisitos que debe cumplir:

- El sistema debe conservar absolutamente todo lo ocurrido en el nivel RAW sin interpretarlo.
- El sistema debe separar los datos en cinco niveles: raw, processed, knowledge, project y control.
- El nivel CONTROL debe permitir que otra sesión no tenga que releer todo el universo.
- La aplicación debe funcionar de forma totalmente offline y a la vez ser completa.
- Los comentarios del código deben ser trilingües (ES/EN/PT) con explicación de curso para principiantes.
- Nunca se debe sobrescribir un archivo sin READ → UNDERSTAND → DIFF → PLAN → PATCH → VERIFY → COMMIT.

Plan de construcción por fases:

Fase 0 — Bootstrap
1. Project Manifest
2. State
3. Event system
4. Logger
5. Checkpoint

Fase 1 — Captura
1. Chat/session ingestion
2. Raw storage
3. Message parser

Fase 2 — Knowledge Engine
1. Requirements
2. Plans
3. Decisions
4. Actions
5. Errors
6. Searches
7. Builds

Fase 3 — Documentation Engine
Fase 4 — Web App
Fase 5 — Agent
Fase 6 — Education
Fase 7 — Autonomous Evolution

No intentaría construir los 30 módulos simultáneamente. Haría capas verticales funcionales.

ASSISTANT:

Entendido. Antes de implementar necesito resolver una bifurcación de infraestructura.

DECISIÓN #00002

Objetivo: Elegir la base de datos y el motor de búsqueda del Knowledge Engine.

Contexto: Node 22.22 incluye node:sqlite de forma nativa. Verificado en el entorno:
creación de tablas, escritura, lectura y consultas FTS5 MATCH funcionan sin ningún
paquete npm.

Restricciones: debe funcionar offline, no requerir npm install, soportar búsqueda de
texto completo y poder evolucionar a PostgreSQL más adelante.

Opciones: A. JSON files only  B. better-sqlite3 (npm)  C. PostgreSQL  D. Vector DB  E. node:sqlite built-in + FTS5

Decisión: node:sqlite (integrado en Node 22) + tablas virtuales FTS5, con archivos
JSON para la configuración.

Motivo: menor complejidad inicial, búsqueda full-text real, funcionamiento local y
offline, y cero riesgo de cadena de suministro.

Consecuencia: el esquema es SQL portable, así que puede migrar a PostgreSQL después
sin rediseño.

Estado: APROBADO

SEARCH-00001

Query: node:sqlite experimental FTS5 support Node 22
Reason: Infrastructure research — verify the built-in SQLite supports full-text search
Sources: https://nodejs.org/api/sqlite.html
Selected: node:sqlite with FTS5 virtual tables
Why: the probe executed inside the sandbox returned "FTS5 OK, sqlite version 3.51.3"
Influenced decisions: DEC-00002, DEC-00008

USER:

Quiero una mezcla, sería híbrido: que contenga todo full pero a la vez que funcione
de forma totalmente offline. Sería una respuesta = las 3.

Y sobre el idioma: toda la creación en inglés, los comentarios del código en
trilingüe con explicación total, como si fuera un curso para recién iniciando en el
lenguaje y en la programación en sí.

ASSISTANT:

DECISIÓN #00005

Objetivo: Elegir el stack de la capa de aplicación.

Contexto: el usuario respondió "las 3 opciones" y exigió que sea completo Y
totalmente offline.

Restricciones: debe funcionar sin node_modules, debe ofrecer también la experiencia
completa React/Next.js, y ambas deben compartir una única API.

Opciones: A. Next.js only  B. Zero-dep static SPA only  C. Hybrid: zero-dep core + zero-dep console + Next.js app on the same API

Decisión: Front end híbrido de tres capas: (1) core/api, servidor HTTP sin
dependencias; (2) apps/console, interfaz estática offline servida por ese servidor;
(3) apps/web, aplicación Next.js que consume el mismo contrato de API.

Motivo: el contrato de API se convierte en la costura. La capacidad offline la
garantizan las capas 1 y 2; las funciones completas, la capa 3.

Consecuencia: cualquier interfaz puede reemplazarse sin tocar el motor.

Estado: APROBADO

LESSON: La capacidad offline no es una característica de la interfaz, es una
propiedad del núcleo. Si el núcleo depende de npm, ninguna interfaz será offline.

RULE CREATED: core.zero_dependencies=true

ERROR: gh repo create SoftEngAi-dev/develo-courseapp-simplify
ANALYSIS: HTTP 403 "Resource not accessible by integration (createRepository)". El token
de la sesión es una integración limitada sin permiso para crear repositorios.
RECOVERY: construir en la rama de la sesión (cuyo push sí funciona) y dejar preparado
un repositorio local listo para publicar en cuanto exista el remoto.
LESSON: Verificar los permisos reales del token antes de prometer operaciones de
infraestructura externa; un dry-run de push no equivale a permiso de creación.
RULE CREATED: infra.verify_permissions_before_promising=true

El bloqueo queda registrado como interrupción de tipo security_stop, impacto bajo y
recuperable por el usuario.

ASSISTANT:

Fase 0 completada: manifest, state, event bus, logger y checkpoints funcionando.
Fase 1 completada: ingesta de sesiones y parser de mensajes determinista.
Fase 2 completada: SQLite + FTS5, procesadores, grafo de conocimiento y Context Engine.

Estado final de la sesión:

- Decisiones registradas: 11
- Interrupciones abiertas: 1 (INT-00001, security_stop)
- Progreso del proyecto: 68%

Siguiente acción recomendada: ejecutar `npm run demo` para ingerir esta sesión y
después `genesis serve` para navegar el conocimiento en el navegador.

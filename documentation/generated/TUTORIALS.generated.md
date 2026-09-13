# GENESIS — Tutorials (auto-generated)

> 🤖 Generated for audience: **beginner**. Real plans, real searches, real lessons.

## Tutorial 1 — How this project plans work

### PLN-00001 · Bootstrap

1. {"order":1,"text":"Project Manifest","done":false}
2. {"order":2,"text":"State","done":false}
3. {"order":3,"text":"Event system","done":false}
4. {"order":4,"text":"Logger","done":false}
5. {"order":5,"text":"Checkpoint","done":false}

### PLN-00002 · Captura

1. {"order":1,"text":"Chat/session ingestion","done":false}
2. {"order":2,"text":"Raw storage","done":false}
3. {"order":3,"text":"Message parser","done":false}

### PLN-00003 · Knowledge Engine

1. {"order":1,"text":"Requirements","done":false}
2. {"order":2,"text":"Plans","done":false}
3. {"order":3,"text":"Decisions","done":false}
4. {"order":4,"text":"Actions","done":false}
5. {"order":5,"text":"Errors","done":false}
6. {"order":6,"text":"Searches","done":false}
7. {"order":7,"text":"Builds","done":false}

### PLN-00004 · completada: SQLite + FTS5, procesadores, grafo de conocimiento y Context Engine.

1. {"order":1,"text":"Decisiones registradas: 11","done":false}
2. {"order":2,"text":"Interrupciones abiertas: 1 (INT-00001, security_stop)","done":false}
3. {"order":3,"text":"Progreso del proyecto: 68%","done":false}

### PLN-00005 · verify project health

1. run the verification suite
2. check documentation drift

## Tutorial 2 — How this project researches before deciding

- **node:sqlite experimental FTS5 support Node 22** — why: el contrato de API se convierte en la costura. La capacidad offline la → chose: node:sqlite with FTS5 virtual tables (the probe executed inside the sandbox returned "FTS5 OK, sqlite version 3.51.3")

## Tutorial 3 — Mistakes already paid for (lessons → rules)

- **Verificar los permisos reales del token antes de prometer operaciones de infraestructura externa; un dry-run de push no equivale a permiso de creación.** → rule: `infra.verify_permissions_before_promising=true`
- **La capacidad offline no es una característica de la interfaz, es una propiedad del núcleo. Si el núcleo depende de npm, ninguna interfaz será offline.** → rule: `core.zero_dependencies=true`

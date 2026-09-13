# CURRICULUM (generated — do not edit by hand)

> Generated 2026-09-13T18:07:17.240Z · mode `learn` · builds: 2 · lessons: 2 · decisions: 12
> 🇪🇸 Generado automáticamente por la Fase 6. 🇬🇧 Generated automatically by Phase 6. 🇧🇷 Gerado automaticamente pela Fase 6.

## M1 — Foundations: why a self-documenting system
_Fundamentos: por qué un sistema que se documenta solo · Fundamentos: por que um sistema que se documenta sozinho_

- [decision:DEC-00001] Five-level separation (raw, processed, knowledge, project, control).
- [decision:DEC-00002] node:sqlite (integrado en Node 22) + tablas virtuales FTS5, con archivos
JSON pa
- [decision:DEC-00003] Store Decision Traces: objective -> context used -> constraints -> alternatives 
- [decision:DEC-00004] Interruptions become first-class events with types: blocked, failed, interrupted
- [decision:DEC-00005] Front end híbrido de tres capas: (1) core/api, servidor HTTP sin
dependencias; (
- [decision:DEC-00006] Identifiers, types and events in English. Every file carries a trilingual header

## M2 — Build: knowledge-layer
_Build: knowledge-layer · Build: knowledge-layer_

- [build:BLD-00001] SQLite + FTS5 capture, processors, knowledge graph, retrieval and context engine (Phases 0-2)

## M3 — Build: offline-pwa-console
_Build: offline-pwa-console · Build: offline-pwa-console_

- [build:BLD-00002] zero-dependency desktop+mobile console: HTTP server, PWA shell, service worker, offline snapshot (TSK-00012)

## M4 — Real pitfalls and how to avoid them
_Trampas reales y cómo evitarlas · Armadilhas reais e como evitá-las_

- [lesson:LES-00001] Verificar los permisos reales del token antes de prometer operaciones de infraes
- [lesson:LES-00002] La capacidad offline no es una característica de la interfaz, es una propiedad d

---
Every lesson follows the anatomy:

1. title
1. objective
1. concepts
1. implementation
1. explanation
1. tutorial
1. exercise
1. solution

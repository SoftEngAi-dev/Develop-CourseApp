# PHASE 4 · NEXT.JS WEB APP — SPEC

> **Status: SKELETON (source present, dependencies NOT installed).**
> This package is deliberately isolated: the repository root and the offline console
> have **zero npm dependencies** (POL-0001, DEC-00005). Everything Next.js needs
> lives inside `apps/web/package.json`, so `npm install` here cannot pollute the
> core, and deleting `apps/web/node_modules` breaks nothing outside this folder.

| Field | Value |
| --- | --- |
| Phase | `phase-4` · Task `TSK-00007` · Layer `5 application` |
| Weight | 15% (the installable PWA console, TSK-00012, is the delivered half) |
| Runtime | Next.js (App Router) — **optional**: the product works without it |
| Data source | the SAME 31-route HTTP API the offline console uses (DEC-00005) |

## 1. Why two front ends

- `apps/console` — vanilla HTML/CSS/JS + PWA. Zero deps, zero build, works from a
  bare `node core/cli/genesis.js serve` and from a phone with no signal. It is the
  guarantee.
- `apps/web` — Next.js. Server components, streaming, nicer typography, SEO for the
  generated documentation. It is the enhancement.

Both consume `/api/*`. Neither owns business logic: the knowledge engine is the
single source of truth (level 3), and the control plane (level 5) is the single
source of project truth.

## 2. Rules for this package

1. **No direct database access.** Server components call the HTTP API (or import
   `memory/*` when running inside the same process as the engine).
2. **No duplicated views.** A screen that already exists in the console must not be
   re-implemented with different data shapes; it must render the same contract.
3. **Offline parity.** Anything the console shows offline must also render here from
   cached data (the console's service worker is the reference implementation).
4. **Dependencies stay inside this folder.** The root `package.json` keeps
   `"dependencies": {}` forever.

## 3. Planned routes

| Route | Source |
| --- | --- |
| `/` | `/api/stats` + `/api/state` + `/api/recent` |
| `/sessions`, `/sessions/[id]` | `/api/sessions`, `/api/sessions/:id` |
| `/decisions`, `/decisions/[id]` | `/api/decisions`, `/api/decisions/:id`, `.../provenance` |
| `/knowledge` | `/api/search` |
| `/graph` | `/api/graph`, `/api/graph/node/:id` |
| `/context` | `/api/context?format=md` |
| `/timeline` | `/api/timeline` |
| `/docs/**` | `documentation/generated` (Phase 3 output) |

## 4. Acceptance criteria (exit gate)

- [ ] `npm --prefix apps/web install && npm --prefix apps/web run dev` renders `/`
      against a running `genesis serve`.
- [ ] Every page is server-rendered from the API; the browser ships no secrets.
- [ ] Deleting `apps/web/node_modules` leaves `npm test` and the console unaffected.
- [ ] The console remains the offline reference: same data, same flags.
SPEC_EOF

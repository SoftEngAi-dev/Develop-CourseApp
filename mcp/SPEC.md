# MCP / EXTERNAL TOOL ADAPTER LAYER — SPEC (skeleton)

> **Status: SKELETON.** `mcp/index.js` declares the adapter contract and returns
> `notImplemented(...)`. `control/manifest.json → mcp.status = "adapter-layer-planned"`.

Dependency direction is the whole spec:

```
adapter ──HTTP──▶ core API        ✅ allowed
core ──import──▶ LangGraph/CrewAI/AutoGen/n8n/Dify/Flowise/Langflow   ❌ forbidden (POL-0001)
```

The seam already exists and is tested: 31 routes served by `node:http` with zero
dependencies and CORS enabled (`genesis serve`, `genesis routes`, `/api/routes`).
An external agent only needs HTTP to search, recall, read traces and capture.

Acceptance (exit gate):

- [ ] `registerAdapter()` records name, endpoints, capabilities and degradation plan.
- [ ] `exposeAsMcpTools()` maps /api/search, /api/context, /api/decisions/:id/provenance to tools.
- [ ] `assertCoreIsDependencyFree()` statically proves no third-party import in core/ and knowledge/.
- [ ] Removing every adapter leaves the core fully functional offline.

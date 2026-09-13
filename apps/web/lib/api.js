/*
 * ES: cliente de la API del núcleo. Misma contracto que usa el console offline:
 *     una sola fuente de verdad para los datos (DEC-00005).
 * EN: client for the core API. Same contract the offline console uses: one single
 *     source of truth for data (DEC-00005).
 * PT: cliente da API do núcleo. Mesmo contrato do console offline (DEC-00005).
 */
const BASE = process.env.GENESIS_API ?? 'http://127.0.0.1:4321';

export async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, { cache: 'no-store', ...options });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error?.message ?? `HTTP ${response.status} on ${path}`);
  }
  return response.json();
}

export const routes = {
  stats: () => api('/api/stats'),
  state: () => api('/api/state'),
  manifest: () => api('/api/manifest'),
  roadmap: () => api('/api/roadmap'),
  tasks: () => api('/api/tasks'),
  decisions: () => api('/api/decisions'),
  decision: (id) => api(`/api/decisions/${id}`),
  provenance: (id) => api(`/api/decisions/${id}/provenance`),
  sessions: () => api('/api/sessions'),
  session: (id) => api(`/api/sessions/${id}`),
  search: (query) => api(`/api/search?q=${encodeURIComponent(query)}&limit=25`),
  timeline: () => api('/api/timeline?limit=400'),
  graph: () => api('/api/graph?limit=220'),
  context: () => api('/api/context?format=md'),
  lessons: () => api('/api/lessons'),
};

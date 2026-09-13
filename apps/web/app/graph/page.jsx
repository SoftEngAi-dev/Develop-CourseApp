/*
 * 🇪🇸 ES — QUÉ HACE: el grafo de conocimiento en números y listas: estadísticas
 *     (nodos, aristas, densidad), distribución por tipo y los HUBS (los nodos
 *     más conectados — las ideas que sostienen el proyecto). La simulación de
 *     fuerzas interactiva vive en el console (#/graph); aquí el servidor
 *     renderiza la misma información como tablas accesibles y sin JS.
 * 🇬🇧 EN — WHAT IT DOES: the knowledge graph in numbers and lists: stats
 *     (nodes, edges, density), distribution by kind and the HUBS (the most
 *     connected nodes — the ideas holding the project up). The interactive force
 *     simulation lives in the console (#/graph); here the server renders the
 *     same information as accessible, JS-free tables.
 * 🇧🇷 PT — O QUE FAZ: o grafo em números e listas: estatísticas, distribuição
 *     por tipo e os HUBS. A simulação interativa vive no console.
 *
 * 🎓 BEGINNER COURSE: un grafo es nodos (cosas) + aristas (relaciones). El
 *   "grado" de un nodo es cuántas aristas lo tocan: el hubs son los conceptos
 *   que más se relacionan con otros. A hub is a node with many edges: the ideas
 *   everything else hangs from. Um hub é um nó com muitas arestas.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  let data = null;
  let error = null;
  try {
    data = await routes.graph();
  } catch (cause) {
    error = cause.message;
  }

  const stats = data?.stats ?? {};
  const byKind = Object.entries(stats.by_kind ?? {}).sort((a, b) => b[1] - a[1]);
  const hubs = stats.hubs ?? [];
  const nodes = data?.nodes ?? [];

  return (
    <Page>
      <PageHeader
        title="Knowledge graph"
        subtitle="Nodes, edges and hubs — the shape of everything the project knows."
        es="Nodos, aristas y hubs: la forma de todo lo que el proyecto sabe."
        pt="Nós, arestas e hubs: o formato de tudo que o projeto sabe."
      />
      {error ? <ErrorBox error={error} /> : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[['Nodes', stats.nodes], ['Edges', stats.edges], ['Density', stats.density], ['Kinds', byKind.length]].map(([label, value]) => (
              <Card key={label}>
                <div style={{ fontSize: 11, color: theme.faint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                <div style={{ fontFamily: theme.mono, fontSize: 24, color: theme.accent }}>{value ?? '—'}</div>
              </Card>
            ))}
          </section>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <Card>
              <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>By kind</h2>
              {byKind.map(([kind, count]) => (
                <div key={kind} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
                  <span style={{ color: theme.muted, fontFamily: theme.mono }}>{kind}</span>
                  <strong style={{ color: theme.text }}>{count}</strong>
                </div>
              ))}
            </Card>

            <Card>
              <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Hubs (most connected)</h2>
              {hubs.length === 0 ? <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>No hubs reported.</p> : hubs.map((hub) => (
                <div key={hub.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
                  <span style={{ color: theme.text }}>{hub.label} <Pill>{hub.kind}</Pill></span>
                  <strong style={{ color: theme.accent, fontFamily: theme.mono }}>{hub.degree}°</strong>
                </div>
              ))}
            </Card>
          </div>

          <section style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Nodes ({nodes.length} shown)</h2>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {nodes.map((node) => (
                <Card key={node.id} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Pill color={theme.accent}>{node.kind}</Pill>
                    <span style={{ fontFamily: theme.mono, fontSize: 11, color: theme.faint }}>{node.id}</span>
                  </div>
                  <div style={{ fontSize: 14, marginTop: 6 }}>{node.label}</div>
                  {node.what_is ? <div style={{ fontSize: 12, color: theme.muted, marginTop: 4, lineHeight: 1.5 }}>{String(node.what_is).slice(0, 140)}</div> : null}
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

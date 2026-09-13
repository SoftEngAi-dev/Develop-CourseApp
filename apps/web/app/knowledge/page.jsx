/*
 * 🇪🇸 ES — QUÉ HACE: búsqueda full-text (FTS5) sobre TODA la base de
 *     conocimiento: decisiones, requisitos, tecnologías, planes, lecciones,
 *     nodos del grafo. El formulario es un GET nativo: buscar funciona sin una
 *     sola línea de JavaScript en el navegador (la ?q= viaja en la URL y el
 *     servidor renderiza los resultados).
 * 🇬🇧 EN — WHAT IT DOES: FTS5 full-text search across the WHOLE knowledge base.
 *     The form is a native GET: search works with zero browser JavaScript (the
 *     ?q= travels in the URL and the server renders results).
 * 🇧🇷 PT — O QUE FAZ: busca FTS5 em toda a base; formulário GET nativo, zero JS.
 *
 * 🎓 BEGINNER COURSE
 *   • searchParams ES/EN/PT: en Next 15 llega como Promise: `await searchParams`
 *     da {q}. La URL ES el estado de la búsqueda — compartible y recargable.
 *     The URL is the search state: shareable and reloadable.
 *   • snippets con [[ ]] ES/EN/PT: el motor marca el término encontrado con
 *     corchetes dobles; aquí se resaltan con <mark>. The engine marks matches
 *     with double brackets; we render them as <mark>.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

/** ES/EN/PT: parte el snippet por [[term]] y resalta. Highlights [[term]]. */
function Snippet({ text }) {
  const parts = String(text ?? '').split(/(\[\[.*?\]\])/g);
  return (
    <span style={{ color: theme.muted, fontSize: 13, lineHeight: 1.6 }}>
      {parts.map((part, index) => (part.startsWith('[[') && part.endsWith(']]')
        ? <mark key={index} style={{ background: 'rgba(79,209,197,.2)', color: theme.accent, borderRadius: 3, padding: '0 2px' }}>{part.slice(2, -2)}</mark>
        : <span key={index}>{part}</span>))}
    </span>
  );
}

export default async function KnowledgePage({ searchParams }) {
  const { q } = await searchParams;
  const query = typeof q === 'string' && q.trim() ? q.trim() : null;

  let data = null;
  let error = null;
  if (query) {
    try {
      data = await routes.search(query);
    } catch (cause) {
      error = cause.message;
    }
  }

  return (
    <Page>
      <PageHeader
        title="Knowledge search"
        subtitle="FTS5 across decisions, requirements, technologies, plans, lessons and graph nodes — diacritics-insensitive, trilingual."
        es="Búsqueda full-text sobre toda la base de conocimiento."
        pt="Busca full-text em toda a base de conhecimento."
      />

      <form method="get" action="/knowledge" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="search"
          name="q"
          defaultValue={query ?? ''}
          placeholder="sqlite, offline, checkpoint, FTS5…"
          aria-label="Search the knowledge base"
          style={{ flex: '1 1 260px', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, padding: '10px 14px', fontSize: 15, fontFamily: theme.mono }}
        />
        <button type="submit" style={{ background: theme.accent, color: '#04121a', fontWeight: 700, border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
          Search
        </button>
      </form>

      {error ? <ErrorBox error={error} /> : null}
      {!query ? (
        <Card><p style={{ margin: 0, color: theme.muted }}>Type a term and press Search — the results are server-rendered from the same FTS5 index the CLI uses (<code>genesis search</code>).</p></Card>
      ) : null}

      {data ? (
        <section style={{ display: 'grid', gap: 10 }}>
          <p style={{ color: theme.faint, fontSize: 13, margin: 0 }}>
            engine <strong style={{ color: theme.accent }}>{data.engine}</strong> · {data.count} result(s) for “{data.query}”
          </p>
          {(data.results ?? []).map((result) => (
            <Card key={`${result.type}-${result.id}-${result.rank}`} style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pill color={theme.accent}>{result.type}</Pill>
                <Pill>{result.id}</Pill>
                <Pill>bm25 {Number(result.score ?? 0).toFixed(2)}</Pill>
                {result.type === 'decision' ? <a href={`/decisions/${result.id}`} style={{ color: theme.accent, fontSize: 13 }}>open trace →</a> : null}
              </div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 15, fontFamily: theme.mono }}>{result.title}</h2>
              <Snippet text={result.snippet} />
            </Card>
          ))}
        </section>
      ) : null}
    </Page>
  );
}

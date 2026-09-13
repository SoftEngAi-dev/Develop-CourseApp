/*
 * ES: página inicial. Componente de servidor: los datos se buscan EN el proceso,
 *     no en el navegador. Si el núcleo no responde, se dice claramente (nada de
 *     esqueletos infinitos).
 * EN: home page. Server component: data is fetched IN the process, not in the
 *     browser. If the core does not answer, we say so clearly (no infinite
 *     skeletons).
 * PT: página inicial. Componente de servidor: os dados são buscados NO processo.
 *     Se o núcleo não responder, dizemos claramente.
 */
import { routes } from '../lib/api.js';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let stats = null;
  let error = null;
  try {
    stats = await routes.stats();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ letterSpacing: '0.14em' }}>🧬 GENESIS</h1>
      <p style={{ color: '#93a2b8' }}>
        Project Knowledge &amp; Autonomous Engine — the Next.js enhancement layer.
        The zero-dependency offline console lives at <code>apps/console</code>.
      </p>

      {error ? (
        <div style={{ border: '1px solid rgba(248,81,73,.4)', padding: 16, borderRadius: 10 }}>
          <strong>The engine is not answering.</strong>
          <p>Start it with <code>npm run serve</code> (or <code>genesis serve</code>), then reload.</p>
          <p style={{ color: '#93a2b8', fontSize: 13 }}>{error}</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            ['Progress', `${stats.state?.progress_percent ?? 0}%`],
            ['Phase', stats.state?.current_phase ?? '—'],
            ['Decisions', String(stats.processing?.decisions ?? 0)],
            ['Requirements', String(stats.processing?.requirements ?? 0)],
            ['Graph nodes', String(stats.graph?.nodes ?? 0)],
            ['Events', String(stats.processing?.events ?? 0)],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid #1f2a3a', background: '#121924', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 24, color: '#4fd1c5' }}>{value}</div>
            </div>
          ))}
        </section>
      )}

      <p style={{ color: '#64748b', fontSize: 13, marginTop: 32 }}>
        “Nothing happens without leaving an observable project event.”
      </p>
    </main>
  );
}

/*
 * 🇪🇸 ES — QUÉ HACE: lista las sesiones capturadas (nivel 1 RAW → nivel 2
 *     PROCESSED). Cada tarjeta muestra título, origen, formato y cuántos
 *     mensajes se parsearon. Datos vía /api/sessions — el MISMO contrato que
 *     consume el console offline (regla 2 del SPEC: no duplicar formas).
 * 🇬🇧 EN — WHAT IT DOES: lists captured sessions via /api/sessions — the SAME
 *     contract the offline console consumes (SPEC rule 2: no duplicated shapes).
 * 🇧🇷 PT — O QUE FAZ: lista as sessões capturadas via /api/sessions — o MESMO
 *     contrato do console offline.
 *
 * 🎓 BEGINNER COURSE: esta página es un async function que devuelve JSX: Next la
 *   ejecuta en el servidor por pedido (force-dynamic) y el navegador solo recibe
 *   HTML. An async server component: Next runs it per request; the browser only
 *   receives HTML. Um componente de servidor assíncrono: o navegador só recebe HTML.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme, statusColor } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  let data = null;
  let error = null;
  try {
    data = await routes.sessions();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <Page>
      <PageHeader
        title="Sessions"
        subtitle="Every development conversation captured at level 1 (RAW) and parsed at level 2 (PROCESSED)."
        es="Cada conversación de desarrollo, capturada en crudo y parseada."
        pt="Cada conversa de desenvolvimento, capturada e analisada."
      />
      {error ? <ErrorBox error={error} hint="Start the engine with npm run serve, then reload." /> : (
        <section style={{ display: 'grid', gap: 12 }}>
          {(data?.sessions ?? []).map((session) => (
            <Card key={session.id}>
              <a href={`/sessions/${session.id}`} style={{ color: theme.accent, textDecoration: 'none', fontFamily: theme.mono }}>
                {session.id}
              </a>
              <h2 style={{ margin: '6px 0 4px', fontSize: 18 }}>{session.title}</h2>
              <p style={{ color: theme.muted, margin: 0, fontSize: 13, fontFamily: theme.mono }}>{session.source}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill color={statusColor('completed')}>{session.message_count} messages</Pill>
                <Pill>{session.format}</Pill>
                <Pill>{new Date(session.captured_at).toISOString().slice(0, 16).replace('T', ' ')}</Pill>
              </div>
            </Card>
          ))}
        </section>
      )}
    </Page>
  );
}

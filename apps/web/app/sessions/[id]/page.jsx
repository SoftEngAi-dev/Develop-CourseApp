/*
 * 🇪🇸 ES — QUÉ HACE: detalle de UNA sesión: cabecera + mensajes PROCESADOS
 *     (rol, intención detectada, idioma con confianzas, métricas) y el contenido
 *     RAW completo dentro de <details> plegables. Muestra los 5 niveles de datos
 *     en una pantalla: RAW intacto junto a la interpretación, sin mezclarlos.
 * 🇬🇧 EN — WHAT IT DOES: detail of ONE session: header + PROCESSED messages
 *     (role, detected intent, language with confidences, metrics) and the full
 *     RAW content inside collapsible <details>. Five data levels on one screen:
 *     RAW intact next to its interpretation, never mixed.
 * 🇧🇷 PT — O QUE FAZ: detalhe de UMA sessão: mensagens PROCESSADAS + conteúdo
 *     RAW em <details> colapsáveis.
 *
 * 🎓 BEGINNER COURSE
 *   • params es una promesa ES/EN/PT: en Next 15 los parámetros de ruta llegan
 *     como Promise: se hace `await params` antes de usarlos. In Next 15 route
 *     params arrive as a Promise: await them before use.
 *   • <details> nativo ES/EN/PT: plegar contenido sin una sola línea de
 *     JavaScript del lado del cliente. Collapsible content with zero client JS.
 */
import { routes } from '../../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme, statusColor } from '../../../lib/ui.js';

export const dynamic = 'force-dynamic';

export default async function SessionDetail({ params }) {
  const { id } = await params;
  let data = null;
  let error = null;
  try {
    data = await routes.session(id);
  } catch (cause) {
    error = cause.message;
  }

  if (error) {
    return <Page><PageHeader title={id} /><ErrorBox error={error} /></Page>;
  }

  const session = data.session ?? {};
  const processed = data.processed_messages ?? [];
  const raw = data.raw_messages ?? [];

  return (
    <Page>
      <PageHeader
        title={session.title ?? id}
        subtitle={session.source}
        es="RAW intacto + interpretación procesada, lado a lado."
        pt="RAW intacto + interpretação processada, lado a lado."
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <Pill color={theme.accent}>{session.id}</Pill>
        <Pill>{session.format}</Pill>
        <Pill>{raw.length} raw messages</Pill>
        <Pill>{processed.length} processed</Pill>
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        {processed.map((message, index) => {
          const rawMessage = raw.find((item) => item.id === message.id) ?? raw[index] ?? {};
          return (
            <Card key={message.id ?? index}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pill color={message.role === 'user' ? theme.accent : theme.warn}>{message.role}</Pill>
                <Pill color={statusColor('approved')}>intent: {message.intent ?? '—'} ({Math.round((message.intent_confidence ?? 0) * 100)}%)</Pill>
                <Pill>lang: {message.language ?? '—'} ({Math.round((message.language_confidence ?? 0) * 100)}%)</Pill>
                <Pill>{message.words ?? 0} words · {message.code_blocks ?? 0} code blocks</Pill>
              </div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: theme.muted, fontSize: 13 }}>RAW content (level 1, never interpreted)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', color: theme.text, fontSize: 13, fontFamily: theme.mono, background: theme.bg, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                  {rawMessage.content ?? '(raw message not found)'}
                </pre>
              </details>
            </Card>
          );
        })}
      </section>
    </Page>
  );
}

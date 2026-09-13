/*
 * 🇪🇸 ES — QUÉ HACE: la historia observable del proyecto, día a día y evento a
 *     evento (POL-0001: nada pasa sin dejar un evento). Cada fila: hora, tipo,
 *     capa, tarea y resumen del payload. Es la cinta de auditoría del sistema:
 *     si algo cambió, aquí está CUÁNDO y POR QUÉ.
 * 🇬🇧 EN — WHAT IT DOES: the project's observable history, day by day and event
 *     by event (POL-0001: nothing happens without an event). Each row: time,
 *     type, layer, task and a payload summary. The system's audit tape: when
 *     something changed, WHEN and WHY are here.
 * 🇧🇷 PT — O QUE FAZ: a história observável do projeto, dia a dia, evento a
 *     evento. A fita de auditoria do sistema.
 *
 * 🎓 BEGINNER COURSE: eventos append-only ES/EN/PT: la lista de eventos solo
 *   crece; nunca se edita ni se borra. Por eso es confiable como historial:
 *   reescribir la historia es justo lo que un audit log no debe permitir.
 *   An append-only log is trustworthy precisely because nobody can rewrite it.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

const TYPE_COLORS = {
  ERROR_DETECTED: '#f85149', INTERRUPTION_RAISED: '#f85149', TEST_FAILED: '#f85149',
  BUILD_COMPLETED: '#3fb950', TEST_PASSED: '#3fb950', RECOVERY_COMPLETED: '#3fb950',
  DECISION_MADE: '#4fd1c5', LESSON_CREATED: '#4fd1c5', CHECKPOINT_CREATED: '#d29922',
};

export default async function TimelinePage() {
  let data = null;
  let error = null;
  try {
    data = await routes.timeline();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <Page>
      <PageHeader
        title="Timeline"
        subtitle={`${data?.count ?? '…'} observable events — the audit tape of everything that happened.`}
        es="Nada pasa sin dejar un evento observable (POL-0001)."
        pt="Nada acontece sem deixar um evento observável (POL-0001)."
      />
      {error ? <ErrorBox error={error} /> : (
        Object.entries(data?.by_day ?? {}).map(([day, events]) => (
          <section key={day} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontFamily: theme.mono, color: theme.accent, margin: '0 0 10px' }}>{day}</h2>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {(events ?? []).map((event) => (
                <div
                  key={event.id}
                  style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 14px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}
                >
                  <span style={{ fontFamily: theme.mono, fontSize: 12, color: theme.faint, flex: '0 0 58px' }}>
                    {String(event.ts ?? '').slice(11, 19)}
                  </span>
                  <Pill color={TYPE_COLORS[event.type] ?? theme.border}>{event.type}</Pill>
                  <span style={{ fontSize: 12, color: theme.muted, fontFamily: theme.mono }}>{event.layer ?? '—'}</span>
                  {event.task ? <span style={{ fontSize: 12, color: theme.faint, fontFamily: theme.mono }}>{event.task}</span> : null}
                  <span style={{ fontSize: 12, color: theme.muted, flex: '1 1 200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(event.payload ?? {}).slice(0, 120)}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ))
      )}
    </Page>
  );
}

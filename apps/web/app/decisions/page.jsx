/*
 * 🇪🇸 ES — QUÉ HACE: lista las Decision Traces (DEC-00003): en vez de
 *     razonamiento privado de modelo, cada decisión guarda objetivo, contexto,
 *     restricciones, alternativas, decisión, justificación y evidencia. Esta
 *     página es el índice; el detalle completo vive en /decisions/[id].
 * 🇬🇧 EN — WHAT IT DOES: lists the Decision Traces (DEC-00003): instead of
 *     private model reasoning, every decision stores objective, context,
 *     constraints, alternatives, decision, justification and evidence. Index
 *     here; full detail at /decisions/[id].
 * 🇧🇷 PT — O QUE FAZ: lista as Decision Traces; detalhe em /decisions/[id].
 *
 * 🎓 BEGINNER COURSE: el estado se pinta con color semántico (statusColor):
 *   verde aprobado, ámbar propuesto, rojo bloqueado. Un color consistente es
 *   información, no decoración. Consistent color is information, not decoration.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme, statusColor } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

export default async function DecisionsPage() {
  let data = null;
  let error = null;
  try {
    data = await routes.decisions();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <Page>
      <PageHeader
        title="Decision Traces"
        subtitle={`${data?.count ?? '…'} explainable decisions — objective, context, constraints, alternatives, justification, evidence.`}
        es="Decisiones explicables: nada de razonamiento privado (DEC-00003)."
        pt="Decisões explicáveis: nada de raciocínio privado (DEC-00003)."
      />
      {error ? <ErrorBox error={error} /> : (
        <section style={{ display: 'grid', gap: 10 }}>
          {(data?.decisions ?? []).map((decision) => (
            <Card key={decision.id} style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href={`/decisions/${decision.id}`} style={{ color: theme.accent, textDecoration: 'none', fontFamily: theme.mono, fontWeight: 700 }}>
                  {decision.id}
                </a>
                <Pill>{decision.layer ?? '—'}</Pill>
                <Pill color={statusColor(decision.status)}>{decision.status}</Pill>
              </div>
              <p style={{ margin: '8px 0 0', color: theme.text, fontSize: 14, lineHeight: 1.5 }}>
                {(decision.objective_en ?? decision.decision ?? '').slice(0, 220)}
                {(decision.objective_en ?? decision.decision ?? '').length > 220 ? '…' : ''}
              </p>
            </Card>
          ))}
        </section>
      )}
    </Page>
  );
}

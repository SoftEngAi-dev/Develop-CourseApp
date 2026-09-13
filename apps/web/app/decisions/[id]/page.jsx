/*
 * 🇪🇸 ES — QUÉ HACE: UNA Decision Trace completa + su cadena de proveniencia:
 *     qué búsquedas la informaron, qué fuentes se consultaron, cuál se eligió y
 *     POR QUÉ (provenanceChain). Objetivos trilingües lado a lado: el modelo de
 *     datos {es,en,pt} se ve tal cual, sin traducciones de última hora.
 * 🇬🇧 EN — WHAT IT DOES: ONE full Decision Trace + its provenance chain: which
 *     searches informed it, which sources were consulted, which was selected and
 *     WHY. Trilingual objectives side by side: the {es,en,pt} data model as-is.
 * 🇧🇷 PT — O QUE FAZ: UMA Decision Trace completa + cadeia de proveniência.
 *
 * 🎓 BEGINNER COURSE
 *   • Campos que pueden ser string O array ES/EN/PT: la API devuelve JSON ya
 *     parseado, pero un cliente defensivo acepta ambos (maybeList). Programar
 *     contra contratos reales incluye tolerar serializaciones viejas.
 *     Defensive clients accept both parsed arrays and JSON strings.
 *   • Proveniencia ES/EN/PT: "por qué sé lo que sé" es tan importante como lo
 *     que sé. La sección de proveniencia responde con evidencia fechada.
 *     Provenance answers "why do I know this" with dated evidence.
 */
import { routes } from '../../../lib/api.js';
import { Page, PageHeader, Card, Pill, ErrorBox, theme, statusColor } from '../../../lib/ui.js';

export const dynamic = 'force-dynamic';

/** ES/EN/PT: acepta array o string JSON. Accepts an array or a JSON string. */
function maybeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return value ? [value] : []; }
  }
  return [];
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.faint, margin: '0 0 8px' }}>{title}</h2>
      {children}
    </section>
  );
}

export default async function DecisionDetail({ params }) {
  const { id } = await params;
  let decision = null;
  let provenance = null;
  let error = null;
  try {
    decision = await routes.decision(id);
    provenance = await routes.provenance(id).catch(() => null);
  } catch (cause) {
    error = cause.message;
  }

  if (error || !decision) {
    return <Page><PageHeader title={id} /><ErrorBox error={error ?? 'decision not found'} /></Page>;
  }

  const constraints = maybeList(decision.constraints ?? decision.constraints_json);
  const alternatives = maybeList(decision.alternatives ?? decision.alternatives_json);
  const related = maybeList(decision.related ?? decision.related_json);
  const chain = provenance?.chains?.[0] ?? null;

  return (
    <Page>
      <PageHeader title={id} subtitle={decision.decision} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill>{decision.layer ?? '—'}</Pill>
        <Pill color={statusColor(decision.status)}>{decision.status}</Pill>
        {decision.created_at ? <Pill>{String(decision.created_at).slice(0, 10)}</Pill> : null}
      </div>

      <Section title="Objective (trilingual)">
        <Card>
          <p style={{ margin: 0 }}>🇬🇧 {decision.objective_en ?? '—'}</p>
          <p style={{ margin: '8px 0 0', color: theme.muted }}>🇪🇸 {decision.objective_es ?? '—'}</p>
          <p style={{ margin: '8px 0 0', color: theme.muted }}>🇧🇷 {decision.objective_pt ?? '—'}</p>
        </Card>
      </Section>

      {decision.context ? <Section title="Context"><Card><p style={{ margin: 0, color: theme.muted, lineHeight: 1.6 }}>{decision.context}</p></Card></Section> : null}

      {constraints.length ? (
        <Section title="Constraints">
          <Card><ul style={{ margin: 0, paddingLeft: 18, color: theme.muted, lineHeight: 1.7 }}>{constraints.map((item, index) => <li key={index}>{String(item)}</li>)}</ul></Card>
        </Section>
      ) : null}

      {alternatives.length ? (
        <Section title="Alternatives">
          <Card>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {alternatives.map((alternative, index) => {
                const selected = alternative.selected === true || String(alternative.id ?? '').startsWith('✅');
                return (
                  <li key={index} style={{ color: selected ? theme.text : theme.muted }}>
                    {selected ? '✅ ' : '❌ '}<strong>{alternative.option ?? String(alternative)}</strong>
                    {alternative.rejected_because ? <span style={{ color: theme.faint }}> — rejected: {alternative.rejected_because}</span> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      ) : null}

      {decision.justification ? <Section title="Justification"><Card><p style={{ margin: 0, lineHeight: 1.6 }}>{decision.justification}</p></Card></Section> : null}
      {decision.consequence ? <Section title="Consequence"><Card><p style={{ margin: 0, color: theme.muted, lineHeight: 1.6 }}>{decision.consequence}</p></Card></Section> : null}
      {decision.evidence ? (
        <Section title="Evidence">
          <Card><pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: theme.mono, fontSize: 13, color: theme.accent }}>{decision.evidence}</pre></Card>
        </Section>
      ) : null}

      {related.length ? (
        <Section title="Related">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {related.map((item) => (
              <a key={String(item)} href={String(item).startsWith('DEC-') ? `/decisions/${item}` : '#'} style={{ textDecoration: 'none' }}>
                <Pill color={theme.accent}>{String(item)}</Pill>
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Provenance (why I know this)">
        {chain ? (
          <Card>
            {(chain.searches ?? []).length === 0 ? <p style={{ margin: 0, color: theme.muted }}>No external searches were needed — this decision came from the project conversations.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18, color: theme.muted, lineHeight: 1.8 }}>
                {(chain.searches ?? []).map((search) => (
                  <li key={search.id ?? search.query}>
                    <strong>{search.query}</strong> — {search.reason ?? ''}
                    {search.selected ? <span style={{ color: theme.accent }}> · selected: {String(search.selected).slice(0, 120)}</span> : null}
                    {search.why ? <span style={{ color: theme.faint }}> · why: {search.why}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {(chain.sources ?? []).length ? (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: theme.faint }}>Sources: {chain.sources.map((source) => String(source)).join(' · ').slice(0, 400)}</p>
            ) : null}
          </Card>
        ) : <Card><p style={{ margin: 0, color: theme.muted }}>No provenance chain recorded for this decision.</p></Card>}
      </Section>
    </Page>
  );
}

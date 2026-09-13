/*
 * 🇪🇸 ES — QUÉ HACE: el SESSION CONTEXT completo del Context Engine (Fase 2):
 *     dónde estamos, tarea actual, checkpoints, decisiones relevantes, intentos
 *     fallidos, restricciones y archivos — en Markdown, tal como lo consume
 *     `genesis resume`. Ninguna sesión futura tiene que re-leer el universo:
 *     esta pantalla ES la memoria de trabajo del proyecto.
 * 🇬🇧 EN — WHAT IT DOES: the full SESSION CONTEXT from the Context Engine
 *     (Phase 2): where we are, current task, checkpoints, relevant decisions,
 *     failed attempts, constraints and files — as Markdown, exactly what
 *     `genesis resume` consumes. No future session has to re-read the universe:
 *     this screen IS the project's working memory.
 * 🇧🇷 PT — O QUE FAZ: o SESSION CONTEXT completo do Context Engine, em
 *     Markdown — a memória de trabalho do projeto.
 *
 * 🎓 BEGINNER COURSE: la API devuelve TEXTO (no JSON) cuando se pide
 *   format=md; por eso existe apiText() en lib/api.js. Un mismo endpoint puede
 *   negociar formatos: ?format=md para humanos/agentes, JSON para máquinas.
 *   One endpoint, negotiated formats: markdown for humans, JSON for machines.
 */
import { routes } from '../../lib/api.js';
import { Page, PageHeader, ErrorBox, theme } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

export default async function ContextPage() {
  let markdown = null;
  let error = null;
  try {
    markdown = await routes.contextMd();
  } catch (cause) {
    error = cause.message;
  }

  return (
    <Page>
      <PageHeader
        title="Session context"
        subtitle="Everything a new session needs to continue — generated live by the Context Engine (genesis resume)."
        es="Todo lo que una sesión nueva necesita para continuar."
        pt="Tudo que uma nova sessão precisa para continuar."
      />
      {error ? <ErrorBox error={error} /> : (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: theme.mono, fontSize: 13, lineHeight: 1.7, color: theme.text, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20, margin: 0 }}>
          {markdown}
        </pre>
      )}
    </Page>
  );
}

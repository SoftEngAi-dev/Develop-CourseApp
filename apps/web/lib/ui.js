/*
 * 🇪🇸 ES — QUÉ HACE: piezas de interfaz compartidas por todas las páginas del
 *     front Next.js. Mismo tema oscuro del console offline (una sola identidad
 *     visual, dos tecnologías). Son componentes DE SERVIDOR: no llevan 'use
 *     client', no hidratan, no envían JS extra al navegador.
 * 🇬🇧 EN — WHAT IT DOES: UI pieces shared by every page of the Next.js front
 *     end. Same dark theme as the offline console (one visual identity, two
 *     technologies). These are SERVER components: no 'use client', no
 *     hydration, no extra JS shipped to the browser.
 * 🇧🇷 PT — O QUE FAZ: peças de UI compartilhadas por todas as páginas do front
 *     Next.js. Mesmo tema escuro do console offline. Componentes DE SERVIDOR.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Server components ES/EN/PT: en Next.js (App Router) un componente se
 *     ejecuta EN EL SERVIDOR por defecto. Recibe datos, devuelve HTML y el
 *     navegador no descarga su lógica. Solo se marca 'use client' lo que
 *     necesita interactividad; aquí, nada la necesita: los formularios son GET
 *     nativos. By default components run on the server; only interactive ones
 *     opt into the client. Native GET forms need zero JavaScript.
 *   • Estilos en línea ES/EN/PT: sin CSS-in-JS ni Tailwind: objetos de estilo
 *     planos. Cero dependencias extra dentro del paquete aislado (POL-0001).
 *     Plain style objects: no extra dependencies inside the isolated package.
 */

/** ES/EN/PT: paleta heredada del console. Palette inherited from the console. */
export const theme = {
  bg: '#080b10',
  card: '#121924',
  border: '#1f2a3a',
  text: '#e6edf6',
  muted: '#93a2b8',
  faint: '#64748b',
  accent: '#4fd1c5',
  danger: 'rgba(248,81,73,.4)',
  ok: '#3fb950',
  warn: '#d29922',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

/** ES/EN/PT: tarjeta base. Base card. */
export function Card({ children, style }) {
  return (
    <div style={{ border: `1px solid ${theme.border}`, background: theme.card, borderRadius: 10, padding: 16, ...style }}>
      {children}
    </div>
  );
}

/** ES/EN/PT: encabezado de página con subtítulo trilingüe opcional. */
export function PageHeader({ title, subtitle, es, pt }) {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ margin: 0, letterSpacing: '0.06em', fontSize: 26 }}>{title}</h1>
      {subtitle ? <p style={{ color: theme.muted, margin: '6px 0 0' }}>{subtitle}</p> : null}
      {es || pt ? (
        <p style={{ color: theme.faint, margin: '4px 0 0', fontSize: 13 }}>
          🇪🇸 {es} {pt ? <>· 🇧🇷 {pt}</> : null}
        </p>
      ) : null}
    </header>
  );
}

/** ES/EN/PT: etiqueta pequeña (estado, capa, tipo). Small pill badge. */
export function Pill({ children, color }) {
  return (
    <span
      style={{
        display: 'inline-block', fontSize: 11, fontFamily: theme.mono, padding: '2px 8px',
        borderRadius: 999, border: `1px solid ${color ?? theme.border}`, color: color ?? theme.muted,
      }}
    >
      {children}
    </span>
  );
}

/** ES/EN/PT: caja de error honesta (el patrón del page.jsx original). */
export function ErrorBox({ error, hint }) {
  return (
    <Card style={{ borderColor: theme.danger }}>
      <strong>The engine is not answering.</strong>
      {hint ? <p style={{ color: theme.muted }}>{hint}</p> : null}
      <p style={{ color: theme.faint, fontSize: 13, fontFamily: theme.mono }}>{String(error)}</p>
    </Card>
  );
}

/** ES/EN/PT: envoltorio de página (ancho máximo + padding). Page wrapper. */
export function Page({ children }) {
  return <main style={{ maxWidth: 1020, margin: '0 auto', padding: '32px 20px 64px' }}>{children}</main>;
}

/** ES/EN/PT: color por estado/palabra clave. Color by status keyword. */
export function statusColor(status) {
  const text = String(status ?? '').toLowerCase();
  if (['approved', 'completed', 'resolved', 'success', 'consistent'].some((k) => text.includes(k))) return theme.ok;
  if (['blocked', 'failed', 'drift', 'security'].some((k) => text.includes(k))) return '#f85149';
  if (['proposed', 'planned', 'running', 'pending', 'stub'].some((k) => text.includes(k))) return theme.warn;
  return theme.muted;
}

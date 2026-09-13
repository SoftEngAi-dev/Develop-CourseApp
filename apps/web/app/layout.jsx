/*
 * 🇪🇸 ES — QUÉ HACE: layout raíz con navegación lateral. Las 8 rutas del SPEC
 *     de Fase 4 viven en el sidebar: dashboard, sesiones, decisiones,
 *     conocimiento (búsqueda), grafo, línea de tiempo, contexto y docs
 *     generadas. En móvil la barra se vuelve horizontal (flex-wrap) sin media
 *     queries ni JS: el mismo markup sirve a escritorio y móvil.
 * 🇬🇧 EN — WHAT IT DOES: root layout with side navigation. The 8 routes from
 *     the Phase 4 SPEC live in the sidebar: dashboard, sessions, decisions,
 *     knowledge (search), graph, timeline, context and generated docs. On
 *     mobile the bar becomes horizontal (flex-wrap) with no media queries and
 *     no JS: the same markup serves desktop and mobile.
 * 🇧🇷 PT — O QUE FAZ: layout raiz com navegação lateral. As 8 rotas do SPEC da
 *     Fase 4 vivem no sidebar; no celular a barra vira horizontal (flex-wrap),
 *     sem media queries nem JS.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • layout.jsx ES/EN/PT: en el App Router de Next, layout.jsx envuelve todas
 *     las páginas del directorio. Lo que pongas aquí (nav, tema) aparece en
 *     cada ruta sin repetirlo. In Next's App Router, layout.jsx wraps every
 *     page in the folder: put the nav here once.
 *   • <nav> semántico ES/EN/PT: usar la etiqueta <nav> (y no un <div>) le dice
 *     a lectores de pantalla y buscadores "esto es navegación". HTML semántico
 *     es accesibilidad gratis. Semantic HTML is free accessibility.
 */
import { theme } from '../lib/ui.js';

export const metadata = {
  title: 'GENESIS · Project Knowledge & Autonomous Engine',
  description: 'Decisions, timeline, knowledge graph, lessons and context — served by the zero-dependency engine.',
};

const NAV = [
  ['/', 'Dashboard'],
  ['/sessions', 'Sessions'],
  ['/decisions', 'Decisions'],
  ['/knowledge', 'Knowledge'],
  ['/graph', 'Graph'],
  ['/timeline', 'Timeline'],
  ['/context', 'Context'],
  ['/docs', 'Docs'],
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: theme.bg, color: theme.text, fontFamily: 'system-ui, sans-serif' }}>
        {/*
          ES: CSS plano con media query en un <style> SSR: móvil = barra superior
              horizontal; ≥820px = sidebar vertical. Cero dependencias, cero JS.
          EN: plain CSS with a media query in an SSR <style>: mobile = horizontal
              top bar; ≥820px = vertical sidebar. Zero deps, zero JS.
          PT: CSS puro com media query: celular = barra superior; ≥820px = sidebar.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          .shell { display: flex; min-height: 100vh; flex-wrap: wrap; }
          .nav { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
                 border-bottom: 1px solid ${theme.border}; padding: 10px 14px; background: #0b1017; }
          .nav .brand { color: ${theme.text}; text-decoration: none; font-weight: 700;
                        letter-spacing: .12em; padding: 6px 10px; }
          .nav a.link { color: ${theme.muted}; text-decoration: none; padding: 7px 10px;
                        border-radius: 8px; font-size: 14px; }
          .nav a.link:hover { color: ${theme.accent}; background: ${theme.card}; }
          .nav .foot { display: none; }
          .content { flex: 1 1 100%; min-width: 0; }
          @media (min-width: 820px) {
            .shell { flex-wrap: nowrap; }
            .nav { flex: 0 0 208px; flex-direction: column; align-items: stretch;
                   border-bottom: none; border-right: 1px solid ${theme.border}; padding: 20px 14px; }
            .nav .foot { display: block; color: ${theme.faint}; font-size: 11px;
                         margin-top: auto; padding: 14px 10px 0; line-height: 1.5; }
            .content { flex: 1 1 auto; }
          }
        `}} />
        <div className="shell">
          <nav className="nav" aria-label="Main navigation">
            <a className="brand" href="/">🧬 GENESIS</a>
            {NAV.map(([href, label]) => (
              <a key={href} className="link" href={href}>{label}</a>
            ))}
            <p className="foot">
              Next.js enhancement · same 31-route API as the offline console (DEC-00005)
            </p>
          </nav>
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  );
}

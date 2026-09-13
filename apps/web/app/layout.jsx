/*
 * ES: layout raíz. Tipografía del sistema, tema oscuro heredado del console.
 * EN: root layout. System typography, dark theme inherited from the console.
 * PT: layout raiz. Tipografia do sistema, tema escuro herdado do console.
 */
export const metadata = {
  title: 'GENESIS · Project Knowledge & Autonomous Engine',
  description: 'Decisions, timeline, knowledge graph, lessons and context — served by the zero-dependency engine.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080b10', color: '#e6edf6', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

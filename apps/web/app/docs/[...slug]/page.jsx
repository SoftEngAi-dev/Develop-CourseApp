/*
 * 🇪🇸 ES — QUÉ HACE: lector de UN archivo generado. La seguridad es el punto:
 *     la ruta pedida se resuelve y se comprueba que SIGA dentro de
 *     documentation/generated antes de leer nada (anti path-traversal: un ../../
 *     no puede escapar a leer /etc/passwd o el .git). Markdown y JSON se
 *     renderizan monoespaciados, sin librerías de parseo (cero dependencias
 *     extra, POL-0001 dentro del paquete aislado).
 * 🇬🇧 EN — WHAT IT DOES: reader for ONE generated file. Security is the point:
 *     the requested path is resolved and PROVEN to stay inside
 *     documentation/generated before anything is read (anti path-traversal: a
 *     ../../ cannot escape to /etc/passwd or .git). Markdown and JSON render
 *     monospaced, with no parsing libraries (zero extra deps).
 * 🇧🇷 PT — O QUE FAZ: leitor de UM arquivo gerado, com proteção anti
 *     path-traversal comprovada antes de ler.
 *
 * 🎓 BEGINNER COURSE: path.resolve + startsWith ES/EN/PT: resolver convierte
 *   "docs/../../secreto" en una ruta absoluta real; startsWith contra la raíz
 *   permitida decide si se lee. Dos líneas que valen un firewall.
 *   Resolve, then prove containment: two lines that act as a firewall.
 */
import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Page, PageHeader, Card, Pill, theme } from '../../../lib/ui.js';

export const dynamic = 'force-dynamic';

const GENERATED = path.resolve(process.cwd(), '..', '..', 'documentation', 'generated');

export default async function GeneratedDocPage({ params }) {
  const { slug } = await params;
  const relative = (Array.isArray(slug) ? slug : [slug]).join('/');
  const absolute = path.resolve(GENERATED, relative);

  // ES: containment check — fuera de generated/ no se lee NADA.
  // EN: containment check — nothing outside generated/ is ever read.
  // PT: verificação de contenção — nada fora de generated/ é lido.
  if (!absolute.startsWith(GENERATED + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    notFound();
  }

  const content = fs.readFileSync(absolute, 'utf8');
  const isJson = absolute.endsWith('.json');

  return (
    <Page>
      <PageHeader
        title={path.basename(absolute)}
        subtitle={relative}
        es="Archivo generado — si lo editas a mano, verifyDocumentation marcará drift."
        pt="Arquivo gerado — edições manuais geram drift."
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Pill color={theme.accent}>{isJson ? 'json' : 'markdown'}</Pill>
        <Pill>{(Buffer.byteLength(content) / 1024).toFixed(1)} KB</Pill>
        <a href="/docs" style={{ color: theme.muted, fontSize: 13 }}>← all generated docs</a>
      </div>
      <Card style={{ padding: 0 }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: theme.mono, fontSize: 13, lineHeight: 1.65, color: theme.text, margin: 0, padding: 20 }}>
          {content}
        </pre>
      </Card>
    </Page>
  );
}

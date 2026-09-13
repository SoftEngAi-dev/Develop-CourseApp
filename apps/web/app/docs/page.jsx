/*
 * 🇪🇸 ES — QUÉ HACE: índice de la documentación GENERADA por la Fase 3
 *     (documentation/generated): los cuatro documentos principales, el
 *     manifiesto con el resultado de la verificación de drift, las 13 Decision
 *     Traces y los cursos de la Fase 6. Leer archivos con fs en un server
 *     component es exactamente lo que la tabla de rutas del SPEC pide para
 *     /docs/** — y es seguro porque la ruta se resuelve SIEMPRE dentro de
 *     documentation/generated (la página hija lo garantiza).
 * 🇬🇧 EN — WHAT IT DOES: index of the Phase-3 GENERATED documentation: the four
 *     main documents, the manifest with its drift-verification result, the 13
 *     Decision Traces and the Phase-6 courses. Reading files with fs in a server
 *     component is exactly what the SPEC route table asks for /docs/** — safe
 *     because paths ALWAYS resolve inside documentation/generated.
 * 🇧🇷 PT — O QUE FAZ: índice da documentação GERADA pela Fase 3 + cursos da
 *     Fase 6; leitura de arquivos sempre dentro de documentation/generated.
 *
 * 🎓 BEGINNER COURSE: "docs generadas" vs "docs escritas" ES/EN/PT: docs/ son
 *   escritas a mano; documentation/generated/ las produce la base de datos. Si
 *   alguien edita a mano un archivo .generated.md, verifyDocumentation lo marca
 *   como drift. Generated docs are database output: hand-edits are drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Page, PageHeader, Card, Pill, ErrorBox, theme } from '../../lib/ui.js';

export const dynamic = 'force-dynamic';

const GENERATED = path.resolve(process.cwd(), '..', '..', 'documentation', 'generated');

/** ES/EN/PT: lista archivos relativos, recursivo, ordenados. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

export default async function DocsIndexPage() {
  let files = [];
  let manifest = null;
  let error = null;
  try {
    files = fs.existsSync(GENERATED) ? walk(GENERATED) : [];
    manifest = JSON.parse(fs.readFileSync(path.join(GENERATED, 'doc-manifest.json'), 'utf8'));
  } catch (cause) {
    error = cause.message;
  }

  const groups = {
    'Core documents': files.filter((file) => !file.includes('/') && file.endsWith('.md')),
    'Manifests & data': files.filter((file) => !file.includes('/') && !file.endsWith('.md')),
    'Decision Traces': files.filter((file) => file.startsWith('decisions/')),
    'Courses (Phase 6)': files.filter((file) => file.startsWith('courses/')),
  };

  return (
    <Page>
      <PageHeader
        title="Generated documentation"
        subtitle={`${files.length} files produced by the Phase-3 engine from the live database — never hand-written.`}
        es="Documentación generada por el motor de Fase 3 desde la base real."
        pt="Documentação gerada pelo motor da Fase 3 a partir do banco real."
      />

      {manifest ? (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill color={manifest.verification?.consistent ? '#3fb950' : '#f85149'}>
              {manifest.verification?.consistent ? '✓ consistent with the database' : '⚠ DRIFT detected'}
            </Pill>
            <Pill>generated {String(manifest.generated_at ?? '').slice(0, 16).replace('T', ' ')}</Pill>
            <Pill>{manifest.formats?.join(' · ')}</Pill>
          </div>
        </Card>
      ) : null}

      {error ? <ErrorBox error={error} hint="Run `genesis docs` (or npm run pipeline) to generate them." /> : null}

      {Object.entries(groups).map(([group, items]) => (items.length ? (
        <section key={group} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.faint, margin: '0 0 8px' }}>{group}</h2>
          <Card style={{ padding: 8 }}>
            {items.map((file) => (
              <a
                key={file}
                href={`/docs/${file}`}
                style={{ display: 'block', color: theme.accent, textDecoration: 'none', fontFamily: theme.mono, fontSize: 13, padding: '6px 8px', borderRadius: 6 }}
              >
                {file}
              </a>
            ))}
          </Card>
        </section>
      ) : null))}
    </Page>
  );
}

// ES: configuración mínima y honesta. El front de Next NO toca la base de datos:
//     habla con la API del núcleo por HTTP (o memoria/* en el mismo proceso).
// EN: minimal, honest config. The Next front end does NOT touch the database: it
//     talks to the core API over HTTP (or memory/* in the same process).
// PT: configuração mínima. O front Next NÃO toca o banco: fala com a API por HTTP.
const GENESIS_API = process.env.GENESIS_API ?? 'http://127.0.0.1:4321';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { GENESIS_API },
  async rewrites() {
    // ES: proxy /api/* hacia el núcleo para que el navegador nunca necesite CORS.
    // EN: proxy /api/* to the core so the browser never needs CORS.
    // PT: proxy /api/* para o núcleo, sem CORS no navegador.
    return [{ source: '/api/:path*', destination: `${GENESIS_API}/api/:path*` }];
  },
};

export default nextConfig;

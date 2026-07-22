/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export (output: 'export') — no SSR, no server runtime.
  // El output queda en apps/web/out/ y se sube tal cual a Firebase Hosting.
  // El cliente llama a Cloud Functions directamente via httpsCallable() de
  // firebase/functions (callable CFs) o fetch() (HTTP CFs). No hay
  // middleware de Next.js (Edge runtime no existe en static export).
  output: 'export',
  // transpilePackages fuerza a Next.js a transpilar el shared package con
  // webpack. Necesario porque `packages/shared/src/**/*.ts` usa extensiones
  // `.js` en imports (convención ESM Bundler resolution para runtime
  // functions-side) que webpack nativamente no resuelve — sin esto falla
  // con "Module not found: Can't resolve './common.js'".
  // Ver PR #26 (sdd-10-fase-2-ui PR-1) que introdujo los primeros imports
  // de `@shared/schemas/templates` en el cliente.
  transpilePackages: ['@platform/shared'],
  experimental: { typedRoutes: true },
  images: { unoptimized: true },
  webpack(config) {
    // Webpack resolve.extensionAlias: cuando el código fuente importa
    // './common.js' (convención ESM), webpack lo trata como './common.ts'
    // (porque el shared package es TypeScript source, no dist compilado).
    // Sin esto, incluso con transpilePackages, Next.js no resuelve los
    // `.js` aliases.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
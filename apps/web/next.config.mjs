/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output produces un bundle minimo que se puede deploy a
  // cualquier Node.js host. Necesario para Firebase Hosting + Cloud Run
  // SSR (ver apps/functions/src/v1/hosting/ssr.ts). El output queda en
  // apps/web/.next/standalone/ y los assets estaticos en
  // apps/web/.next/static/.
  output: 'standalone',
  experimental: { typedRoutes: true },
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
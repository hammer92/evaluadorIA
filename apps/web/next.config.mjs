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
  experimental: { typedRoutes: true },
  images: { unoptimized: true },
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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { onRequest } from 'firebase-functions/v2/https';
import next from 'next';

import { env } from '../../env.js';

// =============================================================================
// Cloud Function: ssr (SSR adapter para Next.js)
// =============================================================================
// Firebase Hosting sirve los assets estaticos desde apps/web/.next/static/.
// Para rutas dinamicas (/admin/**, /login, etc.), Hosting hace rewrite a esta
// Cloud Function que ejecuta Next.js via `next` package programmatic API.
//
// Build flow (en firebase.json functions.predeploy):
//   1. pnpm --filter @platform/web build
//      -> produce apps/web/.next/ (BUILD_ID + chunks + static + server/)
//   2. pnpm --filter @platform/functions build (tsc)
//      -> produce apps/functions/lib/
//   3. scripts/copy-next-build.ts copia apps/web/.next -> apps/functions/lib/.next
//   4. firebase deploy --only functions sube apps/functions/lib/ a Cloud Functions
//   5. firebase deploy --only hosting sube apps/web/.next/static/ + rewrites
//   6. Cada request a una ruta dinamica se enruta via rewrite -> ssr function
//
// Runtime:
//   - cwd = root del package desplegado (= apps/functions/lib en runtime)
//   - .next/ esta al lado de lib/ despues del copy
//   - next({ dev: false }) lee el .next/ relativo a cwd y construye el handler
//
// Las env vars (ALLOWED_ORIGINS, NODE_ENV) se validan via Zod en `env.ts`.
//
// Limitaciones:
//   - Cold start ~3-5s en primera request (mitigado con minInstances: 1 en prod)
//   - memory: 512MiB suficiente para Next.js SSR simple (admin pages)
//   - timeoutSeconds: 60 cubre render de admin pages (la mayoria <5s)
// =============================================================================

const distDir = existsSync(join(process.cwd(), '.next')) ? '.next' : undefined;
const nextApp = next({
  dev: false,
  ...(distDir ? { conf: { distDir } } : {}),
});
const nextHandle = nextApp.getRequestHandler();

let preparePromise: Promise<void> | null = null;

function ensurePrepared(): Promise<void> {
  preparePromise ??= nextApp.prepare();
  return preparePromise;
}

export const ssr = onRequest(
  {
    cors: env.ALLOWED_ORIGINS.split(','),
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
    invoker: 'public',
  },
  async (req, res) => {
    try {
      await ensurePrepared();
      await nextHandle(req, res);
    } catch (e) {
      const err = e as Error;
      console.error('[ssr] request handler failed', { message: err.message, stack: err.stack });
      if (!res.headersSent) {
        res.status(500).json({
          error: 'SSR handler failed',
          message: env.NODE_ENV === 'production' ? undefined : err.message,
        });
      }
    }
  },
);

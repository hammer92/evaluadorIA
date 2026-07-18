// =============================================================================
// scripts/copy-next-build.ts
// =============================================================================
// Copia apps/web/.next/ -> apps/functions/lib/.next/ para que la Cloud
// Function `ssr` pueda leer los build artifacts de Next.js en runtime.
//
// Cloud Functions deploya apps/functions/lib/, asi que el .next/ debe estar
// adentro de lib/ para que `next({ dev: false })` lo encuentre.
//
// Se ejecuta como parte del predeploy hook de firebase.json:
//   "predeploy": ["pnpm --filter @platform/functions build"]
//   (donde `build` ahora incluye `pnpm --filter @platform/web build` + `tsc`
//    + este script)
//
// Usage: pnpm tsx scripts/copy-next-build.ts
// =============================================================================

/* eslint-disable no-console */
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../../..');
const srcDir = join(projectRoot, 'apps/web/.next');
const destDir = join(projectRoot, 'apps/functions/lib/.next');

async function main(): Promise<void> {
  if (!existsSync(srcDir)) {
    throw new Error(
      `apps/web/.next/ no existe. Corré "pnpm --filter @platform/web build" primero.`,
    );
  }

  // Limpia el .next/ anterior de la lib/ (si existe)
  if (existsSync(destDir)) {
    await rm(destDir, { recursive: true, force: true });
  }
  await mkdir(destDir, { recursive: true });

  // cp con filter para excluir artefactos no necesarios en runtime (cache, traces)
  await cp(srcDir, destDir, {
    recursive: true,
    filter: (src) => {
      const base = src.split('/').pop() ?? '';
      // Excluir: cache, trace files, server-side source maps pesadas
      if (base === 'cache' || base.endsWith('.nft.json') || base.endsWith('.map')) {
        return false;
      }
      return true;
    },
  });

  console.log(`[copy-next-build] ${srcDir} -> ${destDir}`);
}

main().catch((err: Error) => {
  console.error('[copy-next-build] failed:', err.message);
  process.exit(1);
});

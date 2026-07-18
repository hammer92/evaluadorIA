import { vi } from 'vitest';

// =============================================================================
// vitest.setup — corre UNA VEZ antes de los tests del archivo
// =============================================================================
// Mockea `firebase-functions.config()` para que retorne un objeto con la misma
// forma que en runtime real, pero poblado desde process.env (seteado por
// vitest.config.ts). El mock lee process.env DINAMICAMENTE en cada call para
// permitir que los tests muten variables y luego invaliden la cache con
// __resetEnv() — patron analogo a como en runtime real functions.config()
// leeria el Runtime Config API actualizado.
//
// En runtime real:
//   - `functions.config()` lee del Firebase Runtime Config API (seteado por
//     `firebase functions:config:set $CONFIG_VALUES` en el deploy)
//   - En emuladores, lee de .runtimeconfig.json
// =============================================================================

vi.mock('firebase-functions', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions')>('firebase-functions');
  return {
    ...actual,
    config: () => ({
      session: {
        cookie_secret: process.env['SESSION_COOKIE_SECRET'] ?? '',
      },
      allowed: {
        origins: process.env['ALLOWED_ORIGINS'] ?? '',
      },
      repository: {
        driver: process.env['REPOSITORY_DRIVER'] ?? 'memory',
      },
      admin: {
        project_id: process.env['FIREBASE_ADMIN_PROJECT_ID'] ?? 'demo-test',
      },
      openai: {
        api_key: process.env['OPENAI_API_KEY'],
      },
    }),
  };
});

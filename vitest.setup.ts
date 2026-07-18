// =============================================================================
// Vitest setup (root) — jest-dom matchers + functions.config() mock
// =============================================================================
// Solo aplica a tests que usan `// @vitest-environment jsdom` (pragma en el
// archivo) o configuran jsdom en su workspace. Para tests con environment
// node (e.g., functions, shared) jest-dom no agrega nada porque no hay DOM.
//
// Tambien mockea `firebase-functions.config()` para que `apps/functions/src/env.ts`
// pueda correr desde root sin throw al module load (sign-up.ts y otros acceden
// `env.ALLOWED_ORIGINS` en su onCall config). El mock lee process.env
// DINAMICAMENTE para que __resetEnv() + mutaciones de process.env en tests
// individuales sigan funcionando.
//
// NOTA: vi.mock dentro de setupFiles solo se aplica a modulos importados
// DESPUES del setupFile. Si un test file hace `import` antes del setupFile
// ejecutar (por ejemplo via test isolation), el mock no se aplica. En ese
// caso los tests individuales deben hacer `vi.mock('firebase-functions')`
// en su propio archivo (ver apps/functions/src/env.test.ts).
// =============================================================================

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock lazy-loaded via factory que se invoca cuando se importa el modulo.
vi.mock('firebase-functions', () => ({
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
  https: {
    onCall: () => () => undefined,
    onRequest: () => () => undefined,
  },
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { vi } from 'vitest';

// =============================================================================
// vitest.setup — corre UNA VEZ antes de los tests del archivo
// =============================================================================
// Intencionalmente vacio. env.ts (apps/functions/src/env.ts) lee de process.env.
// vitest.config.ts inyecta los defaults (SESSION_COOKIE_SECRET, ALLOWED_ORIGINS)
// y los tests individuales pueden mutar process.env + llamar __resetEnv() para
// forzar re-lectura con los valores actualizados.
// =============================================================================

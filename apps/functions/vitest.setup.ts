// =============================================================================
// vitest.setup — corre UNA VEZ antes de los tests del archivo
// =============================================================================
// Intencionalmente vacio. El cache de `env` (apps/functions/src/env.ts) se
// invalida SOLO en tests que mutan `process.env` (via `__resetEnv()`), no
// globalmente, para no romper tests que setean process.env en `beforeEach`
// o en el body del test.
//
// Ver `env.test.ts` para el patron de uso correcto.
// =============================================================================

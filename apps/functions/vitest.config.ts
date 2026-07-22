import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Los integration tests se incluyen vía filtro posicional
    // (e.g. `vitest run integration`). El script `test` los excluye via
    // --exclude flag (ver package.json).
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // Per-file worker pool (singleFork: false). Cada test file corre en su
    // propio fork con firebase-admin/app fresco. Elimina el shared state
    // entre archivos que rompía los 2 intentos previos de templates
    // (commit 2ff7145: "Unknown Error: There is no user record corresponding
    // to the provided identifier").
    //
    // Unit tests no tienen shared state issue (no se conectan a emuladores),
    // pero pagan el costo de startup de worker per-file. Trade-off aceptable
    // para desbloquear los integration tests de templates.
    //
    // Nota: vitest 2.x no soporta `poolMatchGlobs` con object config (solo
    // string pool names). Probado en commit 3c36780: TypeError en pathe.
    // Solución: singleFork:false top-level.
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      ALLOWED_ORIGINS: 'http://localhost:3000',
      SESSION_COOKIE_SECRET: 'test-secret-for-vitest-must-be-at-least-32-chars-long',
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});

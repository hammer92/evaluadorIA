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
    // Unit tests: single fork para velocidad (268 tests, ~3s).
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Integration tests contra emuladores Firebase: per-file worker pool.
    // Cada `*.integration.test.ts` corre en su propio fork con firebase-admin/app
    // fresco. Elimina el shared state entre archivos que rompía los 2 intentos
    // previos de templates (commit 2ff7145: "Unknown Error: There is no user
    // record corresponding to the provided identifier"). Unit tests siguen en
    // singleFork para mantener el startup time bajo.
    poolMatchGlobs: [
      [
        '**/*.integration.test.ts',
        { pool: 'forks', poolOptions: { forks: { singleFork: false } } },
      ],
    ],
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

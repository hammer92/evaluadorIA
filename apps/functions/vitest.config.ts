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
    // Single fork (secuencial) para integration tests existentes y futuros.
    // Cada test file corre en orden dentro del mismo worker, evitando race
    // conditions sobre el estado compartido del firestore + auth emulator.
    //
    // El commit 2ff7145 (templates integration tests deferidos) atribuyó
    // el conflicto a "shared state entre test files via firebase-admin
    // singleton". La raíz real fue race conditions entre workers paralelos:
    // sign-up (bootstrap admin) chocaba con create-user (admin existente).
    // Confirmado en CI run #29889573206.
    //
    // Los nuevos templates integration tests (PR #B) usarán los helpers de
    // `__tests__/helpers/integration-setup.ts` (cleanup determinístico en
    // afterAll + beforeAll) para mantener el estado limpio sin depender de
    // workers aislados.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
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

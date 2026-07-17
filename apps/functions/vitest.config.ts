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
    // Integration tests contra emuladores Firebase: correr secuencialmente
    // (single fork) para evitar race conditions sobre el estado compartido
    // del firestore + auth emulator. Cada archivo limpia sus users en
    // beforeAll pero sin singleFork los runs paralelos contaminan el estado.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      ALLOWED_ORIGINS: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});

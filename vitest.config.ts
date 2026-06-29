import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
      exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/*.config.{ts,js,mjs}'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/web'),
      '@shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});

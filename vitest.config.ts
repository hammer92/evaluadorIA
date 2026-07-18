import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Usar el JSX automatic runtime (React 17+) para no requerir
  // `import React from 'react'` en cada componente .tsx testeado desde root.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    // Setup inline (no archivo externo) porque root setup solo necesita
    // jest-dom cuando se carga un test con `// @vitest-environment jsdom`.
    // Usar require dinámico para no romper tests con environment node
    // (que es el default desde root y no tiene @testing-library/jest-dom).
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    // Env vars requeridas por apps/functions/src/env.ts (Zod validation
    // fail-fast). Los tests individuales de functions las sobreescriben
    // segun corresponda, pero estos defaults permiten que el modulo se
    // cargue sin throw al ejecutar `pnpm test` desde root.
    env: {
      SESSION_COOKIE_SECRET: 'test-secret-for-vitest-must-be-at-least-32-chars-long',
      ALLOWED_ORIGINS: 'http://localhost:3000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
      include: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/lib/**',
        '**/.next/**',
        '**/*.d.ts',
        '**/next-env.d.ts',
        '**/*.config.{ts,js,mjs}',
        '**/vitest.setup.ts',
        '**/__tests__/**',
        'scripts/**',
        'apps/web/app/**',
        'apps/web/components/ui/**',
        'apps/web/components/layout/**',
        'apps/web/features/dashboard/components/**',
        'apps/web/features/settings/components/**',
        'apps/web/features/users/components/**',
        'apps/web/features/auth/components/login-form.tsx',
        'apps/web/features/auth/components/signup-form.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/web'),
      '@shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});

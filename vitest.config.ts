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
        'apps/web/components/error-boundary.tsx',
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

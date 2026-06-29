import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    env: {
      // Default a memory para que tests unit no necesiten emuladores.
      // Los tests de integración Firebase instancian su propio FirebaseApp
      // y no dependen del factory, así que este default no los afecta.
      REPOSITORY_DRIVER: 'memory',
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-test',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:0:web:test',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});

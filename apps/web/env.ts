import { z } from 'zod';

import { applyDevEnvDefaults } from '@/lib/env-dev-defaults';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

// =============================================================================
// Lazy validation — la validación se ejecuta en el primer access, no en module
// load. Esto permite que vitest (y otros consumidores) inyecten env vars en el
// setup file antes de que el módulo se use.
// =============================================================================
// Arquitectura estática (output: 'export'): solo hay env vars del cliente
// (NEXT_PUBLIC_*). No hay server-side runtime, no hay serverEnvSchema, no hay
// SESSION_COOKIE_SECRET (la auth pasa por Firebase Auth ID token, no por cookie
// firmada HS256). Las CFs leen sus propias env vars via functions.config().
// =============================================================================

let _client: z.infer<typeof clientEnvSchema> | undefined;

function readClient(): z.infer<typeof clientEnvSchema> {
  if (_client) return _client;
  applyDevEnvDefaults();
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env['NEXT_PUBLIC_APP_ENV'],
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'],
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'],
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'],
  });
  if (!parsed.success) {
    throw new Error(
      'Invalid client env: ' + JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
  }
  _client = parsed.data;
  return _client;
}

// Getters — se evalúan en cada access pero la cache interna evita re-validar.
export const clientEnv = new Proxy({} as z.infer<typeof clientEnvSchema>, {
  get: (_t, prop: string) => (readClient() as Record<string, unknown>)[prop],
});

// Test helper — limpia la cache entre tests si es necesario.
export function __resetEnv(): void {
  _client = undefined;
}

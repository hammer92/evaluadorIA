import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
});

const serverEnvSchema = clientEnvSchema.extend({
  REPOSITORY_DRIVER: z.enum(['memory', 'firebase']).default('firebase'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional(),
});

// =============================================================================
// Lazy validation — la validación se ejecuta en el primer access, no en module
// load. Esto permite que vitest (y otros consumidores) inyecten env vars en el
// setup file antes de que el módulo se use. Mantiene la UX de "fail fast" para
// producción porque el primer access de `clientEnv`/`env` siempre ocurre al
// inicio del request lifecycle.
// =============================================================================

let _client: z.infer<typeof clientEnvSchema> | undefined;
let _server: z.infer<typeof serverEnvSchema> | undefined;

function readClient(): z.infer<typeof clientEnvSchema> {
  if (_client) return _client;
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
    NEXT_PUBLIC_API_BASE_URL: process.env['NEXT_PUBLIC_API_BASE_URL'],
  });
  if (!parsed.success) {
    throw new Error(
      'Invalid client env: ' + JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
  }
  _client = parsed.data;
  return _client;
}

function readServer(): z.infer<typeof serverEnvSchema> {
  if (_server) return _server;
  _server = serverEnvSchema.parse({ ...readClient(), ...process.env });
  return _server;
}

// Getters — se evalúan en cada access pero la cache interna evita re-validar.
export const clientEnv = new Proxy({} as z.infer<typeof clientEnvSchema>, {
  get: (_t, prop: string) => (readClient() as Record<string, unknown>)[prop],
});

export const env = new Proxy({} as z.infer<typeof serverEnvSchema>, {
  get: (_t, prop: string) => {
    const source = typeof window === 'undefined' ? readServer() : readClient();
    return (source as Record<string, unknown>)[prop];
  },
});

// Test helper — limpia la cache entre tests si es necesario.
export function __resetEnv(): void {
  _client = undefined;
  _server = undefined;
}

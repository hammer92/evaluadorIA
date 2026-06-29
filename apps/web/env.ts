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
  // HS256 secret para firmar/verificar la cookie de sesión __session.
  // Generar con: openssl rand -base64 48. Mismo valor en middleware y
  // Cloud Function createSession. NUNCA exponer al cliente (sin NEXT_PUBLIC_).
  SESSION_COOKIE_SECRET: z
    .string()
    .min(32, 'SESSION_COOKIE_SECRET debe tener al menos 32 caracteres (HS256)'),
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

// Dev defaults — placeholders seguros para correr contra emuladores locales
// sin necesidad de crear .env.local. En staging/prod, los env vars DEBEN
// estar seteados explícitamente (la validación lazy con safeParse fallaría).
const DEV_FIREBASE_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key-for-emulator',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'admin-platform-dev.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'admin-platform-dev',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'admin-platform-dev.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
};

function applyDevDefaults(): void {
  // Aplica defaults si no estamos en staging/prod explícito. En esos envs,
  // los valores DEBEN estar seteados via .env / Secret Manager.
  const env = process.env['NEXT_PUBLIC_APP_ENV'];
  if (env === 'staging' || env === 'prod') return;
  for (const [key, value] of Object.entries(DEV_FIREBASE_DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readClient(): z.infer<typeof clientEnvSchema> {
  if (_client) return _client;
  applyDevDefaults();
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
  // En dev, si SESSION_COOKIE_SECRET no está seteado, generamos uno por
  // sesión. Esto permite `pnpm dev` sin tocar .env. En prod/staging,
  // Zod falla con error explícito.
  if (!process.env['SESSION_COOKIE_SECRET'] && process.env['NEXT_PUBLIC_APP_ENV'] === 'dev') {
    process.env['SESSION_COOKIE_SECRET'] = 'dev-secret-please-change-in-production-32+chars';
  }
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

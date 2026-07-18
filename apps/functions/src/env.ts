import { z } from 'zod';

// =============================================================================
// env — Validación centralizada de variables de entorno para Cloud Functions.
// =============================================================================
// Mismo patrón que apps/web/env.ts:
// - Schema Zod declarativo (fail-fast en runtime si falta config)
// - Lazy validation (cache interna, re-validación solo en tests via __resetEnv)
// - Proxy getter (env.X se evalúa en cada access)
// - __resetEnv() para limpiar cache entre tests
//
// Las env vars se inyectan en runtime via:
//   firebase deploy --set-env-vars "KEY1=val1,KEY2=val2,..."
// (definido en .github/workflows/main_deploy.yml)
//
// En dev, los emuladores las cargan desde .env / .secret.local (scripts/emulators.sh).
// =============================================================================

const envSchema = z.object({
  // HS256 secret para firmar/verificar la cookie de sesion __session.
  // Mismo valor en middleware Next.js (apps/web) y en CFs (apps/functions).
  // Generar con: openssl rand -base64 48 (>= 32 chars).
  SESSION_COOKIE_SECRET: z
    .string()
    .min(32, 'SESSION_COOKIE_SECRET debe tener al menos 32 caracteres (HS256)'),

  // CSV de origenes permitidos para CORS en CFs onRequest.
  // Ej: "https://agente-entrevistador-ia.web.app,https://agente-entrevistador-ia.firebaseapp.com"
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS requerido (CSV de origenes CORS)'),

  // Driver del repositorio de users/orgs/audit-logs.
  // En prod siempre 'firebase'; 'memory' solo para emuladores/tests.
  REPOSITORY_DRIVER: z.enum(['memory', 'firebase']).default('firebase'),

  // Project ID de Firebase Admin SDK. Requerido en prod; opcional en emuladores
  // (ahi lo resuelve firebase-admin via GCLOUD_PROJECT).
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1).optional(),

  // OpenAI API key (opcional — solo si alguna CF la consume).
  OPENAI_API_KEY: z.string().optional(),

  // NODE_ENV lo setea firebase-functions automaticamente en prod; en emuladores
  // suele ser 'development'. Usado para agregar `Secure` al Set-Cookie.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export type Env = z.infer<typeof envSchema>;

let _cached: Env | undefined;

function read(): Env {
  if (_cached) return _cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      'Invalid functions env: ' + JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
  }
  _cached = parsed.data;
  return _cached;
}

// Proxy getter — se evalúa en cada access pero la cache interna evita re-validar.
export const env = new Proxy({} as Env, {
  get: (_t, prop: string) => (read() as Record<string, unknown>)[prop],
});

// Test helper — limpia la cache entre tests si es necesario.
export function __resetEnv(): void {
  _cached = undefined;
}

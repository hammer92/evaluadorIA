import * as functions from 'firebase-functions';
import { z } from 'zod';

// =============================================================================
// env — Validación centralizada de variables de entorno para Cloud Functions.
// =============================================================================
// Misma API publica que apps/web/env.ts:
// - Schema Zod declarativo (fail-fast en runtime si falta config)
// - Lazy validation (cache interna, re-validación solo en tests via __resetEnv)
// - Proxy getter (env.X se evalúa en cada access)
//
// FUENTE DE DATOS: functions.config() (Firebase Runtime Config API legacy).
// v15.24.0 de firebase-tools removio `firebase deploy --set-env-vars` y el
// subprocess de discovery solo inyecta `firebaseEnvs` (FIREBASE_CONFIG +
// GCLOUD_PROJECT). La unica via oficial para inyectar env vars a las CFs en
// v15+ es `firebase functions:config:set` (gated por el experimento
// `legacyRuntimeConfigCommands`, deprecado antes de marzo 2027 — migrar a
// Firebase Functions Secrets antes de esa fecha).
//
// El workflow (`.github/workflows/main_deploy.yml`) setea CONFIG_VALUES que
// la accion `w9jds/firebase-action@master` traduce a
// `firebase functions:config:set $CONFIG_VALUES` antes del deploy, escribiendo
// a Firebase Runtime Config API. Las CFs leen los valores via
// `functions.config()`.
//
// API expuesta:
//   env.SESSION_COOKIE_SECRET      <- functions.config().session.cookie_secret
//   env.ALLOWED_ORIGINS            <- functions.config().allowed.origins
//   env.REPOSITORY_DRIVER          <- functions.config().repository.driver
//   env.FIREBASE_ADMIN_PROJECT_ID  <- functions.config().admin.project_id
//   env.OPENAI_API_KEY             <- functions.config().openai.api_key
//   env.NODE_ENV                   <- process.env.NODE_ENV (auto-set por CF runtime)
// =============================================================================

const envSchema = z.object({
  // HS256 secret para firmar/verificar la cookie de sesion __session.
  // Mismo valor en middleware Next.js (apps/web) y en CFs (apps/functions).
  SESSION_COOKIE_SECRET: z
    .string()
    .min(32, 'SESSION_COOKIE_SECRET debe tener al menos 32 caracteres (HS256)'),

  // CSV de origenes permitidos para CORS en CFs onRequest.
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS requerido (CSV de origenes CORS)'),

  // Driver del repositorio de users/orgs/audit-logs.
  // En prod siempre 'firebase'; 'memory' solo para emuladores/tests.
  REPOSITORY_DRIVER: z.enum(['memory', 'firebase']).default('firebase'),

  // Project ID de Firebase Admin SDK. Opcional (en runtime se resuelve via SA).
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1).optional(),

  // OpenAI API key (opcional — solo si alguna CF la consume).
  OPENAI_API_KEY: z.string().optional(),

  // NODE_ENV lo setea firebase-functions automaticamente en prod; en emuladores
  // suele ser 'development'. Usado para agregar `Secure` al Set-Cookie.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export type Env = z.infer<typeof envSchema>;

let _cached: Env | undefined;

function flatten(config: Record<string, unknown> | undefined): Record<string, string | undefined> {
  const section = (key: string): Record<string, unknown> =>
    (config?.[key] as Record<string, unknown> | undefined) ?? {};
  return {
    SESSION_COOKIE_SECRET: section('session')['cookie_secret'] as string | undefined,
    ALLOWED_ORIGINS: section('allowed')['origins'] as string | undefined,
    REPOSITORY_DRIVER: section('repository')['driver'] as string | undefined,
    FIREBASE_ADMIN_PROJECT_ID: section('admin')['project_id'] as string | undefined,
    OPENAI_API_KEY: section('openai')['api_key'] as string | undefined,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function read(): Env {
  if (_cached) return _cached;
  const parsed = envSchema.safeParse(flatten(functions.config() ?? undefined));
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

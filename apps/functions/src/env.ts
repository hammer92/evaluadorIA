import { defineSecret, defineString } from 'firebase-functions/params';

// =============================================================================
// env — Variables de entorno para Cloud Functions v2.
// =============================================================================
// Usa `defineSecret()` + `defineString()` (firebase-functions/params) que
// la Firebase Functions runtime inyecta automáticamente como env vars en
// el service config del CF. Los secrets se crean con:
//
//   firebase functions:secrets:set SESSION_COOKIE_SECRET
//   firebase functions:secrets:set OPENAI_API_KEY
//
// Y los strings (no-secret) con variables de entorno normales via
// `firebase functions:config:set` (legacy, gated por experimento) o via
// gcloud run services update. Para simplificar, todo va por Secret Manager
// (incluyendo los non-secret via `defineString` que se setean con
// `firebase functions:secrets:set` también — Firebase los trata igual).
//
// API expuesta (lazy read via .value()):
//   env.SESSION_COOKIE_SECRET  .value()   (string, secret)
//   env.ALLOWED_ORIGINS        .value()   (string CSV, string param)
//   env.REPOSITORY_DRIVER      .value()   ('memory' | 'firebase', default 'firebase')
//   env.FIREBASE_ADMIN_PROJECT_ID  .value() (string, secret)
//   env.OPENAI_API_KEY         .value()   (string, secret, optional)
//   env.NODE_ENV               (auto-set por CF runtime)
// =============================================================================

export const SESSION_COOKIE_SECRET: ReturnType<typeof defineSecret> =
  defineSecret('SESSION_COOKIE_SECRET');
export const ALLOWED_ORIGINS: ReturnType<typeof defineString> = defineString('ALLOWED_ORIGINS');
export const REPOSITORY_DRIVER: ReturnType<typeof defineString> = defineString('REPOSITORY_DRIVER');
export const FIREBASE_ADMIN_PROJECT_ID: ReturnType<typeof defineSecret> =
  defineSecret('ADMIN_PROJECT_ID');
export const OPENAI_API_KEY: ReturnType<typeof defineSecret> = defineSecret('OPENAI_API_KEY');

export interface Env {
  SESSION_COOKIE_SECRET: string;
  ALLOWED_ORIGINS: string;
  REPOSITORY_DRIVER: 'memory' | 'firebase';
  FIREBASE_ADMIN_PROJECT_ID: string | undefined;
  OPENAI_API_KEY: string | undefined;
  NODE_ENV: 'development' | 'production' | 'test';
}

function read(): Env {
  const driver = REPOSITORY_DRIVER.value();
  const nodeEnv = process.env['NODE_ENV'];
  return {
    SESSION_COOKIE_SECRET: SESSION_COOKIE_SECRET.value(),
    ALLOWED_ORIGINS: ALLOWED_ORIGINS.value(),
    REPOSITORY_DRIVER: driver === 'memory' ? 'memory' : 'firebase',
    FIREBASE_ADMIN_PROJECT_ID: FIREBASE_ADMIN_PROJECT_ID.value() || undefined,
    OPENAI_API_KEY: OPENAI_API_KEY.value() || undefined,
    NODE_ENV: nodeEnv === 'development' || nodeEnv === 'test' ? nodeEnv : 'production',
  };
}

export const env = new Proxy({} as Env, {
  get: (_t, prop: string) => (read() as unknown as Record<string, unknown>)[prop],
});

export function __resetEnv(): void {
  // params son reactivos (re-leen en cada call a .value()), no requieren cache reset
}

// Validador runtime — fail-fast en producción si falta secret crítico.
export function assertRuntimeEnv(): void {
  const e = read();
  if (!e.SESSION_COOKIE_SECRET || e.SESSION_COOKIE_SECRET.length < 32) {
    throw new Error(
      'SESSION_COOKIE_SECRET no configurado o < 32 chars (firebase functions:secrets:set SESSION_COOKIE_SECRET)',
    );
  }
  if (!e.ALLOWED_ORIGINS) {
    throw new Error(
      'ALLOWED_ORIGINS no configurado (firebase functions:secrets:set ALLOWED_ORIGINS)',
    );
  }
}

// =============================================================================
// env — Acceso centralizado a variables de entorno para Cloud Functions.
// =============================================================================
// Misma API publica que apps/web/env.ts:
// - Lazy read (cache interna, re-read solo en tests via __resetEnv)
// - Proxy getter (env.X se evalúa en cada access)
//
// FUENTE DE DATOS: process.env.
//
// En CFv2, `functions.config()` LANZA ERROR (la API ya no está disponible —
// ver firebase-functions@5/lib/v1/config.js: `if (process.env.K_CONFIGURATION)
// throw new Error(...)`). Por eso leemos directamente de process.env.
//
// Los env vars se setean en el Cloud Run service via
// `gcloud functions deploy --update-env-vars` en el workflow
// `.github/workflows/main_deploy.yml` (paso POST-DEPLOY).
//
// En deploy-time analysis (firebase-tools spawna las CFs para descubrir
// triggers) NO hay env vars reales en process.env — por eso el env.ts
// retorna defaults seguros sin fallar. La validación real ocurre en
// runtime cuando las CFs se invocan (assertRuntimeEnv()).
//
// API expuesta:
//   env.SESSION_COOKIE_SECRET  (string, default '')
//   env.ALLOWED_ORIGINS        (string CSV, default '*' para que el cors
//                               del onCall no rompa en deploy-time analysis;
//                               en runtime se setea via gcloud update-env-vars)
//   env.REPOSITORY_DRIVER      ('memory' | 'firebase', default 'firebase')
//   env.FIREBASE_ADMIN_PROJECT_ID  (string | undefined)
//   env.OPENAI_API_KEY         (string | undefined)
//   env.NODE_ENV               (default 'production')
// =============================================================================

export interface Env {
  SESSION_COOKIE_SECRET: string;
  ALLOWED_ORIGINS: string;
  REPOSITORY_DRIVER: 'memory' | 'firebase';
  FIREBASE_ADMIN_PROJECT_ID: string | undefined;
  OPENAI_API_KEY: string | undefined;
  NODE_ENV: 'development' | 'production' | 'test';
}

let _cached: Env | undefined;

function read(): Env {
  if (_cached) return _cached;
  const driver = process.env['REPOSITORY_DRIVER'];
  const nodeEnv = process.env['NODE_ENV'];
  _cached = {
    SESSION_COOKIE_SECRET: process.env['SESSION_COOKIE_SECRET'] ?? '',
    // Default '*' permite que las CFs carguen en deploy-time analysis sin
    // env vars. En runtime se sobreescribe via gcloud update-env-vars.
    ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS'] ?? '*',
    REPOSITORY_DRIVER: driver === 'memory' ? 'memory' : 'firebase',
    FIREBASE_ADMIN_PROJECT_ID: process.env['FIREBASE_ADMIN_PROJECT_ID'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
    NODE_ENV: nodeEnv === 'development' || nodeEnv === 'test' ? nodeEnv : 'production',
  };
  return _cached;
}

// Proxy getter — se evalúa en cada access pero la cache interna evita re-leer.
export const env = new Proxy({} as Env, {
  get: (_t, prop: string) => (read() as unknown as Record<string, unknown>)[prop],
});

// Test helper — limpia la cache entre tests si es necesario.
export function __resetEnv(): void {
  _cached = undefined;
}

// Validador runtime — para que las CFs fallen rápido en producción si
// les falta SESSION_COOKIE_SECRET. Llamar desde el handler de cada CF
// antes de operaciones que lo requieran.
export function assertRuntimeEnv(): void {
  const e = read();
  if (!e.SESSION_COOKIE_SECRET || e.SESSION_COOKIE_SECRET.length < 32) {
    throw new Error('SESSION_COOKIE_SECRET no configurado o < 32 chars');
  }
  if (!e.ALLOWED_ORIGINS || e.ALLOWED_ORIGINS === '*') {
    throw new Error('ALLOWED_ORIGINS no configurado (aún en default "*")');
  }
}

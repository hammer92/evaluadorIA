// =============================================================================
// Dev defaults para variables de entorno.
// =============================================================================
// Se importa eagerly desde el middleware (Edge runtime) y desde env.ts (Node)
// para garantizar que las variables críticas (especialmente SESSION_COOKIE_SECRET)
// estén disponibles ANTES de cualquier validación, sin requerir que el caller
// invoque un getter o setup function.
//
// Solo aplica defaults si la variable está undefined Y el entorno NO es
// staging/prod. En staging/prod, los valores DEBEN estar explícitamente
// configurados via .env / Secret Manager / variables de entorno del runtime.
// =============================================================================

const DEV_FIREBASE_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key-for-emulator',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'admin-platform-dev.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'admin-platform-dev',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'admin-platform-dev.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
};

const DEV_SESSION_SECRET = 'dev-secret-shared-by-cf-and-middleware-must-be-at-least-32-chars-long';

function isProductionLike(): boolean {
  const env = process.env['NEXT_PUBLIC_APP_ENV'];
  return env === 'staging' || env === 'prod';
}

export function applyDevEnvDefaults(): void {
  if (isProductionLike()) return;
  for (const [key, value] of Object.entries(DEV_FIREBASE_DEFAULTS)) {
    process.env[key] ??= value;
  }
  process.env['SESSION_COOKIE_SECRET'] ??= DEV_SESSION_SECRET;
}

applyDevEnvDefaults();

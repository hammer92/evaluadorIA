// =============================================================================
// deploy-config.ts — Valores de configuracion leidos al DEPLOY TIME.
// =============================================================================
// Los secrets (defineSecret) solo se pueden leer en RUNTIME, no en deploy time.
// El `cors` option de onCall requiere el valor en deploy time, por lo que
// las URLs permitidas NO pueden ser secrets — son valores publicos conocidos.
//
// Para los demas env vars (session secret, api keys, etc.) usa env.ts.
// =============================================================================

export const ALLOWED_ORIGINS_DEPLOY = [
  'https://agente-entrevistador-ia.web.app',
  'https://agente-entrevistador-ia.firebaseapp.com',
  'http://localhost:3000',
];

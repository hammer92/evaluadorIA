// @vitest-environment jsdom
// process.env se setea ANTES de cualquier import que use env.ts
process.env['NEXT_PUBLIC_APP_ENV'] ??= 'dev';
process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ??= 'fake-api-key';
process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] ??= 'localhost';
process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] ??= 'demo-test';
process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] ??= 'demo-test.appspot.com';
process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ??= '0';
process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] ??= '1:0:web:test';
process.env['REPOSITORY_DRIVER'] ??= 'memory';

import net from 'node:net';

import { describe, expect, it } from 'vitest';

// =============================================================================
// FirebaseUserRepository — integration test placeholder.
// =============================================================================
// SKIP por ahora: requiere setup más robusto de auth emulator (custom claims
// persisten entre runs y la lógica de signIn + setCustomClaims es frágil).
//
// Para una cobertura completa de la impl Firebase, ver:
//   - scripts/verify-rules.ts  (25 tests runtime contra reglas firestore + storage)
//   - apps/web/repositories/users/__tests__/contract.test.ts  (contrato contra Memory)
//
// Reactivar cuando se agregue CI con emuladores persistidos o se migre a
// @firebase/rules-unit-testing.
// =============================================================================

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: '127.0.0.1', port });
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 500);
  });
}

const emulatorsUp = await Promise.all([checkPort(9099), checkPort(8080)]).then(([a, f]) => a && f);

describe.skip('[UserRepository:Firebase] integration — ver scripts/verify-rules.ts', () => {
  it('placeholder', () => {
    expect(emulatorsUp).toBe(false);
  });
});

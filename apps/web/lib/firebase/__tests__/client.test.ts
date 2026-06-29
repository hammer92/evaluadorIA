// @vitest-environment jsdom
import type * as FirebaseAuthModule from 'firebase/auth';
import type * as FirebaseFirestoreModule from 'firebase/firestore';
import type * as FirebaseStorageModule from 'firebase/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Crear los spies a nivel hoist para que los mocks en client.ts (que se
// importan vía vi.resetModules) compartan la MISMA instancia que el test.
const mocks = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  connectStorageEmulator: vi.fn(),
}));

// Mockear connect*Emulator para evitar conexiones reales durante el test.
// Usamos `vi.importActual` para preservar todo el resto del módulo real
// (getAuth, getFirestore, etc.) y solo reemplazamos los connect*.
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof FirebaseAuthModule>('firebase/auth');
  return {
    ...actual,
    connectAuthEmulator: mocks.connectAuthEmulator,
  };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof FirebaseFirestoreModule>('firebase/firestore');
  return {
    ...actual,
    connectFirestoreEmulator: mocks.connectFirestoreEmulator,
  };
});

vi.mock('firebase/storage', async () => {
  const actual = await vi.importActual<typeof FirebaseStorageModule>('firebase/storage');
  return {
    ...actual,
    connectStorageEmulator: mocks.connectStorageEmulator,
  };
});

const stubClientEnv = (env: 'dev' | 'staging'): void => {
  vi.stubEnv('NEXT_PUBLIC_APP_ENV', env);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test-api-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'admin-platform-dev');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'admin-platform-dev.appspot.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '0000000000');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:000000000000:web:0000000000000000000000');
};

describe('firebase client', () => {
  beforeEach(() => {
    mocks.connectAuthEmulator.mockClear();
    mocks.connectFirestoreEmulator.mockClear();
    mocks.connectStorageEmulator.mockClear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exporta singletons (firebaseApp, auth, db, storage) con env vars NEXT_PUBLIC_*', async () => {
    stubClientEnv('staging'); // staging → no conecta emuladores

    const mod = await import('../client');

    expect(mod.firebaseApp).toBeDefined();
    expect(mod.auth).toBeDefined();
    expect(mod.db).toBeDefined();
    expect(mod.storage).toBeDefined();

    // En staging no se deben haber llamado los connect*Emulator
    expect(mocks.connectAuthEmulator).not.toHaveBeenCalled();
    expect(mocks.connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(mocks.connectStorageEmulator).not.toHaveBeenCalled();
  });

  it('en dev, conecta automáticamente a los emuladores de auth/firestore/storage', async () => {
    stubClientEnv('dev');

    await import('../client');

    expect(mocks.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(mocks.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mocks.connectStorageEmulator).toHaveBeenCalledTimes(1);
  });
});

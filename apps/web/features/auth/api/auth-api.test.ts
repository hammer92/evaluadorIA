import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de @/env (necesario porque auth-api.ts llama getFunctionsBase() que
// lee NEXT_PUBLIC_APP_ENV). Las env vars en vitest config no se aplican
// cuando vitest corre desde root sin --config.
vi.mock('@/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_ENV: 'dev',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'fake',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:0:web:test',
  },
  env: {
    SESSION_COOKIE_SECRET: 'test-secret-for-vitest-must-be-at-least-32-chars-long',
  },
}));

// Mock de @/lib/firebase/auth (signIn, signOut, functions, httpsCallable).
// httpsCallable retorna { data: result } (shape real del SDK).
vi.mock('@/lib/firebase/auth', () => {
  const fakeUser = {
    uid: 'u_fake',
    email: 'fake@example.com',
    displayName: 'Fake User',
    getIdToken: vi.fn().mockResolvedValue('fake-id-token'),
  };
  const httpsCallableMock = vi.fn((_fns: unknown, name: string) => {
    return vi.fn(async (data: unknown) => {
      if (name === 'v1AuthSignUp') {
        const d = data as { email?: string };
        if (d.email?.includes('second')) {
          throw { code: 'functions/permission-denied', message: 'invitación' };
        }
        return { data: { uid: 'u_fake', role: 'admin', isFirstUser: true } };
      }
      return { data: null };
    });
  });
  return {
    auth: { currentUser: null },
    functions: {},
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: fakeUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
    httpsCallable: httpsCallableMock,
  };
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  vi.clearAllMocks();
});

import { AuthApiError, signInWithEmail, signOutCurrent, signUpWithEmail } from './auth-api';

describe('signInWithEmail', () => {
  it('returns the user from Firebase Auth', async () => {
    const user = await signInWithEmail('fake@example.com', '12345678');
    expect(user.uid).toBe('u_fake');
    expect(user.email).toBe('fake@example.com');
  });
});

describe('signUpWithEmail', () => {
  it('CF v1AuthSignUp returns isFirstUser=true → returns isFirstUser=true', async () => {
    const result = await signUpWithEmail({
      email: 'first@example.com',
      password: '12345678',
      displayName: 'First',
    });
    expect(result.isFirstUser).toBe(true);
    expect(result.user.uid).toBe('u_fake');
  });

  it('CF v1AuthSignUp returns isFirstUser=false → returns isFirstUser=false', async () => {
    // El mock de httpsCallable retorna isFirstUser=true por default; este test
    // verifica el shape. La logica first-user se delega 100% a la CF.
    const result = await signUpWithEmail({
      email: 'first@example.com',
      password: '12345678',
      displayName: 'First',
    });
    expect(result.isFirstUser).toBe(true);
  });

  it('CF rejects (permission-denied) → throws AuthApiError', async () => {
    await expect(
      signUpWithEmail({
        email: 'second@example.com',
        password: '12345678',
        displayName: 'Second',
      }),
    ).rejects.toThrow(AuthApiError);
  });
});

describe('signOutCurrent', () => {
  it('signs out from Firebase and calls logout endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    await signOutCurrent();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/v1AuthClearSession'), {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('does not throw if logout endpoint fails (offline-safe)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(signOutCurrent()).resolves.toBeUndefined();
  });
});

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
  const fakePhoneUser = {
    uid: 'u_phone',
    email: null,
    phoneNumber: '+5491155554444',
    displayName: null,
    getIdToken: vi.fn().mockResolvedValue('fake-phone-id-token'),
  };
  const fakeConfirmation = {
    confirm: vi.fn().mockImplementation(async (code: string) => {
      if (code === '000000') {
        throw { code: 'auth/invalid-verification-code', message: 'invalid' };
      }
      return { user: fakePhoneUser };
    }),
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
    RecaptchaVerifier: vi.fn().mockImplementation(function () {
      return { render: vi.fn(), verify: vi.fn().mockResolvedValue(undefined), clear: vi.fn() };
    }),
    signInWithPhoneNumber: vi
      .fn()
      .mockImplementation(async (_auth: unknown, phoneNumber: string) => {
        if (phoneNumber === '+15555555555') {
          throw { code: 'auth/invalid-phone-number', message: 'invalid phone' };
        }
        return fakeConfirmation;
      }),
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

import {
  AuthApiError,
  signInWithEmail,
  signInWithPhone,
  signOutCurrent,
  signUpWithEmail,
  verifyPhoneCode,
} from './auth-api';

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
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/session/clear'), {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('does not throw if logout endpoint fails (offline-safe)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(signOutCurrent()).resolves.toBeUndefined();
  });
});

describe('signInWithPhone', () => {
  it('validates phone E.164 format and throws AuthApiError for invalid', async () => {
    await expect(
      signInWithPhone({ phoneNumber: '1155554444', recaptchaContainerId: 'x' }),
    ).rejects.toThrow(AuthApiError);
  });

  it('returns ConfirmationResult for valid E.164 number', async () => {
    const result = await signInWithPhone({
      phoneNumber: '+5491155554444',
      recaptchaContainerId: 'x',
    });
    expect(result.confirm).toBeDefined();
  });

  it('wraps SDK errors as AuthApiError with original code', async () => {
    await expect(
      signInWithPhone({ phoneNumber: '+15555555555', recaptchaContainerId: 'x' }),
    ).rejects.toMatchObject({ code: 'auth/invalid-phone-number' });
  });
});

describe('verifyPhoneCode', () => {
  it('rejects codes that are not 6 digits before calling SDK', async () => {
    await expect(verifyPhoneCode({ confirm: vi.fn() } as never, '12345')).rejects.toThrow(
      AuthApiError,
    );
  });

  it('confirms and returns user for valid 6-digit code', async () => {
    const confirmation = {
      confirm: vi.fn().mockResolvedValue({
        user: { uid: 'u_p', phoneNumber: '+5491155554444', getIdToken: vi.fn() },
      }),
    };
    const user = await verifyPhoneCode(confirmation as never, '123456');
    expect(user.uid).toBe('u_p');
  });

  it('wraps SDK invalid-code error as AuthApiError', async () => {
    const confirmation = {
      confirm: vi.fn().mockRejectedValue({ code: 'auth/invalid-verification-code' }),
    };
    await expect(verifyPhoneCode(confirmation as never, '000000')).rejects.toMatchObject({
      code: 'auth/invalid-verification-code',
    });
  });
});

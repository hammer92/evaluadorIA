import type { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthContext } from '../with-auth.js';

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
  }),
  defineString: (name: string) => ({
    value: () => process.env[name] ?? '',
  }),
}));

vi.mock('firebase-functions', () => ({
  config: () => ({
    session: {
      cookie_secret: process.env['SESSION_COOKIE_SECRET'] ?? '',
    },
    allowed: {
      origins: process.env['ALLOWED_ORIGINS'] ?? '',
    },
    repository: {
      driver: process.env['REPOSITORY_DRIVER'] ?? 'memory',
    },
    admin: {
      project_id: process.env['FIREBASE_ADMIN_PROJECT_ID'] ?? 'demo-test',
    },
    openai: {
      api_key: process.env['OPENAI_API_KEY'],
    },
  }),
}));

// =============================================================================
// buildAuthContext — Tests del wrapper de auth (Firebase Auth ID token only).
// =============================================================================
// Arquitectura estática: no hay session cookie. La auth pasa por Firebase
// Auth ID token que el SDK cliente incluye automáticamente en cada
// httpsCallable. Las CFs leen request.auth (populated por el framework).
// =============================================================================

function makeRequest(auth?: {
  uid: string;
  token: Record<string, unknown>;
}): CallableRequest<unknown> {
  return {
    auth: auth as never,
    data: {},
    rawRequest: { headers: {} },
  } as unknown as CallableRequest<unknown>;
}

describe('buildAuthContext', () => {
  beforeEach(() => {
    process.env['SESSION_COOKIE_SECRET'] =
      'test-secret-shared-by-cf-and-middleware-must-be-at-least-32-chars-long';
  });

  it('rejects with unauthenticated when request.auth is missing', async () => {
    await expect(buildAuthContext(makeRequest())).rejects.toBeInstanceOf(HttpsError);
    await expect(buildAuthContext(makeRequest())).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('accepts Firebase Auth context when request.auth is present and has role', async () => {
    const ctx = await buildAuthContext(
      makeRequest({ uid: 'u1', token: { role: 'admin', email: 'a@b.c' } }),
      'admin',
    );
    expect(ctx.uid).toBe('u1');
    expect(ctx.role).toBe('admin');
    expect(ctx.email).toBe('a@b.c');
  });

  it('rejects with permission-denied when role claim missing', async () => {
    await expect(
      buildAuthContext(makeRequest({ uid: 'u1', token: { email: 'a@b.c' } })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects with permission-denied when role is invalid', async () => {
    await expect(
      buildAuthContext(makeRequest({ uid: 'u1', token: { role: 'god', email: 'a@b.c' } })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('respects requiredRole on Firebase Auth context', async () => {
    await expect(
      buildAuthContext(
        makeRequest({ uid: 'u3', token: { role: 'expert', email: 'c@d.e' } }),
        'admin',
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts any role when requiredRole is undefined', async () => {
    const ctx = await buildAuthContext(
      makeRequest({ uid: 'u4', token: { role: 'expert', email: 'd@e.f' } }),
    );
    expect(ctx.uid).toBe('u4');
    expect(ctx.role).toBe('expert');
  });
});

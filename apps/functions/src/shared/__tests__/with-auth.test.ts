import { createHmac } from 'node:crypto';

import type { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { verifySessionCookieFromRequest } from '../verify-session-cookie.js';
import { buildAuthContext } from '../with-auth.js';

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
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

const ISSUER = 'admin-platform';
const ALG = 'HS256';
const SECRET =
  process.env['SESSION_COOKIE_SECRET'] ??
  'test-secret-shared-by-cf-and-middleware-must-be-at-least-32-chars-long';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function signSession(payload: Record<string, unknown>, secret = SECRET): string {
  const header = b64url(JSON.stringify({ alg: ALG, typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      uid: payload['uid'],
      email: payload['email'],
      role: payload['role'],
      organizationId: payload['organizationId'] ?? null,
      iss: ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function makeRequest(opts: {
  auth?: { uid: string; token: Record<string, unknown> };
  cookie?: string;
}): CallableRequest<unknown> {
  return {
    auth: opts.auth as never,
    data: {},
    rawRequest: {
      headers: {
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
    },
  } as unknown as CallableRequest<unknown>;
}

describe('buildAuthContext', () => {
  beforeEach(() => {
    process.env['SESSION_COOKIE_SECRET'] = SECRET;
  });

  it('rejects with unauthenticated when no auth and no cookie', async () => {
    await expect(buildAuthContext(makeRequest({}))).rejects.toBeInstanceOf(HttpsError);
    await expect(buildAuthContext(makeRequest({}))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('accepts Firebase Auth context when request.auth is present and has role', async () => {
    const ctx = await buildAuthContext(
      makeRequest({ auth: { uid: 'u1', token: { role: 'admin', email: 'a@b.c' } } }),
      'admin',
    );
    expect(ctx.uid).toBe('u1');
    expect(ctx.role).toBe('admin');
    expect(ctx.email).toBe('a@b.c');
  });

  it('rejects with permission-denied when role claim missing', async () => {
    await expect(
      buildAuthContext(makeRequest({ auth: { uid: 'u1', token: { email: 'a@b.c' } } })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('falls back to session cookie when request.auth is null', async () => {
    const cookie = signSession({
      uid: 'u2',
      email: 'b@c.d',
      role: 'admin',
      organizationId: 'org1',
    });
    const ctx = await buildAuthContext(makeRequest({ cookie: `__session=${cookie}` }), 'admin');
    expect(ctx.uid).toBe('u2');
    expect(ctx.email).toBe('b@c.d');
    expect(ctx.role).toBe('admin');
    expect(ctx.organizationId).toBe('org1');
  });

  it('respects requiredRole on cookie fallback', async () => {
    const cookie = signSession({
      uid: 'u3',
      email: 'c@d.e',
      role: 'expert',
      organizationId: null,
    });
    await expect(
      buildAuthContext(makeRequest({ cookie: `__session=${cookie}` }), 'admin'),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts cookie fallback for any role when requiredRole undefined', async () => {
    const cookie = signSession({
      uid: 'u4',
      email: 'd@e.f',
      role: 'expert',
      organizationId: null,
    });
    const ctx = await buildAuthContext(makeRequest({ cookie: `__session=${cookie}` }));
    expect(ctx.uid).toBe('u4');
  });
});

describe('verifySessionCookieFromRequest', () => {
  beforeEach(() => {
    process.env['SESSION_COOKIE_SECRET'] = SECRET;
  });

  it('returns null when no cookie header', async () => {
    const result = await verifySessionCookieFromRequest(undefined);
    expect(result).toBeNull();
  });

  it('returns null when __session cookie not present', async () => {
    const result = await verifySessionCookieFromRequest('foo=bar; baz=qux');
    expect(result).toBeNull();
  });

  it('returns null when cookie signature is invalid', async () => {
    const result = await verifySessionCookieFromRequest('__session=invalid.jwt.token');
    expect(result).toBeNull();
  });

  it('returns null when SESSION_COOKIE_SECRET is missing/short', async () => {
    // Con Zod validation en env.ts, un secret corto FALLA al module-load
    // (no al runtime del CF). Aqui validamos que env.ts rechaza el secret
    // antes de que verifySessionCookieFromRequest pueda ejecutarse.
    process.env['SESSION_COOKIE_SECRET'] = 'short';
    const { __resetEnv } = await import('../../env.js');
    __resetEnv();
    const { env: envMod } = await import('../../env.js');
    expect(() => envMod.SESSION_COOKIE_SECRET).toThrow(/32 caracteres/);
  });

  it('returns payload for valid cookie', async () => {
    const cookie = signSession({
      uid: 'u',
      email: 'a@b.c',
      role: 'admin',
      organizationId: 'org1',
    });
    const result = await verifySessionCookieFromRequest(`__session=${cookie}`);
    expect(result).toEqual({
      uid: 'u',
      email: 'a@b.c',
      role: 'admin',
      organizationId: 'org1',
    });
  });

  it('rejects payload with invalid role', async () => {
    const cookie = signSession({
      uid: 'u',
      email: 'a@b.c',
      role: 'hacker',
      organizationId: null,
    });
    const result = await verifySessionCookieFromRequest(`__session=${cookie}`);
    expect(result).toBeNull();
  });

  it('reads cookie from among multiple cookies', async () => {
    const cookie = signSession({
      uid: 'u',
      email: 'a@b.c',
      role: 'admin',
      organizationId: null,
    });
    const result = await verifySessionCookieFromRequest(
      `other=foo; __session=${cookie}; extra=bar`,
    );
    expect(result?.uid).toBe('u');
  });
});

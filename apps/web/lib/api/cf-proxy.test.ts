// @vitest-environment node
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_ENV: 'dev', NEXT_PUBLIC_API_BASE_URL: '' },
}));

const { cookiesMock, fetchMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

const TEST_SECRET = 'test-secret-for-cf-proxy-must-be-at-least-32-chars-long';
const ORIGINAL_SECRET = process.env['SESSION_COOKIE_SECRET'];

function makeCookieStore(value: string | undefined) {
  return {
    get: (name: string) => (name === '__session' && value ? { value } : undefined),
  };
}

async function signCookie(payload: Record<string, unknown>): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('admin-platform')
    .setExpirationTime('5d')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

const validPayload = {
  uid: 'u_1',
  email: 'u@example.com',
  role: 'admin',
  organizationId: 'org_1',
};

beforeEach(() => {
  process.env['SESSION_COOKIE_SECRET'] = TEST_SECRET;
  cookiesMock.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env['SESSION_COOKIE_SECRET'];
  } else {
    process.env['SESSION_COOKIE_SECRET'] = ORIGINAL_SECRET;
  }
  vi.clearAllMocks();
});

import { callCallable, readSessionCookie, requireOrigin, type ProxyAuthContext } from './cf-proxy';

describe('readSessionCookie', () => {
  it('retorna null si no hay cookie __session', async () => {
    cookiesMock.mockReturnValue(makeCookieStore(undefined));
    const result = await readSessionCookie();
    expect(result).toBeNull();
  });

  it('retorna null si SESSION_COOKIE_SECRET falta', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('something'));
    delete process.env['SESSION_COOKIE_SECRET'];
    const result = await readSessionCookie();
    expect(result).toBeNull();
  });

  it('retorna null si SESSION_COOKIE_SECRET < 32 chars', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('something'));
    process.env['SESSION_COOKIE_SECRET'] = 'short';
    const result = await readSessionCookie();
    expect(result).toBeNull();
  });

  it('retorna null si el JWT es inválido', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('not.a.valid.jwt'));
    const result = await readSessionCookie();
    expect(result).toBeNull();
  });

  it('retorna el contexto cuando el JWT es válido', async () => {
    const jwt = await signCookie(validPayload);
    cookiesMock.mockReturnValue(makeCookieStore(jwt));
    const ctx = await readSessionCookie();
    expect(ctx).toEqual({
      uid: 'u_1',
      email: 'u@example.com',
      role: 'admin',
      organizationId: 'org_1',
      cookie: jwt,
    });
  });

  it('preserva organizationId=null cuando el JWT lo trae null', async () => {
    const jwt = await signCookie({ ...validPayload, organizationId: null });
    cookiesMock.mockReturnValue(makeCookieStore(jwt));
    const ctx = await readSessionCookie();
    expect(ctx?.organizationId).toBeNull();
  });

  it('retorna null si el role no es válido (no es admin/recruiter/expert)', async () => {
    const jwt = await signCookie({ ...validPayload, role: 'hacker' });
    cookiesMock.mockReturnValue(makeCookieStore(jwt));
    const ctx = await readSessionCookie();
    expect(ctx).toBeNull();
  });

  it('retorna null si el role está ausente del payload', async () => {
    const jwt = await signCookie({ uid: 'u_1', email: 'a@b.com' });
    cookiesMock.mockReturnValue(makeCookieStore(jwt));
    const ctx = await readSessionCookie();
    expect(ctx).toBeNull();
  });

  it('retorna null si uid o email no son strings', async () => {
    const jwt = await signCookie({ uid: 123, email: 'a@b.com', role: 'admin' });
    cookiesMock.mockReturnValue(makeCookieStore(jwt));
    const ctx = await readSessionCookie();
    expect(ctx).toBeNull();
  });
});

describe('callCallable', () => {
  const ctx: ProxyAuthContext = {
    uid: 'u_1',
    email: 'u@example.com',
    role: 'admin',
    organizationId: 'org_1',
    cookie: 'signed.jwt.value',
  };

  it('retorna 503 si NEXT_PUBLIC_API_BASE_URL no está configurado y APP_ENV != dev', async () => {
    vi.resetModules();
    vi.doMock('@/env', () => ({
      clientEnv: { NEXT_PUBLIC_APP_ENV: 'prod', NEXT_PUBLIC_API_BASE_URL: '' },
    }));
    const { callCallable: cc } = await import('./cf-proxy');
    const result = await cc('v1Foo', { x: 1 }, ctx);
    expect(result).toEqual({ ok: false, status: 503, error: 'functions-base-unconfigured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hace POST a base/name con Cookie header y body JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { ok: true } }),
    });
    const result = await callCallable('v1UsersList', { page: 1 }, ctx);
    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5001/admin-platform-dev/us-central1/v1UsersList',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: '__session=signed.jwt.value',
        },
        body: JSON.stringify({ data: { page: 1 } }),
      },
    );
  });

  it('usa NEXT_PUBLIC_API_BASE_URL si está configurado (y no agrega slash doble)', async () => {
    vi.resetModules();
    vi.doMock('@/env', () => ({
      clientEnv: {
        NEXT_PUBLIC_APP_ENV: 'prod',
        NEXT_PUBLIC_API_BASE_URL: 'https://example.com/cf/',
      },
    }));
    const { callCallable: cc } = await import('./cf-proxy');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { ok: true } }),
    });
    await cc('v1X', { y: 2 }, ctx);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/cf/v1X',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('retorna ok:false con status y error del body cuando la CF falla', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'permission-denied' } }),
    });
    const result = await callCallable('v1Forbidden', {}, ctx);
    expect(result).toEqual({ ok: false, status: 403, error: 'permission-denied' });
  });

  it('usa mensaje de fallback cuando la CF falla sin body JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not-json');
      },
    });
    const result = await callCallable('v1Boom', {}, ctx);
    expect(result).toEqual({ ok: false, status: 500, error: 'v1Boom failed (500)' });
  });

  it('envuelve data en { data } en el body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });
    await callCallable('v1X', { a: 'b' }, ctx);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ data: { a: 'b' } }) }),
    );
  });
});

describe('requireOrigin', () => {
  it('lee del header origin si está presente', () => {
    const req = new Request('https://localhost/api/x', {
      headers: { origin: 'https://app.example.com' },
    });
    expect(requireOrigin(req)).toBe('https://app.example.com');
  });

  it('cae a referer si origin falta', () => {
    const req = new Request('https://localhost/api/x', {
      headers: { referer: 'https://app.example.com/foo' },
    });
    expect(requireOrigin(req)).toBe('https://app.example.com/foo');
  });

  it('prefiere origin sobre referer cuando ambos están', () => {
    const req = new Request('https://localhost/api/x', {
      headers: {
        origin: 'https://origin.example.com',
        referer: 'https://referer.example.com',
      },
    });
    expect(requireOrigin(req)).toBe('https://origin.example.com');
  });

  it('retorna string vacío si no hay ni origin ni referer', () => {
    const req = new Request('https://localhost/api/x');
    expect(requireOrigin(req)).toBe('');
  });
});

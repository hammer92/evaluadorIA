// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { cookiesMock, verifySessionCookieMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  verifySessionCookieMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/features/auth/server/session', () => ({
  verifySessionCookie: verifySessionCookieMock,
}));

import { requireAuth, requireRole, verifyAuth } from './auth-service';

import type { ServerAuth } from '@/features/auth/types';

function makeCookieStore(value: string | undefined) {
  return {
    get: (name: string) => (name === '__session' && value ? { value } : undefined),
  };
}

const validPayload: ServerAuth = {
  uid: 'u_1',
  email: 'u@example.com',
  role: 'admin',
  organizationId: 'org_1',
};

beforeEach(() => {
  cookiesMock.mockReset();
  verifySessionCookieMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('verifyAuth', () => {
  it('retorna null si no hay cookie __session', async () => {
    cookiesMock.mockReturnValue(makeCookieStore(undefined));
    const result = await verifyAuth();
    expect(result).toBeNull();
    expect(verifySessionCookieMock).not.toHaveBeenCalled();
  });

  it('retorna null si verifySessionCookie retorna null', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('some-cookie'));
    verifySessionCookieMock.mockResolvedValue(null);
    const result = await verifyAuth();
    expect(result).toBeNull();
    expect(verifySessionCookieMock).toHaveBeenCalledWith('some-cookie');
  });

  it('retorna ServerAuth cuando el payload es válido', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue(validPayload);
    const result = await verifyAuth();
    expect(result).toEqual(validPayload);
  });

  it('preserva organizationId=null en el ServerAuth', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue({ ...validPayload, organizationId: null });
    const result = await verifyAuth();
    expect(result?.organizationId).toBeNull();
  });
});

describe('requireAuth', () => {
  it('retorna el ServerAuth si verifyAuth lo retorna', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue(validPayload);
    const auth = await requireAuth();
    expect(auth).toEqual(validPayload);
  });

  it('lanza Error("UNAUTHORIZED") si verifyAuth retorna null', async () => {
    cookiesMock.mockReturnValue(makeCookieStore(undefined));
    await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('requireRole', () => {
  it('acepta un role string que coincide', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue(validPayload);
    const auth = await requireRole('admin');
    expect(auth).toEqual(validPayload);
  });

  it('acepta un array de roles cuando el role del usuario está incluido', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue({ ...validPayload, role: 'recruiter' });
    const auth = await requireRole(['admin', 'recruiter']);
    expect(auth.role).toBe('recruiter');
  });

  it('lanza Error("FORBIDDEN") si el role no coincide', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue({ ...validPayload, role: 'expert' });
    await expect(requireRole('admin')).rejects.toThrow('FORBIDDEN');
  });

  it('lanza Error("FORBIDDEN") si el role no está en el array', async () => {
    cookiesMock.mockReturnValue(makeCookieStore('valid.jwt'));
    verifySessionCookieMock.mockResolvedValue({ ...validPayload, role: 'expert' });
    await expect(requireRole(['admin', 'recruiter'])).rejects.toThrow('FORBIDDEN');
  });

  it('lanza Error("UNAUTHORIZED") si no hay sesión (precedencia)', async () => {
    cookiesMock.mockReturnValue(makeCookieStore(undefined));
    await expect(requireRole('admin')).rejects.toThrow('UNAUTHORIZED');
  });
});

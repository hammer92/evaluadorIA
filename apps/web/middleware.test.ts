// @vitest-environment node
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env-dev-defaults', () => ({}));

const TEST_SECRET = 'test-secret-for-middleware-must-be-at-least-32-chars-long';
const ORIGINAL_SECRET = process.env['SESSION_COOKIE_SECRET'];

function buildReq(pathname: string, cookieValue?: string): NextRequest {
  const url = `https://localhost:3000${pathname}`;
  const headers = new Headers();
  if (cookieValue) headers.set('cookie', `__session=${cookieValue}`);
  return new NextRequest(url, { headers });
}

async function signValidJwt(payload: Record<string, unknown> = {}): Promise<string> {
  const secret = new TextEncoder().encode(TEST_SECRET);
  return await new SignJWT({
    uid: 'u_1',
    email: 'u@example.com',
    role: 'admin',
    organizationId: 'org_1',
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('admin-platform')
    .setExpirationTime('5d')
    .sign(secret);
}

beforeEach(() => {
  process.env['SESSION_COOKIE_SECRET'] = TEST_SECRET;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env['SESSION_COOKIE_SECRET'];
  } else {
    process.env['SESSION_COOKIE_SECRET'] = ORIGINAL_SECRET;
  }
});

async function importMiddleware() {
  const mod = await import('./middleware');
  return mod.middleware;
}

describe('middleware — public routes', () => {
  it('deja pasar / sin redirección', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/'));
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.headers.get('location')).toBeNull();
  });

  it('deja pasar /login', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/login'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('deja pasar /signup', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/signup'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('deja pasar /api/health (prefijo público)', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/api/health'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('deja pasar rutas que NO son /admin/**', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/foo'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — /admin/**', () => {
  it('redirige a /login?error=server-misconfigured si SESSION_COOKIE_SECRET falta', async () => {
    delete process.env['SESSION_COOKIE_SECRET'];
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/dashboard'));
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('error=server-misconfigured');
  });

  it('redirige a /login?error=server-misconfigured si el secret es < 32 chars', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'short';
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/dashboard'));
    const location = res.headers.get('location');
    expect(location).toContain('error=server-misconfigured');
  });

  it('redirige a /login?next=... si no hay cookie __session', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/dashboard'));
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fadmin%2Fdashboard');
  });

  it('redirige a /login?next=... si el JWT es inválido', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/users', 'not.a.valid.jwt'));
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fadmin%2Fusers');
  });

  it('redirige a /login?error=no-claims si el payload no tiene role', async () => {
    const jwt = await signValidJwt({ role: undefined, uid: 'u_1', email: 'a@b.com' });
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/dashboard', jwt));
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('error=no-claims');
  });

  it('deja pasar /admin/** si el JWT es válido y tiene role string', async () => {
    const jwt = await signValidJwt();
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/dashboard', jwt));
    expect(res.headers.get('location')).toBeNull();
  });

  it('preserva el pathname original en next (encoded)', async () => {
    const middleware = await importMiddleware();
    const res = await middleware(buildReq('/admin/users/list'));
    expect(res.headers.get('location')).toContain('next=%2Fadmin%2Fusers%2Flist');
  });
});

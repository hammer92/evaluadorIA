import { SignJWT } from 'jose';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de 'server-only' (módulo de Next.js que no existe en vitest).
vi.mock('server-only', () => ({}));

// Mock de @/env (la validación lazy falla si las env vars no están seteadas
// cuando vitest corre desde root sin --config).
vi.mock('@/env', () => ({
  env: { SESSION_COOKIE_SECRET: 'test-secret-for-vitest-must-be-at-least-32-chars-long' },
  clientEnv: { NEXT_PUBLIC_APP_ENV: 'dev' },
}));

import { signSessionWithSecret, verifySessionCookieWithSecret } from './jose-utils';
import { signSession, verifySessionCookie } from './session';

const TEST_SECRET = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
const ORIGINAL_SECRET = process.env['SESSION_COOKIE_SECRET'];

beforeEach(() => {
  process.env['SESSION_COOKIE_SECRET'] = TEST_SECRET;
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env['SESSION_COOKIE_SECRET'];
  } else {
    process.env['SESSION_COOKIE_SECRET'] = ORIGINAL_SECRET;
  }
});

describe('signSession + verifySessionCookie roundtrip', () => {
  it('signs and verifies a valid session', async () => {
    const jwt = await signSession({
      uid: 'u_test',
      email: 'test@example.com',
      role: 'admin',
      organizationId: 'org_1',
    });
    expect(jwt).toMatch(/^eyJ/); // JWT header
    const payload = await verifySessionCookie(jwt);
    expect(payload).toMatchObject({
      uid: 'u_test',
      email: 'test@example.com',
      role: 'admin',
      organizationId: 'org_1',
    });
  });

  it('handles organizationId = null', async () => {
    const jwt = await signSession({
      uid: 'u_test',
      email: 'test@example.com',
      role: 'expert',
      organizationId: null,
    });
    const payload = await verifySessionCookie(jwt);
    expect(payload?.organizationId).toBeNull();
  });

  it('returns null for tampered JWT', async () => {
    const jwt = await signSession({
      uid: 'u_test',
      email: 'test@example.com',
      role: 'expert',
      organizationId: null,
    });
    const tampered = jwt.slice(0, -3) + 'xxx';
    const payload = await verifySessionCookie(tampered);
    expect(payload).toBeNull();
  });

  it('returns null for empty cookie', async () => {
    const payload = await verifySessionCookie('');
    expect(payload).toBeNull();
  });

  it('returns null for JWT signed with different secret', async () => {
    const otherSecret = new TextEncoder().encode('a-different-secret-also-32-chars-long-yes');
    const otherJwt = await new SignJWT({ uid: 'x', email: 'x@x.com', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('admin-platform')
      .setExpirationTime('5d')
      .sign(otherSecret);
    const payload = await verifySessionCookie(otherJwt);
    expect(payload).toBeNull();
  });
});

describe('jose-utils (signSessionWithSecret + verifySessionCookieWithSecret)', () => {
  const SECRET = 'pure-utils-test-secret-also-32-chars-long-yes';

  it('signs and verifies with explicit secret', async () => {
    const jwt = await signSessionWithSecret(
      { uid: 'u1', email: 'u1@x.com', role: 'recruiter', organizationId: 'org_x' },
      SECRET,
    );
    const payload = await verifySessionCookieWithSecret(jwt, SECRET);
    expect(payload).toMatchObject({ uid: 'u1', role: 'recruiter', organizationId: 'org_x' });
  });

  it('returns null when verifying with wrong secret', async () => {
    const jwt = await signSessionWithSecret(
      { uid: 'u1', email: 'u1@x.com', role: 'expert', organizationId: null },
      SECRET,
    );
    const payload = await verifySessionCookieWithSecret(
      jwt,
      'wrong-secret-also-32-chars-long-padding',
    );
    expect(payload).toBeNull();
  });
});

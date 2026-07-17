import 'server-only';

import type { Role } from '@shared/schemas/common';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { clientEnv } from '@/env';

// =============================================================================
// Proxy helpers — call Cloud Functions server-to-server forwarding the
// __session cookie. The browser sends the cookie on localhost:3000 (same
// origin as /api/users/*) but the Functions emulator runs at 127.0.0.1:5001
// (different origin), so the browser cannot attach the cookie to a direct
// httpsCallable. Instead, the Next.js API route reads the HttpOnly cookie
// and includes it in the server-to-server fetch.
//
// The CF side already supports cookie auth via shared/with-auth.ts (path 2
// fallback that reads request.rawRequest.headers.cookie and verifies the
// JWT with the same SESSION_COOKIE_SECRET).
// =============================================================================

const COOKIE_NAME = '__session';

function getFunctionsBase(): string {
  if (clientEnv.NEXT_PUBLIC_API_BASE_URL) {
    return clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev') {
    return 'http://127.0.0.1:5001/admin-platform-dev/us-central1';
  }
  return '';
}

export interface ProxyAuthContext {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
  cookie: string;
}

export async function readSessionCookie(): Promise<ProxyAuthContext | null> {
  const jar = cookies();
  const cookie = jar.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const secret = process.env['SESSION_COOKIE_SECRET'];
  if (!secret || secret.length < 32) return null;

  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: 'admin-platform',
    });
    const uid = payload['uid'];
    const email = payload['email'];
    const role = payload['role'];
    if (typeof uid !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      return null;
    }
    if (role !== 'admin' && role !== 'recruiter' && role !== 'expert') return null;
    const orgId = payload['organizationId'];
    const organizationId =
      orgId === null || orgId === undefined ? null : typeof orgId === 'string' ? orgId : null;
    return { uid, email, role: role, organizationId, cookie };
  } catch {
    return null;
  }
}

export async function callCallable<TInput, TOutput>(
  name: string,
  data: TInput,
  ctx: ProxyAuthContext,
): Promise<{ ok: true; data: TOutput } | { ok: false; status: number; error: string }> {
  const base = getFunctionsBase();
  if (!base) {
    return { ok: false, status: 503, error: 'functions-base-unconfigured' };
  }
  const res = await fetch(`${base}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_NAME}=${ctx.cookie}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return {
      ok: false,
      status: res.status,
      error: body.error?.message ?? `${name} failed (${res.status})`,
    };
  }
  const body = (await res.json().catch(() => ({}))) as { result?: TOutput };
  return { ok: true, data: body.result ?? (undefined as unknown as TOutput) };
}

export function requireOrigin(req: Request): string {
  return req.headers.get('origin') ?? req.headers.get('referer') ?? '';
}

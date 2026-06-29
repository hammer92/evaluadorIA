import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

import '@/lib/env-dev-defaults';

// =============================================================================
// Middleware Next.js — verifica la cookie `__session` (HS256) para /admin/**.
// =============================================================================
// Q2=A en execution-plan-sdd05: HS256 con `jose` (edge-compatible, ~5ms).
// El secret se comparte con la Cloud Function `v1_auth_create_session`.
//
// NOTA: este middleware se compila en EDGE runtime, no tiene acceso a
// firebase-admin. La verificación es solo decodificación + verificación
// de firma. La validación real (revocación de sesión, claims actualizados)
// la hace el server (RSC) llamando a `verifyAuth()`.
// =============================================================================

const COOKIE_NAME = '__session';
const ISSUER = 'admin-platform';
const ALG = 'HS256';
const ADMIN_PREFIX = '/admin';
const PUBLIC_ROUTES = new Set(['/', '/login', '/signup']);
const PUBLIC_API_PREFIXES = ['/api/health'];

function getSecret(): Uint8Array | null {
  const s = process.env['SESSION_COOKIE_SECRET'];
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas: pasar.
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // API públicas: pasar.
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Solo protegemos /admin/**.
  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return NextResponse.next();
  }

  const secret = getSecret();
  if (!secret) {
    // Sin secret configurado, fail closed: redirigir a login con error.
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'server-misconfigured');
    return NextResponse.redirect(url);
  }

  const sessionCookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!sessionCookie) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: [ALG],
      issuer: ISSUER,
    });
    if (typeof payload['role'] !== 'string') {
      const url = new URL('/login', req.url);
      url.searchParams.set('error', 'no-claims');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    // Match all routes EXCEPT:
    //  - _next/static, _next/image (Next.js internals)
    //  - favicon.ico
    //  - files with extensions (e.g. .png, .svg, .css, .js)
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

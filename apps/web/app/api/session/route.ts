import { NextResponse, type NextRequest } from 'next/server';

import { clientEnv } from '@/env';

// =============================================================================
// Next.js API route — POST /api/session
// =============================================================================
// Proxy same-origin hacia la Cloud Function v1AuthCreateSession.
//
// Por qué: una Set-Cookie desde el origin del Functions emulator
// (127.0.0.1:5001) queda scoped a ese host:port. El browser NO la envía
// en requests a localhost:3000 (donde corre la app), así que el middleware
// ve la cookie como ausente y redirige a /login?next=/admin.
//
// Esta ruta es same-origin con la app, así que la Set-Cookie queda en
// localhost:3000 y el browser la envía en la siguiente navegación a /admin.
//
// Verificación de seguridad: la CF igual valida el idToken con Admin SDK y
// firma con el SESSION_COOKIE_SECRET. El cliente solo le pasa el idToken
// (que ya posee el usuario autenticado).
// =============================================================================

const COOKIE_NAME = '__session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 días, mismo que v1AuthCreateSession

function getFunctionsBase(): string {
  if (clientEnv.NEXT_PUBLIC_API_BASE_URL) {
    return clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev') {
    return 'http://127.0.0.1:5001/admin-platform-dev/us-central1';
  }
  return '';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: unknown };
  if (typeof idToken !== 'string' || idToken.length === 0) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  const cfUrl = `${getFunctionsBase()}/v1AuthCreateSession`;
  const cfRes = await fetch(cfUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!cfRes.ok) {
    return NextResponse.json(
      { error: 'create-session-failed', status: cfRes.status },
      { status: 502 },
    );
  }

  // Tomamos el JWT del header Set-Cookie de la CF (NO del body — el body no
  // lo incluye, solo success+uid+role).
  const cfSetCookie = cfRes.headers.get('set-cookie');
  if (!cfSetCookie) {
    return NextResponse.json({ error: 'no-cookie-from-cf' }, { status: 502 });
  }
  const match = /__session=([^;]+)/.exec(cfSetCookie);
  const sessionJwt = match?.[1];
  if (!sessionJwt) {
    return NextResponse.json({ error: 'malformed-cookie-from-cf' }, { status: 502 });
  }

  // Re-emitimos la cookie en el response de Next.js (origin localhost:3000).
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: sessionJwt,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // secure: process.env.NODE_ENV === 'production',  // habilita en prod
  });
  return res;
}

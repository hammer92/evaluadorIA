import { jwtVerify } from 'jose';

import { env } from '../env.js';

// =============================================================================
// verifySessionCookieFromRequest — fallback auth para onCall CFs.
// =============================================================================
// El client SDK de Firebase (httpsCallable) envía el Bearer token de
// `auth.currentUser.getIdToken()` solo si el usuario está signed-in en el SDK.
// En nuestro flujo cookie-based, después de un page reload el SDK puede
// perder auth.currentUser aunque la cookie `__session` sea válida (en
// particular con el Auth emulator). Esto provoca "Authentication required"
// en CFs como v1UsersList, v1UsersUpdate, etc.
//
// Como fix, en `withAuth` (`shared/with-auth.ts`), si `request.auth` es
// null intentamos verificar la cookie `__session` del request y construir
// el AuthedContext desde su payload. La cookie está firmada con jose HS256
// usando el mismo secret que el middleware Next.js, así que es la fuente
// de verdad de la sesión.
//
// El secret se valida via `env.SESSION_COOKIE_SECRET` (Zod schema en
// `env.ts`); si falta o es <32 chars el modulo falla al importarse.
// =============================================================================

const COOKIE_NAME = '__session';
const ALG = 'HS256';
const ISSUER = 'admin-platform';

export interface CookiePayload {
  uid: string;
  email: string;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId: string | null;
}

function readCookie(rawCookieHeader: string | undefined, name: string): string | null {
  if (!rawCookieHeader) return null;
  const parts = rawCookieHeader.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export async function verifySessionCookieFromRequest(
  rawCookieHeader: string | undefined,
): Promise<CookiePayload | null> {
  const cookie = readCookie(rawCookieHeader, COOKIE_NAME);
  if (!cookie) return null;
  const secret = env.SESSION_COOKIE_SECRET;
  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret), {
      algorithms: [ALG],
      issuer: ISSUER,
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
    return { uid, email, role: role, organizationId };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as SESSION_COOKIE_NAME_FROM_CF };

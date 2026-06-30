import type { Role } from '@platform/shared';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import type { AuthedContext } from './on-call-auth.js';
import { verifySessionCookieFromRequest } from './verify-session-cookie.js';

export async function buildAuthContext(
  request: CallableRequest<unknown>,
  requiredRole?: Role | Role[],
): Promise<AuthedContext> {
  const headerTrace = request.rawRequest.headers['x-trace-id'];
  const traceId =
    typeof headerTrace === 'string' && headerTrace.length > 0
      ? headerTrace
      : (globalThis.crypto?.randomUUID?.() ?? `tr_${Date.now().toString(36)}`);

  // Path 1: Firebase Auth ID token (enviado por httpsCallable cuando
  // auth.currentUser está populated en el SDK cliente).
  if (request.auth) {
    const token = request.auth.token;
    const role = token['role'] as Role | undefined;
    if (!role || !['admin', 'recruiter', 'expert'].includes(role)) {
      throw new HttpsError('permission-denied', 'Invalid or missing role claim');
    }

    if (requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowed.includes(role)) {
        throw new HttpsError('permission-denied', `Required role: ${allowed.join(' | ')}`);
      }
    }

    return {
      uid: request.auth.uid,
      email: request.auth.token.email ?? '',
      role,
      organizationId: (token['organizationId'] as string | undefined) ?? null,
      traceId,
      request,
    };
  }

  // Path 2: session cookie __session (firmada con jose HS256). Esta es la
  // fuente de verdad de la sesión web — la usa el middleware Next.js y la
  // ruta /api/session. La leemos acá como fallback cuando el client SDK
  // perdió auth.currentUser (e.g. después de page reload en dev/emulator).
  const rawCookie = request.rawRequest.headers['cookie'];
  const cookie = await verifySessionCookieFromRequest(rawCookie);
  if (!cookie) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(cookie.role)) {
      throw new HttpsError('permission-denied', `Required role: ${allowed.join(' | ')}`);
    }
  }

  return {
    uid: cookie.uid,
    email: cookie.email,
    role: cookie.role,
    organizationId: cookie.organizationId,
    traceId,
    request,
  };
}

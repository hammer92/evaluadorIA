import type { Role } from '@platform/shared';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import type { AuthedContext } from './on-call-auth.js';

// eslint-disable-next-line @typescript-eslint/require-await
export async function buildAuthContext(
  request: CallableRequest<unknown>,
  requiredRole?: Role | Role[],
): Promise<AuthedContext> {
  const headerTrace = request.rawRequest.headers['x-trace-id'];
  const traceId =
    typeof headerTrace === 'string' && headerTrace.length > 0
      ? headerTrace
      : (globalThis.crypto?.randomUUID?.() ?? `tr_${Date.now().toString(36)}`);

  // Auth via Firebase Auth ID token (enviado por httpsCallable cuando
  // auth.currentUser está populated en el SDK cliente). Esta es la única
  // vía de auth — el cliente Firebase Auth SDK incluye el ID token
  // automáticamente en cada httpsCallable.
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

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

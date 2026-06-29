import type { Role } from '@platform/shared';
import type { CallableRequest } from 'firebase-functions/v2/https';

import { buildAuthContext } from './with-auth.js';

export interface AuthedContext {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
  traceId: string;
  request: CallableRequest<unknown>;
}

/**
 * Higher-order helper that wraps an `onCall` handler with the standard
 * auth + context resolution. Use as:
 *
 *   export const v1UsersCreate = onCall(
 *     { cors: [...] },
 *     withAuth('admin', async (ctx, input) => { ... }),
 *   );
 */
export function withAuth<TInput, TOutput>(
  requiredRole: Role | Role[] | undefined,
  handler: (ctx: AuthedContext, input: TInput) => Promise<TOutput>,
): (request: CallableRequest<TInput>) => Promise<TOutput> {
  return async (request) => {
    const ctx = await buildAuthContext(request, requiredRole);
    return handler(ctx, request.data);
  };
}

export { buildAuthContext };

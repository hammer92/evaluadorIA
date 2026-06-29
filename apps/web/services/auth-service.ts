import 'server-only';

import { cookies } from 'next/headers';

import { verifySessionCookie } from '@/features/auth/server/session';
import type { ServerAuth } from '@/features/auth/types';

// =============================================================================
// Server-side auth helpers — usados en RSC y route handlers.
// =============================================================================
// `verifyAuth()` retorna el ServerAuth o `null`.
// `requireAuth()` lanza Error('UNAUTHORIZED') si no hay sesión.
// `requireRole(role | role[])` lanza Error('FORBIDDEN') si el rol no coincide.
// =============================================================================

export const COOKIE_NAME = '__session';

export async function verifyAuth(): Promise<ServerAuth | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const payload = await verifySessionCookie(sessionCookie);
  if (!payload) return null;
  return {
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
  };
}

export async function requireAuth(): Promise<ServerAuth> {
  const auth = await verifyAuth();
  if (!auth) throw new Error('UNAUTHORIZED');
  return auth;
}

export async function requireRole(
  role: ServerAuth['role'] | ServerAuth['role'][],
): Promise<ServerAuth> {
  const auth = await requireAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(auth.role)) throw new Error('FORBIDDEN');
  return auth;
}

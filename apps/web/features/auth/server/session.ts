import 'server-only';

import type { SessionPayload } from '../types';

import { signSessionWithSecret, verifySessionCookieWithSecret } from './jose-utils';

import { env } from '@/env';

// =============================================================================
// Server-side session helpers — HS256 con `jose` (edge-compatible).
// =============================================================================
// La Cloud Function `createSession` firma el JWT y setea la cookie `__session`.
// El middleware Next.js llama a `verifySessionCookie()` para validar antes de
// servir /admin/**.
//
// Trade-off (Q2=A en execution-plan-sdd05): secret compartido entre 2
// componentes. Mitigation: secret solo en process.env del servidor, NUNCA
// expuesto al cliente. En prod, rotar el secret invalida todas las sesiones
// (comportamiento aceptable para MVP).
//
// Esta capa es un thin wrapper sobre `jose-utils.ts` (puro jose, sin env
// vars, re-usable por scripts de integración). Solo esta capa hace el
// `import 'server-only'` y lee el secret desde `@/env`.
// =============================================================================

export async function signSession(input: {
  uid: string;
  email: string;
  role: SessionPayload['role'];
  organizationId: string | null;
}): Promise<string> {
  return await signSessionWithSecret(input, env.SESSION_COOKIE_SECRET);
}

export async function verifySessionCookie(cookie: string): Promise<SessionPayload | null> {
  return await verifySessionCookieWithSecret(cookie, env.SESSION_COOKIE_SECRET);
}

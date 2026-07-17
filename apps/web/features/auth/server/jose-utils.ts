import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

import type { SessionPayload } from '../types';

// =============================================================================
// Pure jose session helpers (sin `import 'server-only'` para que los scripts
// de integración puedan usarlos directamente).
// =============================================================================
// `session.ts` (server-only) re-exporta estas funciones y agrega las env vars
// desde `@/env`. `verify-auth.ts` usa estas funciones directamente para evitar
// el runtime check de `server-only` (que solo aplica en Next.js).
// =============================================================================

const ALG = 'HS256';
const ISSUER = 'admin-platform';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 días

export function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionWithSecret(
  input: {
    uid: string;
    email: string;
    role: SessionPayload['role'];
    organizationId: string | null;
  },
  secret: string,
): Promise<string> {
  return await new SignJWT({
    uid: input.uid,
    email: input.email,
    role: input.role,
    organizationId: input.organizationId,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret(secret));
}

export async function verifySessionCookieWithSecret(
  cookie: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(cookie, getSecret(secret), {
      algorithms: [ALG],
      issuer: ISSUER,
    });
    return toSessionPayload(payload);
  } catch {
    return null;
  }
}

function toSessionPayload(payload: JWTPayload): SessionPayload | null {
  const uid = payload['uid'];
  const email = payload['email'];
  const role = payload['role'];
  const iat = payload.iat;
  const exp = payload.exp;
  if (
    typeof uid !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    return null;
  }
  const orgId = payload['organizationId'];
  if (orgId !== null && orgId !== undefined && typeof orgId !== 'string') return null;
  return {
    uid,
    email,
    role: role as SessionPayload['role'],
    organizationId: orgId ?? null,
    iat,
    exp,
  };
}

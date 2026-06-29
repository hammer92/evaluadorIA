import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { SignJWT } from 'jose';

import { getAdminAuth } from '../../firebase-admin.js';

// =============================================================================
// Cloud Function: v1_auth_create_session (onRequest)
// =============================================================================
// Crea una session cookie httpOnly a partir de un idToken.
// FIRMAMOS con jose (HS256) usando el mismo secret que el middleware Next.js.
// Esto evita depender de firebase-admin's createSessionCookie (que produce
// JWTs con el formato interno de Firebase, no compatible con nuestro verifier).
//
// Endpoint: POST /v1AuthCreateSession
// Body: { idToken: string }
// Response: 200 { success: true } + Set-Cookie: __session=...
//
// IMPORTANTE: Set-Cookie requiere Access-Control-Allow-Credentials: true
// en respuestas CORS. firebase-functions v2 onRequest NO lo setea por default.
// Lo agregamos manualmente en cada response.
// =============================================================================

const sessionSecret = defineSecret('SESSION_COOKIE_SECRET');

const COOKIE_NAME = '__session';
const ISSUER = 'admin-platform';
const ALG = 'HS256';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 días

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;

function setCorsHeaders(
  res: { setHeader: (k: string, v: string) => void },
  origin: string | undefined,
  allowedOrigins: string[],
): void {
  const allowOrigin =
    origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? '*');
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export const v1AuthCreateSession = onRequest(
  {
    cors: false,
    secrets: [sessionSecret],
  },
  async (req, res) => {
    const allowed = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(',');
    const origin = req.headers['origin'] as string | undefined;
    setCorsHeaders(res, origin, allowed);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }
    const idToken = (req.body as { idToken?: unknown })?.idToken;
    if (typeof idToken !== 'string') {
      res.status(400).json({ error: 'idToken required' });
      return;
    }

    const auth = getAdminAuth();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch {
      res.status(401).json({ error: 'invalid-id-token' });
      return;
    }

    const role = decoded['role'];
    const organizationId = decoded['organizationId'] ?? null;
    const secret = sessionSecret.value();
    if (!secret || secret.length < 32) {
      res.status(500).json({ error: 'server-misconfigured' });
      return;
    }

    const sessionJwt = await new SignJWT({
      uid: decoded.uid,
      email: decoded.email ?? '',
      role: role ?? 'expert',
      organizationId,
    })
      .setProtectedHeader({ alg: ALG })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setExpirationTime(`${MAX_AGE_SECONDS}s`)
      .sign(new TextEncoder().encode(secret));

    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${sessionJwt}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}` +
        (process.env['NODE_ENV'] === 'production' ? '; Secure' : ''),
    );
    res.status(200).json({
      success: true,
      uid: decoded.uid,
      role: role ?? 'expert',
    });
  },
);

import { onRequest } from 'firebase-functions/v2/https';

import { SESSION_COOKIE_NAME } from './create-session.js';

// =============================================================================
// Cloud Function: v1_auth_clear_session (onRequest)
// =============================================================================
// Borra la cookie de sesión (Set-Cookie con Max-Age=0).
//
// Endpoint: POST /v1AuthClearSession
// Response: 200 { success: true } + Set-Cookie: __session=; Max-Age=0
// =============================================================================

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

export const v1AuthClearSession = onRequest({ cors: false }, async (req, res) => {
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
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(200).json({ success: true });
});

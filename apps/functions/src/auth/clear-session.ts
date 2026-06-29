import { onRequest } from 'firebase-functions/v2/https';

import { SESSION_COOKIE_NAME } from './create-session.js';

// =============================================================================
// Cloud Function: v1_auth_clear_session (onRequest)
// =============================================================================
// Borra la cookie de sesión (Set-Cookie con Max-Age=0).
//
// Endpoint: POST /v1_auth_clear_session
// Response: 200 { success: true } + Set-Cookie: __session=; Max-Age=0
//
// IMPORTANTE: igual que createSession, requiere CORS headers manuales
// (Access-Control-Allow-Credentials: true) para que el browser acepte
// la cookie borrada.
// =============================================================================

const ALLOWED_ORIGIN = 'http://localhost:3000';

function setCorsHeaders(
  res: { setHeader: (k: string, v: string) => void },
  origin: string | undefined,
): void {
  const allowOrigin = origin && origin.startsWith('http://localhost') ? origin : ALLOWED_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export const clearSession = onRequest(
  // CORS: false desactiva el middleware interno de firebase-functions v2.
  // Hacemos CORS manualmente en setCorsHeaders().
  { cors: false },
  async (req, res) => {
    const origin = req.headers['origin'] as string | undefined;
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    );
    res.status(200).json({ success: true });
  },
);

import { onRequest } from 'firebase-functions/v2/https';

import { SESSION_COOKIE_NAME } from './create-session.js';

// =============================================================================
// Cloud Function: v1_auth_clear_session (onRequest)
// =============================================================================
// Borra la cookie de sesión (Set-Cookie con Max-Age=0).
//
// Endpoint: POST /v1_auth_clear_session
// Response: 200 { success: true } + Set-Cookie: __session=; Max-Age=0
// =============================================================================

export const clearSession = onRequest({ cors: ['http://localhost:3000'] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(200).json({ success: true });
});

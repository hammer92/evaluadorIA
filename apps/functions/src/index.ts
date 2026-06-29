import { clearSession } from './auth/clear-session.js';
import { createSession } from './auth/create-session.js';
import { createUser } from './auth/create-user.js';
import { inviteUser } from './auth/invite-user.js';
import { setUserRole } from './auth/set-custom-claims.js';

/**
 * Firebase Cloud Functions (v2) — entrypoint.
 *
 * Exporta:
 *   - v1_auth_create_session  (onRequest) — set httpOnly cookie
 *   - v1_auth_clear_session   (onRequest) — clear cookie
 *   - v1_users_create         (onCall)    — first-user-admin bootstrap
 *   - v1_users_invite         (onCall)    — admin invite
 *   - setUserRole             (utility)   — set custom claims (auth helper)
 *
 * SDD-05: implementa el flujo de autenticación + autorización client-side
 * (cookie session, custom claims, primer-user-admin).
 */

export { setUserRole, createSession, clearSession, createUser, inviteUser };

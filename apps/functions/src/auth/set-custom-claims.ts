import type { Role } from '../../../../packages/shared/src/schemas/users';
import { getAdminAuth } from '../firebase-admin.js';

/**
 * Sets Custom User Claims for a Firebase Auth user.
 *
 * Custom Claims are the **single source of truth** for roles
 * (see ADR-0006). The `role` field in Firestore's `users/{uid}` doc is a
 * mirror/cache — server-authoritative state lives in the JWT.
 *
 * @param uid            Firebase Auth UID
 * @param role           Role to assign
 * @param organizationId Optional org membership. Pass `null` to clear it.
 *                       Omit to leave existing claim untouched.
 */
export async function setUserRole(
  uid: string,
  role: Role,
  organizationId?: string | null,
): Promise<void> {
  const auth = getAdminAuth();
  const claims: { role: Role; organizationId?: string | null } = { role };

  if (organizationId !== undefined) {
    claims.organizationId = organizationId;
  }

  await auth.setCustomUserClaims(uid, claims);
}

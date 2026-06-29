import type { Role } from '@platform/shared';

import { getAdminAuth } from '../../firebase-admin.js';

/**
 * Utility: setea Custom User Claims sobre un Firebase Auth user.
 * Source of truth para roles (ver ADR-0006). El campo `role` en
 * `users/{uid}` de Firestore es un mirror/cache.
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

import { updateUserInputSchema, type UpdateUserInput } from '@platform/shared';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { env } from '../../env.js';
import { getAdminAuth, getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

const updateUserRequestSchema = z.object({
  uid: z.string().min(1),
  input: updateUserInputSchema,
});
type UpdateUserRequest = z.input<typeof updateUserRequestSchema>;

const userRef = (db: Firestore, uid: string) => db.collection('users').doc(uid);

function toUpdateRaw(input: UpdateUserInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.displayName !== undefined) patch['display_name'] = input.displayName;
  if (input.photoURL !== undefined) patch['photo_url'] = input.photoURL;
  if (input.role !== undefined) patch['role'] = input.role;
  if (input.status !== undefined) patch['status'] = input.status;
  return patch;
}

function mapUserDoc(uid: string, raw: Record<string, unknown>) {
  return {
    uid,
    email: raw['email'] as string,
    displayName: (raw['display_name'] as string | null) ?? null,
    photoURL: (raw['photo_url'] as string | null) ?? null,
    role: raw['role'] as 'admin' | 'recruiter' | 'expert',
    organizationId: (raw['organization_id'] as string | null) ?? null,
    status: raw['status'] as 'active' | 'invited' | 'suspended',
  };
}

export const v1UsersUpdate = onCall(
  {
    cors: env.ALLOWED_ORIGINS.split(','),
    enforceAppCheck: false,
  },
  withAuth<UpdateUserRequest, unknown>(undefined, async (ctx: AuthedContext, data) => {
    try {
      const { uid, input } = validateInput(updateUserRequestSchema, data);

      if (ctx.role !== 'admin' && ctx.uid !== uid) {
        throw new RepositoryError(
          'PERMISSION_DENIED',
          'Solo admin o el propio user pueden modificar',
        );
      }
      if (input.role !== undefined && ctx.role !== 'admin') {
        throw new RepositoryError('PERMISSION_DENIED', 'Solo admin puede cambiar role');
      }

      const db = getAdminDb();
      const ref = userRef(db, uid);
      const snap = await ref.get();
      if (!snap.exists) throw new RepositoryError('NOT_FOUND', `User ${uid} not found`);
      const beforeRaw = snap.data() ?? {};
      const before = mapUserDoc(uid, beforeRaw);

      const patch = toUpdateRaw(input);
      if (Object.keys(patch).length === 0) {
        throw new RepositoryError('VALIDATION', 'Patch vacío');
      }
      await ref.update({ ...patch, updated_at: FieldValue.serverTimestamp() });

      if (input.role !== undefined) {
        const auth = getAdminAuth();
        const claims: Record<string, unknown> = { role: input.role };
        if (before.organizationId !== null) claims['organizationId'] = before.organizationId;
        await auth.setCustomUserClaims(uid, claims);
      }

      const after = mapUserDoc(uid, { ...beforeRaw, ...patch });

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: input.role && input.role !== before.role ? 'user.role_changed' : 'user.updated',
        targetType: 'user',
        targetId: uid,
        organizationId: after.organizationId,
        metadata: {
          before: { role: before.role, status: before.status, displayName: before.displayName },
          after: { role: after.role, status: after.status, displayName: after.displayName },
        },
      });

      return after;
    } catch (e) {
      handleError(e);
    }
  }),
);

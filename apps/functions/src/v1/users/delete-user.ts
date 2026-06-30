import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

const deleteUserRequestSchema = z.object({
  uid: z.string().min(1),
});
type DeleteUserRequest = z.input<typeof deleteUserRequestSchema>;

export const v1UsersDelete = onCall(
  {
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
    enforceAppCheck: false,
    secrets: ['SESSION_COOKIE_SECRET'],
  },
  withAuth<DeleteUserRequest, unknown>('admin', async (ctx: AuthedContext, data) => {
    try {
      const { uid } = validateInput(deleteUserRequestSchema, data);

      if (uid === ctx.uid) {
        throw new RepositoryError('VALIDATION', 'No podés eliminarte a vos mismo');
      }

      const db = getAdminDb();
      const ref = db.collection('users').doc(uid);
      const snap = await ref.get();
      if (!snap.exists) throw new RepositoryError('NOT_FOUND', `User ${uid} not found`);
      const before = snap.data() ?? {};

      const now = FieldValue.serverTimestamp();
      await ref.update({ deleted_at: now, status: 'suspended', updated_at: now });

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'user.deleted',
        targetType: 'user',
        targetId: uid,
        organizationId: (before['organization_id'] as string | null) ?? null,
        metadata: {
          email: before['email'],
          role: before['role'],
          softDelete: true,
        },
      });

      return { uid, deletedAt: new Date().toISOString() };
    } catch (e) {
      handleError(e);
    }
  }),
);

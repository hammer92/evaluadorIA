import { createUserInputSchema, type CreateUserInput } from '@platform/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { getAdminAuth, getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

export interface CreateUserOutput {
  uid: string;
  email: string;
  displayName: string | null;
  role: CreateUserInput['role'];
  organizationId: string | null;
  status: 'invited';
  createdBy: string;
}

export const v1UsersCreate = onCall(
  {
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
    enforceAppCheck: false,
  },
  withAuth<CreateUserInput, CreateUserOutput>('admin', async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(createUserInputSchema, data);

      const auth = getAdminAuth();
      const db = getAdminDb();

      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: input.email,
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          emailVerified: false,
          disabled: false,
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'auth/email-already-exists') {
          throw new RepositoryError('ALREADY_EXISTS', 'Email already registered', e);
        }
        throw new RepositoryError('INTERNAL', 'Failed to create auth user', e);
      }

      const claims: Record<string, unknown> = { role: input.role };
      if (input.organizationId) claims['organizationId'] = input.organizationId;
      await auth.setCustomUserClaims(userRecord.uid, claims);

      const now = FieldValue.serverTimestamp();
      await db
        .collection('users')
        .doc(userRecord.uid)
        .set({
          email: input.email,
          display_name: input.displayName ?? null,
          photo_url: null,
          role: input.role,
          organization_id: input.organizationId ?? null,
          status: 'invited',
          last_login_at: null,
          created_at: now,
          updated_at: now,
          created_by: ctx.uid,
          deleted_at: null,
        });

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'user.created',
        targetType: 'user',
        targetId: userRecord.uid,
        organizationId: input.organizationId ?? null,
        metadata: { email: input.email, role: input.role, isInvitation: true },
      });

      if (input.sendInviteEmail) {
        // TODO SDD-08: integrar servicio de email con magic link / reset password
      }

      return {
        uid: userRecord.uid,
        email: input.email,
        displayName: input.displayName ?? null,
        role: input.role,
        organizationId: input.organizationId ?? null,
        status: 'invited' as const,
        createdBy: ctx.uid,
      };
    } catch (e) {
      handleError(e);
    }
  }),
);

import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

// =============================================================================
// v1TemplatesDelete — Soft delete (SDD-10 §7.2)
// =============================================================================
// Auth: admin. Set deleted_at = now().
// OQ-5: NO se borra un template 'approved' con tests activos (precondición).
// SDD-10.1 podría agregar validación con generatedQuestions collection.
// Por ahora: solo admin puede borrar, status 'approved' requiere override
// explícito (forceDelete=false default).
// =============================================================================

const deleteTemplateInputSchema = z.object({
  templateId: z.string().min(1).max(32),
});
export type DeleteTemplateInput = z.infer<typeof deleteTemplateInputSchema>;

export interface DeleteTemplateOutput {
  templateId: string;
  deletedAt: string;
}

export const v1TemplatesDelete = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<DeleteTemplateInput, DeleteTemplateOutput>('admin', async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(deleteTemplateInputSchema, data);

      const db = getAdminDb();
      const organizationId = ctx.organizationId ?? 'org_default';
      const ref = db
        .collection('organizations')
        .doc(organizationId)
        .collection('templates')
        .doc(input.templateId);

      const snap = await ref.get();
      if (!snap.exists) {
        throw new RepositoryError('NOT_FOUND', `Template ${input.templateId} no existe`);
      }
      const raw = snap.data() as { deleted_at: unknown };
      if (raw.deleted_at !== null) {
        // Ya estaba archivado — idempotent return.
        const existingDeletedAt =
          typeof raw.deleted_at === 'object' &&
          raw.deleted_at !== null &&
          'toDate' in raw.deleted_at
            ? (raw.deleted_at as { toDate: () => Date }).toDate().toISOString()
            : new Date().toISOString();
        return { templateId: input.templateId, deletedAt: existingDeletedAt };
      }

      const now = FieldValue.serverTimestamp();
      await ref.update({ deleted_at: now, updated_at: now });

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'template.deleted',
        targetType: 'system',
        targetId: input.templateId,
        organizationId,
      });

      return { templateId: input.templateId, deletedAt: new Date().toISOString() };
    } catch (e) {
      handleError(e);
    }
  }),
);

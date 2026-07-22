import {
  updateTemplateInputSchema,
  type UpdateTemplateInput,
  type Template,
} from '@platform/shared';
import { canEdit } from '@platform/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { recipesInputToFirestore, templateFromFirestore, type TemplateDocRaw } from './mapper.js';

// =============================================================================
// v1TemplatesUpdate — Editar template (admin) (SDD-10 §7.2)
// =============================================================================
// Auth: admin. Pre-condición: status='draft' | 'changes_requested' (canEdit).
// OQ-4: NO se puede editar un template 'approved' (rechazar con
// failed-precondition). El admin debe crear uno nuevo.
// =============================================================================

export type UpdateTemplateOutput = Template;

export const v1TemplatesUpdate = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<UpdateTemplateInput, UpdateTemplateOutput>('admin', async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(updateTemplateInputSchema, data);

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
      const current = templateFromFirestore(input.templateId, snap.data() as TemplateDocRaw);

      // canEdit valida status (admin en draft o changes_requested).
      const editCheck = canEdit(current, ctx.role);
      if (!editCheck.canEdit) {
        throw new RepositoryError('PERMISSION_DENIED', editCheck.reason);
      }

      // OQ-4: NO se puede editar un template approved.
      if (current.status === 'approved') {
        throw new RepositoryError(
          'VALIDATION',
          'Un template aprobado es inmutable — crea uno nuevo si necesitás cambios',
        );
      }

      // Construir patch.
      const updates: Record<string, unknown> = {
        updated_at: FieldValue.serverTimestamp(),
      };
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];

      if (input.name !== undefined && input.name !== current.name) {
        // OQ-1: si cambia el nombre, validar unicidad.
        const existing = await ref.parent.where('name', '==', input.name).limit(1).get();
        if (!existing.empty && existing.docs[0]?.id !== input.templateId) {
          throw new RepositoryError(
            'ALREADY_EXISTS',
            `Ya existe un template con nombre "${input.name}" en esta organización`,
          );
        }
        updates['name'] = input.name;
        fieldChanges.push({ field: 'name', before: current.name, after: input.name });
      }
      if (input.description !== undefined && input.description !== current.description) {
        updates['description'] = input.description ?? null;
        fieldChanges.push({
          field: 'description',
          before: current.description ?? null,
          after: input.description ?? null,
        });
      }
      if (input.niche !== undefined && input.niche !== current.niche) {
        updates['niche'] = input.niche;
        fieldChanges.push({ field: 'niche', before: current.niche, after: input.niche });
      }
      if (
        input.timeLimitMinutes !== undefined &&
        input.timeLimitMinutes !== current.timeLimitMinutes
      ) {
        updates['time_limit_minutes'] = input.timeLimitMinutes;
        fieldChanges.push({
          field: 'timeLimitMinutes',
          before: current.timeLimitMinutes,
          after: input.timeLimitMinutes,
        });
      }
      if (input.maxRetries !== undefined && input.maxRetries !== current.maxRetries) {
        updates['max_retries'] = input.maxRetries;
        fieldChanges.push({
          field: 'maxRetries',
          before: current.maxRetries,
          after: input.maxRetries,
        });
      }
      if (input.recipes !== undefined) {
        updates['recipes'] = recipesInputToFirestore(input.recipes);
        fieldChanges.push({
          field: 'recipes',
          before: current.recipes,
          after: input.recipes,
        });
      }

      if (fieldChanges.length === 0) {
        // No-op — devolvemos el template actual.
        return current;
      }

      await ref.update(updates);

      // Side-effect: reviewEvent con action='edited'.
      await ref.collection('reviews').add({
        actor_id: ctx.uid,
        actor_name: ctx.email,
        actor_role: ctx.role,
        action: 'edited',
        comment: null,
        changes: fieldChanges,
        created_at: FieldValue.serverTimestamp(),
      });

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'template.edited',
        targetType: 'system',
        targetId: input.templateId,
        organizationId,
        metadata: { fields: fieldChanges.map((c) => c.field) },
      });

      // Releer y devolver.
      const afterSnap = await ref.get();
      return templateFromFirestore(input.templateId, afterSnap.data() as TemplateDocRaw);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      handleError(e);
    }
  }),
);

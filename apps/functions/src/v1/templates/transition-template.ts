import { transitionInputSchema, type TransitionInput } from '@platform/shared';
import { getTransition, isExpertApprovingOwnTemplate, validateTransition } from '@platform/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { templateFromFirestore, type TemplateDocRaw } from './mapper.js';

// =============================================================================
// v1TemplatesTransition — Cambiar estado (state machine) (SDD-10 §7.2)
// =============================================================================
// Side effects por transición:
//   1. Update del template (status, updated_at, possibly approvedBy/At)
//   2. Create de reviewEvent con action=reviewAction, actorRole, comment, changes
//   3. Create de auditLog con action=auditAction, metadata: {fromStatus, toStatus}
// OQ-6 (soft check): si to='approved' && role='expert' && actorId===createdBy →
//   permission-denied (defense in depth aunque hoy solo admin crea).
// =============================================================================

export interface TransitionTemplateOutput {
  templateId: string;
  status: TransitionInput['toStatus'];
  transitionedAt: string;
}

export const v1TemplatesTransition = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<TransitionInput, TransitionTemplateOutput>(
    undefined,
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(transitionInputSchema, data);

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

        // OQ-4 / OQ-5: no transicionar templates archivados.
        if (current.deletedAt !== null) {
          throw new RepositoryError('VALIDATION', 'No se puede transicionar un template archivado');
        }

        // Validar la transición via state machine.
        const v = validateTransition(current.status, input.toStatus, ctx.role, input.comment);
        if (!v.ok) {
          throw new RepositoryError('VALIDATION', v.reason);
        }
        const transition = getTransition(current.status, input.toStatus);
        if (!transition) {
          throw new RepositoryError(
            'VALIDATION',
            `Transición inválida: ${current.status} → ${input.toStatus}`,
          );
        }

        // OQ-6: soft check defensivo.
        if (isExpertApprovingOwnTemplate(input.toStatus, ctx.role, ctx.uid, current.createdBy)) {
          throw new RepositoryError(
            'PERMISSION_DENIED',
            'No podés aprobar un template que vos mismo creaste',
          );
        }

        const now = FieldValue.serverTimestamp();
        const updates: Record<string, unknown> = {
          status: input.toStatus,
          updated_at: now,
        };
        if (input.toStatus === 'approved') {
          updates['approved_by'] = ctx.uid;
          updates['approved_at'] = now;
        }
        if (input.toStatus === 'draft') {
          // Reabrir: limpiar approved_by/at.
          updates['approved_by'] = null;
          updates['approved_at'] = null;
        }

        await ref.update(updates);

        // Side effect: reviewEvent.
        await ref.collection('reviews').add({
          actor_id: ctx.uid,
          actor_name: ctx.email,
          actor_role: ctx.role,
          action: transition.reviewAction,
          comment: input.comment ?? null,
          changes: input.changes ?? null,
          created_at: now,
        });

        // Side effect: auditLog.
        await writeAuditLog({
          actorId: ctx.uid,
          actorEmail: ctx.email,
          action: transition.auditAction as Parameters<typeof writeAuditLog>[0]['action'],
          targetType: 'system',
          targetId: input.templateId,
          organizationId,
          metadata: {
            fromStatus: current.status,
            toStatus: input.toStatus,
            ...(input.comment ? { comment: input.comment } : {}),
          },
        });

        return {
          templateId: input.templateId,
          status: input.toStatus,
          transitionedAt: new Date().toISOString(),
        };
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

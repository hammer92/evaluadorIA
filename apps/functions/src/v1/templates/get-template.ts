import type { Template } from '@platform/shared';
import { canViewTemplate, getTransition, type Transition } from '@platform/shared';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { templateFromFirestore, type TemplateDocRaw } from './mapper.js';

// =============================================================================
// v1TemplatesGet — Obtener un template por id (SDD-10 §7.2)
// =============================================================================
// Auth: admin o expert (cualquiera); recruiter solo si status='approved'.
// Defense-in-depth: re-validamos canViewTemplate() en el server aunque las
// Firestore rules ya filtran por rol+estado.
// =============================================================================

const getTemplateInputSchema = z.object({ templateId: z.string().min(1).max(32) });
export type GetTemplateInput = z.infer<typeof getTemplateInputSchema>;

export type GetTemplateOutput = Template | null;

export const v1TemplatesGet = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<GetTemplateInput, GetTemplateOutput>(undefined, async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(getTemplateInputSchema, data);

      const db = getAdminDb();
      const organizationId = ctx.organizationId ?? 'org_default';
      const ref = db
        .collection('organizations')
        .doc(organizationId)
        .collection('templates')
        .doc(input.templateId);
      const snap = await ref.get();
      if (!snap.exists) {
        return null;
      }
      const raw = snap.data() as TemplateDocRaw;
      const template = templateFromFirestore(input.templateId, raw);

      // Server-side re-check (defense in depth con Firestore rules).
      if (!canViewTemplate(template, ctx.role)) {
        return null;
      }

      // Adjuntar availableTransitions para que la UI no tenga que recalcular.
      const availableTransitions: Transition[] = [];
      for (const candidate of [
        'draft',
        'in_review',
        'changes_requested',
        'approved',
        'rejected',
      ] as const) {
        const t = getTransition(template.status, candidate);
        if (t?.allowedRoles.includes(ctx.role)) {
          availableTransitions.push(t);
        }
      }
      return Object.assign(template, {
        availableTransitions: availableTransitions.map((t) => ({
          from: t.from,
          to: t.to,
          label: t.label,
          variant: t.variant,
          requiresComment: t.requiresComment,
        })),
      });
    } catch (e) {
      handleError(e);
    }
  }),
);

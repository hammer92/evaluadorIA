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

// Output type: el template + las transiciones disponibles para el caller
// (la UI las usa para renderizar botones de acción). Tipo explícito en vez
// de `Object.assign` para mantener el type boundary claro.
export interface TemplateWithTransitions extends Template {
  availableTransitions: Pick<Transition, 'from' | 'to' | 'label' | 'variant' | 'requiresComment'>[];
}

export type GetTemplateOutput = TemplateWithTransitions | null;

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

      const availableTransitions = (
        ['draft', 'in_review', 'changes_requested', 'approved', 'rejected'] as const
      )
        .map((candidate) => getTransition(template.status, candidate))
        .filter((t): t is Transition => t?.allowedRoles.includes(ctx.role) ?? false)
        .map((t) => ({
          from: t.from,
          to: t.to,
          label: t.label,
          variant: t.variant,
          requiresComment: t.requiresComment,
        }));

      return { ...template, availableTransitions };
    } catch (e) {
      handleError(e);
    }
  }),
);

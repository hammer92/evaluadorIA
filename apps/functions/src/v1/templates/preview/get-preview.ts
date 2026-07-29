import {
  type GetPreviewInput,
  type GetPreviewOutput,
  PREVIEW_DOC_ID,
  getPreviewInputSchema,
} from '@platform/shared';
import { onCall } from 'firebase-functions/v2/https';


import { ALLOWED_ORIGINS_DEPLOY } from '../../../deploy-config.js';
import { getAdminDb } from '../../../firebase-admin.js';
import { handleError } from '../../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../../shared/on-call-auth.js';
import { validateInput } from '../../../shared/validate-input.js';
import { type TemplateDocRaw } from '../mapper.js';

// =============================================================================
// v1_template_preview_get — SDD-11 §4.1
// =============================================================================
// Auth: admin o expert. Misma org que el template.
// Lee el preview cacheado y compara recipeSnapshot.recipeUpdatedAt contra
// template.updatedAt para detectar stale.
// No side effects.
// =============================================================================

export const v1TemplatePreviewGet = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<GetPreviewInput, GetPreviewOutput>(
    ['admin', 'expert'],
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(getPreviewInputSchema, data);
        const db = getAdminDb();
        const organizationId = ctx.organizationId ?? 'org_default';
        const templateRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('templates')
          .doc(input.templateId);

        const templateSnap = await templateRef.get();
        if (!templateSnap.exists) {
          return { preview: null, isStale: false, message: 'Template no existe' };
        }
        const template = templateSnap.data() as TemplateDocRaw;
        const templateUpdatedAt = (template.updated_at as { toDate: () => Date } | undefined)
          ?.toDate?.()
          .toISOString();

        const previewSnap = await templateRef
          .collection('previewQuestions')
          .doc(PREVIEW_DOC_ID)
          .get();
        if (!previewSnap.exists) {
          return { preview: null, isStale: false, message: 'No hay preview generado' };
        }

        const raw = previewSnap.data() as Record<string, unknown>;
        const generatedAt = (raw['generatedAt'] as { toDate: () => Date } | undefined)?.toDate?.();
        const recipeUpdatedAt = (
          (raw['recipeSnapshot'] as Record<string, unknown> | undefined)?.['recipeUpdatedAt'] as
            | { toDate: () => Date }
            | undefined
        )?.toDate?.();

        const generatedIso = generatedAt ? generatedAt.toISOString() : '';
        const recipeIso = recipeUpdatedAt ? recipeUpdatedAt.toISOString() : '';

        const isStale = templateUpdatedAt !== undefined && templateUpdatedAt !== recipeIso;

        const preview = {
          ...(raw),
          generatedAt: generatedIso,
          recipeSnapshot: {
            ...((raw['recipeSnapshot'] as Record<string, unknown>) ?? {}),
            recipeUpdatedAt: recipeIso,
          },
        };

        return {
          preview: preview as GetPreviewOutput['preview'],
          isStale,
          message: isStale
            ? 'El preview está desactualizado porque la receta cambió. Regenerá para ver la versión actual.'
            : null,
        };
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

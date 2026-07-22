import { expertEditInputSchema, type ExpertEditInput, type Template } from '@platform/shared';
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
// v1TemplatesExpertEdit — Editar params técnicos (expert en in_review) (SDD-10 §7.2)
// =============================================================================
// Auth: expert. Pre-condición: status='in_review'.
// Solo campos permitidos: recipes[].{competencyContext, qtyMultipleChoice,
// qtyMultiChoice, difficulty, topicsCovered}.
// NO se permite editar: name, description, niche, timeLimitMinutes, maxRetries,
// recipes[].competencyName.
// =============================================================================

export type ExpertEditTemplateOutput = Template;

export const v1TemplatesExpertEdit = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<ExpertEditInput, ExpertEditTemplateOutput>(
    'expert',
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(expertEditInputSchema, data);

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

        if (current.status !== 'in_review') {
          throw new RepositoryError(
            'PERMISSION_DENIED',
            `Expert solo puede editar en estado "in_review" (actual: ${current.status})`,
          );
        }

        if (!input.recipes || input.recipes.length === 0) {
          throw new RepositoryError('VALIDATION', 'Debe especificar al menos un recipe a editar');
        }

        // Construir patch: solo campos técnicos.
        const newRecipes = current.recipes.map((currentRecipe) => {
          const patch = input.recipes?.find((r) => r.recipeId === currentRecipe.recipeId);
          if (!patch) return currentRecipe;
          return {
            ...currentRecipe,
            ...(patch.competencyContext !== undefined
              ? { competencyContext: patch.competencyContext }
              : {}),
            ...(patch.qtyMultipleChoice !== undefined
              ? { qtyMultipleChoice: patch.qtyMultipleChoice }
              : {}),
            ...(patch.qtyMultiChoice !== undefined ? { qtyMultiChoice: patch.qtyMultiChoice } : {}),
            ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
            ...(patch.topicsCovered !== undefined ? { topicsCovered: patch.topicsCovered } : {}),
          };
        });

        const newRecipesFirestore = newRecipes.map((r) => ({
          recipe_id: r.recipeId,
          competency_name: r.competencyName,
          competency_context: r.competencyContext,
          qty_multiple_choice: r.qtyMultipleChoice,
          qty_multi_choice: r.qtyMultiChoice,
          difficulty: r.difficulty,
          topics_covered: r.topicsCovered ?? [],
        }));

        const now = FieldValue.serverTimestamp();
        await ref.update({
          recipes: newRecipesFirestore,
          updated_at: now,
        });

        // Side effect: reviewEvent con action='edited' + diff antes/después.
        const changes = newRecipes.flatMap((after, i) => {
          const before = current.recipes[i];
          if (!before) return [];
          const fields: { field: string; before: unknown; after: unknown }[] = [];
          if (before.competencyContext !== after.competencyContext) {
            fields.push({
              field: `recipes[${i}].competencyContext`,
              before: before.competencyContext,
              after: after.competencyContext,
            });
          }
          if (before.qtyMultipleChoice !== after.qtyMultipleChoice) {
            fields.push({
              field: `recipes[${i}].qtyMultipleChoice`,
              before: before.qtyMultipleChoice,
              after: after.qtyMultipleChoice,
            });
          }
          if (before.qtyMultiChoice !== after.qtyMultiChoice) {
            fields.push({
              field: `recipes[${i}].qtyMultiChoice`,
              before: before.qtyMultiChoice,
              after: after.qtyMultiChoice,
            });
          }
          if (before.difficulty !== after.difficulty) {
            fields.push({
              field: `recipes[${i}].difficulty`,
              before: before.difficulty,
              after: after.difficulty,
            });
          }
          return fields;
        });

        await ref.collection('reviews').add({
          actor_id: ctx.uid,
          actor_name: ctx.email,
          actor_role: ctx.role,
          action: 'edited',
          comment: null,
          changes,
          created_at: now,
        });

        await writeAuditLog({
          actorId: ctx.uid,
          actorEmail: ctx.email,
          action: 'template.expert_edited',
          targetType: 'system',
          targetId: input.templateId,
          organizationId,
          metadata: { recipeCount: input.recipes.length, fieldCount: changes.length },
        });

        const afterSnap = await ref.get();
        return templateFromFirestore(input.templateId, afterSnap.data() as TemplateDocRaw);
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

import { randomUUID } from 'node:crypto';

import {
  createTemplateInputSchema,
  type CreateTemplateInput,
  type Template,
} from '@platform/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { recipesInputToFirestore } from './mapper.js';

// =============================================================================
// v1TemplatesCreate — Crear template (SDD-10 §7.2)
// =============================================================================
// Auth: admin. Estado inicial: 'draft'.
// OQ-1: el nombre debe ser único por (organizationId). Validamos via query
// antes del insert — si ya existe, devolvemos ALREADY_EXISTS.
// =============================================================================

export type CreateTemplateOutput = Template;

export const v1TemplatesCreate = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<CreateTemplateInput, CreateTemplateOutput>('admin', async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(createTemplateInputSchema, data);

      const db = getAdminDb();
      const organizationId = ctx.organizationId ?? 'org_default';
      const templatesCol = db
        .collection('organizations')
        .doc(organizationId)
        .collection('templates');

      // OQ-1: validar nombre único por organización.
      const existing = await templatesCol.where('name', '==', input.name).limit(1).get();
      if (!existing.empty) {
        throw new RepositoryError(
          'ALREADY_EXISTS',
          `Ya existe un template con nombre "${input.name}" en esta organización`,
        );
      }

      const templateId = randomUUID().replace(/-/g, '').slice(0, 32);
      const now = FieldValue.serverTimestamp();

      const docData = {
        organization_id: organizationId,
        name: input.name,
        description: input.description ?? null,
        niche: input.niche,
        time_limit_minutes: input.timeLimitMinutes,
        max_retries: input.maxRetries,
        recipes: recipesInputToFirestore(input.recipes),
        status: 'draft' as const,
        created_by: ctx.uid,
        created_by_role: ctx.role,
        created_at: now,
        updated_at: now,
        approved_by: null,
        approved_at: null,
        deleted_at: null,
      };
      await templatesCol.doc(templateId).set(docData);

      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'template.created',
        targetType: 'system',
        targetId: templateId,
        organizationId,
        metadata: { name: input.name, niche: input.niche, recipeCount: input.recipes.length },
      });

      const nowDate = new Date();
      return {
        templateId,
        organizationId,
        name: input.name,
        description: input.description,
        niche: input.niche,
        timeLimitMinutes: input.timeLimitMinutes,
        maxRetries: input.maxRetries,
        recipes: input.recipes.map((r, i) => ({
          recipeId: `r${i}`,
          competencyName: r.competencyName,
          competencyContext: r.competencyContext,
          qtyMultipleChoice: r.qtyMultipleChoice,
          qtyMultiChoice: r.qtyMultiChoice,
          difficulty: r.difficulty,
          topicsCovered: r.topicsCovered ?? [],
        })),
        status: 'draft' as const,
        createdBy: ctx.uid,
        createdByRole: ctx.role,
        createdAt: nowDate,
        updatedAt: nowDate,
        approvedBy: null,
        approvedAt: null,
        deletedAt: null,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      handleError(e);
    }
  }),
);

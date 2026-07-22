import type { ReviewEvent } from '@platform/shared';
import { canViewTemplate, reviewEventSchema } from '@platform/shared';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { templateFromFirestore, type TemplateDocRaw } from './mapper.js';

// =============================================================================
// v1TemplatesGetReviewHistory — Historial de review events (SDD-10 §7.2)
// =============================================================================
// Auth: admin, expert (cualquiera); recruiter (solo si template 'approved').
// Output: ReviewEvent[] ordenado por createdAt desc.
// =============================================================================

const getReviewHistoryInputSchema = z.object({
  templateId: z.string().min(1).max(32),
});
export type GetReviewHistoryInput = z.infer<typeof getReviewHistoryInputSchema>;

export type GetReviewHistoryOutput = ReviewEvent[];

interface ReviewEventRaw {
  actor_id: string;
  actor_name: string;
  actor_role: 'admin' | 'expert' | 'recruiter';
  action: string;
  comment: string | null;
  changes: { field: string; before: unknown; after: unknown }[] | null;
  created_at: { toDate: () => Date };
}

export const v1TemplatesGetReviewHistory = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<GetReviewHistoryInput, GetReviewHistoryOutput>(
    undefined,
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(getReviewHistoryInputSchema, data);

        const db = getAdminDb();
        const organizationId = ctx.organizationId ?? 'org_default';
        const ref = db
          .collection('organizations')
          .doc(organizationId)
          .collection('templates')
          .doc(input.templateId);

        const tplSnap = await ref.get();
        if (!tplSnap.exists) {
          return [];
        }
        const template = templateFromFirestore(input.templateId, tplSnap.data() as TemplateDocRaw);

        // Defense in depth.
        if (!canViewTemplate(template, ctx.role)) {
          return [];
        }

        const eventsSnap = await ref.collection('reviews').orderBy('created_at', 'desc').get();

        const events: ReviewEvent[] = eventsSnap.docs.map((d) => {
          const raw = d.data() as ReviewEventRaw;
          return reviewEventSchema.parse({
            reviewId: d.id,
            templateId: input.templateId,
            actorId: raw.actor_id,
            actorName: raw.actor_name,
            actorRole: raw.actor_role,
            action: raw.action,
            comment: raw.comment ?? undefined,
            changes: raw.changes ?? undefined,
            createdAt: raw.created_at.toDate(),
          });
        });

        return events;
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

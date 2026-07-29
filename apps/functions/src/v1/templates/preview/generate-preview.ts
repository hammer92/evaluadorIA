import {
  type GeneratePreviewInput,
  MAX_REGENERATIONS_PER_HOUR,
  PREVIEW_DOC_ID,
  REGENERATION_WINDOW_MS,
  generatePreviewInputSchema,
  type TemplatePreview,
  templatePreviewSchema,
} from '@platform/shared';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';


import { ALLOWED_ORIGINS_DEPLOY } from '../../../deploy-config.js';
import { getAdminDb } from '../../../firebase-admin.js';
import { writeAuditLog } from '../../../shared/audit.js';
import { RepositoryError } from '../../../shared/errors.js';
import { generateQuestionsForPreview } from '../../../shared/generator-client.js';
import { handleError } from '../../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../../shared/on-call-auth.js';
import { validateInput } from '../../../shared/validate-input.js';
import { type TemplateDocRaw, templateFromFirestore } from '../mapper.js';

// =============================================================================
// v1_template_preview_generate — SDD-11 §4.1
// =============================================================================
// Auth: admin o expert. Misma org que el template.
// Pre-condiciones:
//   - Template existe (NOT_FOUND si no)
//   - Recipe tiene qtyMultipleChoice + qtyMultiChoice >= 1 (FAILED_PRECONDITION)
//   - Rate limit 5/h/user/template no excedido (FAILED_PRECONDITION)
// Si existe cache válido (recipeUpdatedAt matchea) y !forceRegenerate: retorna el cache.
// Si no: llama generator, persiste, incrementa rate counter.
// =============================================================================

async function readTemplateRaw(
  organizationId: string,
  templateId: string,
): Promise<TemplateDocRaw> {
  const db = getAdminDb();
  const ref = db
    .collection('organizations')
    .doc(organizationId)
    .collection('templates')
    .doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new RepositoryError('NOT_FOUND', `Template ${templateId} no existe`);
  }
  return snap.data() as TemplateDocRaw;
}

async function checkRateLimit(
  templateRef: FirebaseFirestore.DocumentReference,
  uid: string,
  now: Date,
): Promise<void> {
  const rateRef = templateRef.collection('previewRegenerations').doc(uid);
  const rateSnap = await rateRef.get();
  if (rateSnap.exists) {
    const data = rateSnap.data() as { windowStart?: { toDate: () => Date }; count?: number };
    const windowStart = data.windowStart?.toDate() ?? new Date(0);
    const ageMs = now.getTime() - windowStart.getTime();
    if (ageMs < REGENERATION_WINDOW_MS) {
      const count = data.count ?? 0;
      if (count >= MAX_REGENERATIONS_PER_HOUR) {
        const minutesLeft = Math.ceil((REGENERATION_WINDOW_MS - ageMs) / (60 * 1000));
        throw new HttpsError(
          'failed-precondition',
          `Límite de regeneraciones alcanzado. Próxima en ${minutesLeft} minutos.`,
        );
      }
    } else {
      await rateRef.set({ windowStart: Timestamp.fromDate(now), count: 0 });
    }
  } else {
    await rateRef.set({ windowStart: Timestamp.fromDate(now), count: 0 });
  }
}

async function readCachedPreview(
  templateRef: FirebaseFirestore.DocumentReference,
  templateUpdatedAt: string,
): Promise<{ preview: TemplatePreview | null; isStale: boolean }> {
  const snap = await templateRef.collection('previewQuestions').doc(PREVIEW_DOC_ID).get();
  if (!snap.exists) return { preview: null, isStale: true };
  const raw = snap.data() as Record<string, unknown>;
  const generatedAt = (raw['generatedAt'] as { toDate: () => Date } | undefined)?.toDate?.();
  const recipeUpdatedAt = (
    (raw['recipeSnapshot'] as Record<string, unknown> | undefined)?.['recipeUpdatedAt'] as
      | { toDate: () => Date }
      | undefined
  )?.toDate?.();
  const preview = templatePreviewSchema.parse({
    ...raw,
    generatedAt: generatedAt ? generatedAt.toISOString() : raw['generatedAt'],
    recipeSnapshot: {
      ...((raw['recipeSnapshot'] as Record<string, unknown>) ?? {}),
      recipeUpdatedAt: recipeUpdatedAt ? recipeUpdatedAt.toISOString() : raw['recipeUpdatedAt'],
    },
  });
  return {
    preview,
    isStale: preview.recipeSnapshot.recipeUpdatedAt !== templateUpdatedAt,
  };
}

export const v1TemplatePreviewGenerate = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
    // 5 min — 4 recipes en paralelo con Gemini Flash demoran ~30-45s;
    // serial era 120s y rompía el default de 60s. Parallelizamos dentro
    // y damos margen.
    timeoutSeconds: 300,
  },
  withAuth<GeneratePreviewInput, TemplatePreview>(
    ['admin', 'expert'],
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(generatePreviewInputSchema, data);
        const db = getAdminDb();
        const organizationId = ctx.organizationId ?? 'org_default';
        const templateRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('templates')
          .doc(input.templateId);

        const raw = await readTemplateRaw(organizationId, input.templateId);
        const template = templateFromFirestore(input.templateId, raw);
        const templateUpdatedAt = raw.updated_at
          ? (raw.updated_at).toDate().toISOString()
          : new Date(0).toISOString();

        if (template.recipes.length === 0) {
          throw new RepositoryError(
            'VALIDATION',
            'El template no tiene recetas para previsualizar.',
          );
        }

        const now = new Date();
        await checkRateLimit(templateRef, ctx.uid, now);

        if (!input.forceRegenerate) {
          const cached = await readCachedPreview(templateRef, templateUpdatedAt);
          if (cached.preview && !cached.isStale) {
            return cached.preview;
          }
        }

        const generatorOutput = await generateQuestionsForPreview(template);
        const preview = templatePreviewSchema.parse({
          previewId: PREVIEW_DOC_ID,
          templateId: input.templateId,
          recipeSnapshot: {
            name: template.name,
            niche: template.niche,
            recipes: template.recipes,
            recipeUpdatedAt: templateUpdatedAt,
          },
          questions: generatorOutput.questions,
          generatedAt: now.toISOString(),
          generatedBy: {
            uid: ctx.uid,
            name: ctx.email,
            role: ctx.role,
          },
          modelVersion: 'gpt-4o-2024-08-06',
          promptVersion: 'generator/v1.0',
          totalRequested: generatorOutput.totalRequested,
          totalGenerated: generatorOutput.totalGenerated,
          totalFlagged: generatorOutput.totalFlagged,
          refusal: generatorOutput.refusal,
          isValid: true,
        });

        await templateRef
          .collection('previewQuestions')
          .doc(PREVIEW_DOC_ID)
          .set({
            ...preview,
            generatedAt: Timestamp.fromDate(now),
            recipeSnapshot: {
              ...preview.recipeSnapshot,
              recipeUpdatedAt: Timestamp.fromDate(new Date(templateUpdatedAt)),
            },
          });

        await templateRef
          .collection('previewRegenerations')
          .doc(ctx.uid)
          .set({ windowStart: Timestamp.fromDate(now), count: FieldValue.increment(1) }, { merge: true });

        await writeAuditLog({
          actorId: ctx.uid,
          actorEmail: ctx.email,
          action: 'template.preview_generated',
          targetType: 'template',
          targetId: input.templateId,
          organizationId,
          metadata: {
            modelVersion: preview.modelVersion,
            promptVersion: preview.promptVersion,
            totalQuestions: preview.totalGenerated,
            totalFlagged: preview.totalFlagged,
            wasRefusal: preview.refusal !== null,
          },
        });

        return preview;
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

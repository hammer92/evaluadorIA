import {
  type RecordAnswersInput,
  type RecordAnswersOutput,
  type TemplatePreview,
  type PreviewQuestion,
  PREVIEW_DOC_ID,
  recordAnswersInputSchema,
} from '@platform/shared';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';


import { ALLOWED_ORIGINS_DEPLOY } from '../../../deploy-config.js';
import { getAdminDb } from '../../../firebase-admin.js';
import { writeAuditLog } from '../../../shared/audit.js';
import { handleError } from '../../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../../shared/on-call-auth.js';
import { validateInput } from '../../../shared/validate-input.js';

// =============================================================================
// v1_template_preview_answered — SDD-11 §4.1
// =============================================================================
// Auth: admin o expert. Misma org que el template.
// Registra las respuestas del reviewer en una simulación.
// Output: score (% correctas), total, correct, y perQuestion con missedBecause.
// Side effect: escribe previewSessions + audit log.
// =============================================================================

function evaluateAnswers(
  preview: TemplatePreview,
  answers: RecordAnswersInput['answers'],
): RecordAnswersOutput {
  const byId = new Map<string, PreviewQuestion>(preview.questions.map((q) => [q.questionId, q]));
  const perQuestion: RecordAnswersOutput['perQuestion'] = [];
  let correct = 0;

  for (const answer of answers) {
    const q = byId.get(answer.questionId);
    if (!q) continue;
    const expected = new Set(q.correctOptionIds);
    const selected = new Set(answer.selectedOptionIds);
    const isMatch = expected.size === selected.size && [...expected].every((id) => selected.has(id));
    if (isMatch) correct++;

    let missedBecause: string | null = null;
    if (!isMatch) {
      const expectedIds = q.correctOptionIds.join(',');
      const selectedIds = answer.selectedOptionIds.join(',');
      missedBecause = `Esperaba ${expectedIds.toUpperCase()}, marcaste ${selectedIds.toUpperCase()}`;
    }

    perQuestion.push({
      questionId: answer.questionId,
      correct: isMatch,
      missedBecause,
    });
  }

  const total = perQuestion.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, total, correct, perQuestion };
}

export const v1TemplatePreviewAnswered = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<RecordAnswersInput, RecordAnswersOutput>(
    ['admin', 'expert'],
    async (ctx: AuthedContext, data) => {
      try {
        const input = validateInput(recordAnswersInputSchema, data);
        const db = getAdminDb();
        const organizationId = ctx.organizationId ?? 'org_default';
        const templateRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('templates')
          .doc(input.templateId);

        const previewSnap = await templateRef
          .collection('previewQuestions')
          .doc(PREVIEW_DOC_ID)
          .get();
        if (!previewSnap.exists) {
          throw new Error(`Preview ${input.previewId} no existe`);
        }
        const preview = previewSnap.data() as TemplatePreview;

        const result = evaluateAnswers(preview, input.answers);

        await templateRef.collection('previewSessions').add({
          uid: ctx.uid,
          email: ctx.email,
          role: ctx.role,
          previewId: preview.previewId,
          templateId: preview.templateId,
          score: result.score,
          total: result.total,
          correct: result.correct,
          perQuestion: result.perQuestion,
          durationMs: input.answers.reduce((sum, a) => sum + a.timeSpentMs, 0),
          createdAt: FieldValue.serverTimestamp(),
          createdAtServer: Timestamp.now(),
        });

        await writeAuditLog({
          actorId: ctx.uid,
          actorEmail: ctx.email,
          action: 'template.preview_answered',
          targetType: 'template',
          targetId: input.templateId,
          organizationId,
          metadata: {
            previewId: input.previewId,
            score: result.score,
            correct: result.correct,
            total: result.total,
          },
        });

        return result;
      } catch (e) {
        handleError(e);
      }
    },
  ),
);

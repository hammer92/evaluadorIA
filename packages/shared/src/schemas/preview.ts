import { z } from 'zod';

import { difficultySchema, nicheSchema, recipeSchema } from './templates.js';

// =============================================================================
// Preview schema — SDD-11 (Template Preview & Simulator)
// =============================================================================
// Sub-colección `templates/{templateId}/previewQuestions/{previewId}`.
// Cache del output del Generator Agent (SDD-G01) para que admin/expert
// puedan validar la calidad de las preguntas antes de aprobar el template.
// Mensajes en español por convención del proyecto (ADR-0004).
// =============================================================================

// =============================================================================
// PRIMITIVOS REUTILIZABLES
// =============================================================================

export const previewOptionIdSchema = z.string().min(1).max(4);
export type PreviewOptionId = z.infer<typeof previewOptionIdSchema>;

export const previewQuestionTypeSchema = z.enum(['single_answer', 'multi_answer']);
export type PreviewQuestionType = z.infer<typeof previewQuestionTypeSchema>;

// =============================================================================
// PREVIEW QUESTION (subset del output del Generator)
// =============================================================================

export const previewOptionSchema = z.object({
  id: previewOptionIdSchema,
  text: z.string().min(5, 'Texto muy corto').max(500, 'Máximo 500 caracteres'),
});
export type PreviewOption = z.infer<typeof previewOptionSchema>;

export const previewFeedbackSchema = z.object({
  optionId: previewOptionIdSchema,
  isCorrect: z.boolean(),
  feedback: z.string().min(50, 'El feedback debe tener al menos 50 caracteres').max(800),
  rationale: z.string().max(500).nullable(),
});
export type PreviewFeedback = z.infer<typeof previewFeedbackSchema>;

export const previewSelfAssessmentSchema = z.object({
  estimatedDifficulty: difficultySchema,
  confidence: z.number().min(0).max(1),
  flagForReview: z.boolean(),
  flagReason: z.string().max(300, 'Máximo 300 caracteres').nullable(),
});
export type PreviewSelfAssessment = z.infer<typeof previewSelfAssessmentSchema>;

export const previewQuestionSchema = z.object({
  questionId: z.string().min(1).max(64),
  type: previewQuestionTypeSchema,
  stem: z.string().min(20, 'El enunciado debe tener al menos 20 caracteres').max(1000),
  context: z.string().max(1500).nullable(),
  options: z.array(previewOptionSchema).min(4, 'Mínimo 4 opciones').max(6, 'Máximo 6 opciones'),
  correctOptionIds: z.array(previewOptionIdSchema).min(1, 'Al menos 1 respuesta correcta'),
  feedbackPerOption: z
    .array(previewFeedbackSchema)
    .min(1, 'Cada opción debe tener feedback asociado'),
  competencyId: z.string().min(1).max(64),
  niche: nicheSchema,
  difficulty: difficultySchema,
  topicsCovered: z.array(z.string().max(80)).max(20),
  selfAssessment: previewSelfAssessmentSchema,
  metadata: z.object({
    modelVersion: z.string().min(1),
    promptVersion: z.string().min(1),
    generatedAt: z.string().min(1),
    previewMode: z.literal(true),
  }),
});
export type PreviewQuestion = z.infer<typeof previewQuestionSchema>;

// =============================================================================
// REFUSAL (cuándo el Generator rechaza la receta)
// =============================================================================

export const previewRefusalSchema = z.object({
  refused: z.literal(true),
  reason: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
});
export type PreviewRefusal = z.infer<typeof previewRefusalSchema>;

// =============================================================================
// TEMPLATE PREVIEW (snapshot de una generación)
// =============================================================================
// Reglas de validación:
// - `previewId` siempre es 'pv_latest' (sobrescribimos al regenerar).
// - `recipeSnapshot.recipeUpdatedAt` actúa como clave de invalidation.
// - `isValid` se computa en runtime contra `template.updatedAt`.
// =============================================================================

export const recipeSnapshotSchema = z.object({
  name: z.string().min(1).max(120),
  niche: nicheSchema,
  recipes: z.array(recipeSchema).min(1),
  recipeUpdatedAt: z.string().min(1),
});
export type RecipeSnapshot = z.infer<typeof recipeSnapshotSchema>;

export const templatePreviewSchema = z.object({
  previewId: z.string().min(1).max(64),
  templateId: z.string().min(1).max(64),

  recipeSnapshot: recipeSnapshotSchema,

  questions: z.array(previewQuestionSchema),

  generatedAt: z.string().min(1),
  generatedBy: z.object({
    uid: z.string().min(1),
    name: z.string().min(1).max(120),
    role: z.enum(['admin', 'expert']),
  }),

  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),

  totalRequested: z.number().int().min(0),
  totalGenerated: z.number().int().min(0),
  totalFlagged: z.number().int().min(0),

  refusal: previewRefusalSchema.nullable(),

  isValid: z.boolean(),
});
export type TemplatePreview = z.infer<typeof templatePreviewSchema>;

// Input para `generate-preview` (request body).
export const generatePreviewInputSchema = z.object({
  templateId: z.string().min(1, 'templateId requerido').max(64),
  forceRegenerate: z.boolean().default(false),
});
export type GeneratePreviewInput = z.input<typeof generatePreviewInputSchema>;

export const getPreviewInputSchema = z.object({
  templateId: z.string().min(1, 'templateId requerido').max(64),
});
export type GetPreviewInput = z.input<typeof getPreviewInputSchema>;

export const getPreviewOutputSchema = z.object({
  preview: templatePreviewSchema.nullable(),
  isStale: z.boolean(),
  message: z.string().nullable(),
});
export type GetPreviewOutput = z.infer<typeof getPreviewOutputSchema>;

// =============================================================================
// PREVIEW ANSWERED (analytics secundario)
// =============================================================================

export const previewAnswerItemSchema = z.object({
  questionId: z.string().min(1).max(64),
  selectedOptionIds: z.array(previewOptionIdSchema).min(1),
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(1000 * 60 * 60),
});
export type PreviewAnswerItem = z.infer<typeof previewAnswerItemSchema>;

export const recordAnswersInputSchema = z.object({
  templateId: z.string().min(1).max(64),
  previewId: z.string().min(1).max(64),
  answers: z.array(previewAnswerItemSchema).min(1),
});
export type RecordAnswersInput = z.input<typeof recordAnswersInputSchema>;

export const previewAnswerResultSchema = z.object({
  questionId: z.string(),
  correct: z.boolean(),
  missedBecause: z.string().nullable(),
});
export type PreviewAnswerResult = z.infer<typeof previewAnswerResultSchema>;

export const recordAnswersOutputSchema = z.object({
  score: z.number().min(0).max(100),
  total: z.number().int().min(0),
  correct: z.number().int().min(0),
  perQuestion: z.array(previewAnswerResultSchema),
});
export type RecordAnswersOutput = z.infer<typeof recordAnswersOutputSchema>;

// =============================================================================
// RATE LIMIT TRACKER
// =============================================================================

export const previewRegenerationTrackerSchema = z.object({
  templateId: z.string().min(1),
  userId: z.string().min(1),
  windowStart: z.string().min(1),
  count: z.number().int().min(0),
});
export type PreviewRegenerationTracker = z.infer<typeof previewRegenerationTrackerSchema>;

export const MAX_REGENERATIONS_PER_HOUR = 5;
export const REGENERATION_WINDOW_MS = 60 * 60 * 1000;
export const PREVIEW_DOC_ID = 'pv_latest';

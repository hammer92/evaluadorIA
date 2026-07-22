import { z } from 'zod';

import { roleSchema } from './common.js';

// =============================================================================
// Templates schema — SDD-10
// =============================================================================
// Modelo público (TS/UI): camelCase. Firestore almacena snake_case — el
// mapeo se hace en el repository (ver `apps/functions/src/v1/templates/`).
// =============================================================================
// Mensajes en español por convención del proyecto (ADR-0004).
// =============================================================================

// =============================================================================
// PRIMITIVOS REUTILIZABLES
// =============================================================================

export const nicheSchema = z.enum(['school', 'university', 'exam_practice']);
// Phase 2+ (SDD-G07): agregar 'code' (ver SDD-G01 §5.7).
// export const nicheSchema = z.enum(['school', 'university', 'exam_practice', 'code']);
export type Niche = z.infer<typeof nicheSchema>;

export const NICHE_LABELS: Record<Niche, string> = {
  school: 'Escolar (9°–11°)',
  university: 'Universitario',
  exam_practice: 'Simulacro de examen estandarizado',
  // Phase 2+: code: 'Programación',
};

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Medio',
  hard: 'Difícil',
};

export const templateStatusSchema = z.enum([
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
]);
export type TemplateStatus = z.infer<typeof templateStatusSchema>;

export const STATUS_LABELS: Record<TemplateStatus, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  changes_requested: 'Cambios solicitados',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export const STATUS_COLORS: Record<TemplateStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  in_review: 'bg-blue-100 text-blue-700 border-blue-300',
  changes_requested: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
};

// =============================================================================
// RECIPE (sub-documento)
// =============================================================================

export const topicSchema = z.string().min(2).max(80);

// Schema base sin refine — usado por `.omit()` en recipeInputSchema.
export const recipeSchemaBase = z.object({
  recipeId: z.string().min(1).max(32),
  competencyName: z
    .string()
    .min(2, 'El nombre de la competencia debe tener al menos 2 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  competencyContext: z
    .string()
    .min(20, 'El contexto para la IA debe tener al menos 20 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
  qtyMultipleChoice: z
    .number()
    .int()
    .min(0, 'Mínimo 0')
    .max(20, 'Máximo 20 preguntas de única respuesta'),
  qtyMultiChoice: z
    .number()
    .int()
    .min(0, 'Mínimo 0')
    .max(20, 'Máximo 20 preguntas de múltiple respuesta'),
  // Phase 2+ (SDD-G07): agregar qtyCodeAnswer para el nicho 'code'.
  // qtyCodeAnswer: z.number().int().min(0).max(20).default(0),
  difficulty: difficultySchema,
  topicsCovered: z.array(topicSchema).max(20).default([]),
});

// RecipeSchema con la business rule aplicada (SDD §4.2).
// `.refine()` retorna ZodEffects, por eso derivamos recipeInputSchema desde
// recipeSchemaBase (sin refine) y re-aplicamos el refine manualmente.
export const recipeSchema = recipeSchemaBase.refine(
  (r) => r.qtyMultipleChoice + r.qtyMultiChoice >= 1,
  {
    message: 'La receta debe solicitar al menos 1 pregunta en total',
    path: ['qtyMultipleChoice'],
  },
);
export type Recipe = z.infer<typeof recipeSchema>;

// Helper para input de recipe (sin recipeId, se genera server-side).
export const recipeInputSchema = recipeSchemaBase
  .omit({ recipeId: true })
  .refine((r) => r.qtyMultipleChoice + r.qtyMultiChoice >= 1, {
    message: 'La receta debe solicitar al menos 1 pregunta en total',
    path: ['qtyMultipleChoice'],
  });
export type RecipeInput = z.infer<typeof recipeInputSchema>;

// =============================================================================
// TEMPLATE (documento principal)
// =============================================================================
//
// OQ-1 (decidido): `name` debe ser único por `organizationId`. La unicidad
// se valida en el Cloud Function `v1_templates_create` via query a Firestore
// (índice compuesto `(organization_id, name)` en `firestore.indexes.json`).
// Si dos admins crean el mismo nombre en paralelo, el segundo falla con
// `already-exists`. Zod no puede validar unicidad cross-doc — eso es
// responsabilidad de la capa de persistencia.
// =============================================================================

export const templateSchema = z.object({
  templateId: z.string().min(1).max(32),
  organizationId: z.string().min(1),

  // Datos básicos
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  niche: nicheSchema,
  timeLimitMinutes: z
    .number()
    .int()
    .min(5, 'Mínimo 5 minutos')
    .max(240, 'Máximo 240 minutos (4 horas)'),
  maxRetries: z.number().int().min(0, 'Mínimo 0 reintentos').max(5, 'Máximo 5 reintentos'),

  // Recetas
  recipes: z
    .array(recipeSchema)
    .min(1, 'El template debe tener al menos 1 receta')
    .max(20, 'Máximo 20 recetas por template'),

  // Workflow state
  status: templateStatusSchema,
  createdBy: z.string().min(1),
  createdByRole: roleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  approvedBy: z.string().nullable(),
  approvedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});
export type Template = z.infer<typeof templateSchema>;

// Input para CREAR (omite campos auto-generados)
export const createTemplateInputSchema = templateSchema
  .omit({
    templateId: true,
    status: true,
    createdBy: true,
    createdByRole: true,
    createdAt: true,
    updatedAt: true,
    approvedBy: true,
    approvedAt: true,
    deletedAt: true,
  })
  .extend({
    recipes: z.array(recipeInputSchema).min(1).max(20),
  });
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;

// Input para EDITAR (admin, en draft | changes_requested)
export const updateTemplateInputSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(3).max(120).optional(),
  description: z.string().max(500).optional(),
  niche: nicheSchema.optional(),
  timeLimitMinutes: z.number().int().min(5).max(240).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  recipes: z.array(recipeInputSchema).min(1).max(20).optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;

// Input que el EXPERT puede editar durante in_review (solo params técnicos)
// Refleja OQ-2: el expert NO edita name/description directamente. Si quiere
// sugerir cambios, lo hace via comment en `TransitionInput.comment` (ver OQ-2
// en aidlc-docs/inception/requirements/requirements-sdd10.md §3).
export const expertEditInputSchema = z.object({
  templateId: z.string().min(1),
  recipes: z
    .array(
      z.object({
        recipeId: z.string().min(1),
        competencyContext: z.string().min(20).max(2000).optional(),
        qtyMultipleChoice: z.number().int().min(0).max(20).optional(),
        qtyMultiChoice: z.number().int().min(0).max(20).optional(),
        difficulty: difficultySchema.optional(),
        topicsCovered: z.array(topicSchema).max(20).optional(),
      }),
    )
    .optional(),
});
export type ExpertEditInput = z.infer<typeof expertEditInputSchema>;

// =============================================================================
// REVIEW EVENT (sub-documento)
// =============================================================================

export const reviewActionSchema = z.enum([
  'submitted',
  'approved',
  'rejected',
  'changes_requested',
  'edited',
  'resubmitted',
  'reopened',
]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  submitted: 'Enviado a revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  changes_requested: 'Cambios solicitados',
  edited: 'Editado',
  resubmitted: 'Reenviado a revisión',
  reopened: 'Reabierto como borrador',
};

export const fieldChangeSchema = z.object({
  field: z.string(), // ej. "recipes[0].qtyMultipleChoice"
  before: z.unknown(),
  after: z.unknown(),
});
export type FieldChange = z.infer<typeof fieldChangeSchema>;

export const reviewEventSchema = z.object({
  reviewId: z.string().min(1).max(32),
  templateId: z.string().min(1),
  actorId: z.string().min(1),
  actorName: z.string().min(1).max(120),
  actorRole: roleSchema,
  action: reviewActionSchema,
  // OQ-2: el comment puede contener sugerencias del expert (max 2000 chars).
  comment: z.string().max(2000).optional(),
  changes: z.array(fieldChangeSchema).optional(),
  createdAt: z.date(),
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

// Input para CREAR un review event
export const createReviewEventInputSchema = reviewEventSchema.omit({
  reviewId: true,
  createdAt: true,
});
export type CreateReviewEventInput = z.infer<typeof createReviewEventInputSchema>;

// =============================================================================
// TRANSITION (state machine input)
// =============================================================================
//
// OQ-6 (decidido, DESVIACIÓN del SDD §18): soft check defensivo desde v1.
// En `v1_templates_transition` cuando toStatus === 'approved' y role ===
// 'expert', validar `actorId !== template.createdBy`. Aunque hoy solo admin
// puede crear, el check previene regresiones si el role rules cambia en v2.
// =============================================================================

export const transitionInputSchema = z
  .object({
    templateId: z.string().min(1),
    toStatus: templateStatusSchema,
    // OQ-2: comment puede contener sugerencias. Requerido por
    // `request_changes` y `reject` (validado en state-machine.ts).
    comment: z.string().max(2000).optional(),
    changes: z.array(fieldChangeSchema).optional(),
  })
  .refine((t) => t.toStatus !== 'draft', {
    message: 'Transición a draft no permitida vía este endpoint',
  });
export type TransitionInput = z.infer<typeof transitionInputSchema>;

// =============================================================================
// LIST FILTERS
// =============================================================================

export const listTemplatesInputSchema = z.object({
  status: templateStatusSchema.optional(),
  niche: nicheSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListTemplatesInput = z.infer<typeof listTemplatesInputSchema>;

export const listTemplatesResultSchema = z.object({
  items: z.array(templateSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
});
export type ListTemplatesResult = z.infer<typeof listTemplatesResultSchema>;

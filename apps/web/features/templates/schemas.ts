import { nicheSchema, templateStatusSchema } from '@shared/schemas/templates';
import { z } from 'zod';

// =============================================================================
// Templates UI schemas (SDD-10 Fase 2 UI)
// =============================================================================
// UI-only filters + helpers. Domain types come from `@shared/schemas/templates`
// (single source of truth between web and functions).
// =============================================================================

// Filtros del listado. Todos los campos son opcionales; `page` y `pageSize`
// tienen defaults seguros.
export const templateFiltersSchema = z.object({
  status: templateStatusSchema.optional().or(z.literal('all')),
  niche: nicheSchema.optional().or(z.literal('all')),
  createdBy: z.string().max(120).optional(),
  search: z.string().max(100).optional(),
  from: z.string().datetime().optional(), // ISO date
  to: z.string().datetime().optional(), // ISO date
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type TemplateFilters = z.infer<typeof templateFiltersSchema>;

export const defaultTemplateFilters: TemplateFilters = {
  status: 'all',
  niche: 'all',
  createdBy: '',
  search: '',
  page: 1,
  pageSize: 20,
};

// Inputs derivados (UI-side validation, RHF resolver). El server-side
// re-valida con los schemas oficiales de `@shared/schemas/templates`.
export const recipeFormSchema = z
  .object({
    recipeId: z.string().optional(), // omit en create, presente en edit
    competencyName: z
      .string()
      .min(2, 'El nombre de la competencia debe tener al menos 2 caracteres')
      .max(120, 'Máximo 120 caracteres'),
    competencyContext: z
      .string()
      .min(20, 'El contexto para la IA debe tener al menos 20 caracteres')
      .max(2000, 'Máximo 2000 caracteres'),
    qtyMultipleChoice: z.number().int().min(0).max(20),
    qtyMultiChoice: z.number().int().min(0).max(20),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    topicsCovered: z.array(z.string().min(2).max(80)).max(20).default([]),
  })
  .refine((r) => r.qtyMultipleChoice + r.qtyMultiChoice >= 1, {
    message: 'La receta debe solicitar al menos 1 pregunta en total',
    path: ['qtyMultipleChoice'],
  });
export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

export const templateFormSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  niche: nicheSchema,
  timeLimitMinutes: z.number().int().min(5, 'Mínimo 5 minutos').max(240, 'Máximo 240 minutos'),
  maxRetries: z.number().int().min(0).max(5),
  recipes: z.array(recipeFormSchema).min(1, 'El template debe tener al menos 1 receta').max(20),
});
export type TemplateFormValues = z.infer<typeof templateFormSchema>;

export const expertEditFormSchema = z.object({
  templateId: z.string().min(1),
  comment: z.string().max(2000).optional(),
  recipes: z
    .array(
      z.object({
        recipeId: z.string().min(1),
        competencyContext: z.string().min(20).max(2000).optional(),
        qtyMultipleChoice: z.number().int().min(0).max(20).optional(),
        qtyMultiChoice: z.number().int().min(0).max(20).optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        topicsCovered: z.array(z.string().min(2).max(80)).max(20).optional(),
      }),
    )
    .optional(),
});
export type ExpertEditFormValues = z.infer<typeof expertEditFormSchema>;

export const transitionFormSchema = z.object({
  templateId: z.string().min(1),
  action: z.enum(['submit', 'approve', 'reject', 'request_changes', 'reopen']),
  comment: z.string().max(2000).optional(),
});
export type TransitionFormValues = z.infer<typeof transitionFormSchema>;

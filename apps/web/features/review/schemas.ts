import { nicheSchema } from '@shared/schemas/templates';
import { z } from 'zod';

// =============================================================================
// Review UI schemas (SDD-10 Fase 2 UI — PR-2)
// =============================================================================
// UI-only filters + form schemas. Domain types y state machine vienen de
// `@shared/schemas/templates` (single source of truth).
//
// Reglas de negocio aplicadas:
// - comment REQUERIDO (10-2000 chars) para reject y request_changes (ver
//   `state-machine.ts` server-side validation, OQ-2 en requirements-sdd10).
// - action enum alineado con transitionTemplate API wrapper.
// =============================================================================

// Review queue filters — solo templates en status 'in_review' por default.
// `page`/`pageSize` siguen el patrón de templates (1..100).
export const reviewQueueFiltersSchema = z.object({
  status: z.enum(['in_review']).default('in_review'), // Fijo por ahora; futuro: soporte multi-status (e.g. 'changes_requested' para histórico).
  niche: nicheSchema.optional().or(z.literal('all')),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ReviewQueueFilters = z.infer<typeof reviewQueueFiltersSchema>;

export const defaultReviewQueueFilters: ReviewQueueFilters = {
  status: 'in_review',
  niche: 'all',
  search: '',
  page: 1,
  pageSize: 20,
};

// Review decision form — usado por ReviewDecisionPanel.
// Discriminated union via refine: comment es opcional para 'approve', requerido
// (10-2000 chars) para 'request_changes' y 'reject'. Ver OQ-2.
const baseDecisionFields = z.object({
  templateId: z.string().min(1, 'templateId requerido'),
  action: z.enum(['approve', 'request_changes', 'reject']),
  comment: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
});

export const reviewDecisionFormSchema = baseDecisionFields.refine(
  (data) => {
    if (data.action === 'request_changes' || data.action === 'reject') {
      return typeof data.comment === 'string' && data.comment.trim().length >= 10;
    }
    return true;
  },
  {
    message: 'El comentario debe tener al menos 10 caracteres',
    path: ['comment'],
  },
);
export type ReviewDecisionFormValues = z.infer<typeof reviewDecisionFormSchema>;

// Re-export transition schema for convenience (no duplicar).
export { transitionFormSchema, expertEditFormSchema } from '../templates/schemas';
export type { TransitionFormValues, ExpertEditFormValues } from '../templates/schemas';

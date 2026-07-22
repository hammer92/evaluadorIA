import type { Template } from '@shared/schemas/templates';

import {
  expertEditTemplate,
  listTemplates,
  transitionTemplate,
  type ExpertEditInput,
  type ListTemplatesFilters,
  type ListTemplatesResult,
  type TransitionInput,
} from '@/features/templates/api/templates-api';

// =============================================================================
// Review API (cliente) — wrappers semánticos sobre templates-api.
// =============================================================================
// Sigue el patrón establecido en `features/users/api/users-api.ts` y
// `features/templates/api/templates-api.ts`:
//   - thin wrappers sobre httpsCallable
//   - el cliente incluye el Firebase Auth ID token automáticamente
//   - las CFs verifican el token + extraen role/claims via buildAuthContext()
// =============================================================================
//
// Decisión de diseño: NO duplicamos wrappers — reusamos los de templates-api
// y exponemos wrappers semánticos por action de review (approve/requestChanges/
// reject/submitForReview/reopen) para que la UI tenga nombres legibles y los
// tests mockeen por nombre de intención.
// =============================================================================

// ---------- Queue ----------

export interface ListReviewQueueFilters {
  niche?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export function listReviewQueue(filters: ListReviewQueueFilters): Promise<ListTemplatesResult> {
  const args: ListTemplatesFilters = {
    status: 'in_review', // Fijo por ahora (futuro: soporte multi-status para histórico).
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (filters.niche && filters.niche !== 'all') args.niche = filters.niche;
  if (filters.search && filters.search.length > 0) args.search = filters.search;
  return listTemplates(args);
}

// ---------- Review action wrappers ----------

function buildTransition(
  templateId: string,
  action: TransitionInput['action'],
  comment?: string,
): TransitionInput {
  return comment !== undefined ? { templateId, action, comment } : { templateId, action };
}

export function submitForReview(input: {
  templateId: string;
  comment?: string;
}): Promise<Template> {
  return transitionTemplate(buildTransition(input.templateId, 'submit', input.comment));
}

export function approveTemplate(input: {
  templateId: string;
  comment?: string;
}): Promise<Template> {
  return transitionTemplate(buildTransition(input.templateId, 'approve', input.comment));
}

export function requestChanges(input: { templateId: string; comment: string }): Promise<Template> {
  return transitionTemplate(buildTransition(input.templateId, 'request_changes', input.comment));
}

export function rejectTemplate(input: { templateId: string; comment: string }): Promise<Template> {
  return transitionTemplate(buildTransition(input.templateId, 'reject', input.comment));
}

export function reopenTemplate(input: { templateId: string; comment?: string }): Promise<Template> {
  return transitionTemplate(buildTransition(input.templateId, 'reopen', input.comment));
}

// Expert edit + approve en una sola acción (admin en in_review).
// Llama v1TemplatesExpertEdit primero; el caller debe chainear con
// approveTemplate después si quiere transicionar a approved.
export function expertEditTemplateForReview(
  input: Omit<ExpertEditInput, 'templateId'> & { templateId: string },
): Promise<Template> {
  return expertEditTemplate(input);
}

// Re-exports convenientes para consumers.
export type { TransitionInput, ExpertEditInput };

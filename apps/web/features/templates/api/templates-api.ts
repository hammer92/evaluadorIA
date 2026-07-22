import type {
  CreateTemplateInput,
  RecipeInput,
  Template,
  UpdateTemplateInput,
} from '@shared/schemas/templates';

import { functions, httpsCallable } from '@/lib/firebase/auth';

// =============================================================================
// Templates API (cliente) — llama a Cloud Functions callable via httpsCallable.
// =============================================================================
// Sigue el patrón establecido en `features/users/api/users-api.ts`.
// El cliente incluye el Firebase Auth ID token automáticamente; las CFs
// verifican el token + extraen role/claims via buildAuthContext().
// =============================================================================

function unwrapData<T>(p: Promise<{ data: T }>): Promise<T> {
  return p.then((r) => r.data);
}

export interface ListTemplatesFilters {
  status?: string;
  niche?: string;
  createdBy?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface ListTemplatesResult {
  items: Template[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ReviewHistoryResult {
  templateId: string;
  events: {
    reviewId: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    comment?: string;
    changes?: { field: string; before: unknown; after: unknown }[];
    createdAt: string;
  }[];
}

export function listTemplates(filters: ListTemplatesFilters): Promise<ListTemplatesResult> {
  const fn = httpsCallable<ListTemplatesFilters, ListTemplatesResult>(functions, 'v1TemplatesList');
  return unwrapData(fn(filters));
}

export function getTemplate(templateId: string): Promise<Template> {
  const fn = httpsCallable<{ templateId: string }, Template>(functions, 'v1TemplatesGet');
  return unwrapData(fn({ templateId }));
}

export function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const fn = httpsCallable<CreateTemplateInput, Template>(functions, 'v1TemplatesCreate');
  return unwrapData(fn(input));
}

export function updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<Template> {
  const fn = httpsCallable<UpdateTemplateInput, Template>(functions, 'v1TemplatesUpdate');
  return unwrapData(fn({ ...input, templateId }));
}

export function deleteTemplate(
  templateId: string,
): Promise<{ templateId: string; deletedAt: string }> {
  const fn = httpsCallable<{ templateId: string }, { templateId: string; deletedAt: string }>(
    functions,
    'v1TemplatesDelete',
  );
  return unwrapData(fn({ templateId }));
}

export interface TransitionInput {
  templateId: string;
  action: 'submit' | 'approve' | 'reject' | 'request_changes' | 'reopen';
  comment?: string;
}

export function transitionTemplate(input: TransitionInput): Promise<Template> {
  const fn = httpsCallable<TransitionInput, Template>(functions, 'v1TemplatesTransition');
  return unwrapData(fn(input));
}

export interface ExpertEditInput {
  templateId: string;
  recipes?: {
    recipeId: string;
    competencyContext?: string;
    qtyMultipleChoice?: number;
    qtyMultiChoice?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    topicsCovered?: string[];
  }[];
  comment?: string;
}

export function expertEditTemplate(input: ExpertEditInput): Promise<Template> {
  const fn = httpsCallable<ExpertEditInput, Template>(functions, 'v1TemplatesExpertEdit');
  return unwrapData(fn(input));
}

export function getReviewHistory(templateId: string): Promise<ReviewHistoryResult> {
  const fn = httpsCallable<{ templateId: string }, ReviewHistoryResult>(
    functions,
    'v1TemplatesGetReviewHistory',
  );
  return unwrapData(fn({ templateId }));
}

// Re-export RecipeInput for consumers that want to type-check
export type { CreateTemplateInput, RecipeInput, Template, UpdateTemplateInput };

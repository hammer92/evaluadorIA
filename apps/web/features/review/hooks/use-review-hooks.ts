'use client';

import type { Template } from '@shared/schemas/templates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';

import {
  approveTemplate,
  expertEditTemplateForReview,
  listReviewQueue,
  rejectTemplate,
  reopenTemplate,
  requestChanges,
  submitForReview,
  type ListReviewQueueFilters,
} from '../api/review-api';

// =============================================================================
// Review hooks (SDD-10 Fase 2 UI — PR-2)
// =============================================================================
// Query keys centralizados (sigue pattern de features/templates/hooks/use-templates.ts).
// Mutations invalidan ['templates', '*'] + ['review', 'queue'] para garantizar
// coherencia cross-página (review queue ↔ template detail).
// =============================================================================

const KEYS = {
  all: ['review'] as const,
  queue: (filters: ListReviewQueueFilters) => ['review', 'queue', filters] as const,
};

// ---------- Query: review queue ----------

function toArgs(filters: { niche?: string; search?: string; page: number; pageSize: number }) {
  const args: ListReviewQueueFilters = {
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (filters.niche && filters.niche !== 'all') args.niche = filters.niche;
  if (filters.search && filters.search.length > 0) args.search = filters.search;
  return args;
}

export interface UseReviewQueueArgs {
  niche?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export function useReviewQueue(filters: UseReviewQueueArgs) {
  return useQuery({
    queryKey: KEYS.queue(filters),
    queryFn: () => listReviewQueue(toArgs(filters)),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 min — la cola cambia cuando admin aprueba.
  });
}

// ---------- Mutations: review actions ----------

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEYS.all });
  void qc.invalidateQueries({ queryKey: ['templates'] });
}

export function useSubmitForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitForReview,
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', data.templateId], data);
      invalidateAll(qc);
    },
  });
}

export function useApproveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveTemplate,
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', data.templateId], data);
      invalidateAll(qc);
    },
  });
}

export function useRequestChanges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestChanges,
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', data.templateId], data);
      invalidateAll(qc);
    },
  });
}

export function useRejectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectTemplate,
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', data.templateId], data);
      invalidateAll(qc);
    },
  });
}

export function useReopenTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reopenTemplate,
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', data.templateId], data);
      invalidateAll(qc);
    },
  });
}

// Expert edit + (opcional) approve. El caller puede chainear approveTemplate
// después si quiere transición inmediata a approved.
export function useExpertEditTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof expertEditTemplateForReview>[0]) =>
      expertEditTemplateForReview(input),
    onSuccess: (data: Template) => {
      qc.setQueryData(['templates', 'detail', templateId], data);
      void qc.invalidateQueries({ queryKey: ['templates', 'history', templateId] });
      invalidateAll(qc);
    },
  });
}

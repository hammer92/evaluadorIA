'use client';

import type { Template } from '@shared/schemas/templates';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTemplate,
  deleteTemplate,
  expertEditTemplate,
  getReviewHistory,
  getTemplate,
  listTemplates,
  transitionTemplate,
  updateTemplate,
  type ExpertEditInput,
  type ListTemplatesFilters,
  type TransitionInput,
} from '../api/templates-api';

const KEYS = {
  all: ['templates'] as const,
  list: (filters: ListTemplatesFilters) => ['templates', 'list', filters] as const,
  detail: (id: string) => ['templates', 'detail', id] as const,
  history: (id: string) => ['templates', 'history', id] as const,
};

function toArgs(filters: ListTemplatesFilters): ListTemplatesFilters {
  const args: ListTemplatesFilters = { page: filters.page, pageSize: filters.pageSize };
  if (filters.status && filters.status !== 'all') args.status = filters.status;
  if (filters.niche && filters.niche !== 'all') args.niche = filters.niche;
  if (filters.createdBy && filters.createdBy.length > 0) args.createdBy = filters.createdBy;
  if (filters.search && filters.search.length > 0) args.search = filters.search;
  if (filters.from) args.from = filters.from;
  if (filters.to) args.to = filters.to;
  return args;
}

export function useTemplatesList(filters: ListTemplatesFilters) {
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => listTemplates(toArgs(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(templateId ?? ''),
    queryFn: () => getTemplate(templateId!),
    enabled: Boolean(templateId),
  });
}

export function useReviewHistory(templateId: string | undefined) {
  return useQuery({
    queryKey: KEYS.history(templateId ?? ''),
    queryFn: () => getReviewHistory(templateId!),
    enabled: Boolean(templateId),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateTemplate>[1]) => updateTemplate(templateId, patch),
    onSuccess: (data: Template) => {
      qc.setQueryData(KEYS.detail(templateId), data);
      void qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useTransitionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionInput) => transitionTemplate(input),
    onSuccess: (data: Template) => {
      qc.setQueryData(KEYS.detail(data.templateId), data);
      void qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useExpertEditTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ExpertEditInput, 'templateId'>) =>
      expertEditTemplate({ ...input, templateId }),
    onSuccess: (data: Template) => {
      qc.setQueryData(KEYS.detail(templateId), data);
      void qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

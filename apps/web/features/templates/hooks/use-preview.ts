'use client';

import type {
  GetPreviewOutput,
  RecordAnswersInput,
  RecordAnswersOutput,
} from '@shared/schemas/preview';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  generatePreview,
  getPreview,
  recordAnswers,
} from '../api/preview-api';

// =============================================================================
// Preview hooks — SDD-11 §5.3
// =============================================================================
// usePreview: lee cache (con isStale flag).
// useGeneratePreview: useMutation con onSuccess que invalida el cache.
// useRecordAnswers: useMutation para registrar respuestas tras la simulación.
// =============================================================================

const KEYS = {
  all: ['preview'] as const,
  detail: (templateId: string) => ['preview', templateId] as const,
};

export function usePreview(templateId: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(templateId ?? ''),
    queryFn: () => getPreview(templateId!),
    enabled: Boolean(templateId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeneratePreview(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (forceRegenerate = false) =>
      generatePreview(templateId, forceRegenerate),
    onSuccess: (data) => {
      qc.setQueryData(KEYS.detail(templateId), {
        preview: data,
        isStale: false,
        message: null,
      } satisfies GetPreviewOutput);
    },
  });
}

export function useRecordAnswers() {
  return useMutation<RecordAnswersOutput, Error, RecordAnswersInput>({
    mutationFn: recordAnswers,
  });
}

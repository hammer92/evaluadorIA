// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListTemplates, mockTransitionTemplate, mockExpertEditTemplate } = vi.hoisted(() => ({
  mockListTemplates: vi.fn(),
  mockTransitionTemplate: vi.fn(),
  mockExpertEditTemplate: vi.fn(),
}));

vi.mock('@/features/templates/api/templates-api', () => ({
  listTemplates: mockListTemplates,
  transitionTemplate: mockTransitionTemplate,
  expertEditTemplate: mockExpertEditTemplate,
}));

import {
  useApproveTemplate,
  useExpertEditTemplate,
  useRejectTemplate,
  useReopenTemplate,
  useRequestChanges,
  useReviewQueue,
  useSubmitForReview,
} from './use-review-hooks';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakeTemplate = {
  templateId: 'tmpl-1',
  organizationId: 'org-1',
  name: 'Algebra 101',
  description: 'Intro algebra',
  niche: 'school' as const,
  timeLimitMinutes: 60,
  maxRetries: 2,
  recipes: [],
  status: 'in_review' as const,
  createdBy: 'user-1',
  createdByRole: 'recruiter' as const,
  createdAt: new Date('2026-07-22T10:00:00Z'),
  updatedAt: new Date('2026-07-22T10:00:00Z'),
  approvedBy: null,
  approvedAt: null,
  deletedAt: null,
};

beforeEach(() => {
  mockListTemplates.mockReset();
  mockTransitionTemplate.mockReset();
  mockExpertEditTemplate.mockReset();

  mockListTemplates.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
  });
  mockTransitionTemplate.mockResolvedValue(fakeTemplate);
  mockExpertEditTemplate.mockResolvedValue(fakeTemplate);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useReviewQueue', () => {
  it('llama a listTemplates con status="in_review" + page + pageSize', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReviewQueue({ page: 1, pageSize: 20 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListTemplates).toHaveBeenCalledWith({
      status: 'in_review',
      page: 1,
      pageSize: 20,
    });
  });

  it('omite niche cuando vale "all"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReviewQueue({ niche: 'all', page: 1, pageSize: 20 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListTemplates).toHaveBeenCalledWith({
      status: 'in_review',
      page: 1,
      pageSize: 20,
    });
  });

  it('incluye niche cuando NO es "all"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useReviewQueue({ niche: 'university', page: 1, pageSize: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListTemplates).toHaveBeenCalledWith({
      status: 'in_review',
      niche: 'university',
      page: 1,
      pageSize: 20,
    });
  });

  it('incluye search cuando es string no vacío', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useReviewQueue({ search: 'algebra', page: 1, pageSize: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListTemplates).toHaveBeenCalledWith({
      status: 'in_review',
      search: 'algebra',
      page: 1,
      pageSize: 20,
    });
  });
});

describe('useSubmitForReview', () => {
  it('llama transitionTemplate con action="submit"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSubmitForReview(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'submit',
      comment: undefined,
    });
  });

  it('incluye comment cuando se provee', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSubmitForReview(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1', comment: 'Listo para revisión' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'submit',
      comment: 'Listo para revisión',
    });
  });
});

describe('useApproveTemplate', () => {
  it('llama transitionTemplate con action="approve"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useApproveTemplate(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'approve',
      comment: undefined,
    });
  });
});

describe('useRequestChanges', () => {
  it('llama transitionTemplate con action="request_changes" + comment', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRequestChanges(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1', comment: 'Subir dificultad a hard' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'request_changes',
      comment: 'Subir dificultad a hard',
    });
  });
});

describe('useRejectTemplate', () => {
  it('llama transitionTemplate con action="reject" + comment', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRejectTemplate(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1', comment: 'No cumple con el nicho' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'reject',
      comment: 'No cumple con el nicho',
    });
  });
});

describe('useReopenTemplate', () => {
  it('llama transitionTemplate con action="reopen"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReopenTemplate(), { wrapper });

    result.current.mutate({ templateId: 'tmpl-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockTransitionTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      action: 'reopen',
      comment: undefined,
    });
  });
});

describe('useExpertEditTemplate', () => {
  it('llama expertEditTemplate con recipes + comment', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useExpertEditTemplate('tmpl-1'), { wrapper });

    result.current.mutate({
      templateId: 'tmpl-1',
      recipes: [{ recipeId: 'r-1', difficulty: 'hard' }],
      comment: 'Ajustado por expert',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockExpertEditTemplate).toHaveBeenCalledWith({
      templateId: 'tmpl-1',
      recipes: [{ recipeId: 'r-1', difficulty: 'hard' }],
      comment: 'Ajustado por expert',
    });
  });
});

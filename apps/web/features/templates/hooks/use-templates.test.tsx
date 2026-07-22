// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the firebase/auth module so tests don't pull in the real Firebase SDK.
const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockTransition = vi.fn();
const mockExpertEdit = vi.fn();
const mockReviewHistory = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/firebase/auth', () => ({
  functions: {},
  httpsCallable: (_functions: unknown, name: string) => {
    const fn = (input: unknown) => {
      switch (name) {
        case 'v1TemplatesList':
          return Promise.resolve({ data: mockList(input) });
        case 'v1TemplatesGet':
          return Promise.resolve({ data: mockGet(input) });
        case 'v1TemplatesCreate':
          return Promise.resolve({ data: mockCreate(input) });
        case 'v1TemplatesUpdate':
          return Promise.resolve({ data: mockUpdate(input) });
        case 'v1TemplatesDelete':
          return Promise.resolve({ data: mockDelete(input) });
        case 'v1TemplatesTransition':
          return Promise.resolve({ data: mockTransition(input) });
        case 'v1TemplatesExpertEdit':
          return Promise.resolve({ data: mockExpertEdit(input) });
        case 'v1TemplatesGetReviewHistory':
          return Promise.resolve({ data: mockReviewHistory(input) });
        default:
          return Promise.reject(new Error(`Unmocked CF ${name}`));
      }
    };
    return fn;
  },
}));

import {
  useCreateTemplate,
  useDeleteTemplate,
  useReviewHistory,
  useTemplatesList,
  useTemplate,
  useTransitionTemplate,
  useUpdateTemplate,
  useExpertEditTemplate,
} from './use-templates';

function wrapper(): ({ children }: { children: ReactNode }) => React.JSX.Element {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const SAMPLE_TEMPLATE = {
  templateId: 'tpl_1',
  organizationId: 'org_1',
  name: 'Test',
  description: 'desc',
  niche: 'school',
  timeLimitMinutes: 30,
  maxRetries: 1,
  recipes: [
    {
      recipeId: 'rec_1',
      competencyName: 'Hooks',
      competencyContext: 'understanding React hooks',
      qtyMultipleChoice: 3,
      qtyMultiChoice: 1,
      difficulty: 'medium',
      topicsCovered: ['useState'],
    },
  ],
  status: 'draft',
  createdBy: 'u_1',
  createdByRole: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  approvedBy: null,
  approvedAt: null,
  deletedAt: null,
};

describe('useTemplatesList', () => {
  beforeEach(() => {
    mockList.mockResolvedValue({
      items: [SAMPLE_TEMPLATE],
      page: 1,
      pageSize: 20,
      total: 1,
      hasMore: false,
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('fetches with translated filters', async () => {
    const { result } = renderHook(
      () =>
        useTemplatesList({
          page: 1,
          pageSize: 20,
          status: 'all',
          niche: 'school',
          createdBy: 'u_1',
          search: '',
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, niche: 'school', createdBy: 'u_1' }),
    );
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('drops "all" sentinels from query args', async () => {
    const { result } = renderHook(
      () =>
        useTemplatesList({
          page: 1,
          pageSize: 20,
          status: 'all',
          niche: 'all',
        }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const args = mockList.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args['status']).toBeUndefined();
    expect(args['niche']).toBeUndefined();
  });
});

describe('useTemplate', () => {
  beforeEach(() => mockGet.mockResolvedValue(SAMPLE_TEMPLATE));
  afterEach(() => vi.clearAllMocks());

  it('is disabled when templateId is undefined', async () => {
    const { result } = renderHook(() => useTemplate(undefined), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches when templateId is provided', async () => {
    const { result } = renderHook(() => useTemplate('tpl_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith({ templateId: 'tpl_1' });
  });
});

describe('useCreateTemplate', () => {
  it('invalidates the templates query on success', async () => {
    mockCreate.mockResolvedValue(SAMPLE_TEMPLATE);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateTemplate(), { wrapper: localWrapper });

    await result.current.mutateAsync({
      name: 'Test',
      niche: 'school',
      timeLimitMinutes: 30,
      maxRetries: 1,
      recipes: [
        {
          competencyName: 'Hooks',
          competencyContext: 'understanding React hooks',
          qtyMultipleChoice: 3,
          qtyMultiChoice: 1,
          difficulty: 'medium',
          topicsCovered: ['useState'],
        },
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['templates'] });
  });
});

describe('useDeleteTemplate', () => {
  it('invalidates on success', async () => {
    mockDelete.mockResolvedValue({ templateId: 'tpl_1', deletedAt: '2026-07-22T00:00:00Z' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper: localWrapper });
    await result.current.mutateAsync('tpl_1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['templates'] });
  });
});

describe('useUpdateTemplate', () => {
  it('sets query data on success', async () => {
    mockUpdate.mockResolvedValue(SAMPLE_TEMPLATE);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const setSpy = vi.spyOn(qc, 'setQueryData');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTemplate('tpl_1'), { wrapper: localWrapper });
    await result.current.mutateAsync({ templateId: 'tpl_1', name: 'Renamed' });
    expect(setSpy).toHaveBeenCalledWith(['templates', 'detail', 'tpl_1'], SAMPLE_TEMPLATE);
  });
});

describe('useTransitionTemplate', () => {
  it('passes action through to CF', async () => {
    mockTransition.mockResolvedValue(SAMPLE_TEMPLATE);
    const { result } = renderHook(() => useTransitionTemplate(), { wrapper: wrapper() });
    await result.current.mutateAsync({
      templateId: 'tpl_1',
      action: 'submit',
      comment: 'ready',
    });
    expect(mockTransition).toHaveBeenCalledWith({
      templateId: 'tpl_1',
      action: 'submit',
      comment: 'ready',
    });
  });
});

describe('useExpertEditTemplate', () => {
  it('forwards templateId and recipe edits', async () => {
    mockExpertEdit.mockResolvedValue(SAMPLE_TEMPLATE);
    const { result } = renderHook(() => useExpertEditTemplate('tpl_1'), { wrapper: wrapper() });
    await result.current.mutateAsync({
      recipes: [{ recipeId: 'rec_1', qtyMultipleChoice: 5 }],
    });
    expect(mockExpertEdit).toHaveBeenCalledWith({
      templateId: 'tpl_1',
      recipes: [{ recipeId: 'rec_1', qtyMultipleChoice: 5 }],
    });
  });
});

describe('useReviewHistory', () => {
  beforeEach(() =>
    mockReviewHistory.mockResolvedValue({
      templateId: 'tpl_1',
      events: [
        {
          reviewId: 'r_1',
          actorId: 'u_1',
          actorName: 'Admin',
          actorRole: 'admin',
          action: 'submitted',
          createdAt: '2026-07-22T00:00:00Z',
        },
      ],
    }),
  );
  afterEach(() => vi.clearAllMocks());

  it('returns events', async () => {
    const { result } = renderHook(() => useReviewHistory('tpl_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.events).toHaveLength(1);
  });
});

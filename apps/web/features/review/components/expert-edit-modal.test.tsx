// @vitest-environment jsdom
import type { Template } from '@shared/schemas/templates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mutateExpertMock, mutateApproveMock } = vi.hoisted(() => ({
  mutateExpertMock: vi.fn(),
  mutateApproveMock: vi.fn(),
}));

vi.mock('../hooks/use-review-hooks', () => ({
  useExpertEditTemplate: () => ({
    mutate: mutateExpertMock,
    isPending: false,
  }),
  useApproveTemplate: () => ({
    mutate: mutateApproveMock,
    isPending: false,
  }),
}));

import { ExpertEditModal } from './expert-edit-modal';

const baseTemplate: Template = {
  templateId: 'tmpl-1',
  organizationId: 'org-1',
  name: 'Algebra 101',
  description: 'Intro algebra',
  niche: 'school',
  timeLimitMinutes: 60,
  maxRetries: 2,
  recipes: [
    {
      recipeId: 'r-1',
      competencyName: 'Álgebra básica',
      competencyContext: 'Resolver ecuaciones lineales con una incógnita.',
      qtyMultipleChoice: 3,
      qtyMultiChoice: 2,
      difficulty: 'medium',
      topicsCovered: ['ecuaciones', 'lineales'],
    },
  ],
  status: 'in_review',
  createdBy: 'jane@example.com',
  createdByRole: 'recruiter',
  createdAt: new Date('2026-07-22T10:00:00Z'),
  updatedAt: new Date('2026-07-22T11:00:00Z'),
  approvedBy: null,
  approvedAt: null,
  deletedAt: null,
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mutateExpertMock.mockReset();
  mutateApproveMock.mockReset();
  // Chain onSuccess: expertEdit onSuccess triggers approve onSuccess.
  mutateExpertMock.mockImplementation((_input, opts: { onSuccess?: () => void } = {}) => {
    opts.onSuccess?.();
  });
  mutateApproveMock.mockImplementation((_input, opts: { onSuccess?: () => void } = {}) => {
    opts.onSuccess?.();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ExpertEditModal', () => {
  it('renderiza título con nombre del template', () => {
    render(<ExpertEditModal template={baseTemplate} open onOpenChange={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText(/editar y aprobar — algebra 101/i)).toBeInTheDocument();
  });

  it('renderiza una card por cada recipe con label Receta #1', () => {
    render(<ExpertEditModal template={baseTemplate} open onOpenChange={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText(/receta #1/i)).toBeInTheDocument();
  });

  it('llama useExpertEditTemplate + useApproveTemplate al submit', async () => {
    const onOpenChange = vi.fn();
    render(<ExpertEditModal template={baseTemplate} open onOpenChange={onOpenChange} />, {
      wrapper: makeWrapper(),
    });
    // Submit form (button queries are flaky in jsdom dialog portal).
    const dialog = screen.getByRole('dialog');
    const form = dialog.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(mutateExpertMock).toHaveBeenCalled());
    const expertCall = mutateExpertMock.mock.calls[0]![0] as {
      templateId: string;
      recipes: { recipeId: string; qtyMultipleChoice?: number }[];
    };
    expect(expertCall.templateId).toBe('tmpl-1');
    expect(expertCall.recipes[0]?.recipeId).toBe('r-1');
    expect(expertCall.recipes[0]?.qtyMultipleChoice).toBe(3);
    const approveCall = mutateApproveMock.mock.calls[0]![0] as { templateId: string };
    expect(approveCall.templateId).toBe('tmpl-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('invoca onCompleted callback cuando aplica', async () => {
    const onCompleted = vi.fn();
    render(
      <ExpertEditModal
        template={baseTemplate}
        open
        onOpenChange={() => undefined}
        onCompleted={onCompleted}
      />,
      { wrapper: makeWrapper() },
    );
    const dialog = screen.getByRole('dialog');
    const form = dialog.querySelector('form');
    fireEvent.submit(form!);
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
  });
});

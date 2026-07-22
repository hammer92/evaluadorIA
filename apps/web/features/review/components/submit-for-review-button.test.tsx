// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../hooks/use-review-hooks', () => ({
  useSubmitForReview: () => ({ mutate: mutateMock, isPending: false }),
}));

import { SubmitForReviewButton } from './submit-for-review-button';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mutateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SubmitForReviewButton', () => {
  it('renderiza botón "Enviar a revisión"', () => {
    render(<SubmitForReviewButton templateId="tmpl-1" />, { wrapper: makeWrapper() });
    expect(screen.getByRole('button', { name: /enviar a revisión/i })).toBeInTheDocument();
  });

  it('llama mutate con templateId al click', async () => {
    render(<SubmitForReviewButton templateId="tmpl-1" />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByRole('button', { name: /enviar a revisión/i }));
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    expect(mutateMock).toHaveBeenCalledWith(
      { templateId: 'tmpl-1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('invoca onSubmitted callback cuando mutate tiene onSuccess', () => {
    mutateMock.mockImplementation((_input, opts: { onSuccess?: () => void } = {}) => {
      opts.onSuccess?.();
    });
    const onSubmitted = vi.fn();
    render(<SubmitForReviewButton templateId="tmpl-1" onSubmitted={onSubmitted} />, {
      wrapper: makeWrapper(),
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar a revisión/i }));
    expect(onSubmitted).toHaveBeenCalledOnce();
  });
});

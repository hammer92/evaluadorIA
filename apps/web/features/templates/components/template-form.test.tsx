// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutateCreateMock = vi.fn();
const mutateUpdateMock = vi.fn();

vi.mock('../hooks/use-templates', () => ({
  useCreateTemplate: () => ({
    mutateAsync: mutateCreateMock,
    isPending: false,
  }),
  useUpdateTemplate: () => ({
    mutateAsync: mutateUpdateMock,
    isPending: false,
  }),
}));

import { TemplateForm } from './template-form';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mutateCreateMock.mockReset();
  mutateUpdateMock.mockReset();
  mutateCreateMock.mockResolvedValue({
    templateId: 'new-id',
    organizationId: 'org-1',
    name: 'Test',
    description: '',
    niche: 'school',
    timeLimitMinutes: 30,
    maxRetries: 1,
    recipes: [],
    status: 'draft',
    createdBy: 'me',
    createdByRole: 'recruiter',
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedBy: null,
    approvedAt: null,
    deletedAt: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TemplateForm — create', () => {
  it('envía el create mutation con valores válidos cuando los datos están llenos', async () => {
    const onSuccess = vi.fn();
    render(
      <TemplateForm mode="create" submitLabel="Crear template" onSuccess={onSuccess} />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: /agregar receta/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/nombre de la competencia/i)).toBeInTheDocument();
    });

    fireEvent.input(screen.getByLabelText(/^nombre$/i), {
      target: { value: 'Plantilla demo' },
    });
    fireEvent.input(screen.getByLabelText(/nombre de la competencia/i), {
      target: { value: 'React Hooks' },
    });
    fireEvent.input(screen.getByLabelText(/contexto para la ia/i), {
      target: { value: 'Contexto suficientemente largo para pasar la validación de mínimo 20 caracteres.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /crear template/i }));

    await waitFor(() => {
      expect(mutateCreateMock).toHaveBeenCalled();
    });

    const call = mutateCreateMock.mock.calls[0]?.[0] as {
      name: string;
      recipes: { competencyName: string; competencyContext: string }[];
    };
    expect(call.name).toBe('Plantilla demo');
    expect(call.recipes[0]?.competencyName).toBe('React Hooks');
    expect(call.recipes[0]?.competencyContext).toMatch(/suficientemente largo/);
    expect(onSuccess).toHaveBeenCalled();
  });
});
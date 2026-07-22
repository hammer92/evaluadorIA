// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../hooks/use-review-hooks', () => ({
  useApproveTemplate: () => ({ mutate: mutateMock, isPending: false }),
  useRejectTemplate: () => ({ mutate: mutateMock, isPending: false }),
  useRequestChanges: () => ({ mutate: mutateMock, isPending: false }),
}));

import { ReviewDecisionPanel } from './review-decision-panel';

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

describe('ReviewDecisionPanel', () => {
  it('renderiza los 4 botones de decisión', () => {
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getAllByRole('button', { name: /aprobar/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /solicitar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar y aprobar/i })).toBeInTheDocument();
  });

  it('abre dialog de Aprobar al click y muestra textarea opcional', () => {
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    fireEvent.click(screen.getAllByRole('button', { name: /aprobar/i })[0]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/comentario/i)).toBeInTheDocument();
    expect(screen.getByText(/\(opcional\)/i)).toBeInTheDocument();
  });

  it('abre dialog de Rechazar con comment required (asterisco)', () => {
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // El asterisco indica required
    expect(dialog.textContent).toMatch(/\*/);
  });

  it('llama mutate con templateId cuando se aprueba sin comment', async () => {
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    // Step 1: click panel "Aprobar" para abrir el dialog.
    fireEvent.click(screen.getAllByRole('button', { name: /aprobar/i })[0]!);
    // Step 2: dialog abierto (verificamos via textarea placeholder).
    await screen.findByPlaceholderText(/feedback positivo/i);
    // Step 3: submit form (sin comment, approve es opcional).
    const dialog = screen.getByRole('dialog');
    const form = dialog.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    const [firstArg] = mutateMock.mock.calls[0]!;
    expect(firstArg).toMatchObject({ templateId: 'tmpl-1' });
  });

  it('invoca onEditAndApprove al click en "Editar y aprobar"', () => {
    const onEditAndApprove = vi.fn();
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={onEditAndApprove} />, {
      wrapper: makeWrapper(),
    });
    fireEvent.click(screen.getByRole('button', { name: /editar y aprobar/i }));
    expect(onEditAndApprove).toHaveBeenCalledOnce();
  });

  it('expone region ARIA con label "Acciones de revisión"', () => {
    render(<ReviewDecisionPanel templateId="tmpl-1" onEditAndApprove={() => undefined} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByRole('region', { name: /acciones de revisión/i })).toBeInTheDocument();
  });
});

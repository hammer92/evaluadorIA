// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteUserMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  deleteUserMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('../api/users-api', () => ({
  deleteUser: deleteUserMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { useDeleteUser } from './use-delete-user';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  deleteUserMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDeleteUser', () => {
  it('llama a deleteUser con el uid y devuelve el resultado', async () => {
    deleteUserMock.mockResolvedValue({ uid: 'u_42', deletedAt: '2026-01-01T00:00:00Z' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    let deleted: { uid: string; deletedAt: string } | undefined;
    await act(async () => {
      deleted = await result.current.mutateAsync({ uid: 'u_42' });
    });
    expect(deleted).toEqual({ uid: 'u_42', deletedAt: '2026-01-01T00:00:00Z' });
    expect(deleteUserMock).toHaveBeenCalled();
    expect(deleteUserMock.mock.calls[0]?.[0]).toBe('u_42');
  });

  it('muestra toast.success en éxito', async () => {
    deleteUserMock.mockResolvedValue({ uid: 'u_42', deletedAt: '2026-01-01T00:00:00Z' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uid: 'u_42' });
    });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Usuario eliminado'));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('muestra toast.error en error', async () => {
    deleteUserMock.mockRejectedValue(new Error('forbidden'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uid: 'u_42' }).catch(() => undefined);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('forbidden'));
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});

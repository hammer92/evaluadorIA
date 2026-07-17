// @vitest-environment jsdom
import type { UpdateUserInput, User } from '@shared/schemas/users';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { updateUserMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('../api/users-api', () => ({
  updateUser: updateUserMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { useUpdateUser } from './use-update-user';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const sampleUser: User = {
  uid: 'u_42',
  email: 'u@example.com',
  displayName: 'Renamed',
  photoURL: null,
  role: 'admin',
  organizationId: 'org_1',
  status: 'active',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'u_admin',
  deletedAt: null,
};

const input: UpdateUserInput = { displayName: 'Renamed' };

beforeEach(() => {
  updateUserMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUpdateUser', () => {
  it('llama a updateUser con uid + input y devuelve el user', async () => {
    updateUserMock.mockResolvedValue(sampleUser);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper });

    let user: User | undefined;
    await act(async () => {
      user = await result.current.mutateAsync({ uid: 'u_42', input });
    });
    expect(user).toEqual(sampleUser);
    expect(updateUserMock).toHaveBeenCalled();
    expect(updateUserMock.mock.calls[0]?.[0]).toBe('u_42');
    expect(updateUserMock.mock.calls[0]?.[1]).toEqual(input);
  });

  it('muestra toast.success en éxito', async () => {
    updateUserMock.mockResolvedValue(sampleUser);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uid: 'u_42', input });
    });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Usuario actualizado'));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('muestra toast.error en error', async () => {
    updateUserMock.mockRejectedValue(new Error('not-found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uid: 'u_42', input }).catch(() => undefined);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('not-found'));
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});

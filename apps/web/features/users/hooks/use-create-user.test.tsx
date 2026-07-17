// @vitest-environment jsdom
import type { CreateUserInput, User } from '@shared/schemas/users';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createUserMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('../api/users-api', () => ({
  createUser: createUserMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { useCreateUser } from './use-create-user';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const sampleUser: User = {
  uid: 'u_new',
  email: 'new@example.com',
  displayName: 'New User',
  photoURL: null,
  role: 'recruiter',
  organizationId: 'org_1',
  status: 'active',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'u_admin',
  deletedAt: null,
};

const input: CreateUserInput = {
  email: 'new@example.com',
  displayName: 'New User',
  role: 'recruiter',
  organizationId: 'org_1',
  sendInviteEmail: true,
};

beforeEach(() => {
  createUserMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCreateUser', () => {
  it('llama a createUser con el input y devuelve el user', async () => {
    createUserMock.mockResolvedValue(sampleUser);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      const user = await result.current.mutateAsync(input);
      expect(user).toEqual(sampleUser);
    });
    expect(createUserMock).toHaveBeenCalled();
    expect(createUserMock.mock.calls[0]?.[0]).toEqual(input);
  });

  it('muestra toast.success y NO toast.error en éxito', async () => {
    createUserMock.mockResolvedValue(sampleUser);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Usuario creado'));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('muestra toast.error y NO toast.success en error', async () => {
    createUserMock.mockRejectedValue(new Error('email-already-in-use'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('email-already-in-use'));
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});

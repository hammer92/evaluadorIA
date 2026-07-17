// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListUsersResult } from '../api/users-api';

const { listUsersMock } = vi.hoisted(() => ({
  listUsersMock: vi.fn(),
}));

vi.mock('../api/users-api', () => ({
  listUsers: listUsersMock,
}));

import { useUsersList } from './use-users-list';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const successResult: ListUsersResult = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  hasMore: false,
};

beforeEach(() => {
  listUsersMock.mockReset();
  listUsersMock.mockResolvedValue(successResult);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUsersList', () => {
  it('llama a listUsers con page + pageSize por default', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUsersList({ page: 1, pageSize: 20 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('omite status y role cuando valen "all"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useUsersList({
          status: 'all',
          role: 'all',
          search: '',
          page: 2,
          pageSize: 50,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsersMock).toHaveBeenCalledWith({ page: 2, pageSize: 50 });
  });

  it('incluye status cuando NO es "all"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useUsersList({
          status: 'active',
          role: 'all',
          search: '',
          page: 1,
          pageSize: 20,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsersMock).toHaveBeenCalledWith({
      status: 'active',
      page: 1,
      pageSize: 20,
    });
  });

  it('incluye role cuando NO es "all"', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useUsersList({
          status: 'all',
          role: 'recruiter',
          search: '',
          page: 1,
          pageSize: 20,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsersMock).toHaveBeenCalledWith({
      role: 'recruiter',
      page: 1,
      pageSize: 20,
    });
  });

  it('incluye search cuando es un string no vacío', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useUsersList({
          status: 'all',
          role: 'all',
          search: 'jane',
          page: 1,
          pageSize: 20,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsersMock).toHaveBeenCalledWith({
      search: 'jane',
      page: 1,
      pageSize: 20,
    });
  });

  it('expone los datos del query', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUsersList({ page: 1, pageSize: 20 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(successResult);
  });
});

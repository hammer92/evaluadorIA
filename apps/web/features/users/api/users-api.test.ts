// @vitest-environment node
import type { CreateUserInput, UpdateUserInput, User } from '@shared/schemas/users';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

import { createUser, deleteUser, listUsers, updateUser } from './users-api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleUser: User = {
  uid: 'u_1',
  email: 'u@example.com',
  displayName: 'User One',
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

describe('listUsers', () => {
  it('hace POST a /api/users/list con los filters en el body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [sampleUser],
        page: 1,
        pageSize: 20,
        total: 1,
        hasMore: false,
      }),
    );

    const result = await listUsers({
      page: 1,
      pageSize: 20,
      status: 'active',
      role: 'admin',
      search: 'foo',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/users/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        page: 1,
        pageSize: 20,
        status: 'active',
        role: 'admin',
        search: 'foo',
      }),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.uid).toBe(sampleUser.uid);
    expect(result.items[0]?.email).toBe(sampleUser.email);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('lanza Error con el mensaje del backend cuando falla', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }, 403));
    await expect(listUsers({ page: 1, pageSize: 10 })).rejects.toThrow('forbidden');
  });

  it('lanza Error con mensaje de fallback si el body no es JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not-json', { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    );
    await expect(listUsers({ page: 1, pageSize: 10 })).rejects.toThrow(
      'POST /api/users/list failed (500)',
    );
  });
});

describe('createUser', () => {
  const input: CreateUserInput = {
    email: 'new@example.com',
    displayName: 'New User',
    role: 'recruiter',
    organizationId: 'org_1',
    sendInviteEmail: true,
  };

  it('hace POST a /api/users con el input', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sampleUser));
    const result = await createUser(input);
    expect(fetchMock).toHaveBeenCalledWith('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    expect(result.uid).toBe(sampleUser.uid);
    expect(result.email).toBe(sampleUser.email);
    expect(result.role).toBe(sampleUser.role);
    expect(new Date(result.createdAt as unknown as string).toISOString()).toBe(
      sampleUser.createdAt.toISOString(),
    );
  });

  it('lanza Error con mensaje del backend cuando falla', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'email-already-in-use' }, 400));
    await expect(createUser(input)).rejects.toThrow('email-already-in-use');
  });
});

describe('updateUser', () => {
  const input: UpdateUserInput = { displayName: 'Renamed' };

  it('hace PATCH a /api/users/:uid con el input', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...sampleUser, displayName: 'Renamed' }));
    const result = await updateUser('u_42', input);
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u_42', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...input }),
    });
    expect(result.displayName).toBe('Renamed');
    expect(result.uid).toBe(sampleUser.uid);
  });

  it('lanza Error cuando la API falla', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'not-found' }, 404));
    await expect(updateUser('u_99', input)).rejects.toThrow('not-found');
  });
});

describe('deleteUser', () => {
  it('hace DELETE a /api/users/:uid con body vacío', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ uid: 'u_42', deletedAt: '2026-01-01T00:00:00Z' }),
    );
    const result = await deleteUser('u_42');
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u_42', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    expect(result).toEqual({ uid: 'u_42', deletedAt: '2026-01-01T00:00:00Z' });
  });

  it('lanza Error cuando la API falla', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }, 403));
    await expect(deleteUser('u_42')).rejects.toThrow('forbidden');
  });
});

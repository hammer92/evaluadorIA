import type { CreateUserInput, UpdateUserInput, User } from '@shared/schemas/users';

export interface ListUsersFilters {
  status?: string;
  role?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface ListUsersResult {
  items: User[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

async function jsonFetch<TInput, TOutput>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: TInput,
): Promise<TOutput> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${method} ${url} failed (${res.status})`);
  }
  return (await res.json()) as TOutput;
}

export async function listUsers(filters: ListUsersFilters): Promise<ListUsersResult> {
  return jsonFetch<unknown, ListUsersResult>('/api/users/list', 'POST', filters);
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return jsonFetch<unknown, User>('/api/users', 'POST', input);
}

export async function updateUser(uid: string, input: UpdateUserInput): Promise<User> {
  return jsonFetch<unknown, User>(`/api/users/${uid}`, 'PATCH', { ...input });
}

export async function deleteUser(uid: string): Promise<{ uid: string; deletedAt: string }> {
  return jsonFetch<unknown, { uid: string; deletedAt: string }>(`/api/users/${uid}`, 'DELETE', {});
}

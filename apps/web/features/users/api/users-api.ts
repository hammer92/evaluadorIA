import type { CreateUserInput, UpdateUserInput, User } from '@shared/schemas/users';

import { functions, httpsCallable } from '@/lib/firebase/auth';

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

// =============================================================================
// Users API (cliente) — llama a Cloud Functions callable via httpsCallable.
// =============================================================================
// Arquitectura estática (sin /api/* routes). El cliente incluye el
// Firebase Auth ID token automáticamente en cada httpsCallable; las CFs
// verifican el token + extraen role/claims via buildAuthContext().
// =============================================================================

function unwrapData<T>(p: Promise<{ data: T }>): Promise<T> {
  return p.then((r) => r.data);
}

export function listUsers(filters: ListUsersFilters): Promise<ListUsersResult> {
  const fn = httpsCallable<ListUsersFilters, ListUsersResult>(functions, 'v1UsersList');
  return unwrapData(fn(filters));
}

export function createUser(input: CreateUserInput): Promise<User> {
  const fn = httpsCallable<CreateUserInput, User>(functions, 'v1UsersCreate');
  return unwrapData(fn(input));
}

export function updateUser(uid: string, input: UpdateUserInput): Promise<User> {
  const fn = httpsCallable<UpdateUserInput & { uid: string }, User>(functions, 'v1UsersUpdate');
  return unwrapData(fn({ uid, ...input }));
}

export function deleteUser(uid: string): Promise<{ uid: string; deletedAt: string }> {
  const fn = httpsCallable<{ uid: string }, { uid: string; deletedAt: string }>(
    functions,
    'v1UsersDelete',
  );
  return unwrapData(fn({ uid }));
}

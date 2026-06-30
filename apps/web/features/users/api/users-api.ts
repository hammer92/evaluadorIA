import type { CreateUserInput, UpdateUserInput, User } from '@shared/schemas/users';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/lib/firebase/client';

const createUserFn = httpsCallable<CreateUserInput, User>(functions, 'v1UsersCreate');
const listUsersFn = httpsCallable<
  {
    organizationId?: string;
    status?: string;
    role?: string;
    search?: string;
    page: number;
    pageSize: number;
  },
  { items: User[]; page: number; pageSize: number; total: number; hasMore: boolean }
>(functions, 'v1UsersList');
const updateUserFn = httpsCallable<
  { uid: string; input: UpdateUserInput },
  {
    uid: string;
    email: string;
    displayName: string | null;
    role: string;
    status: string;
    organizationId: string | null;
  }
>(functions, 'v1UsersUpdate');
const deleteUserFn = httpsCallable<{ uid: string }, { uid: string; deletedAt: string }>(
  functions,
  'v1UsersDelete',
);

export async function listUsers(filters: {
  status?: string;
  role?: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: User[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
  const r = await listUsersFn(filters);
  return r.data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const r = await createUserFn(input);
  return r.data;
}

export async function updateUser(uid: string, input: UpdateUserInput): Promise<User> {
  const r = await updateUserFn({ uid, input });
  return r.data as unknown as User;
}

export async function deleteUser(uid: string): Promise<{ uid: string; deletedAt: string }> {
  const r = await deleteUserFn({ uid });
  return r.data;
}

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listUsers } from '../api/users-api';
import type { UserFilters } from '../schemas';

export interface ListUsersArgs {
  status?: string;
  role?: string;
  search?: string;
  page: number;
  pageSize: number;
}

function toArgs(filters: UserFilters): ListUsersArgs {
  const args: ListUsersArgs = { page: filters.page, pageSize: filters.pageSize };
  if (filters.status && filters.status !== 'all') args.status = filters.status;
  if (filters.role && filters.role !== 'all') args.role = filters.role;
  if (filters.search && filters.search.length > 0) args.search = filters.search;
  return args;
}

export function useUsersList(filters: UserFilters) {
  return useQuery({
    queryKey: ['users', 'list', filters],
    queryFn: () => listUsers(toArgs(filters)),
    placeholderData: keepPreviousData,
  });
}

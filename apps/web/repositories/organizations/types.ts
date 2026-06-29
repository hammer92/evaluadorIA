import type {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '@shared/schemas/organizations';

import type { Ctx } from '../users/types';

export type { Ctx };

export interface ListOrganizationsInput {
  status?: 'active' | 'deleted';
  page?: number;
  pageSize?: number;
}

export interface ListOrganizationsResult {
  items: Organization[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface OrganizationRepository {
  list(input: ListOrganizationsInput, ctx: Ctx): Promise<ListOrganizationsResult>;
  getById(orgId: string, ctx: Ctx): Promise<Organization | null>;
  create(input: CreateOrganizationInput, ctx: Ctx): Promise<Organization>;
  update(orgId: string, input: UpdateOrganizationInput, ctx: Ctx): Promise<Organization>;
  delete(orgId: string, ctx: Ctx): Promise<{ orgId: string; deletedAt: Date }>;
}

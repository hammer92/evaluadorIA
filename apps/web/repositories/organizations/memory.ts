import {
  organizationSchema,
  type Organization,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@shared/schemas/organizations';

import { RepositoryError } from '../errors';

import type {
  Ctx,
  ListOrganizationsInput,
  ListOrganizationsResult,
  OrganizationRepository,
} from './types';

let _seq = 0;
const genId = (): string => `org_${Date.now()}_${++_seq}`;

export class MemoryOrganizationRepository implements OrganizationRepository {
  private store = new Map<string, Organization>();
  private slugs = new Set<string>();

  async list(input: ListOrganizationsInput, _ctx: Ctx): Promise<ListOrganizationsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    let items = Array.from(this.store.values());
    if (input.status === 'deleted') items = items.filter((o) => o.deletedAt !== null);
    else items = items.filter((o) => o.deletedAt === null);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return { items: paged, page, pageSize, total, hasMore: start + paged.length < total };
  }

  async getById(orgId: string, _ctx: Ctx): Promise<Organization | null> {
    const o = this.store.get(orgId);
    if (!o || o.deletedAt !== null) return null;
    return o;
  }

  async create(input: CreateOrganizationInput, ctx: Ctx): Promise<Organization> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    if (this.slugs.has(input.slug)) {
      throw RepositoryError.alreadyExists('Organization', 'slug', input.slug);
    }
    const orgId = genId();
    const now = new Date();
    const org: Organization = organizationSchema.parse({
      orgId,
      name: input.name,
      slug: input.slug,
      plan: input.plan,
      settings: { timezone: 'UTC', locale: 'en' },
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
      deletedAt: null,
    });
    this.store.set(orgId, org);
    this.slugs.add(input.slug);
    return org;
  }

  async update(orgId: string, input: UpdateOrganizationInput, ctx: Ctx): Promise<Organization> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    const current = await this.getById(orgId, ctx);
    if (!current) throw RepositoryError.notFound('Organization', orgId);
    const updated: Organization = organizationSchema.parse({
      ...current,
      ...input,
      updatedAt: new Date(),
    });
    this.store.set(orgId, updated);
    return updated;
  }

  async delete(orgId: string, ctx: Ctx): Promise<{ orgId: string; deletedAt: Date }> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    const current = await this.getById(orgId, ctx);
    if (!current) throw RepositoryError.notFound('Organization', orgId);
    const updated: Organization = {
      ...current,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(orgId, updated);
    return { orgId, deletedAt: updated.deletedAt! };
  }

  __reset(): void {
    this.store.clear();
    this.slugs.clear();
  }

  __seed(items: Organization[]): void {
    items.forEach((o) => {
      this.store.set(o.orgId, o);
      this.slugs.add(o.slug);
    });
  }
}

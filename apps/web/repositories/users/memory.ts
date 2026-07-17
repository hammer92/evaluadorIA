import {
  userSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@shared/schemas/users';

import { RepositoryError } from '../errors';

import type { Ctx, ListUsersInput, ListUsersResult, UserRepository } from './types';

// =============================================================================
// MemoryUserRepository — impl in-memory para tests (no producción).
// =============================================================================
// Estado en Map<string, User> + Set<string> de emails (índice único).
// `__reset` y `__seed` son helpers de test (prefijo __ evita uso accidental
// en código de producción).
// =============================================================================

let _seq = 0;
const genId = (): string => `mem_${Date.now()}_${++_seq}`;

export class MemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  private emails = new Set<string>();

  async list(input: ListUsersInput, _ctx: Ctx): Promise<ListUsersResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    let items = Array.from(this.store.values()).filter((u) => u.deletedAt === null);
    if (input.organizationId)
      items = items.filter((u) => u.organizationId === input.organizationId);
    if (input.status) items = items.filter((u) => u.status === input.status);
    if (input.role) items = items.filter((u) => u.role === input.role);
    if (input.search) {
      const q = input.search.toLowerCase();
      items = items.filter((u) => `${u.email} ${u.displayName ?? ''}`.toLowerCase().includes(q));
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return Promise.resolve({ items: paged, page, pageSize, total, hasMore: start + paged.length < total });
  }

  async getById(uid: string, _ctx: Ctx): Promise<User | null> {
    const u = this.store.get(uid);
    if (u?.deletedAt !== null) return Promise.resolve(null);
    return Promise.resolve(u);
  }

  async create(input: CreateUserInput, ctx: Ctx): Promise<User> {
    if (this.emails.has(input.email)) {
      throw RepositoryError.alreadyExists('User', 'email', input.email);
    }
    const uid = genId();
    const now = new Date();
    const user: User = userSchema.parse({
      uid,
      email: input.email,
      displayName: input.displayName ?? null,
      photoURL: null,
      role: input.role,
      organizationId: input.organizationId ?? null,
      status: 'invited',
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
      deletedAt: null,
    });
    this.store.set(uid, user);
    this.emails.add(input.email);
    return Promise.resolve(user);
  }

  async update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User> {
    const current = await this.getById(uid, ctx);
    if (!current) throw RepositoryError.notFound('User', uid);
    if (ctx.uid !== uid && ctx.role !== 'admin') {
      throw RepositoryError.permissionDenied();
    }
    if (input.role && input.role !== current.role && ctx.role !== 'admin') {
      throw RepositoryError.permissionDenied();
    }
    const updated: User = userSchema.parse({
      ...current,
      ...input,
      updatedAt: new Date(),
    });
    this.store.set(uid, updated);
    return updated;
  }

  async delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    const current = await this.getById(uid, ctx);
    if (!current) throw RepositoryError.notFound('User', uid);
    const updated: User = {
      ...current,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(uid, updated);
    return { uid, deletedAt: updated.deletedAt! };
  }

  // === Test helpers (prefijo __ para evitar uso accidental en prod) ===

  __reset(): void {
    this.store.clear();
    this.emails.clear();
  }

  __seed(items: User[]): void {
    items.forEach((u) => {
      this.store.set(u.uid, u);
      this.emails.add(u.email);
    });
  }
}

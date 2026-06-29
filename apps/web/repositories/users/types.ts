// =============================================================================
// UserRepository — interfaz pública consumida por services.
// =============================================================================
// Implementada por:
//   - FirebaseUserRepository (producción, lee/escribe Firestore)
//   - MemoryUserRepository (tests, Map en RAM)
//
// El ctx (request context) viaja por método para mantener el repository
// stateless y soportar multi-tenancy futuro sin refactor. Ver ADR-0002.
// =============================================================================

import type { User, CreateUserInput, UpdateUserInput, Role } from '@shared/schemas/users';

export interface ListUsersInput {
  organizationId?: string;
  status?: User['status'];
  role?: User['role'];
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListUsersResult {
  items: User[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface Ctx {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
  traceId: string;
}

export interface UserRepository {
  list(input: ListUsersInput, ctx: Ctx): Promise<ListUsersResult>;
  getById(uid: string, ctx: Ctx): Promise<User | null>;
  create(input: CreateUserInput, ctx: Ctx): Promise<User>;
  update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User>;
  delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }>;
}

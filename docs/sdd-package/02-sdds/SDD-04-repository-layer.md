# SDD-04: Repository Layer (vendor-agnostic)

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 1 (semana 3)
> **Depende de:** SDD-01, SDD-02, SDD-03
> **Bloquea a:** SDD-05, SDD-06, SDD-07
>
> ⚠️ **Este es el SDD más crítico del paquete.** Define el patrón que aísla al vendor. Si esto sale mal, la promesa de "migración a AWS sin reescribir lógica" se rompe. Code review especialmente detallado.

---

## 1. Contexto

El brief pide arquitectura abstraída para migrar de proveedor sin reescribir lógica. La forma de cumplirlo: **toda interacción con datos pasa por una interfaz**, y la única capa que sabe que el backing es Firebase es `/repositories/*/firebase.ts`.

Este SDD implementa el patrón con tres entidades de ejemplo (`users`, `organizations`, `auditLogs`) y deja la estructura lista para que el equipo agregue entidades nuevas siguiendo el mismo template.

## 2. Goals y Non-Goals

### Goals

- Interfaz TypeScript por entidad con CRUD + queries necesarias.
- Implementación Firebase para cada entidad.
- Implementación `Memory` para cada entidad (tests).
- Tests contractuales que corren las mismas aserciones contra ambas impls.
- Factory pattern para inyección según env.
- ESLint enforcement activo (heredado de SDD-01).
- 3 entidades implementadas de punta a punta: `users`, `organizations`, `auditLogs`.
- Schemas Zod en `packages/shared` que se reusan (input, output, firestore raw).
- Errores tipados (`RepositoryError` con códigos).

### Non-Goals

- Realtime listeners (Firestore `onSnapshot`). Solo read/write puntuales.
- Paginación basada en cursors complejos (suficiente con `offset` + `limit` en MVP).
- Bulk operations (crear 1000 users de una). Se hace en loop.
- Transacciones multi-doc (eso es lógica de service).
- Cache local (TanStack Query ya hace cache en UI; no duplicar).

## 3. Decisiones de arquitectura

| #   | Decisión                                                  | ADR                                                                    |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Interfaz + 2 impls + factory                              | [ADR-0002](../01-architecture/decisions/0002-repository-pattern.md)    |
| 2   | Validación con Zod en cada método público del repo        | [ADR-0004](../01-architecture/decisions/0004-zod-shared-validation.md) |
| 3   | Mapping snake_case ↔ camelCase solo en `firebase.ts`      | convención                                                             |
| 4   | Errores con códigos semánticos                            | convención                                                             |
| 5   | `MemoryUserRepository` mantiene state en `Map<string, T>` | decisión interna                                                       |
| 6   | Factory memoiza la instancia por entorno                  | decisión interna                                                       |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
apps/web/repositories/
├── index.ts                       # factory + re-exports de interfaces
├── errors.ts                      # RepositoryError class
├── users/
│   ├── index.ts                   # exporta interfaz y factory
│   ├── types.ts                   # tipos compartidos (si fueran necesarios)
│   ├── firebase.ts                # impl Firebase
│   ├── memory.ts                  # impl Memory
│   ├── mapper.ts                  # snake_case ↔ camelCase
│   ├── __tests__/
│   │   ├── contract.test.ts       # corre contra ambas impls
│   │   ├── firebase.test.ts       # integration contra emuladores
│   │   └── memory.test.ts         # unit
├── organizations/                 # misma estructura
└── audit-logs/                    # misma estructura (sin update/delete)

packages/shared/src/
├── schemas/
│   ├── common.ts                  # primitives reusables
│   ├── users.ts
│   ├── organizations.ts
│   └── audit-logs.ts
├── types/
│   └── index.ts                   # re-exports de tipos inferidos
└── errors/
    └── index.ts                   # (opcional, o vive en apps/web/repositories/errors.ts)
```

### 4.2 Error tipado

```ts
// apps/web/repositories/errors.ts
export type RepositoryErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'VALIDATION'
  | 'INTERNAL'
  | 'UNAVAILABLE';

export class RepositoryError extends Error {
  public readonly code: RepositoryErrorCode;
  public readonly cause?: unknown;

  constructor(code: RepositoryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }

  static notFound(resource: string, id: string): RepositoryError {
    return new RepositoryError('NOT_FOUND', `${resource} with id "${id}" not found`);
  }
  static alreadyExists(resource: string, field: string, value: string): RepositoryError {
    return new RepositoryError(
      'ALREADY_EXISTS',
      `${resource} with ${field}="${value}" already exists`,
    );
  }
  static validation(message: string, cause?: unknown): RepositoryError {
    return new RepositoryError('VALIDATION', message, cause);
  }
  static permissionDenied(message = 'Permission denied'): RepositoryError {
    return new RepositoryError('PERMISSION_DENIED', message);
  }
  static internal(message = 'Internal error', cause?: unknown): RepositoryError {
    return new RepositoryError('INTERNAL', message, cause);
  }
  static unavailable(message = 'Service unavailable', cause?: unknown): RepositoryError {
    return new RepositoryError('UNAVAILABLE', message, cause);
  }
}
```

### 4.3 Interfaz `UserRepository`

```ts
// apps/web/repositories/users/index.ts
import type { User, CreateUserInput, UpdateUserInput } from '@shared/schemas/users';

export type ListUsersInput = {
  organizationId?: string;
  status?: User['status'];
  role?: User['role'];
  search?: string;
  page?: number; // 1-based
  pageSize?: number; // default 20, max 100
};

export type ListUsersResult = {
  items: User[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type Ctx = {
  uid: string;
  email: string;
  role: User['role'];
  organizationId: string | null;
  traceId: string;
};

export interface UserRepository {
  list(input: ListUsersInput, ctx: Ctx): Promise<ListUsersResult>;
  getById(uid: string, ctx: Ctx): Promise<User | null>;
  create(input: CreateUserInput, ctx: Ctx): Promise<User>;
  update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User>;
  delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }>;
}
```

### 4.4 Interfaz `OrganizationRepository`

```ts
// apps/web/repositories/organizations/index.ts
import type {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '@shared/schemas/organizations';

export type ListOrganizationsInput = {
  status?: 'active' | 'deleted';
  page?: number;
  pageSize?: number;
};
export type ListOrganizationsResult = {
  items: Organization[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export interface OrganizationRepository {
  list(input: ListOrganizationsInput, ctx: Ctx): Promise<ListOrganizationsResult>;
  getById(orgId: string, ctx: Ctx): Promise<Organization | null>;
  create(input: CreateOrganizationInput, ctx: Ctx): Promise<Organization>;
  update(orgId: string, input: UpdateOrganizationInput, ctx: Ctx): Promise<Organization>;
  delete(orgId: string, ctx: Ctx): Promise<{ orgId: string; deletedAt: Date }>;
}
```

### 4.5 Interfaz `AuditLogRepository` (append-only)

```ts
// apps/web/repositories/audit-logs/index.ts
import type { AuditLog, CreateAuditLogInput } from '@shared/schemas/audit-logs';

export type ListAuditLogsInput = {
  organizationId?: string;
  actorId?: string;
  targetType?: 'user' | 'organization' | 'system';
  targetId?: string;
  page?: number;
  pageSize?: number;
};
export type ListAuditLogsResult = {
  items: AuditLog[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export interface AuditLogRepository {
  // append-only. No update / no delete.
  append(input: CreateAuditLogInput, ctx: Ctx): Promise<AuditLog>;
  list(input: ListAuditLogsInput, ctx: Ctx): Promise<ListAuditLogsResult>;
  getById(logId: string, ctx: Ctx): Promise<AuditLog | null>;
}
```

### 4.6 Schemas Zod en `packages/shared`

```ts
// packages/shared/src/schemas/common.ts
import { z } from 'zod';

export const emailSchema = z.string().email().max(254);
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);
export const timestampSchema = z.coerce.date();
export const roleSchema = z.enum(['admin', 'recruiter', 'expert']);
export const statusSchema = z.enum(['active', 'invited', 'suspended']);
```

```ts
// packages/shared/src/schemas/users.ts
import { z } from 'zod';
import { emailSchema, roleSchema, statusSchema, timestampSchema } from './common';

export const userSchema = z.object({
  uid: z.string().min(1),
  email: emailSchema,
  displayName: z.string().min(1).max(120).nullable(),
  photoURL: z.string().url().nullable(),
  role: roleSchema,
  organizationId: z.string().nullable(),
  status: statusSchema,
  lastLoginAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdBy: z.string(),
  deletedAt: timestampSchema.nullable(),
});

export const createUserInputSchema = z.object({
  email: emailSchema,
  displayName: z.string().min(1).max(120).optional(),
  role: roleSchema.default('expert'),
  organizationId: z.string().optional(),
  sendInviteEmail: z.boolean().default(true),
});

export const updateUserInputSchema = z
  .object({
    displayName: z.string().min(1).max(120).nullable().optional(),
    photoURL: z.string().url().nullable().optional(),
    role: roleSchema.optional(),
    status: statusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
```

> (Los schemas de `organizations.ts` y `audit-logs.ts` siguen el mismo patrón — ver `data-model.md`.)

### 4.7 Mapper (snake_case ↔ camelCase)

```ts
// apps/web/repositories/users/mapper.ts
import type { User } from '@shared/schemas/users';
import { Timestamp } from 'firebase/firestore';

export type UserRaw = {
  email: string;
  display_name: string | null;
  photo_url: string | null;
  role: User['role'];
  organization_id: string | null;
  status: User['status'];
  last_login_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  deleted_at: Timestamp | null;
};

export const toUser = (uid: string, raw: UserRaw): User => ({
  uid,
  email: raw.email,
  displayName: raw.display_name,
  photoURL: raw.photo_url,
  role: raw.role,
  organizationId: raw.organization_id,
  status: raw.status,
  lastLoginAt: raw.last_login_at?.toDate() ?? null,
  createdAt: raw.created_at.toDate(),
  updatedAt: raw.updated_at.toDate(),
  createdBy: raw.created_by,
  deletedAt: raw.deleted_at?.toDate() ?? null,
});

export const toUserInputRaw = (input: {
  email: string;
  displayName?: string;
  role: User['role'];
  organizationId?: string;
}): Partial<UserRaw> => ({
  email: input.email,
  display_name: input.displayName ?? null,
  role: input.role,
  organization_id: input.organizationId ?? null,
  status: 'invited',
});

export const toUpdateRaw = (
  input: Partial<{
    displayName: string | null;
    photoURL: string | null;
    role: User['role'];
    status: User['status'];
  }>,
): Partial<UserRaw> => {
  const raw: Partial<UserRaw> = {};
  if (input.displayName !== undefined) raw.display_name = input.displayName;
  if (input.photoURL !== undefined) raw.photo_url = input.photoURL;
  if (input.role !== undefined) raw.role = input.role;
  if (input.status !== undefined) raw.status = input.status;
  return raw;
};
```

### 4.8 `FirebaseUserRepository`

```ts
// apps/web/repositories/users/firebase.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import {
  userSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@shared/schemas/users';
import { RepositoryError } from '../errors';
import type { Ctx, ListUsersInput, ListUsersResult, UserRepository } from './index';
import { toUser, toUpdateRaw, toUserInputRaw, type UserRaw } from './mapper';

const COLLECTION = 'users';

export class FirebaseUserRepository implements UserRepository {
  async list(input: ListUsersInput, ctx: Ctx): Promise<ListUsersResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const filters: QueryConstraint[] = [];
    if (input.organizationId) filters.push(where('organization_id', '==', input.organizationId));
    if (input.status) filters.push(where('status', '==', input.status));
    if (input.role) filters.push(where('role', '==', input.role));

    const q = query(
      collection(db, COLLECTION),
      ...filters,
      orderBy('created_at', 'desc'),
      limit(pageSize * page),
    );

    try {
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => toUser(d.id, d.data() as UserRaw))
        .filter((u) => u.deletedAt === null)
        .filter((u) =>
          input.search
            ? `${u.email} ${u.displayName ?? ''}`.toLowerCase().includes(input.search.toLowerCase())
            : true,
        );
      const start = (page - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);
      return {
        items: paged,
        page,
        pageSize,
        total: items.length,
        hasMore: start + paged.length < items.length,
      };
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal('Failed to list users', e);
    }
  }

  async getById(uid: string, _ctx: Ctx): Promise<User | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION, uid));
      if (!snap.exists()) return null;
      const raw = snap.data() as UserRaw;
      if (raw.deleted_at !== null) return null;
      return userSchema.parse(toUser(uid, raw));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Failed to get user ${uid}`, e);
    }
  }

  async create(input: CreateUserInput, ctx: Ctx): Promise<User> {
    try {
      // Validación adicional (Zod ya se corrió en el caller pero defense in depth)
      const ref = doc(collection(db, COLLECTION));
      const now = serverTimestamp();
      const raw: UserRaw = {
        ...toUserInputRaw(input),
        photo_url: null,
        last_login_at: null,
        created_at: now as Timestamp,
        updated_at: now as Timestamp,
        created_by: ctx.uid,
        deleted_at: null,
      };
      await setDoc(ref, raw);
      const created = toUser(ref.id, {
        ...raw,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return userSchema.parse(created);
    } catch (e) {
      if (String(e).includes('already exists')) {
        throw RepositoryError.alreadyExists('User', 'email', input.email);
      }
      throw RepositoryError.internal(`Failed to create user ${input.email}`, e);
    }
  }

  async update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User> {
    try {
      const ref = doc(db, COLLECTION, uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw RepositoryError.notFound('User', uid);
      const current = snap.data() as UserRaw;

      // Regla de autorización en código (defense in depth — Firestore rules también)
      if (ctx.uid !== uid && ctx.role !== 'admin') {
        throw RepositoryError.permissionDenied('Only admin or self can update user');
      }
      if (input.role && input.role !== current.role && ctx.role !== 'admin') {
        throw RepositoryError.permissionDenied('Only admin can change role');
      }

      const patch = toUpdateRaw(input);
      await updateDoc(ref, { ...patch, updated_at: serverTimestamp() });
      const updated = await this.getById(uid, ctx);
      if (!updated) throw RepositoryError.notFound('User', uid);
      return updated;
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Failed to update user ${uid}`, e);
    }
  }

  async delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    try {
      const ref = doc(db, COLLECTION, uid);
      const now = serverTimestamp();
      await updateDoc(ref, { deleted_at: now, updated_at: now });
      return { uid, deletedAt: new Date() };
    } catch (e) {
      throw RepositoryError.internal(`Failed to delete user ${uid}`, e);
    }
  }
}
```

### 4.9 `MemoryUserRepository`

```ts
// apps/web/repositories/users/memory.ts
import {
  userSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@shared/schemas/users';
import { RepositoryError } from '../errors';
import type { Ctx, ListUsersInput, ListUsersResult, UserRepository } from './index';

let _seq = 0;
const genId = () => `mem_${Date.now()}_${++_seq}`;

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
    return { items: paged, page, pageSize, total, hasMore: start + paged.length < total };
  }

  async getById(uid: string, _ctx: Ctx): Promise<User | null> {
    const u = this.store.get(uid);
    if (!u || u.deletedAt !== null) return null;
    return u;
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
    return user;
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
    const updated: User = { ...current, deletedAt: new Date(), updatedAt: new Date() };
    this.store.set(uid, updated);
    return { uid, deletedAt: updated.deletedAt! };
  }

  // helpers para tests
  __reset() {
    this.store.clear();
    this.emails.clear();
  }
  __seed(items: User[]) {
    items.forEach((u) => {
      this.store.set(u.uid, u);
      this.emails.add(u.email);
    });
  }
}
```

### 4.10 Factory + index

```ts
// apps/web/repositories/users/index.ts
import { FirebaseUserRepository } from './firebase';
import { MemoryUserRepository } from './memory';
import { env } from '@/env';
import type { ListUsersInput, ListUsersResult, UserRepository, Ctx } from './types';

export * from './types';
export { RepositoryError } from '../errors';

let _instance: UserRepository | undefined;
export function getUserRepository(): UserRepository {
  if (_instance) return _instance;
  _instance =
    env.REPOSITORY_DRIVER === 'firebase'
      ? new FirebaseUserRepository()
      : new MemoryUserRepository();
  return _instance;
}

// Para tests — fuerza reset
export function __resetUserRepository() {
  _instance = undefined;
}
```

> El factory vive en `index.ts` del subdirectorio de cada entidad, y se reexporta en `apps/web/repositories/index.ts`.

```ts
// apps/web/repositories/index.ts
export * from './users';
export * from './organizations';
export * from './audit-logs';
```

### 4.11 Tests contractuales

```ts
// apps/web/repositories/users/__tests__/contract.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { FirebaseUserRepository } from '../firebase';
import { MemoryUserRepository } from '../memory';
import type { UserRepository } from '../index';

const ctxAdmin = {
  uid: 'u_admin',
  email: 'admin@x',
  role: 'admin' as const,
  organizationId: 'org_default',
  traceId: 't1',
};
const ctxViewer = {
  uid: 'u_expert',
  email: 'expert@x',
  role: 'expert' as const,
  organizationId: 'org_default',
  traceId: 't2',
};

function suite(name: string, makeRepo: () => UserRepository) {
  describe(`[${name}]`, () => {
    let repo: UserRepository;

    beforeEach(() => {
      repo = makeRepo();
      // Reset state si aplica
    });

    it('create persiste un user y lo devuelve con uid', async () => {
      const u = await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      expect(u.uid).toBeTruthy();
      expect(u.email).toBe('a@x.com');
      expect(u.status).toBe('invited');
    });

    it('create rechaza email duplicado con ALREADY_EXISTS', async () => {
      await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      await expect(
        repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin),
      ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    });

    it('getById retorna null si no existe', async () => {
      const u = await repo.getById('nope', ctxAdmin);
      expect(u).toBeNull();
    });

    it('list pagina y filtra', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create({ email: `u${i}@x.com`, role: 'expert' }, ctxAdmin);
      }
      const r1 = await repo.list({ page: 1, pageSize: 2 }, ctxAdmin);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(5);
      expect(r1.hasMore).toBe(true);
    });

    it('update por expert solo sobre sí mismo', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      // expert actualiza su propio displayName: OK
      const updated = await repo.update(u.uid, { displayName: 'V' }, { ...ctxViewer, uid: u.uid });
      expect(updated.displayName).toBe('V');
    });

    it('update de role por expert falla', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      await expect(
        repo.update(u.uid, { role: 'admin' }, { ...ctxViewer, uid: u.uid }),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('delete por expert falla', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      await expect(repo.delete(u.uid, ctxViewer)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('delete por admin marca deletedAt', async () => {
      const u = await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      const r = await repo.delete(u.uid, ctxAdmin);
      expect(r.deletedAt).toBeInstanceOf(Date);
      const after = await repo.getById(u.uid, ctxAdmin);
      expect(after).toBeNull();
    });
  });
}

suite('Memory', () => new MemoryUserRepository());
// suite('Firebase', () => new FirebaseUserRepository());  // requiere emulador, ver __tests__/firebase.test.ts
```

### 4.12 Tests de integración Firebase (con emulador)

```ts
// apps/web/repositories/users/__tests__/firebase.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { FirebaseUserRepository } from '../firebase';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-firestore-test',
  firestore: { host: '127.0.0.1', port: 8080, rules: '' /* se carga de firestore.rules */ },
});

// beforeAll: cargar reglas
// beforeEach: clearFirestore
// afterAll: cleanup

// Repite los mismos tests del contract pero contra Firebase
```

### 4.13 Comportamiento esperado

1. Service llama `getUserRepository().create(input, ctx)`.
2. En dev: retorna `MemoryUserRepository`. Todo en memoria, sin red.
3. En staging/prod: retorna `FirebaseUserRepository`. Llama Firestore.
4. Errores siempre como `RepositoryError` con códigos semánticos.
5. Validación Zod en cada output (`userSchema.parse(...)`).
6. Tests pasan en CI sin necesidad de emuladores (solo `Memory*` tests). Emuladores solo para integration.

### 4.14 Errores y excepciones

| Situación                                                                 | `code`                              |
| ------------------------------------------------------------------------- | ----------------------------------- |
| Recurso no existe (en `getById` → null; en `update`/`delete` → NOT_FOUND) | `NOT_FOUND`                         |
| Email duplicado en `create`                                               | `ALREADY_EXISTS`                    |
| Custom claims insuficientes                                               | `PERMISSION_DENIED`                 |
| Output no matchea schema Zod                                              | `INTERNAL` (bug — no debería pasar) |
| Firestore devuelve permission-denied                                      | `PERMISSION_DENIED`                 |
| Firestore devuelve unavailable                                            | `UNAVAILABLE`                       |
| Otro error                                                                | `INTERNAL`                          |

### 4.15 Ejemplo de uso

```ts
// apps/web/services/users.ts
import { getUserRepository, RepositoryError } from '@/repositories/users';
import type { Ctx } from '@/repositories/users';

export async function createUserService(input: CreateUserInput, ctx: Ctx) {
  const repo = getUserRepository();
  try {
    return await repo.create(input, ctx);
  } catch (e) {
    if (e instanceof RepositoryError && e.code === 'ALREADY_EXISTS') {
      throw new RepositoryError('ALREADY_EXISTS', 'Ese email ya está registrado', e);
    }
    throw e;
  }
}
```

## 5. Criterios de aceptación

- [ ] Interfaz `UserRepository` exportada con 5 métodos.
- [ ] `FirebaseUserRepository` implementa los 5 métodos y compila con TS estricto.
- [ ] `MemoryUserRepository` implementa los 5 métodos y compila con TS estricto.
- [ ] `RepositoryError` exportado con 6 códigos.
- [ ] `getUserRepository()` factory retorna la impl correcta según `env.REPOSITORY_DRIVER`.
- [ ] Zod schemas en `packages/shared` con tipos inferidos.
- [ ] Mapper snake_case ↔ camelCase con tests de roundtrip.
- [ ] Tests contractuales pasan para `MemoryUserRepository` (mínimo 8 casos).
- [ ] Tests de integración pasan para `FirebaseUserRepository` con emuladores.
- [ ] Coverage ≥ 80% en `repositories/users/`.
- [ ] ESLint rechaza `import { collection } from 'firebase/firestore'` en `services/`.
- [ ] ESLint rechaza `import { FirebaseUserRepository } from '@/repositories/users/firebase'` desde `features/`.
- [ ] Ningún archivo fuera de `repositories/*/firebase.ts` y `lib/firebase/*` importa `firebase/firestore` (verificable con grep).
- [ ] `apps/web/services/` no existe aún (eso es SDD-05), pero el patrón está listo para usarlo.

## 6. Plan de testing

- **Unit (rápido, en CI cada PR)**: `users/memory.test.ts`, `organizations/memory.test.ts`, `audit-logs/memory.test.ts`, `users/contract.test.ts`.
- **Integration (con emulador, en CI nocturna o pre-merge)**: `users/firebase.test.ts`, `organizations/firebase.test.ts`, `audit-logs/firebase.test.ts`.
- **Coverage objetivo**: 80% en `repositories/**`.

## 7. Riesgos y mitigaciones

| Riesgo                                                    | Probabilidad | Impacto | Mitigación                                                                                 |
| --------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------ |
| Drift entre Memory y Firebase                             | M            | A       | Tests contractuales contra ambas impls en `contract.test.ts`. Si divergen, falla el build. |
| Output de Firestore no matchea Zod                        | M            | A       | `userSchema.parse(...)` en cada getter; si falla, se loguea y se tira `INTERNAL`.          |
| Memory impl se vuelve lento con muchos datos              | B            | B       | `Memory` no es para producción. Solo tests. Doc explícito en JSDoc.                        |
| Service se acopla a `FirebaseUserRepository` directamente | M            | A       | ESLint enforcement + code review checklist.                                                |
| Reglas de Firestore más permisivas que código             | M            | A       | Test de reglas independiente (SDD-03) + test de código (este SDD). Defense in depth.       |
| `Mapper` se desincroniza del schema                       | M            | M       | Roundtrip test: `parse(toUser(toRaw(u))) === u`.                                           |

## 8. Out of scope

- Realtime listeners (Firestore `onSnapshot`).
- Bulk operations (loop de create está bien por ahora).
- Multi-region / multi-org querying optimizado.
- Soft-delete recovery UI.
- Data migration scripts (van en `firestore.migrations/` cuando aparezcan).

## 9. Open Questions

- [ ] ¿Los repositories deben aceptar `ctx` o el `ctx` se pasa por un wrapper/closure al instanciar? **Decisión**: `ctx` por método (más flexible para multi-tenant).
- [ ] ¿`MemoryUserRepository` debe usar `localStorage` o solo RAM? **Decisión**: solo RAM. Persistencia entre reloads no es necesaria para tests.
- [ ] ¿El factory memoiza por entorno o crea una instancia nueva cada llamada? **Decisión**: memoiza (es barato y asegura state compartido entre llamadas — crítico para Memory).

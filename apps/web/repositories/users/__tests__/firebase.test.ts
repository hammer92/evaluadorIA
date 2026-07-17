// @vitest-environment jsdom
process.env['NEXT_PUBLIC_APP_ENV'] ??= 'dev';
process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ??= 'fake-api-key';
process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] ??= 'localhost';
process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] ??= 'demo-test';
process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] ??= 'demo-test.appspot.com';
process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ??= '0';
process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] ??= '1:0:web:test';

import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepositoryError } from '../../errors';
import { FirebaseUserRepository } from '../firebase';
import type { UserRaw } from '../mapper';
import type { Ctx } from '../types';

const fakeDb = vi.hoisted(() => {
  type DocMap = Map<string, Record<string, unknown>>;
  const collections = new Map<string, DocMap>();

  const getCollection = (path: string): DocMap => {
    let col = collections.get(path);
    if (!col) {
      col = new Map();
      collections.set(path, col);
    }
    return col;
  };

  let autoIdCounter = 0;
  const nextAutoId = (): string => `auto_${++autoIdCounter}`;

  const SERVER_TIMESTAMP = { __isServerTimestamp: true } as const;

  return {
    collections,
    getCollection,
    nextAutoId,
    SERVER_TIMESTAMP,
    clear(): void {
      collections.clear();
      autoIdCounter = 0;
    },
  };
});

vi.mock('firebase/firestore', async () => {
  type ActualModule = typeof import('firebase/firestore');
  const actual = await vi.importActual<ActualModule>('firebase/firestore');
  const real = actual as unknown as ActualModule;

  interface WhereConstraint {
    __type: 'where';
    field: string;
    op: string;
    value: unknown;
  }
  interface OrderByConstraint {
    __type: 'orderBy';
    field: string;
    direction: 'asc' | 'desc';
  }
  interface LimitConstraint {
    __type: 'limit';
    limit: number;
  }
  type Constraint = WhereConstraint | OrderByConstraint | LimitConstraint;

  const resolveServerTimestamps = (value: unknown): unknown => {
    if (value === fakeDb.SERVER_TIMESTAMP) {
      return real.Timestamp.now();
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof actual.Timestamp)
    ) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = resolveServerTimestamps(v);
      }
      return result;
    }
    return value;
  };

  const collectionMock = vi.fn((_db: unknown, path: string) => ({
    __type: 'collection' as const,
    __path: path,
  }));

  const docMock = vi.fn((dbOrCol: unknown, path?: string, id?: string) => {
    if (path === undefined) {
      const col = dbOrCol as { __path: string };
      const newId = fakeDb.nextAutoId();
      return {
        __type: 'doc' as const,
        __path: `${col.__path}/${newId}`,
        __id: newId,
        id: newId,
      };
    }
    let colPath: string;
    let docId: string;
    if (id === undefined) {
      colPath = (dbOrCol as { __path: string }).__path;
      docId = path;
    } else {
      colPath = path;
      docId = id;
    }
    return {
      __type: 'doc' as const,
      __path: `${colPath}/${docId}`,
      __id: docId,
      id: docId,
    };
  });

  const queryMock = vi.fn((col: { __path: string }, ...constraints: unknown[]) => ({
    __type: 'query' as const,
    __path: col.__path,
    __constraints: constraints as Constraint[],
  }));

  const whereMock = vi.fn(
    (field: string, op: string, value: unknown): WhereConstraint => ({
      __type: 'where',
      field,
      op,
      value,
    }),
  );

  const orderByMock = vi.fn(
    (field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint => ({
      __type: 'orderBy',
      field,
      direction,
    }),
  );

  const limitMock = vi.fn((n: number): LimitConstraint => ({ __type: 'limit', limit: n }));

  const getDocsMock = vi.fn(async (q: { __path: string; __constraints?: Constraint[] }) => {
    const col = fakeDb.getCollection(q.__path);
    let items: { id: string; data: Record<string, unknown> }[] = Array.from(col.entries()).map(
      ([id, data]) => ({ id, data: { ...data } }),
    );

    for (const c of q.__constraints ?? []) {
      if (c.__type === 'where') {
        items = items.filter((it) => {
          const fieldValue = it.data[c.field];
          if (c.op === '==') return fieldValue === c.value;
          if (c.op === '!=') return fieldValue !== c.value;
          return true;
        });
      }
    }

    for (const c of q.__constraints ?? []) {
      if (c.__type === 'orderBy') {
        const dir = c.direction === 'desc' ? -1 : 1;
        items.sort((a, b) => {
          const aVal = a.data[c.field];
          const bVal = b.data[c.field];
          const aTime = aVal instanceof actual.Timestamp ? aVal.toMillis() : 0;
          const bTime = bVal instanceof actual.Timestamp ? bVal.toMillis() : 0;
          if (aTime === bTime) return 0;
          return aTime < bTime ? -1 * dir : 1 * dir;
        });
      }
    }

    for (const c of q.__constraints ?? []) {
      if (c.__type === 'limit') {
        items = items.slice(0, c.limit);
      }
    }

    return {
      docs: items.map((it) => ({
        id: it.id,
        data: () => ({ ...it.data }),
      })),
    };
  });

  const getDocMock = vi.fn(async (ref: { __path: string; __id: string }) => {
    const pathParts = ref.__path.split('/');
    const docId = pathParts.pop() ?? ref.__id;
    const colPath = pathParts.join('/');
    const col = fakeDb.getCollection(colPath);
    const data = col.get(docId);
    if (data === undefined) {
      return { exists: (): boolean => false, data: (): undefined => undefined, id: docId };
    }
    return {
      exists: (): boolean => true,
      data: (): Record<string, unknown> => ({ ...data }),
      id: docId,
    };
  });

  const setDocMock = vi.fn(async (ref: { __path: string }, data: Record<string, unknown>) => {
    const pathParts = ref.__path.split('/');
    const docId = pathParts.pop()!;
    const colPath = pathParts.join('/');
    const col = fakeDb.getCollection(colPath);
    col.set(docId, resolveServerTimestamps(data) as Record<string, unknown>);
  });

  const updateDocMock = vi.fn(async (ref: { __path: string }, data: Record<string, unknown>) => {
    const pathParts = ref.__path.split('/');
    const docId = pathParts.pop()!;
    const colPath = pathParts.join('/');
    const col = fakeDb.getCollection(colPath);
    const existing = col.get(docId);
    if (!existing) {
      throw new Error(`No document to update: ${ref.__path}`);
    }
    col.set(docId, {
      ...existing,
      ...(resolveServerTimestamps(data) as Record<string, unknown>),
    });
  });

  const serverTimestampMock = vi.fn(() => fakeDb.SERVER_TIMESTAMP);

  return {
    ...actual,
    collection: collectionMock,
    doc: docMock,
    query: queryMock,
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    getDocs: getDocsMock,
    getDoc: getDocMock,
    setDoc: setDocMock,
    updateDoc: updateDocMock,
    serverTimestamp: serverTimestampMock,
  };
});

const ctxAdmin: Ctx = {
  uid: 'u_admin',
  email: 'admin@x.com',
  role: 'admin',
  organizationId: 'org_default',
  traceId: 't1',
};

const ctxExpert: Ctx = {
  uid: 'u_expert',
  email: 'expert@x.com',
  role: 'expert',
  organizationId: 'org_default',
  traceId: 't2',
};

function makeUserRaw(overrides: Partial<UserRaw> = {}): UserRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    email: 'a@x.com',
    display_name: null,
    photo_url: null,
    role: 'expert',
    organization_id: null,
    status: 'active',
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
    created_by: 'u_admin',
    deleted_at: null,
    ...overrides,
  };
}

function seedUserRaw(id: string, raw: Partial<UserRaw> = {}): void {
  fakeDb.getCollection('users').set(id, makeUserRaw(raw) as unknown as Record<string, unknown>);
}

describe('[UserRepository:Firebase]', () => {
  let repo: FirebaseUserRepository;

  beforeEach(() => {
    fakeDb.clear();
    vi.clearAllMocks();
    repo = new FirebaseUserRepository({} as never);
  });

  describe('constructor', () => {
    it('acepta una instancia db inyectada', () => {
      const fakeDbInstance = { __custom: true };
      expect(() => new FirebaseUserRepository(fakeDbInstance as never)).not.toThrow();
    });

    it('usa defaultDb cuando no se pasa dbInstance (no lanza)', () => {
      expect(() => new FirebaseUserRepository()).not.toThrow();
    });
  });

  describe('list', () => {
    it('retorna resultado vacío cuando no hay docs', async () => {
      const r = await repo.list({}, ctxAdmin);
      expect(r.items).toEqual([]);
      expect(r.total).toBe(0);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
      expect(r.hasMore).toBe(false);
    });

    it('paginates con pageSize default 20 y page 1', async () => {
      for (let i = 0; i < 5; i++) seedUserRaw(`u${i}`, { email: `u${i}@x.com` });
      const r = await repo.list({}, ctxAdmin);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
      expect(r.items.length).toBe(5);
      expect(r.total).toBe(5);
      expect(r.hasMore).toBe(false);
    });

    it('construye query con where + orderBy(created_at, desc) + limit', async () => {
      const { collection, where, orderBy, limit, query, getDocs } =
        await import('firebase/firestore');
      seedUserRaw('a', { email: 'a@x.com', organization_id: 'org_1' });

      await repo.list({ organizationId: 'org_1', page: 1, pageSize: 5 }, ctxAdmin);

      expect(collection).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('organization_id', '==', 'org_1');
      expect(orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(limit).toHaveBeenCalledWith(5);
      expect(query).toHaveBeenCalled();
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('filtra por organizationId, status y role simultáneamente', async () => {
      seedUserRaw('a', {
        email: 'a@x.com',
        organization_id: 'org_1',
        status: 'active',
        role: 'expert',
      });
      seedUserRaw('b', {
        email: 'b@x.com',
        organization_id: 'org_2',
        status: 'active',
        role: 'expert',
      });
      seedUserRaw('c', {
        email: 'c@x.com',
        organization_id: 'org_1',
        status: 'invited',
        role: 'expert',
      });

      const r = await repo.list(
        { organizationId: 'org_1', status: 'active', role: 'expert' },
        ctxAdmin,
      );
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.email).toBe('a@x.com');
    });

    it('omite filtros where cuando los inputs son undefined', async () => {
      const { where } = await import('firebase/firestore');
      await repo.list({}, ctxAdmin);
      expect(where).not.toHaveBeenCalled();
    });

    it('excluye docs soft-deleted (deleted_at != null)', async () => {
      seedUserRaw('a', { email: 'a@x.com' });
      seedUserRaw('b', { email: 'b@x.com', deleted_at: Timestamp.fromDate(new Date()) });

      const r = await repo.list({}, ctxAdmin);
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.uid).toBe('a');
      expect(r.total).toBe(1);
    });

    it('aplica search filter en memoria (case-insensitive sobre email + displayName)', async () => {
      seedUserRaw('a', { email: 'maria@x.com', display_name: 'Maria' });
      seedUserRaw('b', { email: 'juan@x.com', display_name: 'Juan' });
      seedUserRaw('c', { email: 'x@x.com', display_name: null });

      const r1 = await repo.list({ search: 'maria' }, ctxAdmin);
      expect(r1.items.length).toBe(1);
      expect(r1.items[0]!.email).toBe('maria@x.com');

      const r2 = await repo.list({ search: 'JUAN' }, ctxAdmin);
      expect(r2.items.length).toBe(1);
      expect(r2.items[0]!.email).toBe('juan@x.com');

      const r3 = await repo.list({ search: 'notfound' }, ctxAdmin);
      expect(r3.items.length).toBe(0);
    });

    it('search matchea por displayName aunque email no contenga el término', async () => {
      seedUserRaw('a', { email: 'x@x.com', display_name: 'Mengano' });
      const r = await repo.list({ search: 'mengano' }, ctxAdmin);
      expect(r.items.length).toBe(1);
    });

    it('search maneja displayName null sin lanzar', async () => {
      seedUserRaw('a', { email: 'foo@x.com', display_name: null });
      const r = await repo.list({ search: 'foo' }, ctxAdmin);
      expect(r.items.length).toBe(1);
    });

    it('ordena por created_at desc', async () => {
      seedUserRaw('a', {
        email: 'a@x.com',
        created_at: Timestamp.fromDate(new Date('2026-06-30T10:00:00Z')),
      });
      seedUserRaw('b', {
        email: 'b@x.com',
        created_at: Timestamp.fromDate(new Date('2026-06-30T12:00:00Z')),
      });
      seedUserRaw('c', {
        email: 'c@x.com',
        created_at: Timestamp.fromDate(new Date('2026-06-30T11:00:00Z')),
      });

      const r = await repo.list({}, ctxAdmin);
      expect(r.items.map((u) => u.email)).toEqual(['b@x.com', 'c@x.com', 'a@x.com']);
    });

    it('clamp pageSize a [1, 100]', async () => {
      const r1 = await repo.list({ pageSize: 0 }, ctxAdmin);
      expect(r1.pageSize).toBe(1);

      const r2 = await repo.list({ pageSize: -5 }, ctxAdmin);
      expect(r2.pageSize).toBe(1);

      const r3 = await repo.list({ pageSize: 9999 }, ctxAdmin);
      expect(r3.pageSize).toBe(100);

      const r4 = await repo.list({ pageSize: 25 }, ctxAdmin);
      expect(r4.pageSize).toBe(25);
    });

    it('clamp page a >= 1', async () => {
      const r1 = await repo.list({ page: 0 }, ctxAdmin);
      expect(r1.page).toBe(1);

      const r2 = await repo.list({ page: -10 }, ctxAdmin);
      expect(r2.page).toBe(1);

      const r3 = await repo.list({ page: 3 }, ctxAdmin);
      expect(r3.page).toBe(3);
    });

    it('pagina correctamente con hasMore', async () => {
      for (let i = 0; i < 5; i++) seedUserRaw(`u${i}`, { email: `u${i}@x.com` });

      const r1 = await repo.list({ page: 1, pageSize: 2 }, ctxAdmin);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(2);
      expect(r1.hasMore).toBe(false);

      const r2 = await repo.list({ page: 2, pageSize: 2 }, ctxAdmin);
      expect(r2.items.length).toBe(2);
      expect(r2.total).toBe(4);
      expect(r2.hasMore).toBe(false);

      const r3 = await repo.list({ page: 3, pageSize: 2 }, ctxAdmin);
      expect(r3.items.length).toBe(1);
      expect(r3.total).toBe(5);
      expect(r3.hasMore).toBe(false);
    });

    it('hasMore es false incluso cuando hay más páginas (limitación de limit(pageSize*page))', async () => {
      for (let i = 0; i < 100; i++) seedUserRaw(`u${i}`, { email: `u${i}@x.com` });

      const r1 = await repo.list({ page: 1, pageSize: 10 }, ctxAdmin);
      expect(r1.items.length).toBe(10);
      expect(r1.hasMore).toBe(false);

      const r5 = await repo.list({ page: 5, pageSize: 10 }, ctxAdmin);
      expect(r5.items.length).toBe(10);
      expect(r5.total).toBe(50);
      expect(r5.hasMore).toBe(false);
    });

    it('page fuera de rango retorna items vacío pero total correcto', async () => {
      seedUserRaw('a', { email: 'a@x.com' });
      const r = await repo.list({ page: 99, pageSize: 10 }, ctxAdmin);
      expect(r.items.length).toBe(0);
      expect(r.total).toBe(1);
      expect(r.hasMore).toBe(false);
    });

    it('wraps errores de getDocs en RepositoryError INTERNAL', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      try {
        await repo.list({}, ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError', async () => {
      const { getDocs } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (getDocs as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(re);
      await expect(repo.list({}, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('getById', () => {
    it('retorna null cuando el doc no existe', async () => {
      expect(await repo.getById('nope', ctxAdmin)).toBeNull();
    });

    it('retorna null cuando el doc está soft-deleted', async () => {
      seedUserRaw('u', { deleted_at: Timestamp.fromDate(new Date()) });
      expect(await repo.getById('u', ctxAdmin)).toBeNull();
    });

    it('retorna User parseado cuando el doc existe', async () => {
      seedUserRaw('u', {
        email: 'a@x.com',
        display_name: 'Alice',
        role: 'expert',
        status: 'active',
      });
      const u = await repo.getById('u', ctxAdmin);
      expect(u).not.toBeNull();
      expect(u!.uid).toBe('u');
      expect(u!.email).toBe('a@x.com');
      expect(u!.displayName).toBe('Alice');
      expect(u!.role).toBe('expert');
      expect(u!.status).toBe('active');
      expect(u!.createdAt).toBeInstanceOf(Date);
      expect(u!.updatedAt).toBeInstanceOf(Date);
    });

    it('wraps errores en RepositoryError INTERNAL', async () => {
      const { getDoc } = await import('firebase/firestore');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(repo.getById('u', ctxAdmin)).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('no re-envuelve RepositoryError', async () => {
      const { getDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.getById('u', ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('create', () => {
    it('crea user con uid auto, status invited, createdBy = ctx.uid', async () => {
      const u = await repo.create({ email: 'new@x.com', role: 'expert' }, ctxAdmin);
      expect(u.uid).toBeTruthy();
      expect(u.email).toBe('new@x.com');
      expect(u.role).toBe('expert');
      expect(u.status).toBe('invited');
      expect(u.createdBy).toBe(ctxAdmin.uid);
      expect(u.organizationId).toBeNull();
      expect(u.displayName).toBeNull();
      expect(u.photoURL).toBeNull();
      expect(u.deletedAt).toBeNull();
      expect(u.createdAt).toBeInstanceOf(Date);
      expect(u.updatedAt).toBeInstanceOf(Date);
      expect(u.lastLoginAt).toBeNull();
    });

    it('acepta y persiste displayName opcional', async () => {
      const u = await repo.create(
        { email: 'a@x.com', role: 'expert', displayName: 'Alice' },
        ctxAdmin,
      );
      expect(u.displayName).toBe('Alice');
    });

    it('acepta y persiste organizationId opcional', async () => {
      const u = await repo.create(
        { email: 'a@x.com', role: 'expert', organizationId: 'org_x' },
        ctxAdmin,
      );
      expect(u.organizationId).toBe('org_x');
    });

    it('escribe el doc en el fake store con serverTimestamp resuelto', async () => {
      const u = await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      const stored = fakeDb.getCollection('users').get(u.uid);
      expect(stored).toBeDefined();
      expect(stored!['email']).toBe('a@x.com');
      expect(stored!['status']).toBe('invited');
      expect(stored!['created_by']).toBe(ctxAdmin.uid);
      expect(stored!['deleted_at']).toBeNull();
      expect(stored!['created_at']).toBeInstanceOf(Timestamp);
      expect(stored!['updated_at']).toBeInstanceOf(Timestamp);
    });

    it('lanza ALREADY_EXISTS cuando setDoc rechaza con mensaje "already exists"', async () => {
      const { setDoc } = await import('firebase/firestore');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Document already exists in collection'),
      );
      await expect(
        repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin),
      ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    });

    it('wraps errores genéricos en RepositoryError INTERNAL', async () => {
      const { setDoc } = await import('firebase/firestore');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(
        repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin),
      ).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('no re-envuelve RepositoryError de setDoc', async () => {
      const { setDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('update', () => {
    it('actualiza displayName y re-lee el doc', async () => {
      seedUserRaw('u', { email: 'a@x.com', display_name: 'Old' });
      const updated = await repo.update('u', { displayName: 'New' }, ctxAdmin);
      expect(updated.displayName).toBe('New');
    });

    it('actualiza photoURL', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const updated = await repo.update('u', { photoURL: 'https://x.com/p.png' }, ctxAdmin);
      expect(updated.photoURL).toBe('https://x.com/p.png');
    });

    it('actualiza status', async () => {
      seedUserRaw('u', { email: 'a@x.com', status: 'active' });
      const updated = await repo.update('u', { status: 'suspended' }, ctxAdmin);
      expect(updated.status).toBe('suspended');
    });

    it('lanza NOT_FOUND si el doc no existe', async () => {
      await expect(repo.update('nope', { displayName: 'x' }, ctxAdmin)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('lanza PERMISSION_DENIED cuando expert intenta actualizar OTRO user', async () => {
      seedUserRaw('u', { email: 'a@x.com', role: 'expert' });
      await expect(repo.update('u', { displayName: 'x' }, ctxExpert)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('permite a expert actualizar su propio user (excepto role)', async () => {
      seedUserRaw('u', { email: 'a@x.com', role: 'expert' });
      const updated = await repo.update('u', { displayName: 'Self' }, { ...ctxExpert, uid: 'u' });
      expect(updated.displayName).toBe('Self');
    });

    it('lanza PERMISSION_DENIED cuando expert intenta cambiar su role', async () => {
      seedUserRaw('u', { email: 'a@x.com', role: 'expert' });
      await expect(
        repo.update('u', { role: 'admin' }, { ...ctxExpert, uid: 'u' }),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('NO lanza PERMISSION_DENIED cuando role es el mismo valor', async () => {
      seedUserRaw('u', { email: 'a@x.com', role: 'expert' });
      const updated = await repo.update('u', { role: 'expert' }, { ...ctxExpert, uid: 'u' });
      expect(updated.role).toBe('expert');
    });

    it('permite a admin cambiar role', async () => {
      seedUserRaw('u', { email: 'a@x.com', role: 'expert' });
      const updated = await repo.update('u', { role: 'admin' }, ctxAdmin);
      expect(updated.role).toBe('admin');
    });

    it('llama updateDoc con patch + serverTimestamp en updated_at', async () => {
      const { updateDoc } = await import('firebase/firestore');
      seedUserRaw('u', { email: 'a@x.com' });
      await repo.update('u', { displayName: 'New' }, ctxAdmin);
      expect(updateDoc).toHaveBeenCalledTimes(1);
      const call = (updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toMatchObject({ display_name: 'New' });
      expect(call?.[1]).toHaveProperty('updated_at', fakeDb.SERVER_TIMESTAMP);
    });

    it('wraps errores de updateDoc en INTERNAL', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(repo.update('u', { displayName: 'x' }, ctxAdmin)).rejects.toMatchObject({
        code: 'INTERNAL',
      });
    });

    it('no re-envuelve RepositoryError de updateDoc', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const { updateDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.update('u', { displayName: 'x' }, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('delete', () => {
    it('marca deleted_at y retorna {uid, deletedAt}', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const r = await repo.delete('u', ctxAdmin);
      expect(r.uid).toBe('u');
      expect(r.deletedAt).toBeInstanceOf(Date);
    });

    it('después de delete, getById retorna null', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      await repo.delete('u', ctxAdmin);
      expect(await repo.getById('u', ctxAdmin)).toBeNull();
    });

    it('llama updateDoc con serverTimestamp para deleted_at y updated_at', async () => {
      const { updateDoc } = await import('firebase/firestore');
      seedUserRaw('u', { email: 'a@x.com' });
      await repo.delete('u', ctxAdmin);
      const call = (updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toMatchObject({
        deleted_at: fakeDb.SERVER_TIMESTAMP,
        updated_at: fakeDb.SERVER_TIMESTAMP,
      });
    });

    it('lanza PERMISSION_DENIED si el rol no es admin', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      await expect(repo.delete('u', ctxExpert)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('lanza PERMISSION_DENIED si el rol es recruiter', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      await expect(repo.delete('u', { ...ctxExpert, role: 'recruiter' })).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('wraps errores de updateDoc en INTERNAL', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(repo.delete('u', ctxAdmin)).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('no re-envuelve RepositoryError de updateDoc', async () => {
      seedUserRaw('u', { email: 'a@x.com' });
      const { updateDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.delete('u', ctxAdmin)).rejects.toBe(re);
    });
  });
});

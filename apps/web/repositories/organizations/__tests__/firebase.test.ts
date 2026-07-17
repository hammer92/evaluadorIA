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
import { FirebaseOrganizationRepository } from '../firebase';
import type { OrganizationRaw } from '../mapper';
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

  interface OrderByConstraint {
    __type: 'orderBy';
    field: string;
    direction: 'asc' | 'desc';
  }
  interface LimitConstraint {
    __type: 'limit';
    limit: number;
  }
  type Constraint = OrderByConstraint | LimitConstraint;

  const resolveServerTimestamps = (value: unknown): unknown => {
    if (value === fakeDb.SERVER_TIMESTAMP) {
      return real.Timestamp.now();
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof real.Timestamp)
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

const ctxRecruiter: Ctx = {
  uid: 'u_rec',
  email: 'rec@x.com',
  role: 'recruiter',
  organizationId: 'org_default',
  traceId: 't2',
};

const ctxExpert: Ctx = {
  uid: 'u_exp',
  email: 'exp@x.com',
  role: 'expert',
  organizationId: 'org_default',
  traceId: 't3',
};

function makeOrgRaw(overrides: Partial<OrganizationRaw> = {}): OrganizationRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    name: 'Acme',
    slug: 'acme',
    plan: 'free',
    settings: { timezone: 'UTC', locale: 'en' },
    created_at: ts,
    updated_at: ts,
    created_by: 'u_admin',
    deleted_at: null,
    ...overrides,
  };
}

function seedOrgRaw(id: string, raw: Partial<OrganizationRaw> = {}): void {
  fakeDb
    .getCollection('organizations')
    .set(id, makeOrgRaw(raw) as unknown as Record<string, unknown>);
}

describe('[OrganizationRepository:Firebase]', () => {
  let repo: FirebaseOrganizationRepository;

  beforeEach(() => {
    fakeDb.clear();
    vi.clearAllMocks();
    repo = new FirebaseOrganizationRepository({} as never);
  });

  describe('constructor', () => {
    it('acepta una instancia db inyectada', () => {
      const fakeDbInstance = { __custom: true };
      expect(() => new FirebaseOrganizationRepository(fakeDbInstance as never)).not.toThrow();
    });

    it('usa defaultDb cuando no se pasa dbInstance (no lanza)', () => {
      expect(() => new FirebaseOrganizationRepository()).not.toThrow();
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
      for (let i = 0; i < 5; i++) seedOrgRaw(`o${i}`, { slug: `slug-${i}` });
      const r = await repo.list({}, ctxAdmin);
      expect(r.items.length).toBe(5);
      expect(r.total).toBe(5);
    });

    it('excluye soft-deleted por defecto (status !== "deleted")', async () => {
      seedOrgRaw('a', { slug: 'a' });
      seedOrgRaw('b', { slug: 'b', deleted_at: Timestamp.fromDate(new Date()) });

      const r = await repo.list({}, ctxAdmin);
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.slug).toBe('a');
      expect(r.total).toBe(1);
    });

    it('incluye soft-deleted cuando status = "deleted"', async () => {
      seedOrgRaw('a', { slug: 'a' });
      seedOrgRaw('b', { slug: 'b', deleted_at: Timestamp.fromDate(new Date()) });

      const r = await repo.list({ status: 'deleted' }, ctxAdmin);
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.slug).toBe('b');
      expect(r.total).toBe(1);
    });

    it('construye query con orderBy(created_at, desc) y limit(pageSize * page)', async () => {
      const { collection, orderBy, limit, query, getDocs } = await import('firebase/firestore');
      seedOrgRaw('a', { slug: 'a' });

      await repo.list({ page: 1, pageSize: 5 }, ctxAdmin);

      expect(collection).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(limit).toHaveBeenCalledWith(5);
      expect(query).toHaveBeenCalled();
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('ordena por created_at desc', async () => {
      seedOrgRaw('a', {
        slug: 'a',
        created_at: Timestamp.fromDate(new Date('2026-06-30T10:00:00Z')),
      });
      seedOrgRaw('b', {
        slug: 'b',
        created_at: Timestamp.fromDate(new Date('2026-06-30T12:00:00Z')),
      });
      seedOrgRaw('c', {
        slug: 'c',
        created_at: Timestamp.fromDate(new Date('2026-06-30T11:00:00Z')),
      });

      const r = await repo.list({}, ctxAdmin);
      expect(r.items.map((o) => o.slug)).toEqual(['b', 'c', 'a']);
    });

    it('clamp pageSize a [1, 100]', async () => {
      const r1 = await repo.list({ pageSize: 0 }, ctxAdmin);
      expect(r1.pageSize).toBe(1);

      const r2 = await repo.list({ pageSize: -5 }, ctxAdmin);
      expect(r2.pageSize).toBe(1);

      const r3 = await repo.list({ pageSize: 9999 }, ctxAdmin);
      expect(r3.pageSize).toBe(100);

      const r4 = await repo.list({ pageSize: 15 }, ctxAdmin);
      expect(r4.pageSize).toBe(15);
    });

    it('clamp page a >= 1', async () => {
      const r1 = await repo.list({ page: 0 }, ctxAdmin);
      expect(r1.page).toBe(1);

      const r2 = await repo.list({ page: -10 }, ctxAdmin);
      expect(r2.page).toBe(1);

      const r3 = await repo.list({ page: 2 }, ctxAdmin);
      expect(r3.page).toBe(2);
    });

    it('pagina correctamente con limit(pageSize*page)', async () => {
      for (let i = 0; i < 5; i++) seedOrgRaw(`o${i}`, { slug: `s${i}` });

      const r1 = await repo.list({ page: 1, pageSize: 2 }, ctxAdmin);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(2);

      const r2 = await repo.list({ page: 2, pageSize: 2 }, ctxAdmin);
      expect(r2.items.length).toBe(2);
      expect(r2.total).toBe(4);

      const r3 = await repo.list({ page: 3, pageSize: 2 }, ctxAdmin);
      expect(r3.items.length).toBe(1);
      expect(r3.total).toBe(5);
    });

    it('wraps errores de getDocs en RepositoryError INTERNAL', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      try {
        await repo.list({}, ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError de getDocs', async () => {
      const { getDocs } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (getDocs as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.list({}, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('getById', () => {
    it('retorna null cuando el doc no existe', async () => {
      expect(await repo.getById('nope', ctxAdmin)).toBeNull();
    });

    it('retorna null cuando el doc está soft-deleted', async () => {
      seedOrgRaw('o', { deleted_at: Timestamp.fromDate(new Date()) });
      expect(await repo.getById('o', ctxAdmin)).toBeNull();
    });

    it('retorna Organization parseada cuando el doc existe', async () => {
      seedOrgRaw('o', {
        name: 'Acme Inc',
        slug: 'acme',
        plan: 'pro',
        settings: { timezone: 'America/Argentina/Buenos_Aires', locale: 'es' },
      });
      const o = await repo.getById('o', ctxAdmin);
      expect(o).not.toBeNull();
      expect(o!.orgId).toBe('o');
      expect(o!.name).toBe('Acme Inc');
      expect(o!.slug).toBe('acme');
      expect(o!.plan).toBe('pro');
      expect(o!.settings.timezone).toBe('America/Argentina/Buenos_Aires');
      expect(o!.settings.locale).toBe('es');
      expect(o!.createdAt).toBeInstanceOf(Date);
      expect(o!.updatedAt).toBeInstanceOf(Date);
    });

    it('wraps errores en RepositoryError INTERNAL', async () => {
      const { getDoc } = await import('firebase/firestore');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      try {
        await repo.getById('o', ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError de getDoc', async () => {
      const { getDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.getById('o', ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('create', () => {
    it('lanza PERMISSION_DENIED cuando el rol no es admin', async () => {
      await expect(
        repo.create({ name: 'X', slug: 'x', plan: 'free' }, ctxRecruiter),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('lanza PERMISSION_DENIED cuando el rol es expert', async () => {
      await expect(
        repo.create({ name: 'X', slug: 'x', plan: 'free' }, ctxExpert),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('crea org con uid auto y createdBy = ctx.uid', async () => {
      const o = await repo.create({ name: 'Acme', slug: 'acme', plan: 'pro' }, ctxAdmin);
      expect(o.orgId).toBeTruthy();
      expect(o.name).toBe('Acme');
      expect(o.slug).toBe('acme');
      expect(o.plan).toBe('pro');
      expect(o.createdBy).toBe(ctxAdmin.uid);
      expect(o.deletedAt).toBeNull();
      expect(o.createdAt).toBeInstanceOf(Date);
      expect(o.updatedAt).toBeInstanceOf(Date);
    });

    it('asigna settings default {timezone: "UTC", locale: "en"}', async () => {
      const o = await repo.create({ name: 'A', slug: 'a', plan: 'free' }, ctxAdmin);
      expect(o.settings).toEqual({ timezone: 'UTC', locale: 'en' });
    });

    it('escribe el doc en el fake store con serverTimestamp resuelto', async () => {
      const o = await repo.create({ name: 'A', slug: 'a', plan: 'free' }, ctxAdmin);
      const stored = fakeDb.getCollection('organizations').get(o.orgId);
      expect(stored).toBeDefined();
      expect(stored!['name']).toBe('A');
      expect(stored!['slug']).toBe('a');
      expect(stored!['plan']).toBe('free');
      expect(stored!['settings']).toEqual({ timezone: 'UTC', locale: 'en' });
      expect(stored!['created_by']).toBe(ctxAdmin.uid);
      expect(stored!['deleted_at']).toBeNull();
      expect(stored!['created_at']).toBeInstanceOf(Timestamp);
      expect(stored!['updated_at']).toBeInstanceOf(Timestamp);
    });

    it('wraps errores de setDoc en RepositoryError INTERNAL', async () => {
      const { setDoc } = await import('firebase/firestore');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      try {
        await repo.create({ name: 'A', slug: 'a', plan: 'free' }, ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError de setDoc', async () => {
      const { setDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.create({ name: 'A', slug: 'a', plan: 'free' }, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('update', () => {
    it('lanza PERMISSION_DENIED cuando el rol no es admin', async () => {
      seedOrgRaw('o', { slug: 'a' });
      await expect(repo.update('o', { name: 'New' }, ctxRecruiter)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('lanza PERMISSION_DENIED cuando el rol es expert', async () => {
      seedOrgRaw('o', { slug: 'a' });
      await expect(repo.update('o', { name: 'New' }, ctxExpert)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('lanza NOT_FOUND si el doc no existe', async () => {
      await expect(repo.update('nope', { name: 'X' }, ctxAdmin)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('actualiza name y re-lee el doc', async () => {
      seedOrgRaw('o', { slug: 'a', name: 'Old' });
      const updated = await repo.update('o', { name: 'New' }, ctxAdmin);
      expect(updated.name).toBe('New');
    });

    it('actualiza plan', async () => {
      seedOrgRaw('o', { slug: 'a', plan: 'free' });
      const updated = await repo.update('o', { plan: 'enterprise' }, ctxAdmin);
      expect(updated.plan).toBe('enterprise');
    });

    it('actualiza settings (timezone + locale)', async () => {
      seedOrgRaw('o', { slug: 'a', settings: { timezone: 'UTC', locale: 'en' } });
      const updated = await repo.update(
        'o',
        { settings: { timezone: 'America/Buenos_Aires', locale: 'es' } },
        ctxAdmin,
      );
      expect(updated.settings.timezone).toBe('America/Buenos_Aires');
      expect(updated.settings.locale).toBe('es');
    });

    it('llama updateDoc con patch + serverTimestamp en updated_at', async () => {
      const { updateDoc } = await import('firebase/firestore');
      seedOrgRaw('o', { slug: 'a', name: 'Old' });
      await repo.update('o', { name: 'New' }, ctxAdmin);
      expect(updateDoc).toHaveBeenCalledTimes(1);
      const call = (updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toMatchObject({ name: 'New' });
      expect(call?.[1]).toHaveProperty('updated_at', fakeDb.SERVER_TIMESTAMP);
    });

    it('wraps errores de updateDoc en INTERNAL', async () => {
      seedOrgRaw('o', { slug: 'a' });
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      try {
        await repo.update('o', { name: 'X' }, ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError de updateDoc', async () => {
      seedOrgRaw('o', { slug: 'a' });
      const { updateDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.update('o', { name: 'X' }, ctxAdmin)).rejects.toBe(re);
    });
  });

  describe('delete', () => {
    it('lanza PERMISSION_DENIED cuando el rol no es admin', async () => {
      seedOrgRaw('o', { slug: 'a' });
      await expect(repo.delete('o', ctxRecruiter)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('lanza PERMISSION_DENIED cuando el rol es expert', async () => {
      seedOrgRaw('o', { slug: 'a' });
      await expect(repo.delete('o', ctxExpert)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });

    it('marca deleted_at y retorna {orgId, deletedAt}', async () => {
      seedOrgRaw('o', { slug: 'a' });
      const r = await repo.delete('o', ctxAdmin);
      expect(r.orgId).toBe('o');
      expect(r.deletedAt).toBeInstanceOf(Date);
    });

    it('después de delete, getById retorna null', async () => {
      seedOrgRaw('o', { slug: 'a' });
      await repo.delete('o', ctxAdmin);
      expect(await repo.getById('o', ctxAdmin)).toBeNull();
    });

    it('llama updateDoc con serverTimestamp para deleted_at y updated_at', async () => {
      const { updateDoc } = await import('firebase/firestore');
      seedOrgRaw('o', { slug: 'a' });
      await repo.delete('o', ctxAdmin);
      const call = (updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toMatchObject({
        deleted_at: fakeDb.SERVER_TIMESTAMP,
        updated_at: fakeDb.SERVER_TIMESTAMP,
      });
    });

    it('wraps errores de updateDoc en INTERNAL', async () => {
      seedOrgRaw('o', { slug: 'a' });
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      try {
        await repo.delete('o', ctxAdmin);
        expect.fail('expected to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(RepositoryError);
        expect((e as RepositoryError).code).toBe('INTERNAL');
      }
    });

    it('no re-envuelve RepositoryError de updateDoc', async () => {
      seedOrgRaw('o', { slug: 'a' });
      const { updateDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (updateDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.delete('o', ctxAdmin)).rejects.toBe(re);
    });
  });
});

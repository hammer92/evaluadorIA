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
import { FirebaseAuditLogRepository } from '../firebase';
import type { AuditLogRaw } from '../mapper';
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
    serverTimestamp: serverTimestampMock,
  };
});

const ctx: Ctx = {
  uid: 'u_actor',
  email: 'actor@x.com',
  role: 'admin',
  organizationId: 'org_1',
  traceId: 't1',
};

function makeAuditLogRaw(overrides: Partial<AuditLogRaw> = {}): AuditLogRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    organization_id: 'org_1',
    actor_id: 'u_actor',
    actor_email: 'actor@x.com',
    action: 'user.created',
    target_type: 'user',
    target_id: 'u_target',
    metadata: { foo: 'bar' },
    ip: '127.0.0.1',
    user_agent: 'vitest',
    created_at: ts,
    ...overrides,
  };
}

function seedAuditLogRaw(id: string, raw: Partial<AuditLogRaw> = {}): void {
  fakeDb
    .getCollection('auditLogs')
    .set(id, makeAuditLogRaw(raw) as unknown as Record<string, unknown>);
}

describe('[AuditLogRepository:Firebase]', () => {
  let repo: FirebaseAuditLogRepository;

  beforeEach(() => {
    fakeDb.clear();
    vi.clearAllMocks();
    repo = new FirebaseAuditLogRepository({} as never);
  });

  describe('constructor', () => {
    it('acepta una instancia db inyectada', () => {
      const fakeDbInstance = { __custom: true };
      expect(() => new FirebaseAuditLogRepository(fakeDbInstance as never)).not.toThrow();
    });

    it('usa defaultDb cuando no se pasa dbInstance (no lanza)', () => {
      expect(() => new FirebaseAuditLogRepository()).not.toThrow();
    });
  });

  describe('append', () => {
    it('crea log con logId auto y createdAt como Date', async () => {
      const log = await repo.append(
        {
          organizationId: 'org_1',
          actorId: 'u_actor',
          actorEmail: 'actor@x.com',
          action: 'user.created',
          targetType: 'user',
          targetId: 'u_new',
          metadata: { foo: 'bar' },
          ip: '127.0.0.1',
          userAgent: 'vitest',
        },
        ctx,
      );
      expect(log.logId).toBeTruthy();
      expect(log.createdAt).toBeInstanceOf(Date);
      expect(log.organizationId).toBe('org_1');
      expect(log.actorId).toBe('u_actor');
      expect(log.actorEmail).toBe('actor@x.com');
      expect(log.action).toBe('user.created');
      expect(log.targetType).toBe('user');
      expect(log.targetId).toBe('u_new');
      expect(log.metadata).toEqual({ foo: 'bar' });
      expect(log.ip).toBe('127.0.0.1');
      expect(log.userAgent).toBe('vitest');
    });

    it('acepta organizationId null', async () => {
      const log = await repo.append(
        {
          organizationId: null,
          actorId: 'u',
          actorEmail: 'a@x.com',
          action: 'auth.login',
          targetType: 'system',
          targetId: null,
          metadata: {},
          ip: null,
          userAgent: null,
        },
        ctx,
      );
      expect(log.organizationId).toBeNull();
      expect(log.targetId).toBeNull();
      expect(log.ip).toBeNull();
      expect(log.userAgent).toBeNull();
    });

    it('escribe el doc en el fake store con serverTimestamp resuelto y campos snake_case', async () => {
      const log = await repo.append(
        {
          organizationId: 'org_1',
          actorId: 'u_actor',
          actorEmail: 'actor@x.com',
          action: 'user.created',
          targetType: 'user',
          targetId: 'u_new',
          metadata: { foo: 'bar' },
          ip: '127.0.0.1',
          userAgent: 'vitest',
        },
        ctx,
      );
      const stored = fakeDb.getCollection('auditLogs').get(log.logId);
      expect(stored).toBeDefined();
      expect(stored!['organization_id']).toBe('org_1');
      expect(stored!['actor_id']).toBe('u_actor');
      expect(stored!['actor_email']).toBe('actor@x.com');
      expect(stored!['action']).toBe('user.created');
      expect(stored!['target_type']).toBe('user');
      expect(stored!['target_id']).toBe('u_new');
      expect(stored!['metadata']).toEqual({ foo: 'bar' });
      expect(stored!['ip']).toBe('127.0.0.1');
      expect(stored!['user_agent']).toBe('vitest');
      expect(stored!['created_at']).toBeInstanceOf(Timestamp);
    });

    it('llama setDoc con created_at como serverTimestamp', async () => {
      const { setDoc } = await import('firebase/firestore');
      await repo.append(
        {
          organizationId: 'org_1',
          actorId: 'u',
          actorEmail: 'a@x.com',
          action: 'auth.login',
          targetType: 'system',
          targetId: null,
          metadata: {},
          ip: null,
          userAgent: null,
        },
        ctx,
      );
      expect(setDoc).toHaveBeenCalledTimes(1);
      const call = (setDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]).toHaveProperty('created_at', fakeDb.SERVER_TIMESTAMP);
    });

    it('wraps errores de setDoc en RepositoryError INTERNAL', async () => {
      const { setDoc } = await import('firebase/firestore');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(
        repo.append(
          {
            organizationId: 'org_1',
            actorId: 'u',
            actorEmail: 'a@x.com',
            action: 'auth.login',
            targetType: 'system',
            targetId: null,
            metadata: {},
            ip: null,
            userAgent: null,
          },
          ctx,
        ),
      ).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('no re-envuelve RepositoryError de setDoc', async () => {
      const { setDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (setDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(
        repo.append(
          {
            organizationId: 'org_1',
            actorId: 'u',
            actorEmail: 'a@x.com',
            action: 'auth.login',
            targetType: 'system',
            targetId: null,
            metadata: {},
            ip: null,
            userAgent: null,
          },
          ctx,
        ),
      ).rejects.toBe(re);
    });
  });

  describe('list', () => {
    it('retorna resultado vacío cuando no hay docs', async () => {
      const r = await repo.list({}, ctx);
      expect(r.items).toEqual([]);
      expect(r.total).toBe(0);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
      expect(r.hasMore).toBe(false);
    });

    it('paginates con pageSize default 20 y page 1', async () => {
      for (let i = 0; i < 5; i++) seedAuditLogRaw(`l${i}`, { target_id: `t${i}` });
      const r = await repo.list({}, ctx);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
      expect(r.items.length).toBe(5);
      expect(r.total).toBe(5);
      expect(r.hasMore).toBe(false);
    });

    it('construye query con where + orderBy(created_at, desc) + limit', async () => {
      const { collection, where, orderBy, limit, query, getDocs } =
        await import('firebase/firestore');
      seedAuditLogRaw('a', { organization_id: 'org_1' });

      await repo.list({ organizationId: 'org_1', page: 1, pageSize: 5 }, ctx);

      expect(collection).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('organization_id', '==', 'org_1');
      expect(orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(limit).toHaveBeenCalledWith(5);
      expect(query).toHaveBeenCalled();
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('filtra por organizationId, actorId, targetType y targetId simultáneamente', async () => {
      seedAuditLogRaw('a', {
        organization_id: 'org_1',
        actor_id: 'u_1',
        target_type: 'user',
        target_id: 't_1',
      });
      seedAuditLogRaw('b', {
        organization_id: 'org_2',
        actor_id: 'u_1',
        target_type: 'user',
        target_id: 't_1',
      });
      seedAuditLogRaw('c', {
        organization_id: 'org_1',
        actor_id: 'u_2',
        target_type: 'user',
        target_id: 't_1',
      });
      seedAuditLogRaw('d', {
        organization_id: 'org_1',
        actor_id: 'u_1',
        target_type: 'organization',
        target_id: 't_1',
      });
      seedAuditLogRaw('e', {
        organization_id: 'org_1',
        actor_id: 'u_1',
        target_type: 'user',
        target_id: 't_2',
      });

      const r = await repo.list(
        {
          organizationId: 'org_1',
          actorId: 'u_1',
          targetType: 'user',
          targetId: 't_1',
        },
        ctx,
      );
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.logId).toBe('a');
    });

    it('omite filtros where cuando los inputs son undefined', async () => {
      const { where } = await import('firebase/firestore');
      await repo.list({}, ctx);
      expect(where).not.toHaveBeenCalled();
    });

    it('ordena por created_at desc', async () => {
      seedAuditLogRaw('a', { created_at: Timestamp.fromDate(new Date('2026-06-30T10:00:00Z')) });
      seedAuditLogRaw('b', { created_at: Timestamp.fromDate(new Date('2026-06-30T12:00:00Z')) });
      seedAuditLogRaw('c', { created_at: Timestamp.fromDate(new Date('2026-06-30T11:00:00Z')) });

      const r = await repo.list({}, ctx);
      expect(r.items.map((l) => l.logId)).toEqual(['b', 'c', 'a']);
    });

    it('clamp pageSize a [1, 100]', async () => {
      const r1 = await repo.list({ pageSize: 0 }, ctx);
      expect(r1.pageSize).toBe(1);

      const r2 = await repo.list({ pageSize: -5 }, ctx);
      expect(r2.pageSize).toBe(1);

      const r3 = await repo.list({ pageSize: 9999 }, ctx);
      expect(r3.pageSize).toBe(100);

      const r4 = await repo.list({ pageSize: 25 }, ctx);
      expect(r4.pageSize).toBe(25);
    });

    it('clamp page a >= 1', async () => {
      const r1 = await repo.list({ page: 0 }, ctx);
      expect(r1.page).toBe(1);

      const r2 = await repo.list({ page: -10 }, ctx);
      expect(r2.page).toBe(1);

      const r3 = await repo.list({ page: 3 }, ctx);
      expect(r3.page).toBe(3);
    });

    it('pagina correctamente con hasMore', async () => {
      for (let i = 0; i < 5; i++) seedAuditLogRaw(`l${i}`, { target_id: `t${i}` });

      const r1 = await repo.list({ page: 1, pageSize: 2 }, ctx);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(2);
      expect(r1.hasMore).toBe(false);

      const r2 = await repo.list({ page: 2, pageSize: 2 }, ctx);
      expect(r2.items.length).toBe(2);
      expect(r2.total).toBe(4);
      expect(r2.hasMore).toBe(false);

      const r3 = await repo.list({ page: 3, pageSize: 2 }, ctx);
      expect(r3.items.length).toBe(1);
      expect(r3.total).toBe(5);
      expect(r3.hasMore).toBe(false);
    });

    it('hasMore es false incluso cuando hay más páginas (limitación de limit(pageSize*page))', async () => {
      for (let i = 0; i < 100; i++) seedAuditLogRaw(`l${i}`, { target_id: `t${i}` });

      const r1 = await repo.list({ page: 1, pageSize: 10 }, ctx);
      expect(r1.items.length).toBe(10);
      expect(r1.hasMore).toBe(false);

      const r5 = await repo.list({ page: 5, pageSize: 10 }, ctx);
      expect(r5.items.length).toBe(10);
      expect(r5.total).toBe(50);
      expect(r5.hasMore).toBe(false);
    });

    it('page fuera de rango retorna items vacío pero total correcto', async () => {
      seedAuditLogRaw('a', { target_id: 't_a' });
      const r = await repo.list({ page: 99, pageSize: 10 }, ctx);
      expect(r.items.length).toBe(0);
      expect(r.total).toBe(1);
      expect(r.hasMore).toBe(false);
    });

    it('mapea los docs a AuditLog con logId correcto', async () => {
      seedAuditLogRaw('log_x', {
        organization_id: 'org_1',
        actor_id: 'u_actor',
        actor_email: 'actor@x.com',
        action: 'user.updated',
        target_type: 'user',
        target_id: 'u_target',
        metadata: { k: 'v' },
        ip: '10.0.0.1',
        user_agent: 'jest',
      });
      const r = await repo.list({}, ctx);
      const found = r.items.find((l) => l.logId === 'log_x');
      expect(found).toBeDefined();
      expect(found!.organizationId).toBe('org_1');
      expect(found!.actorId).toBe('u_actor');
      expect(found!.actorEmail).toBe('actor@x.com');
      expect(found!.action).toBe('user.updated');
      expect(found!.targetType).toBe('user');
      expect(found!.targetId).toBe('u_target');
      expect(found!.metadata).toEqual({ k: 'v' });
      expect(found!.ip).toBe('10.0.0.1');
      expect(found!.userAgent).toBe('jest');
      expect(found!.createdAt).toBeInstanceOf(Date);
    });

    it('wraps errores de getDocs en RepositoryError INTERNAL', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      try {
        await repo.list({}, ctx);
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
      await expect(repo.list({}, ctx)).rejects.toBe(re);
    });
  });

  describe('getById', () => {
    it('retorna null cuando el doc no existe', async () => {
      expect(await repo.getById('nope', ctx)).toBeNull();
    });

    it('retorna AuditLog parseado cuando el doc existe', async () => {
      seedAuditLogRaw('l', {
        organization_id: 'org_1',
        actor_id: 'u_actor',
        actor_email: 'actor@x.com',
        action: 'user.deleted',
        target_type: 'user',
        target_id: 'u_victim',
        metadata: { reason: 'gdpr' },
        ip: '192.168.0.1',
        user_agent: 'curl',
      });
      const log = await repo.getById('l', ctx);
      expect(log).not.toBeNull();
      expect(log!.logId).toBe('l');
      expect(log!.organizationId).toBe('org_1');
      expect(log!.actorId).toBe('u_actor');
      expect(log!.actorEmail).toBe('actor@x.com');
      expect(log!.action).toBe('user.deleted');
      expect(log!.targetType).toBe('user');
      expect(log!.targetId).toBe('u_victim');
      expect(log!.metadata).toEqual({ reason: 'gdpr' });
      expect(log!.ip).toBe('192.168.0.1');
      expect(log!.userAgent).toBe('curl');
      expect(log!.createdAt).toBeInstanceOf(Date);
    });

    it('wraps errores en RepositoryError INTERNAL', async () => {
      const { getDoc } = await import('firebase/firestore');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      await expect(repo.getById('l', ctx)).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('no re-envuelve RepositoryError', async () => {
      const { getDoc } = await import('firebase/firestore');
      const re = RepositoryError.internal('ya envuelto');
      (getDoc as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(re);
      await expect(repo.getById('l', ctx)).rejects.toBe(re);
    });
  });
});

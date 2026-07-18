import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  auth: {
    createUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    deleteUser: vi.fn(),
    verifyIdToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
    doc: vi.fn(),
    runTransaction: vi.fn(),
  },
  _firebase_functions_v2: null as unknown,
  _firebase_admin_firestore: null as unknown,
  _firebase_functions_v2_https: null as unknown,
}));

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => hoisted.auth),
  getAdminDb: vi.fn(() => hoisted.db),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
}));

vi.mock('firebase-functions/v2/https', async () => {
  hoisted._firebase_functions_v2_https ??= await vi.importActual('firebase-functions/v2/https');
  const actual = hoisted._firebase_functions_v2_https;
  return {
    ...actual,
    onCall: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown) => Promise<unknown>)
          : (maybeHandler as (req: unknown) => Promise<unknown>);
      return ((req: unknown) => handler(req)) as unknown as ReturnType<typeof actual.onCall>;
    }) as typeof actual.onCall,
  };
});

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
  }),
}));

vi.mock('firebase-admin/firestore', async () => {
  hoisted._firebase_admin_firestore ??= await vi.importActual('firebase-admin/firestore');
  const actual = hoisted._firebase_admin_firestore;
  return {
    ...actual,
    FieldValue: {
      serverTimestamp: () => Symbol('FieldValue.serverTimestamp'),
      increment: (n: number) => ({ __increment: n }),
      arrayUnion: (...v: unknown[]) => ({ __arrayUnion: v }),
      arrayRemove: (...v: unknown[]) => ({ __arrayRemove: v }),
      delete: () => Symbol('FieldValue.delete'),
    },
  };
});

vi.mock('firebase-functions/v2', async () => {
  hoisted._firebase_functions_v2 ??= await vi.importActual('firebase-functions/v2');
  const actual = hoisted._firebase_functions_v2;
  return {
    ...actual,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('firebase-functions', () => ({
  config: () => ({
    session: {
      cookie_secret: process.env['SESSION_COOKIE_SECRET'] ?? '',
    },
    allowed: {
      origins: process.env['ALLOWED_ORIGINS'] ?? '',
    },
    repository: {
      driver: process.env['REPOSITORY_DRIVER'] ?? 'memory',
    },
    admin: {
      project_id: process.env['FIREBASE_ADMIN_PROJECT_ID'] ?? 'demo-test',
    },
    openai: {
      api_key: process.env['OPENAI_API_KEY'],
    },
  }),
}));

const { v1UsersList } = await import('../list-users.js');

interface ListUsersData {
  organizationId?: string;
  status?: 'active' | 'invited' | 'suspended';
  role?: 'admin' | 'recruiter' | 'expert';
  search?: string;
  page?: number;
  pageSize?: number;
}
type ListUsersFn = (req: {
  data: ListUsersData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): ListUsersFn {
  return fn as unknown as ListUsersFn;
}

interface FakeQuery {
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function makeQuery(docs: { id: string; data: Record<string, unknown> }[]): FakeQuery {
  const q: FakeQuery = {
    where: vi.fn(() => q),
    orderBy: vi.fn(() => q),
    select: vi.fn(() => q),
    get: vi.fn().mockResolvedValue({
      docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
      size: docs.length,
      empty: docs.length === 0,
    }),
  };
  return q;
}

function adminContext(orgId?: string): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return {
    uid: 'admin-uid',
    email: 'admin@platform.com',
    role: 'admin',
    token: { role: 'admin', organizationId: orgId ?? null },
  };
}

function recruiterContext(orgId?: string): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return {
    uid: 'rec-uid',
    email: 'rec@platform.com',
    role: 'recruiter',
    token: { role: 'recruiter', organizationId: orgId ?? null },
  };
}

describe('v1UsersList', () => {
  beforeEach(() => {
    hoisted.auth.createUser.mockReset();
    hoisted.auth.setCustomUserClaims.mockReset();
    hoisted.auth.deleteUser.mockReset();
    hoisted.auth.verifyIdToken.mockReset();
    hoisted.db.collection.mockReset();
    hoisted.db.doc.mockReset();
    hoisted.db.runTransaction.mockReset();
  });

  it('rechaza input inválido (pageSize > 100)', async () => {
    const fn = asCallable(v1UsersList);
    await expect(
      fn({
        data: { pageSize: 1000 },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('happy path: pagina y mapea docs', async () => {
    const query = makeQuery([
      {
        id: 'u1',
        data: {
          email: 'a@b.co',
          display_name: 'A',
          photo_url: null,
          role: 'admin',
          organization_id: 'org-1',
          status: 'active',
          created_at: { toDate: () => new Date('2024-01-01T00:00:00Z') },
        },
      },
      {
        id: 'u2',
        data: {
          email: 'b@b.co',
          display_name: 'B',
          photo_url: 'https://x.com/p.png',
          role: 'recruiter',
          organization_id: 'org-1',
          status: 'active',
          created_at: { toDate: () => new Date('2024-01-02T00:00:00Z') },
        },
      },
    ]);
    hoisted.db.collection.mockReturnValue(query as unknown as Record<string, unknown>);

    const fn = asCallable(v1UsersList);
    const result = await fn({
      data: { organizationId: 'org-1', page: 1, pageSize: 20 },
      auth: adminContext('org-1'),
      rawRequest: { headers: {} },
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      hasMore: false,
      items: [
        {
          uid: 'u1',
          email: 'a@b.co',
          displayName: 'A',
          photoURL: null,
          role: 'admin',
          organizationId: 'org-1',
          status: 'active',
        },
        {
          uid: 'u2',
          email: 'b@b.co',
          displayName: 'B',
          photoURL: 'https://x.com/p.png',
          role: 'recruiter',
          organizationId: 'org-1',
          status: 'active',
        },
      ],
    });
    expect(query.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(query.where).toHaveBeenCalledWith('organization_id', '==', 'org-1');
  });

  it('excluye suspended y filtra por search', async () => {
    const query = makeQuery([
      {
        id: 'u1',
        data: {
          email: 'ana@b.co',
          display_name: 'Ana',
          photo_url: null,
          role: 'admin',
          organization_id: 'org-1',
          status: 'active',
          created_at: { toDate: () => new Date('2024-01-01T00:00:00Z') },
        },
      },
      {
        id: 'u2',
        data: {
          email: 'bob@b.co',
          display_name: 'Bob',
          photo_url: null,
          role: 'expert',
          organization_id: 'org-1',
          status: 'suspended',
          created_at: { toDate: () => new Date('2024-01-02T00:00:00Z') },
        },
      },
      {
        id: 'u3',
        data: {
          email: 'other@b.co',
          display_name: 'X',
          photo_url: null,
          role: 'expert',
          organization_id: 'org-1',
          status: 'active',
          created_at: { toDate: () => new Date('2024-01-03T00:00:00Z') },
        },
      },
    ]);
    hoisted.db.collection.mockReturnValue(query as unknown as Record<string, unknown>);

    const fn = asCallable(v1UsersList);
    const result = (await fn({
      data: { organizationId: 'org-1', search: 'ANA' },
      auth: adminContext('org-1'),
      rawRequest: { headers: {} },
    })) as { items: { uid: string }[]; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0]?.uid).toBe('u1');
  });

  it('resuelve orgId desde el contexto del caller cuando no se pasa en input', async () => {
    const query = makeQuery([]);
    hoisted.db.collection.mockReturnValue(query as unknown as Record<string, unknown>);

    const fn = asCallable(v1UsersList);
    await fn({
      data: {},
      auth: recruiterContext('ctx-org'),
      rawRequest: { headers: {} },
    });

    expect(query.where).toHaveBeenCalledWith('organization_id', '==', 'ctx-org');
  });

  it('cuando caller no tiene orgId, no agrega where de organization', async () => {
    const query = makeQuery([
      {
        id: 'u1',
        data: {
          email: 'a@b.co',
          display_name: null,
          photo_url: null,
          role: 'admin',
          organization_id: null,
          status: 'active',
          created_at: { toDate: () => new Date('2024-01-01T00:00:00Z') },
        },
      },
    ]);
    hoisted.db.collection.mockReturnValue(query as unknown as Record<string, unknown>);

    const fn = asCallable(v1UsersList);
    const result = (await fn({
      data: {},
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { items: { uid: string }[]; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0]?.uid).toBe('u1');
    expect(query.where).not.toHaveBeenCalledWith(
      'organization_id',
      expect.anything(),
      expect.anything(),
    );
  });

  it('pagina correctamente con hasMore', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      id: `u${i}`,
      data: {
        email: `u${i}@b.co`,
        display_name: `U${i}`,
        photo_url: null,
        role: 'expert',
        organization_id: 'org-1',
        status: 'active',
        created_at: { toDate: () => new Date(0) },
      },
    }));
    const query = makeQuery(docs);
    hoisted.db.collection.mockReturnValue(query as unknown as Record<string, unknown>);

    const fn = asCallable(v1UsersList);
    const result = (await fn({
      data: { organizationId: 'org-1', page: 2, pageSize: 10 },
      auth: adminContext('org-1'),
      rawRequest: { headers: {} },
    })) as { items: unknown[]; total: number; hasMore: boolean; page: number; pageSize: number };

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(25);
    expect(result.hasMore).toBe(true);
  });
});

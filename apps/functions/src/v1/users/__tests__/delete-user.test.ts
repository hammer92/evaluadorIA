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
  if (!hoisted._firebase_functions_v2_https) {
    hoisted._firebase_functions_v2_https = await vi.importActual('firebase-functions/v2/https');
  }
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
  if (!hoisted._firebase_admin_firestore) {
    hoisted._firebase_admin_firestore = await vi.importActual('firebase-admin/firestore');
  }
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
  if (!hoisted._firebase_functions_v2) {
    hoisted._firebase_functions_v2 = await vi.importActual('firebase-functions/v2');
  }
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

const { v1UsersDelete } = await import('../delete-user.js');

interface DeleteUserData {
  uid: string;
}
type DeleteUserFn = (req: {
  data: DeleteUserData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): DeleteUserFn {
  return fn as unknown as DeleteUserFn;
}

function adminContext(uid = 'admin-uid'): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return { uid, email: 'admin@platform.com', role: 'admin', token: { role: 'admin' } };
}

function setupUsersDoc(data: Record<string, unknown> | null) {
  const update = vi.fn().mockResolvedValue(undefined);
  const ref = {
    get: vi.fn().mockResolvedValue({
      exists: data !== null,
      data: () => data ?? {},
    }),
    update,
    set: vi.fn().mockResolvedValue(undefined),
  };
  hoisted.db.collection.mockImplementation((name: string) => {
    if (name === 'users') {
      return {
        doc: vi.fn(() => ref),
        where: vi.fn(),
        orderBy: vi.fn(),
        select: vi.fn(),
        get: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      };
    }
    return {
      doc: vi.fn(() => ({ set: vi.fn().mockResolvedValue(undefined) })),
      where: vi.fn(),
      orderBy: vi.fn(),
      select: vi.fn(),
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
  });
  return { ref, update };
}

describe('v1UsersDelete', () => {
  beforeEach(() => {
    hoisted.auth.createUser.mockReset();
    hoisted.auth.setCustomUserClaims.mockReset();
    hoisted.auth.deleteUser.mockReset();
    hoisted.auth.verifyIdToken.mockReset();
    hoisted.db.collection.mockReset();
    hoisted.db.doc.mockReset();
    hoisted.db.runTransaction.mockReset();
  });

  it('rechaza uid vacío', async () => {
    const fn = asCallable(v1UsersDelete);
    await expect(
      fn({
        data: { uid: '' },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza que el admin se borre a sí mismo', async () => {
    const fn = asCallable(v1UsersDelete);
    await expect(
      fn({
        data: { uid: 'admin-uid' },
        auth: adminContext('admin-uid'),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { code: 'VALIDATION' },
    });
  });

  it('devuelve NOT_FOUND si el user no existe', async () => {
    setupUsersDoc(null);

    const fn = asCallable(v1UsersDelete);
    await expect(
      fn({
        data: { uid: 'missing' },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'not-found',
      details: { code: 'NOT_FOUND' },
    });
  });

  it('happy path: marca como suspended y deleted_at', async () => {
    const { update } = setupUsersDoc({
      email: 'a@b.co',
      display_name: 'A',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
      deleted_at: null,
    });

    const fn = asCallable(v1UsersDelete);
    const result = (await fn({
      data: { uid: 'u1' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { uid: string; deletedAt: string };

    expect(result.uid).toBe('u1');
    expect(typeof result.deletedAt).toBe('string');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.anything() }));
  });

  it('no falla si el user existe pero deleted_at ya está presente', async () => {
    const { update } = setupUsersDoc({
      email: 'a@b.co',
      display_name: 'A',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
      deleted_at: null,
    });

    const fn = asCallable(v1UsersDelete);
    await fn({
      data: { uid: 'u1' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    });

    expect(update).toHaveBeenCalledTimes(1);
  });
});

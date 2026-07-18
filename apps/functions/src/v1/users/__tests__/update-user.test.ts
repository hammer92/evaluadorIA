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

const { v1UsersUpdate } = await import('../update-user.js');

interface UpdateUserData {
  uid: string;
  input: {
    displayName?: string | null;
    photoURL?: string | null;
    role?: 'admin' | 'recruiter' | 'expert';
    status?: 'active' | 'invited' | 'suspended';
  };
}
type UpdateUserFn = (req: {
  data: UpdateUserData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): UpdateUserFn {
  return fn as unknown as UpdateUserFn;
}

function adminContext(uid = 'admin-uid'): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return { uid, email: 'admin@platform.com', role: 'admin', token: { role: 'admin' } };
}

function expertContext(uid = 'expert-uid'): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return { uid, email: 'expert@platform.com', role: 'expert', token: { role: 'expert' } };
}

function makeDocRef(data: Record<string, unknown> | null) {
  const update = vi.fn().mockResolvedValue(undefined);
  const ref = {
    get: vi.fn().mockResolvedValue({
      exists: data !== null,
      data: () => data ?? {},
    }),
    update,
    set: vi.fn().mockResolvedValue(undefined),
  };
  return { ref, update };
}

function setupCollection(name: string, opts: { doc?: Record<string, unknown> } = {}) {
  const ref = opts.doc ?? makeDocRef(null).ref;
  const collection = {
    doc: vi.fn(() => ref),
    where: vi.fn(() => collection),
    orderBy: vi.fn(() => collection),
    select: vi.fn(() => collection),
    get: vi.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
  if (!hoisted.db.collection.mock.calls.some((c) => c[0] === name)) {
    hoisted.db.collection.mockImplementation((collName: string) => {
      if (collName === name) return collection;
      const generic = {
        doc: vi.fn(() => ({ set: vi.fn().mockResolvedValue(undefined) })),
        where: vi.fn(() => generic),
        orderBy: vi.fn(() => generic),
        select: vi.fn(() => generic),
        get: vi.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      };
      return generic;
    });
  }
  return { collection, ref };
}

function setupDoc(data: Record<string, unknown> | null) {
  const { ref, update } = makeDocRef(data);
  setupCollection('users', { doc: ref });
  return { ref, update };
}

describe('v1UsersUpdate', () => {
  beforeEach(() => {
    hoisted.auth.createUser.mockReset();
    hoisted.auth.setCustomUserClaims.mockReset();
    hoisted.auth.deleteUser.mockReset();
    hoisted.auth.verifyIdToken.mockReset();
    hoisted.db.collection.mockReset();
    hoisted.db.doc.mockReset();
    hoisted.db.runTransaction.mockReset();
  });

  it('rechaza input inválido (uid vacío)', async () => {
    const fn = asCallable(v1UsersUpdate);
    await expect(
      fn({
        data: { uid: '', input: { displayName: 'X' } },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza patch vacío', async () => {
    const { ref } = setupDoc({
      email: 'a@b.co',
      display_name: 'A',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
    });

    const fn = asCallable(v1UsersUpdate);
    await expect(
      fn({
        data: { uid: 'u1', input: {} },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('devuelve NOT_FOUND si el user no existe', async () => {
    const { ref } = setupDoc(null);

    const fn = asCallable(v1UsersUpdate);
    await expect(
      fn({
        data: { uid: 'missing', input: { displayName: 'X' } },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'not-found',
      details: { code: 'NOT_FOUND' },
    });
  });

  it('rechaza si no es admin ni el propio user', async () => {
    const { ref } = setupDoc({
      email: 'a@b.co',
      display_name: 'A',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
    });

    const fn = asCallable(v1UsersUpdate);
    await expect(
      fn({
        data: { uid: 'another-uid', input: { displayName: 'X' } },
        auth: expertContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      details: { code: 'PERMISSION_DENIED' },
    });
  });

  it('rechaza cambio de role a no-admin', async () => {
    const { ref } = setupDoc({
      email: 'self@b.co',
      display_name: 'S',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
    });

    const fn = asCallable(v1UsersUpdate);
    await expect(
      fn({
        data: { uid: 'expert-uid', input: { role: 'admin' } },
        auth: expertContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      details: { code: 'PERMISSION_DENIED' },
    });
  });

  it('happy path: actualiza displayName, no llama setCustomUserClaims', async () => {
    const { ref, update } = setupDoc({
      email: 'a@b.co',
      display_name: 'Old',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
    });

    const fn = asCallable(v1UsersUpdate);
    const result = (await fn({
      data: { uid: 'u1', input: { displayName: 'New' } },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { uid: string; displayName: string; role: string };

    expect(result).toMatchObject({ uid: 'u1', displayName: 'New', role: 'expert' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'New' }));
    expect(hoisted.auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('cambio de role actualiza custom claims', async () => {
    const { ref, update } = setupDoc({
      email: 'a@b.co',
      display_name: 'A',
      photo_url: null,
      role: 'expert',
      organization_id: 'org-1',
      status: 'active',
    });
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1UsersUpdate);
    await fn({
      data: { uid: 'u1', input: { role: 'admin' } },
      auth: adminContext(),
      rawRequest: { headers: {} },
    });

    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('u1', {
      role: 'admin',
      organizationId: 'org-1',
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('un user puede modificar su propio displayName', async () => {
    const { ref, update } = setupDoc({
      email: 'self@b.co',
      display_name: 'Old',
      photo_url: null,
      role: 'expert',
      organization_id: null,
      status: 'active',
    });

    const fn = asCallable(v1UsersUpdate);
    const result = (await fn({
      data: { uid: 'expert-uid', input: { displayName: 'Self' } },
      auth: expertContext(),
      rawRequest: { headers: {} },
    })) as { uid: string; displayName: string };

    expect(result.displayName).toBe('Self');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Self' }));
  });
});

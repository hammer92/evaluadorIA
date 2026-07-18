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
  _firebase_functions_v2: null as unknown as Record<string, unknown>,
  _firebase_admin_firestore: null as unknown as Record<string, unknown>,
  _firebase_functions_v2_https: null as unknown as Record<string, unknown>,
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
  const actual = hoisted._firebase_functions_v2_https as { onCall: unknown };
  const capturedHandler = (optsOrHandler: unknown, maybeHandler?: unknown): unknown => {
    const handler =
      typeof optsOrHandler === 'function'
        ? (optsOrHandler as (req: unknown) => Promise<unknown>)
        : (maybeHandler as (req: unknown) => Promise<unknown>);
    return (req: unknown) => handler(req);
  };
  return {
    ...actual,
    onCall: capturedHandler,
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
  const actual = hoisted._firebase_admin_firestore as Record<string, unknown>;
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
  return {
    ...(hoisted._firebase_functions_v2 as Record<string, unknown>),
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

const { v1UsersCreate } = await import('../create-user.js');

interface CreateUserData {
  email: string;
  displayName?: string;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId?: string;
  sendInviteEmail?: boolean;
}
type CreateUserFn = (req: {
  data: CreateUserData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): CreateUserFn {
  return fn as unknown as CreateUserFn;
}

function makeChain() {
  return {
    where: vi.fn(() => makeChain()),
    orderBy: vi.fn(() => makeChain()),
    select: vi.fn(() => makeChain()),
    doc: vi.fn(() => makeChain()),
    collection: vi.fn(() => makeChain()),
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function adminContext(): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return { uid: 'admin-uid', email: 'admin@platform.com', role: 'admin', token: { role: 'admin' } };
}

describe('v1UsersCreate', () => {
  beforeEach(() => {
    hoisted.auth.createUser.mockReset();
    hoisted.auth.setCustomUserClaims.mockReset();
    hoisted.auth.deleteUser.mockReset();
    hoisted.auth.verifyIdToken.mockReset();
    hoisted.db.collection.mockReset();
    hoisted.db.doc.mockReset();
    hoisted.db.runTransaction.mockReset();

    const chain = makeChain();
    hoisted.db.collection.mockReturnValue(chain);
  });

  it('rechaza input inválido (email mal formado)', async () => {
    const fn = asCallable(v1UsersCreate);
    await expect(
      fn({
        data: { email: 'not-email', role: 'admin' } as CreateUserData,
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('mapea auth/email-already-exists a already-exists HttpsError', async () => {
    const err: Error & { code?: string } = new Error('dup');
    err.code = 'auth/email-already-exists';
    hoisted.auth.createUser.mockRejectedValueOnce(err);

    const fn = asCallable(v1UsersCreate);
    await expect(
      fn({
        data: { email: 'dup@b.co', role: 'recruiter' },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({
      code: 'already-exists',
      details: { code: 'ALREADY_EXISTS' },
    });
  });

  it('mapea error genérico de createUser a internal HttpsError', async () => {
    hoisted.auth.createUser.mockRejectedValueOnce(new Error('boom'));

    const fn = asCallable(v1UsersCreate);
    await expect(
      fn({
        data: { email: 'a@b.co', role: 'expert' },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'internal' });
  });

  it('happy path: crea user, set claims, escribe doc, audit log', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'new-uid' });
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1UsersCreate);
    const result = await fn({
      data: {
        email: 'invitee@b.co',
        displayName: 'Invitee',
        role: 'recruiter',
        organizationId: 'org-1',
        sendInviteEmail: false,
      },
      auth: adminContext(),
      rawRequest: { headers: {} },
    });

    expect(result).toEqual({
      uid: 'new-uid',
      email: 'invitee@b.co',
      displayName: 'Invitee',
      role: 'recruiter',
      organizationId: 'org-1',
      status: 'invited',
      createdBy: 'admin-uid',
    });
    expect(hoisted.auth.createUser).toHaveBeenCalledWith({
      email: 'invitee@b.co',
      displayName: 'Invitee',
      emailVerified: false,
      disabled: false,
    });
    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('new-uid', {
      role: 'recruiter',
      organizationId: 'org-1',
    });
  });

  it('omite displayName en createUser cuando no se proporciona', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'u1' });
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1UsersCreate);
    await fn({
      data: { email: 'no-name@b.co', role: 'expert' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    });

    expect(hoisted.auth.createUser).toHaveBeenCalledWith({
      email: 'no-name@b.co',
      emailVerified: false,
      disabled: false,
    });
  });

  it('omite organizationId en claims cuando no se proporciona', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'u2' });
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1UsersCreate);
    await fn({
      data: { email: 'no-org@b.co', role: 'expert' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    });

    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('u2', { role: 'expert' });
  });
});

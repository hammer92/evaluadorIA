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
  _firebase_functions_v2_https: null as unknown,
  _firebase_admin_firestore: null as unknown,
  _firebase_functions_v2: null as unknown,
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
  const captured: ((req: unknown) => Promise<unknown>)[] = [];
  return {
    ...actual,
    onCall: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown) => Promise<unknown>)
          : (maybeHandler as (req: unknown) => Promise<unknown>);
      captured.push(handler);
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

const { v1AuthSignUp } = await import('../sign-up.js');

interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}
type SignUpFn = (req: {
  data: SignUpData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): SignUpFn {
  return fn as unknown as SignUpFn;
}

function makeTxChain() {
  return {
    where: vi.fn(() => makeTxChain()),
    select: vi.fn(() => makeTxChain()),
    doc: vi.fn(() => makeTxChain()),
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
  };
}

describe('v1AuthSignUp', () => {
  beforeEach(() => {
    hoisted.auth.createUser.mockReset();
    hoisted.auth.setCustomUserClaims.mockReset();
    hoisted.auth.deleteUser.mockReset();
    hoisted.auth.verifyIdToken.mockReset();
    hoisted.db.collection.mockReset();
    hoisted.db.doc.mockReset();
    hoisted.db.runTransaction.mockReset();

    hoisted.db.collection.mockImplementation(() => makeTxChain());
    hoisted.db.runTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ size: 0, docs: [], empty: true }),
        set: vi.fn().mockResolvedValue(undefined),
      };
      return cb(tx);
    });
  });

  it('rechaza email inválido', async () => {
    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'no-es-email', password: 'longenough123', displayName: 'Ana' } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza password corta', async () => {
    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'a@b.c', password: 'short', displayName: 'Ana' } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza displayName fuera de rango', async () => {
    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'a@b.c', password: 'longenough123', displayName: '' } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      fn({ data: { email: 'a@b.c', password: 'longenough123', displayName: 'x'.repeat(121) } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('mapea auth/email-already-exists a RepositoryError', async () => {
    const authErr: Error & { code?: string } = new Error('exists');
    authErr.code = 'auth/email-already-exists';
    hoisted.auth.createUser.mockRejectedValueOnce(authErr);

    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'dup@b.c', password: 'longenough123', displayName: 'Ana' } }),
    ).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
      message: 'Ya existe un user con ese email',
    });
  });

  it('mapea errores genéricos de createUser a internal', async () => {
    hoisted.auth.createUser.mockRejectedValueOnce(new Error('boom'));

    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'a@b.c', password: 'longenough123', displayName: 'Ana' } }),
    ).rejects.toMatchObject({ code: 'internal' });
  });

  it('rechaza registration cuando ya hay users existentes', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'new-uid' });
    hoisted.db.runTransaction.mockImplementationOnce(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ size: 1, docs: [{ id: 'existing' }], empty: false }),
          set: vi.fn(),
        };
        return cb(tx);
      },
    );
    hoisted.auth.deleteUser.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'a@b.c', password: 'longenough123', displayName: 'Ana' } }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(hoisted.auth.deleteUser).toHaveBeenCalledWith('new-uid');
  });

  it('happy path: crea user + set claims en transacción', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'first-uid' });
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1AuthSignUp);
    const req = {
      data: { email: 'admin@platform.com', password: 'longenough123', displayName: 'Admin' },
      rawRequest: { headers: {} as Record<string, unknown> },
    };
    const result = await fn(req);

    expect(result).toEqual({ uid: 'first-uid', role: 'admin', isFirstUser: true });
    expect(hoisted.auth.createUser).toHaveBeenCalledWith({
      email: 'admin@platform.com',
      password: 'longenough123',
      displayName: 'Admin',
      emailVerified: false,
      disabled: false,
    });
    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('first-uid', {
      role: 'admin',
      organizationId: null,
    });
    expect(hoisted.db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it('hace rollback del auth user si la transacción falla', async () => {
    hoisted.auth.createUser.mockResolvedValueOnce({ uid: 'to-delete' });
    hoisted.db.runTransaction.mockRejectedValueOnce(new Error('tx failed'));
    hoisted.auth.deleteUser.mockResolvedValueOnce(undefined);

    const fn = asCallable(v1AuthSignUp);
    await expect(
      fn({ data: { email: 'a@b.c', password: 'longenough123', displayName: 'Ana' } }),
    ).rejects.toThrow('tx failed');
    expect(hoisted.auth.deleteUser).toHaveBeenCalledWith('to-delete');
  });
});

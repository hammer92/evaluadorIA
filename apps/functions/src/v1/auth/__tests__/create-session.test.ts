import { describe, expect, it, vi, beforeEach } from 'vitest';

type FirebaseHttpsModule = typeof import('firebase-functions/v2/https');

const hoisted = vi.hoisted(() => ({
  auth: {
    createUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    deleteUser: vi.fn(),
    verifyIdToken: vi.fn(),
  },
  httpsModule: undefined as unknown as FirebaseHttpsModule,
}));

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => hoisted.auth),
  getAdminDb: vi.fn(() => ({})),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
  }),
}));

vi.mock('firebase-functions/v2/https', async () => {
  hoisted.httpsModule ??= await vi.importActual<FirebaseHttpsModule>('firebase-functions/v2/https');
  return {
    ...hoisted.httpsModule,
    onRequest: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown, res: unknown) => Promise<void>)
          : (maybeHandler as (req: unknown, res: unknown) => Promise<void>);
      return ((req: unknown, res: unknown) => handler(req, res)) as unknown as ReturnType<
        typeof hoisted.httpsModule.onRequest
      >;
    }) as typeof hoisted.httpsModule.onRequest,
  };
});

const { v1AuthCreateSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } =
  await import('../create-session.js');

interface FakeReq {
  method: string;
  headers: Record<string, string | undefined>;
  body?: { idToken?: unknown } | undefined;
}

interface FakeRes {
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function makeReqRes(
  opts: { method?: string; headers?: Record<string, string | undefined>; body?: unknown } = {},
) {
  const req: FakeReq = {
    method: opts.method ?? 'POST',
    headers: { ...(opts.headers ?? {}) },
    body: opts.body as { idToken?: unknown } | undefined,
  };
  const res: FakeRes = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return { req, res };
}

async function callHandler(req: FakeReq, res: FakeRes) {
  const fn = v1AuthCreateSession as unknown as (r: FakeReq, r2: FakeRes) => Promise<void>;
  await fn(req, res);
}

describe('v1AuthCreateSession', () => {
  beforeEach(() => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    hoisted.auth.verifyIdToken.mockReset();
  });

  it('responde 204 en OPTIONS', async () => {
    const { req, res } = makeReqRes({ method: 'OPTIONS' });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith('');
  });

  it('rechaza métodos distintos a POST', async () => {
    const { req, res } = makeReqRes({ method: 'GET' });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'method-not-allowed' });
  });

  it('rechaza body sin idToken', async () => {
    const { req, res } = makeReqRes({ body: {} });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'idToken required' });
  });

  it('rechaza idToken no-string', async () => {
    const { req, res } = makeReqRes({ body: { idToken: 123 } });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'idToken required' });
  });

  it('responde 401 si verifyIdToken falla', async () => {
    hoisted.auth.verifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const { req, res } = makeReqRes({ body: { idToken: 'bad' } });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid-id-token' });
  });

  it('responde 500 si SESSION_COOKIE_SECRET es corto', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'short';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'admin',
    });
    const { req, res } = makeReqRes({ body: { idToken: 'valid' } });
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'server-misconfigured' });
  });

  it('happy path: setea cookie httpOnly con SameSite=Lax', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'admin',
      organizationId: 'org-1',
    });

    const { req, res } = makeReqRes({
      body: { idToken: 'valid' },
      headers: { origin: 'http://localhost:3000' },
    });
    await callHandler(req, res);

    expect(hoisted.auth.verifyIdToken).toHaveBeenCalledWith('valid', true);
    const setCookieCall = res.setHeader.mock.calls.find((c) => c[0] === 'Set-Cookie');
    expect(setCookieCall).toBeDefined();
    const cookieValue = setCookieCall?.[1] as string;
    expect(cookieValue).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookieValue).toContain('HttpOnly');
    expect(cookieValue).toContain('SameSite=Lax');
    expect(cookieValue).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
    expect(cookieValue).not.toContain('Secure');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, uid: 'u1', role: 'admin' });
  });

  it('usa Secure cuando NODE_ENV=production', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    process.env['NODE_ENV'] = 'production';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'admin',
    });
    const { req, res } = makeReqRes({ body: { idToken: 'valid' } });
    await callHandler(req, res);
    const setCookieCall = res.setHeader.mock.calls.find((c) => c[0] === 'Set-Cookie');
    expect((setCookieCall?.[1] as string).trim().endsWith('Secure')).toBe(true);
    delete process.env['NODE_ENV'];
  });

  it('acepta role recruiter/expert y default a expert si claim inválido', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'recruiter',
      organizationId: null,
    });
    const { req, res } = makeReqRes({ body: { idToken: 'valid' } });
    await callHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, uid: 'u1', role: 'recruiter' });
  });

  it('default a expert si role claim es desconocido', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'superuser',
    });
    const { req, res } = makeReqRes({ body: { idToken: 'valid' } });
    await callHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, uid: 'u1', role: 'expert' });
  });

  it('configura CORS con el origin del request si está permitido', async () => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
    hoisted.auth.verifyIdToken.mockResolvedValueOnce({
      uid: 'u1',
      email: 'a@b.co',
      role: 'admin',
    });
    const { req, res } = makeReqRes({
      body: { idToken: 'valid' },
      headers: { origin: 'http://localhost:3000' },
    });
    await callHandler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3000',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });
});

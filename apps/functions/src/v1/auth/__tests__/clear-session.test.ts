import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  _firebase_functions_v2_https: null as unknown,
}));

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => ({})),
  getAdminDb: vi.fn(() => ({})),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
}));

vi.mock('firebase-functions/v2/https', async () => {
  hoisted._firebase_functions_v2_https ??= await vi.importActual('firebase-functions/v2/https');
  const actual = hoisted._firebase_functions_v2_https;
  return {
    ...actual,
    onRequest: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown, res: unknown) => Promise<void>)
          : (maybeHandler as (req: unknown, res: unknown) => Promise<void>);
      return ((req: unknown, res: unknown) => handler(req, res)) as unknown as ReturnType<
        typeof actual.onRequest
      >;
    }) as typeof actual.onRequest,
  };
});

const { SESSION_COOKIE_NAME: COOKIE_NAME } = await import('../create-session.js');
const { v1AuthClearSession: v1AuthClearSessionFn } = await import('../clear-session.js');

interface FakeReq {
  method: string;
  headers: Record<string, string | undefined>;
}

interface FakeRes {
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function makeReqRes(method = 'POST', headers: Record<string, string | undefined> = {}) {
  const req: FakeReq = { method, headers };
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
  const fn = v1AuthClearSessionFn as unknown as (r: FakeReq, r2: FakeRes) => Promise<void>;
  await fn(req, res);
}

describe('v1AuthClearSession', () => {
  beforeEach(() => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
  });

  it('responde 204 en OPTIONS', async () => {
    const { req, res } = makeReqRes('OPTIONS');
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith('');
  });

  it('rechaza métodos distintos a POST', async () => {
    const { req, res } = makeReqRes('DELETE');
    await callHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'method-not-allowed' });
  });

  it('happy path: limpia cookie y devuelve 200', async () => {
    const { req, res } = makeReqRes('POST', { origin: 'http://localhost:3000' });
    await callHandler(req, res);
    const setCookieCall = res.setHeader.mock.calls.find((c) => c[0] === 'Set-Cookie');
    expect(setCookieCall).toBeDefined();
    const cookieValue = setCookieCall?.[1] as string;
    expect(cookieValue.startsWith(`${COOKIE_NAME}=`)).toBe(true);
    expect(cookieValue).toContain('Max-Age=0');
    expect(cookieValue).toContain('HttpOnly');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('configura CORS con el origin permitido', async () => {
    const { req, res } = makeReqRes('POST', { origin: 'http://localhost:3000' });
    await callHandler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3000',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });
});

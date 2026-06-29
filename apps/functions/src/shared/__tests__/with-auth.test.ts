import { describe, it, expect } from 'vitest';

import { buildAuthContext } from '../with-auth.js';

function makeReq(
  auth: { uid: string; token: Record<string, unknown> } | null,
): Parameters<typeof buildAuthContext>[0] {
  return {
    auth,
    data: {},
    rawRequest: { headers: {} },
  } as unknown as Parameters<typeof buildAuthContext>[0];
}

describe('buildAuthContext', () => {
  it('throws unauthenticated si no hay auth', async () => {
    await expect(buildAuthContext(makeReq(null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws permission-denied si role claim falta', async () => {
    await expect(buildAuthContext(makeReq({ uid: 'u1', token: {} }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('throws permission-denied si role claim es desconocido', async () => {
    await expect(
      buildAuthContext(makeReq({ uid: 'u1', token: { role: 'god' } })),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('throws permission-denied si role requerido no coincide', async () => {
    await expect(
      buildAuthContext(makeReq({ uid: 'u1', token: { role: 'expert' } }), 'admin'),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('acepta role requerido como array', async () => {
    const ctx = await buildAuthContext(makeReq({ uid: 'u1', token: { role: 'recruiter' } }), [
      'admin',
      'recruiter',
    ]);
    expect(ctx.role).toBe('recruiter');
  });

  it('retorna context con role y organizationId', async () => {
    const ctx = await buildAuthContext(
      makeReq({
        uid: 'u1',
        token: { role: 'admin', organizationId: 'org_1', email: 'a@x.com' },
      }),
    );
    expect(ctx.role).toBe('admin');
    expect(ctx.organizationId).toBe('org_1');
    expect(ctx.email).toBe('a@x.com');
    expect(ctx.traceId).toBeTruthy();
  });

  it('usa x-trace-id del header si existe', async () => {
    const req = makeReq({ uid: 'u1', token: { role: 'admin' } });
    req.rawRequest = { headers: { 'x-trace-id': 'abc-123' } } as never;
    const ctx = await buildAuthContext(req);
    expect(ctx.traceId).toBe('abc-123');
  });

  it('default organizationId = null si no está en claims', async () => {
    const ctx = await buildAuthContext(makeReq({ uid: 'u1', token: { role: 'expert' } }));
    expect(ctx.organizationId).toBeNull();
  });
});

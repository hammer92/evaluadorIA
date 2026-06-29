import { beforeEach, describe, expect, it } from 'vitest';

import type { Ctx } from '../../users/types';
import { MemoryAuditLogRepository } from '../memory';

const ctx: Ctx = {
  uid: 'u_actor',
  email: 'actor@x.com',
  role: 'admin',
  organizationId: 'org_1',
  traceId: 't',
};

describe('MemoryAuditLogRepository', () => {
  let repo: MemoryAuditLogRepository;

  beforeEach(() => {
    repo = new MemoryAuditLogRepository();
  });

  it('append crea log con logId y createdAt', async () => {
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
    expect(log.action).toBe('user.created');
  });

  it('list filtra por organizationId', async () => {
    await repo.append(
      {
        organizationId: 'org_1',
        actorId: 'u',
        actorEmail: 'a@x.com',
        action: 'user.created',
        targetType: 'user',
        targetId: 'u',
        metadata: {},
        ip: null,
        userAgent: null,
      },
      ctx,
    );
    await repo.append(
      {
        organizationId: 'org_2',
        actorId: 'u',
        actorEmail: 'a@x.com',
        action: 'user.created',
        targetType: 'user',
        targetId: 'u',
        metadata: {},
        ip: null,
        userAgent: null,
      },
      ctx,
    );
    const r = await repo.list({ organizationId: 'org_1' }, ctx);
    expect(r.items.length).toBe(1);
  });

  it('list pagina', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.append(
        {
          organizationId: 'org_1',
          actorId: 'u',
          actorEmail: 'a@x.com',
          action: 'user.created',
          targetType: 'user',
          targetId: `u${i}`,
          metadata: {},
          ip: null,
          userAgent: null,
        },
        ctx,
      );
    }
    const r = await repo.list({ page: 1, pageSize: 3 }, ctx);
    expect(r.items.length).toBe(3);
    expect(r.total).toBe(5);
    expect(r.hasMore).toBe(true);
  });

  it('getById retorna null si no existe', async () => {
    expect(await repo.getById('nope', ctx)).toBeNull();
  });

  it('__reset limpia store', async () => {
    await repo.append(
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
    repo.__reset();
    expect((await repo.list({}, ctx)).items.length).toBe(0);
  });
});

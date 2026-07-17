// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { userListMock, auditListMock, requireAuthMock } = vi.hoisted(() => ({
  userListMock: vi.fn(),
  auditListMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock('@/repositories', () => ({
  getUserRepository: () => ({ list: userListMock }),
  getAuditLogRepository: () => ({ list: auditListMock }),
}));

vi.mock('@/services/auth-service', () => ({
  requireAuth: requireAuthMock,
}));

import { getRecentAuditLogs, getUsersStats } from './dashboard-api';

import type { ServerAuth } from '@/features/auth/types';

const adminAuth: ServerAuth = {
  uid: 'u_admin',
  email: 'admin@x.com',
  role: 'admin',
  organizationId: 'org_1',
};

describe('getUsersStats', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    userListMock.mockReset();
    requireAuthMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('usa el ctx provisto y suma totals de active+invited+suspended', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    userListMock
      .mockResolvedValueOnce({ items: [], total: 10, page: 1, pageSize: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [], total: 4, page: 1, pageSize: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [], total: 1, page: 1, pageSize: 1, hasMore: false });

    const stats = await getUsersStats(adminAuth);

    expect(stats).toEqual({ total: 15, active: 10, invited: 4, suspended: 1 });
    expect(userListMock).toHaveBeenCalledTimes(3);
    expect(userListMock).toHaveBeenNthCalledWith(
      1,
      { status: 'active', page: 1, pageSize: 1 },
      { ...adminAuth, traceId: 'rsc' },
    );
    expect(userListMock).toHaveBeenNthCalledWith(
      2,
      { status: 'invited', page: 1, pageSize: 1 },
      { ...adminAuth, traceId: 'rsc' },
    );
    expect(userListMock).toHaveBeenNthCalledWith(
      3,
      { status: 'suspended', page: 1, pageSize: 1 },
      { ...adminAuth, traceId: 'rsc' },
    );
  });

  it('llama a requireAuth() cuando no se pasa ctx', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    userListMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1, hasMore: false });

    await getUsersStats();

    expect(requireAuthMock).toHaveBeenCalledTimes(1);
  });

  it('degrada a zeros cuando el repo lanza (ej. falta índice de Firestore)', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    userListMock.mockRejectedValue(new Error('index not found'));

    const stats = await getUsersStats(adminAuth);

    expect(stats).toEqual({ total: 0, active: 0, invited: 0, suspended: 0 });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[dashboard] getUsersStats failed (degraded to zeros):',
      'index not found',
    );
  });

  it('degrada a zeros cuando requireAuth lanza UNAUTHORIZED', async () => {
    requireAuthMock.mockRejectedValue(new Error('UNAUTHORIZED'));

    const stats = await getUsersStats();

    expect(stats).toEqual({ total: 0, active: 0, invited: 0, suspended: 0 });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('degrada a zeros cuando una sola de las 3 llamadas falla', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    userListMock
      .mockResolvedValueOnce({ items: [], total: 5, page: 1, pageSize: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [], total: 2, page: 1, pageSize: 1, hasMore: true })
      .mockRejectedValueOnce(new Error('boom'));

    const stats = await getUsersStats(adminAuth);

    expect(stats).toEqual({ total: 0, active: 0, invited: 0, suspended: 0 });
  });
});

describe('getRecentAuditLogs', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auditListMock.mockReset();
    requireAuthMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('mapea items del repo al shape RecentAuditLog con createdAt ISO', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    const created = new Date('2026-06-28T15:30:00Z');
    auditListMock.mockResolvedValue({
      items: [
        {
          logId: 'log_1',
          actorEmail: 'admin@x.com',
          action: 'user.created',
          targetId: 'u_new',
          createdAt: created,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
      hasMore: false,
    });

    const logs = await getRecentAuditLogs(5, adminAuth);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      logId: 'log_1',
      actorEmail: 'admin@x.com',
      action: 'user.created',
      targetId: 'u_new',
      createdAt: created.toISOString(),
    });
    expect(auditListMock).toHaveBeenCalledWith(
      { page: 1, pageSize: 5 },
      { ...adminAuth, traceId: 'rsc' },
    );
  });

  it('pasa el limit como pageSize al repo', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    auditListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    await getRecentAuditLogs(20, adminAuth);

    expect(auditListMock).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      { ...adminAuth, traceId: 'rsc' },
    );
  });

  it('preserva targetId=null en el shape serializado', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    auditListMock.mockResolvedValue({
      items: [
        {
          logId: 'log_x',
          actorEmail: 'sys@x.com',
          action: 'auth.failed_login',
          targetId: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 1,
      hasMore: false,
    });

    const logs = await getRecentAuditLogs(1, adminAuth);

    expect(logs[0]?.targetId).toBeNull();
    expect(logs[0]?.action).toBe('auth.failed_login');
  });

  it('llama a requireAuth() cuando no se pasa ctx', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    auditListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      hasMore: false,
    });

    await getRecentAuditLogs(10);

    expect(requireAuthMock).toHaveBeenCalledTimes(1);
  });

  it('degrada a [] cuando el repo lanza', async () => {
    requireAuthMock.mockResolvedValue(adminAuth);
    auditListMock.mockRejectedValue(new Error('index missing'));

    const logs = await getRecentAuditLogs(5, adminAuth);

    expect(logs).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[dashboard] getRecentAuditLogs failed (degraded to empty):',
      'index missing',
    );
  });

  it('degrada a [] cuando requireAuth lanza UNAUTHORIZED', async () => {
    requireAuthMock.mockRejectedValue(new Error('UNAUTHORIZED'));

    const logs = await getRecentAuditLogs(5);

    expect(logs).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

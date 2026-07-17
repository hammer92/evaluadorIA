import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const state = { lastPayload: null as unknown, lastDocArgs: [] as unknown[] };
  const setMock = vi.fn().mockImplementation((payload: unknown) => {
    state.lastPayload = payload;
    return Promise.resolve();
  });
  const docMock = vi.fn(() => ({ set: setMock }));
  const collectionMock = vi.fn((name: string) => {
    if (name === 'audit_logs') {
      return {
        doc: vi.fn((...args: unknown[]) => {
          state.lastDocArgs = args;
          return { set: setMock };
        }),
      };
    }
    return { doc: docMock };
  });
  return {
    collectionMock,
    setMock,
    getLastPayload: () => state.lastPayload,
    getLastDocArgs: () => state.lastDocArgs,
    reset: () => {
      state.lastPayload = null;
      state.lastDocArgs = [];
      setMock.mockClear();
      collectionMock.mockClear();
    },
  };
});

vi.mock('../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => ({})),
  getAdminDb: vi.fn(() => ({ collection: hoisted.collectionMock })),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
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

const { writeAuditLog } = await import('../audit.js');

describe('writeAuditLog', () => {
  beforeEach(() => {
    hoisted.reset();
  });

  it('escribe en colección audit_logs con payload normalizado', async () => {
    await writeAuditLog({
      actorId: 'u1',
      actorEmail: 'a@b.co',
      action: 'user.created',
      targetType: 'user',
      targetId: 'target-1',
      metadata: { foo: 'bar' },
      organizationId: 'org-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(hoisted.collectionMock).toHaveBeenCalledWith('audit_logs');
    expect(hoisted.setMock).toHaveBeenCalledTimes(1);
    const payload = hoisted.getLastPayload() as Record<string, unknown>;
    expect(payload['organizationId']).toBe('org-1');
    expect(payload['actorId']).toBe('u1');
    expect(payload['actorEmail']).toBe('a@b.co');
    expect(payload['action']).toBe('user.created');
    expect(payload['targetType']).toBe('user');
    expect(payload['targetId']).toBe('target-1');
    expect(payload['metadata']).toEqual({ foo: 'bar' });
    expect(payload['ip']).toBe('127.0.0.1');
    expect(payload['userAgent']).toBe('jest');
    expect(payload['createdAt']).toBeTypeOf('symbol');
  });

  it('usa organizationId null cuando no se pasa', async () => {
    await writeAuditLog({
      actorId: 'u2',
      actorEmail: 'b@b.co',
      action: 'user.updated',
      targetType: 'user',
      targetId: 'target-2',
    });

    const payload = hoisted.getLastPayload() as Record<string, unknown>;
    expect(payload['organizationId']).toBeNull();
    expect(payload['metadata']).toEqual({});
    expect(payload['ip']).toBeNull();
    expect(payload['userAgent']).toBeNull();
  });

  it('pasa targetId null correctamente', async () => {
    await writeAuditLog({
      actorId: 'u3',
      actorEmail: 'c@b.co',
      action: 'auth.failed_login',
      targetType: 'system',
      targetId: null,
    });

    const payload = hoisted.getLastPayload() as Record<string, unknown>;
    expect(payload['targetId']).toBeNull();
  });

  it('usa auto-generated doc id (no args a doc())', async () => {
    await writeAuditLog({
      actorId: 'u4',
      actorEmail: 'd@b.co',
      action: 'user.deleted',
      targetType: 'user',
      targetId: 't4',
    });
    expect(hoisted.getLastDocArgs()).toHaveLength(0);
  });
});

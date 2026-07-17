import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { toAuditLog, toAuditLogInputRaw, type AuditLogRaw } from '../mapper';

function makeRaw(overrides: Partial<AuditLogRaw> = {}): AuditLogRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    organization_id: 'org_1',
    actor_id: 'u_actor',
    actor_email: 'actor@x.com',
    action: 'user.created',
    target_type: 'user',
    target_id: 'u_target',
    metadata: { foo: 'bar' },
    ip: '127.0.0.1',
    user_agent: 'vitest',
    created_at: ts,
    ...overrides,
  };
}

describe('audit-logs mapper', () => {
  describe('toAuditLog', () => {
    it('mapea snake_case → camelCase', () => {
      const raw = makeRaw();
      const log = toAuditLog('log_1', raw);
      expect(log).toEqual({
        logId: 'log_1',
        organizationId: 'org_1',
        actorId: 'u_actor',
        actorEmail: 'actor@x.com',
        action: 'user.created',
        targetType: 'user',
        targetId: 'u_target',
        metadata: { foo: 'bar' },
        ip: '127.0.0.1',
        userAgent: 'vitest',
        createdAt: new Date('2026-06-30T12:00:00Z'),
      });
    });

    it('convierte Timestamp a Date en createdAt', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const raw = makeRaw({ created_at: Timestamp.fromDate(date) });
      const log = toAuditLog('log_1', raw);
      expect(log.createdAt).toBeInstanceOf(Date);
      expect(log.createdAt.toISOString()).toBe(date.toISOString());
    });

    it('preserva el logId del argumento', () => {
      const log = toAuditLog('custom_id', makeRaw());
      expect(log.logId).toBe('custom_id');
    });

    it('preserva organizationId null', () => {
      const raw = makeRaw({ organization_id: null });
      const log = toAuditLog('log_1', raw);
      expect(log.organizationId).toBeNull();
    });

    it('preserva targetId null', () => {
      const raw = makeRaw({ target_id: null });
      const log = toAuditLog('log_1', raw);
      expect(log.targetId).toBeNull();
    });

    it('preserva ip null', () => {
      const raw = makeRaw({ ip: null });
      const log = toAuditLog('log_1', raw);
      expect(log.ip).toBeNull();
    });

    it('preserva userAgent null', () => {
      const raw = makeRaw({ user_agent: null });
      const log = toAuditLog('log_1', raw);
      expect(log.userAgent).toBeNull();
    });

    it('preserva metadata como referencia (mismo objeto)', () => {
      const metadata = { foo: 'bar', n: 1 };
      const raw = makeRaw({ metadata });
      const log = toAuditLog('log_1', raw);
      expect(log.metadata).toEqual(metadata);
    });

    it('soporta metadata vacía', () => {
      const raw = makeRaw({ metadata: {} });
      const log = toAuditLog('log_1', raw);
      expect(log.metadata).toEqual({});
    });

    it('preserva todos los action enum values', () => {
      const actions = [
        'user.created',
        'user.updated',
        'user.deleted',
        'user.role_changed',
        'user.suspended',
        'organization.created',
        'organization.updated',
        'auth.login',
        'auth.failed_login',
        'auth.role_escalation_blocked',
      ] as const;
      for (const action of actions) {
        const raw = makeRaw({ action });
        const log = toAuditLog('log_1', raw);
        expect(log.action).toBe(action);
      }
    });

    it('preserva todos los targetType enum values', () => {
      const types = ['user', 'organization', 'system'] as const;
      for (const targetType of types) {
        const raw = makeRaw({ target_type: targetType });
        const log = toAuditLog('log_1', raw);
        expect(log.targetType).toBe(targetType);
      }
    });
  });

  describe('toAuditLogInputRaw', () => {
    it('mapea camelCase → snake_case excluyendo created_at', () => {
      const result = toAuditLogInputRaw({
        organizationId: 'org_1',
        actorId: 'u_actor',
        actorEmail: 'actor@x.com',
        action: 'user.created',
        targetType: 'user',
        targetId: 'u_target',
        metadata: { foo: 'bar' },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      });
      expect(result).toEqual({
        organization_id: 'org_1',
        actor_id: 'u_actor',
        actor_email: 'actor@x.com',
        action: 'user.created',
        target_type: 'user',
        target_id: 'u_target',
        metadata: { foo: 'bar' },
        ip: '127.0.0.1',
        user_agent: 'vitest',
      });
      expect(result).not.toHaveProperty('created_at');
    });

    it('preserva organizationId null', () => {
      const result = toAuditLogInputRaw({
        organizationId: null,
        actorId: 'u',
        actorEmail: 'a@x.com',
        action: 'auth.login',
        targetType: 'system',
        targetId: null,
        metadata: {},
        ip: null,
        userAgent: null,
      });
      expect(result.organization_id).toBeNull();
      expect(result.target_id).toBeNull();
      expect(result.ip).toBeNull();
      expect(result.user_agent).toBeNull();
    });

    it('preserva metadata como referencia (mismo objeto)', () => {
      const metadata = { foo: 'bar', n: 1 };
      const result = toAuditLogInputRaw({
        organizationId: 'org_1',
        actorId: 'u',
        actorEmail: 'a@x.com',
        action: 'user.created',
        targetType: 'user',
        targetId: 'u',
        metadata,
        ip: null,
        userAgent: null,
      });
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('round-trip toAuditLog ↔ toAuditLogInputRaw', () => {
    const baseInput = {
      organizationId: 'org_1',
      actorId: 'u_actor',
      actorEmail: 'actor@x.com',
      action: 'user.created',
      targetType: 'user',
      targetId: 'u_target',
      metadata: { foo: 'bar' },
      ip: '127.0.0.1',
      userAgent: 'vitest',
    } as const;

    it('input → raw → log conserva campos (excepto logId/createdAt)', () => {
      const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
      const raw: AuditLogRaw = { ...toAuditLogInputRaw(baseInput), created_at: ts };
      const log = toAuditLog('log_1', raw);
      expect(log.logId).toBe('log_1');
      expect(log.organizationId).toBe(baseInput.organizationId);
      expect(log.actorId).toBe(baseInput.actorId);
      expect(log.actorEmail).toBe(baseInput.actorEmail);
      expect(log.action).toBe(baseInput.action);
      expect(log.targetType).toBe(baseInput.targetType);
      expect(log.targetId).toBe(baseInput.targetId);
      expect(log.metadata).toEqual(baseInput.metadata);
      expect(log.ip).toBe(baseInput.ip);
      expect(log.userAgent).toBe(baseInput.userAgent);
      expect(log.createdAt.toISOString()).toBe(ts.toDate().toISOString());
    });

    it('roundtrip preserva nulls en campos opcionales', () => {
      const input = {
        organizationId: null,
        actorId: 'u_actor',
        actorEmail: 'actor@x.com',
        action: 'auth.login',
        targetType: 'system',
        targetId: null,
        metadata: {},
        ip: null,
        userAgent: null,
      } as const;
      const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
      const raw: AuditLogRaw = { ...toAuditLogInputRaw(input), created_at: ts };
      const log = toAuditLog('log_2', raw);
      expect(log.organizationId).toBeNull();
      expect(log.targetId).toBeNull();
      expect(log.ip).toBeNull();
      expect(log.userAgent).toBeNull();
      expect(log.metadata).toEqual({});
    });

    it('roundtrip preserva todos los action enum values', () => {
      const actions = [
        'user.created',
        'user.updated',
        'user.deleted',
        'user.role_changed',
        'user.suspended',
        'organization.created',
        'organization.updated',
        'auth.login',
        'auth.failed_login',
        'auth.role_escalation_blocked',
      ] as const;
      const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
      for (const action of actions) {
        const input = { ...baseInput, action };
        const raw: AuditLogRaw = { ...toAuditLogInputRaw(input), created_at: ts };
        const log = toAuditLog('log_x', raw);
        expect(log.action).toBe(action);
      }
    });

    it('roundtrip preserva metadata como referencia (mismo contenido)', () => {
      const metadata = { nested: { a: 1 }, list: [1, 2, 3], flag: true };
      const input = { ...baseInput, metadata };
      const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
      const raw: AuditLogRaw = { ...toAuditLogInputRaw(input), created_at: ts };
      const log = toAuditLog('log_3', raw);
      expect(log.metadata).toEqual(metadata);
    });

    it('roundtrip timestamps via createdAt conservan precisión de milisegundos', () => {
      const date = new Date('2026-01-01T12:34:56.789Z');
      const ts = Timestamp.fromDate(date);
      const raw: AuditLogRaw = { ...toAuditLogInputRaw(baseInput), created_at: ts };
      const log = toAuditLog('log_4', raw);
      expect(log.createdAt.getTime()).toBe(date.getTime());
    });
  });
});

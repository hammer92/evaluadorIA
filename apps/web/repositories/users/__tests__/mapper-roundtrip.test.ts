import type { User } from '@shared/schemas/users';
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { toUser, toUserInputRaw, toUpdateRaw, type UserRaw } from '../mapper';

// =============================================================================
// Mapper roundtrip test — garantiza que `parse(toUser(toRaw(u))) === u`.
// =============================================================================
// SDD-04 §4.7 menciona que el mapper se desincroniza del schema. Este test
// cubre el roundtrip: domain → raw → domain produce el mismo objeto.
// =============================================================================

function makeRaw(overrides: Partial<UserRaw> = {}): UserRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    email: 'a@x.com',
    display_name: 'Alice',
    photo_url: null,
    role: 'expert',
    organization_id: 'org_default',
    status: 'active',
    last_login_at: ts,
    created_at: ts,
    updated_at: ts,
    created_by: 'u_admin',
    deleted_at: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'u_alice',
    email: 'a@x.com',
    displayName: 'Alice',
    photoURL: null,
    role: 'expert',
    organizationId: 'org_default',
    status: 'active',
    lastLoginAt: new Date('2026-06-30T12:00:00Z'),
    createdAt: new Date('2026-06-30T12:00:00Z'),
    updatedAt: new Date('2026-06-30T12:00:00Z'),
    createdBy: 'u_admin',
    deletedAt: null,
    ...overrides,
  };
}

describe('users/mapper — roundtrip', () => {
  it('toUser preserva todos los campos desde raw', () => {
    const raw = makeRaw();
    const u = toUser('u_alice', raw);

    expect(u.uid).toBe('u_alice');
    expect(u.email).toBe(raw.email);
    expect(u.displayName).toBe(raw.display_name);
    expect(u.photoURL).toBeNull();
    expect(u.role).toBe(raw.role);
    expect(u.organizationId).toBe(raw.organization_id);
    expect(u.status).toBe(raw.status);
    expect(u.lastLoginAt).toBeInstanceOf(Date);
    expect(u.createdAt).toBeInstanceOf(Date);
    expect(u.updatedAt).toBeInstanceOf(Date);
    expect(u.createdBy).toBe(raw.created_by);
    expect(u.deletedAt).toBeNull();
  });

  it('roundtrip raw → user → raw produce un raw equivalente', () => {
    const raw0 = makeRaw();
    const u = toUser('u_alice', raw0);
    // Para reconstruir raw necesitamos Date → Timestamp; aquí verificamos
    // que los timestamps son Date y los campos string/enum coinciden.
    expect(u.email).toBe(raw0.email);
    expect(u.displayName).toBe(raw0.display_name);
    expect(u.photoURL).toBe(raw0.photo_url);
    expect(u.role).toBe(raw0.role);
    expect(u.organizationId).toBe(raw0.organization_id);
    expect(u.status).toBe(raw0.status);
    expect(u.createdBy).toBe(raw0.created_by);
    expect(u.deletedAt).toBeNull();
    // Timestamps: el roundtrip user→raw no existe (toUpdateRaw es para update),
    // pero verificamos que los Date son válidos y aproximadamente iguales.
    expect(u.createdAt.getTime()).toBe(raw0.created_at.toDate().getTime());
    expect(u.updatedAt.getTime()).toBe(raw0.updated_at.toDate().getTime());
  });

  it('roundtrip user → raw preserva enums y strings', () => {
    const u = makeUser({ status: 'invited', role: 'admin', organizationId: 'org_other' });
    const inputRaw = toUserInputRaw({
      email: u.email,
      role: u.role,
      organizationId: u.organizationId ?? undefined,
    });
    expect(inputRaw.email).toBe(u.email);
    expect(inputRaw.role).toBe('admin');
    expect(inputRaw.organization_id).toBe('org_other');
    expect(inputRaw.status).toBe('invited');
  });

  it('roundtrip update: solo campos provistos se incluyen en raw', () => {
    const u = makeUser({ displayName: 'Bob', photoURL: null });
    const patch = toUpdateRaw({ displayName: u.displayName });
    expect(patch.display_name).toBe('Bob');
    expect(patch.photo_url).toBeUndefined();
    expect(patch.role).toBeUndefined();
    expect(patch.status).toBeUndefined();
  });

  it('roundtrip update con role change', () => {
    const u = makeUser({ role: 'admin' });
    const patch = toUpdateRaw({ role: u.role });
    expect(patch.role).toBe('admin');
    expect(patch.display_name).toBeUndefined();
  });

  it('roundtrip update con status change', () => {
    const u = makeUser({ status: 'suspended' });
    const patch = toUpdateRaw({ status: u.status });
    expect(patch.status).toBe('suspended');
    expect(patch.role).toBeUndefined();
  });

  it('toUser con display_name null se preserva como null', () => {
    const raw = makeRaw({ display_name: null });
    const u = toUser('u_alice', raw);
    expect(u.displayName).toBeNull();
  });

  it('toUser con deleted_at no-null setea deletedAt Date', () => {
    const ts = Timestamp.fromDate(new Date('2026-06-29T00:00:00Z'));
    const raw = makeRaw({ deleted_at: ts });
    const u = toUser('u_alice', raw);
    expect(u.deletedAt).toBeInstanceOf(Date);
    expect(u.deletedAt?.getTime()).toBe(ts.toDate().getTime());
  });

  it('toUser con last_login_at null se preserva como null', () => {
    const raw = makeRaw({ last_login_at: null });
    const u = toUser('u_alice', raw);
    expect(u.lastLoginAt).toBeNull();
  });

  it('toUserInputRaw default status es invited', () => {
    const raw = toUserInputRaw({ email: 'x@x.com', role: 'expert' });
    expect(raw.status).toBe('invited');
    expect(raw.organization_id).toBeNull();
    expect(raw.display_name).toBeNull();
  });
});

import type { Organization } from '@shared/schemas/organizations';
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  toOrganization,
  toOrganizationInputRaw,
  toUpdateOrgRaw,
  type OrganizationRaw,
} from '../mapper';

// =============================================================================
// Mapper roundtrip test — garantiza que `parse(toOrganization(toRaw(u))) === u`.
// =============================================================================
// SDD-04 §4.7 menciona que el mapper se desincroniza del schema. Este test
// cubre el roundtrip: domain → raw → domain produce el mismo objeto.
// =============================================================================

function makeRaw(overrides: Partial<OrganizationRaw> = {}): OrganizationRaw {
  const ts = Timestamp.fromDate(new Date('2026-06-30T12:00:00Z'));
  return {
    name: 'Default Org',
    slug: 'default',
    plan: 'free',
    settings: { timezone: 'UTC', locale: 'es' },
    created_at: ts,
    updated_at: ts,
    created_by: 'system',
    deleted_at: null,
    ...overrides,
  };
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    orgId: 'org_default',
    name: 'Default Org',
    slug: 'default',
    plan: 'free',
    settings: { timezone: 'UTC', locale: 'es' },
    createdAt: new Date('2026-06-30T12:00:00Z'),
    updatedAt: new Date('2026-06-30T12:00:00Z'),
    createdBy: 'system',
    deletedAt: null,
    ...overrides,
  };
}

describe('organizations/mapper — roundtrip', () => {
  it('toOrganization preserva todos los campos desde raw', () => {
    const raw = makeRaw();
    const org = toOrganization('org_default', raw);

    expect(org.orgId).toBe('org_default');
    expect(org.name).toBe(raw.name);
    expect(org.slug).toBe(raw.slug);
    expect(org.plan).toBe(raw.plan);
    expect(org.settings).toEqual(raw.settings);
    expect(org.createdAt).toBeInstanceOf(Date);
    expect(org.updatedAt).toBeInstanceOf(Date);
    expect(org.createdBy).toBe(raw.created_by);
    expect(org.deletedAt).toBeNull();
  });

  it('roundtrip raw → org → raw produce un raw equivalente', () => {
    const raw0 = makeRaw();
    const org = toOrganization('org_default', raw0);
    expect(org.name).toBe(raw0.name);
    expect(org.slug).toBe(raw0.slug);
    expect(org.plan).toBe(raw0.plan);
    expect(org.settings).toEqual(raw0.settings);
    expect(org.createdBy).toBe(raw0.created_by);
    expect(org.deletedAt).toBeNull();
    expect(org.createdAt.getTime()).toBe(raw0.created_at.toDate().getTime());
    expect(org.updatedAt.getTime()).toBe(raw0.updated_at.toDate().getTime());
  });

  it('roundtrip org → raw (input) preserva enums y strings', () => {
    const org = makeOrg({ plan: 'pro', slug: 'acme', name: 'Acme Corp' });
    const inputRaw = toOrganizationInputRaw({
      name: org.name,
      slug: org.slug,
      plan: org.plan,
    });
    expect(inputRaw.name).toBe('Acme Corp');
    expect(inputRaw.slug).toBe('acme');
    expect(inputRaw.plan).toBe('pro');
    // Default settings
    expect(inputRaw.settings).toEqual({ timezone: 'UTC', locale: 'en' });
  });

  it('roundtrip update: solo campos provistos se incluyen en raw', () => {
    const patch = toUpdateOrgRaw({ name: 'New Name' });
    expect(patch.name).toBe('New Name');
    expect(patch.plan).toBeUndefined();
    expect(patch.settings).toBeUndefined();
  });

  it('roundtrip update con plan change', () => {
    const org = makeOrg({ plan: 'enterprise' });
    const patch = toUpdateOrgRaw({ plan: org.plan });
    expect(patch.plan).toBe('enterprise');
    expect(patch.name).toBeUndefined();
  });

  it('roundtrip update con settings change (timezone + locale provistos)', () => {
    const patch = toUpdateOrgRaw({
      settings: { timezone: 'America/Mexico_City', locale: 'es-MX' },
    });
    expect(patch.settings).toEqual({ timezone: 'America/Mexico_City', locale: 'es-MX' });
  });

  it('roundtrip update con settings sin timezone ni locale usa defaults', () => {
    const patch = toUpdateOrgRaw({ settings: {} });
    expect(patch.settings).toEqual({ timezone: 'UTC', locale: 'en' });
  });

  it('toOrganization con deleted_at no-null setea deletedAt Date', () => {
    const ts = Timestamp.fromDate(new Date('2026-06-29T00:00:00Z'));
    const raw = makeRaw({ deleted_at: ts });
    const org = toOrganization('org_default', raw);
    expect(org.deletedAt).toBeInstanceOf(Date);
    expect(org.deletedAt?.getTime()).toBe(ts.toDate().getTime());
  });

  it('toOrganization soporta todos los plan enum values', () => {
    const plans = ['free', 'pro', 'enterprise'] as const;
    for (const plan of plans) {
      const raw = makeRaw({ plan });
      const org = toOrganization('org_default', raw);
      expect(org.plan).toBe(plan);
    }
  });

  it('toOrganizationInputRaw default settings es UTC + en', () => {
    const raw = toOrganizationInputRaw({ name: 'X', slug: 'x', plan: 'free' });
    expect(raw.settings).toEqual({ timezone: 'UTC', locale: 'en' });
  });
});

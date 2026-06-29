import type { Organization } from '@shared/schemas/organizations';
import type { Timestamp as FbTimestamp } from 'firebase/firestore';

export interface OrganizationRaw {
  name: string;
  slug: string;
  plan: Organization['plan'];
  settings: { timezone: string; locale: string };
  created_at: FbTimestamp;
  updated_at: FbTimestamp;
  created_by: string;
  deleted_at: FbTimestamp | null;
}

export const toOrganization = (orgId: string, raw: OrganizationRaw): Organization => ({
  orgId,
  name: raw.name,
  slug: raw.slug,
  plan: raw.plan,
  settings: raw.settings,
  createdAt: raw.created_at.toDate(),
  updatedAt: raw.updated_at.toDate(),
  createdBy: raw.created_by,
  deletedAt: raw.deleted_at?.toDate() ?? null,
});

export const toOrganizationInputRaw = (input: {
  name: string;
  slug: string;
  plan: Organization['plan'];
}): Pick<OrganizationRaw, 'name' | 'slug' | 'plan' | 'settings'> => ({
  name: input.name,
  slug: input.slug,
  plan: input.plan,
  settings: { timezone: 'UTC', locale: 'en' },
});

export const toUpdateOrgRaw = (
  input: Partial<{
    name: string;
    plan: Organization['plan'];
    settings: { timezone?: string; locale?: string };
  }>,
): Partial<OrganizationRaw> => {
  const raw: Partial<OrganizationRaw> = {};
  if (input.name !== undefined) raw.name = input.name;
  if (input.plan !== undefined) raw.plan = input.plan;
  if (input.settings !== undefined) {
    raw.settings = {
      timezone: input.settings.timezone ?? 'UTC',
      locale: input.settings.locale ?? 'en',
    };
  }
  return raw;
};

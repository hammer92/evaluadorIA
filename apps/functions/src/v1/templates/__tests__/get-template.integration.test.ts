/**
 * v1TemplatesGet — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Obtener template por id".
 * Sprint sdd-10-backend-gaps PR #B Slice 2.
 *
 * Auth: admin or expert (cualquiera); recruiter solo si status='approved'.
 * Defense-in-depth: server-side canViewTemplate() check.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// =============================================================================
// vi.hoisted: registry de handlers onCall (debe ser hoisted ANTES del mock)
// =============================================================================
const templatesOnCallRegistry = vi.hoisted((): ((req: unknown) => Promise<unknown>)[] => []);

// =============================================================================
// vi.mock: captura handlers de onCall
// =============================================================================
vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  );
  return {
    ...actual,
    onCall: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown) => Promise<unknown>)
          : (maybeHandler as (req: unknown) => Promise<unknown>);
      templatesOnCallRegistry.push(handler);
      return ((req: unknown) => handler(req)) as unknown as ReturnType<typeof actual.onCall>;
    }) as typeof actual.onCall,
  };
});

// =============================================================================
// Static imports
// =============================================================================
import { v1TemplatesGet } from '../get-template.js';

import {
  assertEmulatorsUp,
  buildAdminReq,
  buildExpertReq,
  buildRecruiterReq,
  buildUnauthReq,
  cleanupTemplatesIntegration,
  deleteTestOrg,
  getLatestOnCallHandler,
  seedTestOrg,
  templatesTestDb,
} from './helpers/integration-setup.js';

// =============================================================================
// Fixtures
// =============================================================================
const ORG_ID = 'org_test_get';

async function seedTemplate(
  templateId: string,
  fields: Partial<{
    name: string;
    description: string;
    status: string;
    deletedAt: Date | null;
  }> = {},
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: fields.name ?? `Test Template ${templateId}`,
      description: fields.description ?? null,
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [],
      status: fields.status ?? 'draft',
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: null,
      approved_at: null,
      deleted_at: fields.deletedAt ?? null,
    });
}

// =============================================================================
// Lifecycle
// =============================================================================
beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesGet (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesGet).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(handler(buildUnauthReq({ templateId: 'tpl_001' }))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('happy path: admin lee template draft → retorna template + transitions', async () => {
    await seedTemplate('tpl_admin_draft', { status: 'draft' });
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_admin_draft' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; status: string; availableTransitions: unknown[] } | null;

    expect(result).not.toBeNull();
    expect(result?.templateId).toBe('tpl_admin_draft');
    expect(result?.status).toBe('draft');
    expect(Array.isArray(result?.availableTransitions)).toBe(true);
  });

  it('happy path: recruiter lee template approved → OK', async () => {
    await seedTemplate('tpl_recruiter_approved', { status: 'approved' });
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildRecruiterReq(
        { templateId: 'tpl_recruiter_approved' },
        { uid: 'recruiter-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; status: string } | null;

    expect(result).not.toBeNull();
    expect(result?.templateId).toBe('tpl_recruiter_approved');
    expect(result?.status).toBe('approved');
  });

  it('recruiter NO puede leer template en draft (canViewTemplate server-side → null)', async () => {
    await seedTemplate('tpl_recruiter_draft', { status: 'draft' });
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildRecruiterReq(
        { templateId: 'tpl_recruiter_draft' },
        { uid: 'recruiter-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string } | null;

    expect(result).toBeNull();
  });

  it('expert lee template en in_review → OK', async () => {
    await seedTemplate('tpl_expert_in_review', { status: 'in_review' });
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        { templateId: 'tpl_expert_in_review' },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; status: string } | null;

    expect(result).not.toBeNull();
    expect(result?.status).toBe('in_review');
  });

  it('returns null si el template no existe', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'nonexistent-tpl' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string } | null;

    expect(result).toBeNull();
  });

  it('rechaza templateId vacío (invalid-argument)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildAdminReq({ templateId: '' }, { uid: 'admin-uid', organizationId: ORG_ID })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('admin lee template soft-deleted (deleted_at != null) → OK (admin bypass)', async () => {
    await seedTemplate('tpl_soft_deleted', {
      status: 'approved',
      deletedAt: new Date(),
    });
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_soft_deleted' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; deletedAt: string | null } | null;

    expect(result).not.toBeNull();
    expect(result?.deletedAt).not.toBeNull();
  });
});

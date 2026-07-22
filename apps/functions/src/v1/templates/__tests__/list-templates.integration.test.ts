/**
 * v1TemplatesList — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Listar templates con filtros".
 * Sprint sdd-10-backend-gaps PR #B Slice 3.
 *
 * Auth: admin/expert/recruiter. Recruiter forzado a status='approved'.
 * Pagination: page + pageSize, orden por updatedAt desc.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// =============================================================================
// vi.hoisted + vi.mock
// =============================================================================
const templatesOnCallRegistry = vi.hoisted((): ((req: unknown) => Promise<unknown>)[] => []);

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
import { v1TemplatesList } from '../list-templates.js';

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
const ORG_ID = 'org_test_list';

interface SeedTemplateFields {
  name: string;
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
  niche?: 'school' | 'university' | 'exam_practice';
  deletedAt?: Date | null;
  updatedAt?: Date;
}

async function seedTemplate(templateId: string, fields: SeedTemplateFields): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: fields.name,
      description: null,
      niche: fields.niche ?? 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [],
      status: fields.status,
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: fields.updatedAt ?? new Date(),
      updated_at: fields.updatedAt ?? new Date(),
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

  // Seed: 3 draft, 2 in_review, 4 approved, 1 rejected, 1 soft-deleted
  await seedTemplate('tpl_001', { name: 'Examen Aritmética', status: 'draft' });
  await seedTemplate('tpl_002', { name: 'Examen Geometría', status: 'draft' });
  await seedTemplate('tpl_003', { name: 'Examen Álgebra', status: 'draft', niche: 'university' });
  await seedTemplate('tpl_004', { name: 'Examen Física', status: 'in_review' });
  await seedTemplate('tpl_005', { name: 'Examen Química', status: 'in_review' });
  await seedTemplate('tpl_006', { name: 'Examen Biología', status: 'approved' });
  await seedTemplate('tpl_007', { name: 'Examen Historia', status: 'approved' });
  await seedTemplate('tpl_008', { name: 'Examen Literatura', status: 'approved' });
  await seedTemplate('tpl_009', { name: 'Examen Filosofía', status: 'approved' });
  await seedTemplate('tpl_010', { name: 'Examen Arte', status: 'rejected' });
  await seedTemplate('tpl_011', {
    name: 'Examen Música',
    status: 'approved',
    deletedAt: new Date(),
  });
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesList (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesList).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(handler(buildUnauthReq({}))).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('admin: lista todos los templates no-soft-deleted', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({}, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: unknown[]; total: number };

    // 3 draft + 2 in_review + 4 approved + 1 rejected = 10 (soft-deleted excluido)
    expect(result.total).toBe(10);
    expect(result.items).toHaveLength(10);
  });

  it('recruiter: solo ve templates approved (forzado por server)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildRecruiterReq({}, { uid: 'recruiter-uid', organizationId: ORG_ID }),
    )) as { items: { status: string }[]; total: number };

    expect(result.total).toBe(4);
    for (const item of result.items) {
      expect(item.status).toBe('approved');
    }
  });

  it('expert: ve todos los templates no-soft-deleted', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq({}, { uid: 'expert-uid', organizationId: ORG_ID }),
    )) as { items: unknown[]; total: number };

    expect(result.total).toBe(10);
  });

  it('admin: filtro por status=draft → solo 3', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ status: 'draft' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: { status: string }[]; total: number };

    expect(result.total).toBe(3);
    for (const item of result.items) {
      expect(item.status).toBe('draft');
    }
  });

  it('admin: filtro por niche=university → 1 (tpl_003)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ niche: 'university' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: { name: string }[]; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe('Examen Álgebra');
  });

  it('admin: search por prefijo "Examen Geo" → 1 (tpl_002)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ search: 'Examen Geo' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: { name: string }[]; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe('Examen Geometría');
  });

  it('admin: pagination page=1 pageSize=3 → 3 items + hasMore=true', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ page: 1, pageSize: 3 }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: unknown[]; total: number; hasMore: boolean; page: number; pageSize: number };

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
  });

  it('admin: pagination page=4 pageSize=3 → 1 item (último) + hasMore=false', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ page: 4, pageSize: 3 }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { items: unknown[]; hasMore: boolean };

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });
});

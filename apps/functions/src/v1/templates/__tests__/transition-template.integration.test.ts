/**
 * v1TemplatesTransition — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Cambiar estado (state machine)".
 * Sprint sdd-10-backend-gaps PR #B Slice 6.
 *
 * State machine: draft → in_review → approved/rejected/changes_requested.
 * Auth: depende de la transición (admin/expert).
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
import { v1TemplatesTransition } from '../transition-template.js';

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
const ORG_ID = 'org_test_transition';

async function seedTemplate(
  templateId: string,
  fields: {
    name: string;
    status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
    createdBy?: string;
    deletedAt?: Date | null;
  },
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: fields.name,
      description: null,
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [],
      status: fields.status,
      created_by: fields.createdBy ?? 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: fields.status === 'approved' ? 'admin-uid' : null,
      approved_at: fields.status === 'approved' ? new Date() : null,
      deleted_at: fields.deletedAt ?? null,
    });
}

// =============================================================================
// Lifecycle
// =============================================================================
beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
  await seedTemplate('tpl_draft', { name: 'Tpl Draft', status: 'draft' });
  await seedTemplate('tpl_in_review', { name: 'Tpl InReview', status: 'in_review' });
  await seedTemplate('tpl_changes', { name: 'Tpl Changes', status: 'changes_requested' });
  await seedTemplate('tpl_approved', { name: 'Tpl Approved', status: 'approved' });
  await seedTemplate('tpl_archived', {
    name: 'Tpl Archived',
    status: 'draft',
    deletedAt: new Date(),
  });
  // Templates extra para tests que necesitan estado fresh
  await seedTemplate('tpl_fresh_draft', { name: 'Tpl FreshDraft', status: 'draft' });
  await seedTemplate('tpl_fresh_in_review', {
    name: 'Tpl FreshInReview',
    status: 'in_review',
  });
  await seedTemplate('tpl_fresh_archived', {
    name: 'Tpl FreshArchived',
    status: 'draft',
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
describe('v1TemplatesTransition (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesTransition).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildUnauthReq({ templateId: 'tpl_draft', toStatus: 'in_review' })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('happy path: admin draft → in_review', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_draft', toStatus: 'in_review' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; status: string };

    expect(result.templateId).toBe('tpl_draft');
    expect(result.status).toBe('in_review');

    const docSnap = await templatesTestDb
      .collection('organizations')
      .doc(ORG_ID)
      .collection('templates')
      .doc('tpl_draft')
      .get();
    expect(docSnap.data()?.['status']).toBe('in_review');
  });

  it('happy path: admin in_review → approved + approved_by/at set', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_in_review', toStatus: 'approved' },
        { uid: 'admin-approver', organizationId: ORG_ID },
      ),
    )) as { status: string };

    expect(result.status).toBe('approved');

    const docSnap = await templatesTestDb
      .collection('organizations')
      .doc(ORG_ID)
      .collection('templates')
      .doc('tpl_in_review')
      .get();
    expect(docSnap.data()?.['status']).toBe('approved');
    expect(docSnap.data()?.['approved_by']).toBe('admin-approver');
    expect(docSnap.data()?.['approved_at']).not.toBeNull();
  });

  it('rechaza transición inválida: draft → approved (no está en state machine)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_fresh_draft', toStatus: 'approved' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza transición a draft via endpoint (schema refine)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_changes', toStatus: 'draft' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza template archivado (VALIDATION → invalid-argument)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_fresh_archived', toStatus: 'in_review' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza template inexistente (not-found)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'nonexistent', toStatus: 'in_review' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('expert puede transicionar in_review → changes_requested (con comment)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    // Crear template nuevo en in_review para no contaminar
    await seedTemplate('tpl_for_expert', { name: 'Tpl ForExpert', status: 'in_review' });

    const result = (await handler(
      buildExpertReq(
        {
          templateId: 'tpl_for_expert',
          toStatus: 'changes_requested',
          comment: 'Falta contexto en receta 1',
        },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as { status: string };

    expect(result.status).toBe('changes_requested');
  });

  it('recruiter NO puede transicionar (state machine: allowedRoles no incluye recruiter)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await seedTemplate('tpl_for_recruiter', { name: 'Tpl ForRec', status: 'draft' });
    await expect(
      handler(
        buildRecruiterReq(
          { templateId: 'tpl_for_recruiter', toStatus: 'in_review' },
          { uid: 'recruiter-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

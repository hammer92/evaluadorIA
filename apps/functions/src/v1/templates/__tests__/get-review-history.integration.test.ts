/**
 * v1TemplatesGetReviewHistory — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Historial de review events".
 * Sprint sdd-10-backend-gaps PR #B Slice 8 (último).
 *
 * Auth: admin/expert (cualquiera); recruiter (solo si template 'approved').
 * Output: ReviewEvent[] ordenado por createdAt desc.
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
import { v1TemplatesGetReviewHistory } from '../get-review-history.js';

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
const ORG_ID = 'org_test_review_history';

interface ReviewEventFields {
  actor_id: string;
  actor_name: string;
  actor_role: 'admin' | 'expert' | 'recruiter';
  action: string;
  comment?: string | null;
  changes?: { field: string; before: unknown; after: unknown }[] | null;
  created_at: Date;
}

async function seedTemplate(
  templateId: string,
  status: 'draft' | 'in_review' | 'approved' | 'rejected',
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: `Test Template ${templateId}`,
      description: null,
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [],
      status,
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: null,
      approved_at: null,
      deleted_at: null,
    });
}

async function seedReviewEvent(templateId: string, fields: ReviewEventFields): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .collection('reviews')
    .add(fields);
}

// =============================================================================
// Lifecycle
// =============================================================================
beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
  await seedTemplate('tpl_with_history', 'approved');
  await seedTemplate('tpl_no_history', 'draft');
  await seedTemplate('tpl_draft_no_events', 'draft');

  // Seed 3 review events for tpl_with_history
  await seedReviewEvent('tpl_with_history', {
    actor_id: 'admin-uid',
    actor_name: 'Admin User',
    actor_role: 'admin',
    action: 'submitted',
    comment: null,
    changes: null,
    created_at: new Date('2026-07-01T10:00:00Z'),
  });
  await seedReviewEvent('tpl_with_history', {
    actor_id: 'expert-uid',
    actor_name: 'Expert User',
    actor_role: 'expert',
    action: 'changes_requested',
    comment: 'Falta contexto',
    changes: [{ field: 'qtyMultipleChoice', before: 5, after: 3 }],
    created_at: new Date('2026-07-02T14:30:00Z'),
  });
  await seedReviewEvent('tpl_with_history', {
    actor_id: 'admin-uid',
    actor_name: 'Admin User',
    actor_role: 'admin',
    action: 'approved',
    comment: null,
    changes: null,
    created_at: new Date('2026-07-03T09:15:00Z'),
  });
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesGetReviewHistory (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesGetReviewHistory).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(handler(buildUnauthReq({ templateId: 'tpl_with_history' }))).rejects.toMatchObject(
      { code: 'unauthenticated' },
    );
  });

  it('happy path: admin lee historial con 3 eventos', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_with_history' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { action: string; createdAt: string }[];

    expect(result).toHaveLength(3);
    // Orden desc por createdAt: 2026-07-03 (approved), 2026-07-02 (changes_requested), 2026-07-01 (submitted)
    expect(result[0]?.action).toBe('approved');
    expect(result[1]?.action).toBe('changes_requested');
    expect(result[2]?.action).toBe('submitted');
  });

  it('happy path: recruiter lee historial de template approved (canViewTemplate OK)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildRecruiterReq(
        { templateId: 'tpl_with_history' },
        { uid: 'recruiter-uid', organizationId: ORG_ID },
      ),
    )) as unknown[];

    expect(result).toHaveLength(3);
  });

  it('recruiter NO ve historial de template draft (canViewTemplate falla → [])', async () => {
    await seedTemplate('tpl_for_recruiter_draft', 'draft');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildRecruiterReq(
        { templateId: 'tpl_for_recruiter_draft' },
        { uid: 'recruiter-uid', organizationId: ORG_ID },
      ),
    )) as unknown[];

    expect(result).toEqual([]);
  });

  it('expert ve historial de template aprobado', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        { templateId: 'tpl_with_history' },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as unknown[];

    expect(result).toHaveLength(3);
  });

  it('retorna [] si template no existe', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ templateId: 'nonexistent' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as unknown[];

    expect(result).toEqual([]);
  });

  it('retorna [] si template existe pero sin review events', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ templateId: 'tpl_no_history' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as unknown[];

    expect(result).toEqual([]);
  });

  it('preserva comment y changes en el output', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_with_history' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { action: string; comment?: string; changes?: unknown[] }[];

    const changesEvent = result.find((e) => e.action === 'changes_requested');
    expect(changesEvent?.comment).toBe('Falta contexto');
    expect(changesEvent?.changes).toHaveLength(1);
  });

  it('rechaza templateId vacío (invalid-argument)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildAdminReq({ templateId: '' }, { uid: 'admin-uid', organizationId: ORG_ID })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

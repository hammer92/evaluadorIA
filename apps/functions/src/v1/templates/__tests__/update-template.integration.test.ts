/**
 * v1TemplatesUpdate — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Editar template (admin)".
 * Sprint sdd-10-backend-gaps PR #B Slice 4.
 *
 * Auth: admin. Pre-condición: status='draft' | 'changes_requested'.
 * OQ-4: NO se puede editar un template approved.
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
import { v1TemplatesUpdate } from '../update-template.js';

import {
  assertEmulatorsUp,
  buildAdminReq,
  buildExpertReq,
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
const ORG_ID = 'org_test_update';

interface SeedTemplateFields {
  name: string;
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
  description?: string | null;
  niche?: 'school' | 'university' | 'exam_practice';
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
      description: fields.description ?? null,
      niche: fields.niche ?? 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [
        {
          recipe_id: 'r0',
          competency_name: 'Default',
          competency_context: 'Default context for tests with enough characters.',
          qty_multiple_choice: 2,
          qty_multi_choice: 1,
          difficulty: 'medium',
          topics_covered: ['default'],
        },
      ],
      status: fields.status,
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: null,
      approved_at: null,
      deleted_at: null,
    });
}

// =============================================================================
// Lifecycle
// =============================================================================
beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
  await seedTemplate('tpl_draft', { name: 'Template Draft Original', status: 'draft' });
  await seedTemplate('tpl_changes', {
    name: 'Template Changes Original',
    status: 'changes_requested',
  });
  await seedTemplate('tpl_approved', { name: 'Template Approved', status: 'approved' });
  await seedTemplate('tpl_in_review', { name: 'Template In Review', status: 'in_review' });
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesUpdate (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesUpdate).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildUnauthReq({ templateId: 'tpl_draft', name: 'X' })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rechaza cuando el role es expert (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildExpertReq(
          { templateId: 'tpl_draft', name: 'X' },
          { uid: 'expert-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('happy path: admin edita template en draft → cambia nombre', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_draft', name: 'Template Draft Editado' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; name: string };

    expect(result.templateId).toBe('tpl_draft');
    expect(result.name).toBe('Template Draft Editado');
  });

  it('happy path: admin edita template en changes_requested → OK', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_changes', description: 'Nueva descripción' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; description: string };

    expect(result.description).toBe('Nueva descripción');
  });

  it('rechaza editar template approved (OQ-4: inmutable)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_approved', name: 'Intento de cambio' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza editar template in_review (canEdit no permite)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_in_review', name: 'Cambio no permitido' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza nombre duplicado (already-exists)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'tpl_draft', name: 'Template Approved' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('rechaza templateId inexistente (not-found)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'nonexistent', name: 'Cambio en null' },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('admin edita nicho (cambia school → university)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_draft', niche: 'university' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { niche: string };

    expect(result.niche).toBe('university');
  });
});

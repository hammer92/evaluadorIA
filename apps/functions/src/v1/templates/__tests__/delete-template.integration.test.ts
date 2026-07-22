/**
 * v1TemplatesDelete — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Soft delete (admin)".
 * Sprint sdd-10-backend-gaps PR #B Slice 5.
 *
 * Auth: admin. Set deleted_at = now(). Hard delete bloqueado.
 * Idempotent: si ya está soft-deleted, retorna sin error.
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
import { v1TemplatesDelete } from '../delete-template.js';

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
const ORG_ID = 'org_test_delete';

async function seedTemplate(templateId: string, status: string): Promise<void> {
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

// =============================================================================
// Lifecycle
// =============================================================================
beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
  await seedTemplate('tpl_to_delete', 'draft');
  await seedTemplate('tpl_already_deleted', 'draft');
  // Pre-soft-delete tpl_already_deleted
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc('tpl_already_deleted')
    .update({ deleted_at: new Date('2026-01-01T00:00:00Z') });
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesDelete (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesDelete).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(handler(buildUnauthReq({ templateId: 'tpl_to_delete' }))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rechaza cuando el role es expert (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildExpertReq(
          { templateId: 'tpl_to_delete' },
          { uid: 'expert-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('happy path: admin soft-delete → deleted_at set', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq({ templateId: 'tpl_to_delete' }, { uid: 'admin-uid', organizationId: ORG_ID }),
    )) as { templateId: string; deletedAt: string };

    expect(result.templateId).toBe('tpl_to_delete');
    expect(typeof result.deletedAt).toBe('string');
    expect(new Date(result.deletedAt).getTime()).toBeGreaterThan(0);

    // Verify in firestore
    const docSnap = await templatesTestDb
      .collection('organizations')
      .doc(ORG_ID)
      .collection('templates')
      .doc('tpl_to_delete')
      .get();
    expect(docSnap.exists).toBe(true);
    expect(docSnap.data()?.['deleted_at']).not.toBeNull();
  });

  it('idempotent: soft-delete ya archivado → returns sin error', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_already_deleted' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; deletedAt: string };

    expect(result.templateId).toBe('tpl_already_deleted');
    // Mantiene el deleted_at original (2026-01-01)
    expect(new Date(result.deletedAt).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rechaza templateId inexistente (not-found)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq({ templateId: 'nonexistent' }, { uid: 'admin-uid', organizationId: ORG_ID }),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

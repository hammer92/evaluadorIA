/**
 * v1TemplatePreviewGet — Integration test contra emulador.
 *
 * SDD-11 §4.1: "Leer preview cacheado".
 * Auth: admin o expert. Lee cache + detecta stale.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

const mockGeneratorOutput = vi.hoisted(() => ({
  questions: [],
  totalRequested: 0,
  totalGenerated: 0,
  totalFlagged: 0,
  totalRefused: 0,
  refusal: null,
}));

vi.mock('../../../shared/generator-client.js', () => ({
  generateQuestionsForPreview: vi.fn(async () => mockGeneratorOutput),
}));

import { v1TemplatePreviewGenerate } from '../generate-preview.js';
import { v1TemplatePreviewGet } from '../get-preview.js';

import {
  assertEmulatorsUp,
  buildAdminReq,
  buildExpertReq,
  buildRecruiterReq,
  buildUnauthReq,
  cleanupTemplatesIntegration,
  deleteTestOrg,
  getLatestOnCallHandler,
  getOnCallHandler,
  seedTestOrg,
  templatesTestDb,
} from './helpers/integration-setup.js';

const ORG_ID = 'org_test_preview_get';

async function seedTemplate(templateId: string, updatedAt: Date): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: `T ${templateId}`,
      description: 'desc',
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [
        {
          recipe_id: 'r0',
          competency_name: 'C',
          competency_context: 'Contexto suficiente para el schema de 20 chars.',
          qty_multiple_choice: 1,
          qty_multi_choice: 0,
          difficulty: 'easy',
          topics_covered: [],
        },
      ],
      status: 'in_review',
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: updatedAt,
      updated_at: updatedAt,
      approved_by: null,
      approved_at: null,
      deleted_at: null,
      passing_score: 70,
      version: 0,
    });
}

beforeAll(async () => {
  await assertEmulatorsUp();
  await seedTestOrg(ORG_ID);
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

describe('v1TemplatePreviewGet (integration)', () => {
  it('rechaza sin auth', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildUnauthReq({ templateId: 'tpl_x' })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rechaza recruiter (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildRecruiterReq({ templateId: 'tpl_x' }, { uid: 'rec', organizationId: ORG_ID }),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('retorna preview=null si nunca se genero', async () => {
    await seedTemplate('tpl_never', new Date());
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        { templateId: 'tpl_never' },
        { uid: 'expert-uid-empty', organizationId: ORG_ID },
      ),
    )) as { preview: unknown; isStale: boolean };

    expect(result.preview).toBeNull();
    expect(result.isStale).toBe(false);
  });

  it('retorna isStale=false cuando recipe no cambio', async () => {
    const t = new Date('2026-01-01');
    await seedTemplate('tpl_fresh', t);
    // Primero generar
    const generateHandler = getOnCallHandler(templatesOnCallRegistry, 1); // 2nd-to-last = generate
    const _generateResult = await generateHandler(
      buildExpertReq(
        { templateId: 'tpl_fresh' },
        { uid: 'expert-uid-fresh', organizationId: ORG_ID },
      ),
    );
    void _generateResult;

    const getHandler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await getHandler(
      buildExpertReq(
        { templateId: 'tpl_fresh' },
        { uid: 'expert-uid-fresh', organizationId: ORG_ID },
      ),
    )) as { preview: unknown; isStale: boolean };

    expect(result.preview).not.toBeNull();
    expect(result.isStale).toBe(false);
  });
});

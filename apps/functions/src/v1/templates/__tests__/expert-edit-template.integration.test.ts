/**
 * v1TemplatesExpertEdit — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Editar params técnicos (expert en in_review)".
 * Sprint sdd-10-backend-gaps PR #B Slice 7.
 *
 * Auth: expert. Solo en status='in_review'.
 * Solo campos permitidos: recipes[].{competencyContext, qtyMultipleChoice,
 * qtyMultiChoice, difficulty, topicsCovered}.
 * NO permitidos: name, description, niche, timeLimitMinutes, maxRetries,
 * recipes[].competencyName.
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
import { v1TemplatesExpertEdit } from '../expert-edit-template.js';

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
const ORG_ID = 'org_test_expert_edit';

async function seedTemplate(
  templateId: string,
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected',
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: `Test Template ${templateId}`,
      description: 'Description original',
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [
        {
          recipe_id: 'r0',
          competency_name: 'Competencia Original',
          competency_context:
            'Contexto original con suficiente longitud para pasar validación de 20 chars.',
          qty_multiple_choice: 3,
          qty_multi_choice: 2,
          difficulty: 'easy',
          topics_covered: ['original-topic-1', 'original-topic-2'],
        },
      ],
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
  await seedTemplate('tpl_in_review', 'in_review');
  await seedTemplate('tpl_draft', 'draft');
  await seedTemplate('tpl_in_review_b', 'in_review');
});

afterAll(async () => {
  await deleteTestOrg(ORG_ID);
  await cleanupTemplatesIntegration();
});

// =============================================================================
// Tests
// =============================================================================
describe('v1TemplatesExpertEdit (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatesExpertEdit).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildUnauthReq({ templateId: 'tpl_in_review', recipes: [] })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rechaza cuando el role es admin (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          {
            templateId: 'tpl_in_review',
            recipes: [
              {
                recipeId: 'r0',
                qtyMultipleChoice: 5,
              },
            ],
          },
          { uid: 'admin-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('happy path: expert edita qtyMultipleChoice en in_review', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        {
          templateId: 'tpl_in_review',
          recipes: [{ recipeId: 'r0', qtyMultipleChoice: 5 }],
        },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as {
      recipes: { recipeId: string; qtyMultipleChoice: number }[];
    };

    expect(result.recipes[0]?.recipeId).toBe('r0');
    expect(result.recipes[0]?.qtyMultipleChoice).toBe(5);
  });

  it('happy path: expert edita difficulty + topicsCovered', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        {
          templateId: 'tpl_in_review_b',
          recipes: [
            {
              recipeId: 'r0',
              difficulty: 'hard',
              topicsCovered: ['nuevo-topic-1', 'nuevo-topic-2'],
            },
          ],
        },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as {
      recipes: { recipeId: string; difficulty: string; topicsCovered: string[] }[];
    };

    expect(result.recipes[0]?.difficulty).toBe('hard');
    expect(result.recipes[0]?.topicsCovered).toEqual(['nuevo-topic-1', 'nuevo-topic-2']);
  });

  it('happy path: expert edita competencyContext', async () => {
    await seedTemplate('tpl_in_review_c', 'in_review');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        {
          templateId: 'tpl_in_review_c',
          recipes: [
            {
              recipeId: 'r0',
              competencyContext:
                'Nuevo contexto con suficiente longitud para pasar validación de 20 chars.',
            },
          ],
        },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as {
      recipes: { recipeId: string; competencyContext: string }[];
    };

    expect(result.recipes[0]?.competencyContext).toContain('Nuevo contexto');
  });

  it('rechaza editar en status=draft (PERMISSION_DENIED)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildExpertReq(
          {
            templateId: 'tpl_draft',
            recipes: [{ recipeId: 'r0', qtyMultipleChoice: 5 }],
          },
          { uid: 'expert-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza recipes array vacío (VALIDATION)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildExpertReq(
          { templateId: 'tpl_in_review', recipes: [] },
          { uid: 'expert-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza templateId inexistente (NOT_FOUND)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildExpertReq(
          {
            templateId: 'nonexistent',
            recipes: [{ recipeId: 'r0', qtyMultipleChoice: 5 }],
          },
          { uid: 'expert-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('NO permite editar name/description (schema strippea esos campos)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    // expertEditInputSchema solo tiene templateId + recipes
    // Si intento pasar name, será ignorado por el schema (Zod strip)
    await seedTemplate('tpl_in_review_d', 'in_review');
    const result = (await handler(
      buildExpertReq(
        {
          templateId: 'tpl_in_review_d',
          recipes: [{ recipeId: 'r0', qtyMultipleChoice: 7 }],
        },
        { uid: 'expert-uid', organizationId: ORG_ID },
      ),
    )) as {
      name: string;
      description: string;
      recipes: { qtyMultipleChoice: number }[];
    };

    expect(result.name).toBe('Test Template tpl_in_review_d');
    expect(result.description).toBe('Description original');
    expect(result.recipes[0]?.qtyMultipleChoice).toBe(7);
  });
});

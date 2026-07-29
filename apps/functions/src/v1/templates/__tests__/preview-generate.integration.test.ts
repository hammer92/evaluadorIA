/**
 * v1TemplatePreviewGenerate — Integration test contra emulador.
 *
 * SDD-11 §4.1: "Generar (o regenerar) preview".
 * Auth: admin o expert. Rate limit 5/h/user/template.
 *
 * Mock: vi.mock del generator-client para no gastar LLM tokens ni depender
 * del Generator Agent real (SDD-G01 no implementado aún).
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

// Mock generator-client para retornar output deterministico.
const mockGeneratorOutput = vi.hoisted(() => ({
  questions: [
    {
      questionId: 'q1',
      type: 'single_answer',
      stem: 'Pregunta generada para el recipe de testing con suficiente longitud.',
      context: 'Contexto del template para testing.',
      options: [
        { id: 'a', text: 'Opción A para testing' },
        { id: 'b', text: 'Opción B para testing' },
        { id: 'c', text: 'Opción C para testing' },
        { id: 'd', text: 'Opción D para testing' },
      ],
      correctOptionIds: ['a'],
      feedbackPerOption: [
        { optionId: 'a', isCorrect: true, feedback: 'Correcta porque cumple la condición esperada en el contexto de testing planteado por la receta.', rationale: null },
        { optionId: 'b', isCorrect: false, feedback: 'Incorrecta: no cumple la condición principal esperada en el contexto de testing planteado por la receta.', rationale: null },
        { optionId: 'c', isCorrect: false, feedback: 'Incorrecta: introduce una variante no esperada en el contexto de testing planteado por la receta actual.', rationale: null },
        { optionId: 'd', isCorrect: false, feedback: 'Incorrecta: el escenario que describe no aplica al contexto de testing planteado por la receta analizada.', rationale: null },
      ],
      competencyId: 'r0',
      niche: 'school',
      difficulty: 'easy',
      topicsCovered: ['topic-1'],
      selfAssessment: {
        estimatedDifficulty: 'easy',
        confidence: 0.9,
        flagForReview: false,
        flagReason: null,
      },
      metadata: {
        modelVersion: 'gpt-4o-2024-08-06',
        promptVersion: 'generator/v1.0',
        generatedAt: new Date().toISOString(),
        previewMode: true,
      },
    },
  ],
  totalRequested: 1,
  totalGenerated: 1,
  totalFlagged: 0,
  totalRefused: 0,
  refusal: null,
}));

vi.mock('../../../shared/generator-client.js', () => ({
  generateQuestionsForPreview: vi.fn(async () => mockGeneratorOutput),
}));

// =============================================================================
// Static imports
// =============================================================================
import { v1TemplatePreviewGenerate } from '../preview/generate-preview.js';

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
const ORG_ID = 'org_test_preview_generate';

async function seedTemplate(
  templateId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(ORG_ID)
    .collection('templates')
    .doc(templateId)
    .set({
      organization_id: ORG_ID,
      name: `Test Template ${templateId}`,
      description: 'Description',
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [
        {
          recipe_id: 'r0',
          competency_name: 'Competencia Test',
          competency_context:
            'Contexto suficiente para pasar validación de 20 chars en el schema.',
          qty_multiple_choice: 1,
          qty_multi_choice: 0,
          difficulty: 'easy',
          topics_covered: ['topic-1'],
        },
      ],
      status: 'in_review',
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: null,
      approved_at: null,
      deleted_at: null,
      passing_score: 70,
      version: 0,
      ...overrides,
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
describe('v1TemplatePreviewGenerate (integration, contra emulador)', () => {
  it('captura el handler de onCall al import', () => {
    expect(typeof v1TemplatePreviewGenerate).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    await seedTemplate('tpl_unauth');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildUnauthReq({ templateId: 'tpl_unauth' })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rechaza cuando el role es recruiter (permission-denied)', async () => {
    await seedTemplate('tpl_recruiter');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildRecruiterReq(
          { templateId: 'tpl_recruiter' },
          { uid: 'recruiter-uid', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('happy path: admin genera preview y persiste en Firestore', async () => {
    await seedTemplate('tpl_admin_happy');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildAdminReq(
        { templateId: 'tpl_admin_happy' },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { previewId: string; questions: unknown[] };

    expect(result.previewId).toBe('pv_latest');
    expect(result.questions.length).toBe(1);

    // Verificar persistencia
    const snap = await templatesTestDb
      .collection('organizations')
      .doc(ORG_ID)
      .collection('templates')
      .doc('tpl_admin_happy')
      .collection('previewQuestions')
      .doc('pv_latest')
      .get();
    expect(snap.exists).toBe(true);
  });

  it('happy path: expert genera preview', async () => {
    await seedTemplate('tpl_expert_happy');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const result = (await handler(
      buildExpertReq(
        { templateId: 'tpl_expert_happy' },
        { uid: 'expert-uid-2', organizationId: ORG_ID },
      ),
    )) as { previewId: string };

    expect(result.previewId).toBe('pv_latest');
  });

  it('retorna cache cuando ya existe y no está stale (mismo updatedAt)', async () => {
    await seedTemplate('tpl_cache');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const first = (await handler(
      buildAdminReq(
        { templateId: 'tpl_cache' },
        { uid: 'admin-uid-cache', organizationId: ORG_ID },
      ),
    )) as { generatedAt: string };

    const second = (await handler(
      buildAdminReq(
        { templateId: 'tpl_cache' },
        { uid: 'admin-uid-cache', organizationId: ORG_ID },
      ),
    )) as { generatedAt: string };

    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it('regenera con forceRegenerate=true', async () => {
    await seedTemplate('tpl_force');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const first = (await handler(
      buildAdminReq(
        { templateId: 'tpl_force' },
        { uid: 'admin-uid-force', organizationId: ORG_ID },
      ),
    )) as { generatedAt: string };

    // esperar 5ms para que el timestamp difiera
    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = (await handler(
      buildAdminReq(
        { templateId: 'tpl_force', forceRegenerate: true },
        { uid: 'admin-uid-force', organizationId: ORG_ID },
      ),
    )) as { generatedAt: string };

    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it('rechaza si template no existe (not-found)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildAdminReq(
          { templateId: 'no_existe' },
          { uid: 'admin-uid-404', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rate limit: 5 generaciones OK, 6ta falla con failed-precondition', async () => {
    await seedTemplate('tpl_ratelimit');
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const opts = { uid: 'expert-uid-ratelimit', organizationId: ORG_ID };

    for (let i = 0; i < 5; i++) {
      await handler(buildExpertReq({ templateId: 'tpl_ratelimit', forceRegenerate: true }, opts));
    }

    await expect(
      handler(buildExpertReq({ templateId: 'tpl_ratelimit', forceRegenerate: true }, opts)),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

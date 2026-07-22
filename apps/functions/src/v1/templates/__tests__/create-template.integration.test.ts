/**
 * v1TemplatesCreate — Integration test contra emulador.
 *
 * SDD-10 §7.2: "Crear template".
 * Sprint sdd-10-backend-gaps PR #B Slice 1.
 *
 * NO mockeamos firebase-admin. Solo capturamos el handler de `onCall`
 * y lo invocamos directamente.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// =============================================================================
// vi.hoisted: registry de handlers onCall (debe ser hoisted ANTES del mock)
// =============================================================================
const templatesOnCallRegistry = vi.hoisted((): ((req: unknown) => Promise<unknown>)[] => []);

// =============================================================================
// vi.mock: captura handlers de onCall para invocarlos directamente
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
// Static imports (vi.mock ya está hoisted por vitest)
// =============================================================================
import { v1TemplatesCreate } from '../create-template.js';

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
const ORG_ID = 'org_test_create';

const validRecipeInput = {
  competencyName: 'Álgebra básica',
  competencyContext: 'El estudiante debe resolver ecuaciones lineales con una incógnita.',
  qtyMultipleChoice: 3,
  qtyMultiChoice: 2,
  difficulty: 'medium' as const,
  topicsCovered: ['ecuaciones', 'incógnita'],
};

const validCreateInput = {
  name: 'Examen de álgebra — grado 9',
  description: 'Plantilla inicial para examen de álgebra',
  niche: 'school' as const,
  timeLimitMinutes: 60,
  maxRetries: 2,
  recipes: [validRecipeInput],
};

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
describe('v1TemplatesCreate (integration, contra emulador)', () => {
  it('captura el handler de onCall al import (v1TemplatesCreate es callable)', () => {
    expect(typeof v1TemplatesCreate).toBe('function');
    expect(templatesOnCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(handler(buildUnauthReq(validCreateInput))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rechaza cuando el role es recruiter (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(
        buildRecruiterReq(validCreateInput, { uid: 'recruiter-uid', organizationId: ORG_ID }),
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rechaza cuando el role es expert (permission-denied)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    await expect(
      handler(buildExpertReq(validCreateInput, { uid: 'expert-uid', organizationId: ORG_ID })),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rechaza input inválido (recipe con qty=0 en ambos)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const invalidInput = {
      ...validCreateInput,
      recipes: [
        {
          ...validRecipeInput,
          qtyMultipleChoice: 0,
          qtyMultiChoice: 0,
        },
      ],
    };
    await expect(
      handler(buildAdminReq(invalidInput, { uid: 'admin-uid', organizationId: ORG_ID })),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('happy path: admin crea template → status=draft + doc en firestore', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const uniqueName = `Examen happy-path-${Date.now()}`;
    const result = (await handler(
      buildAdminReq(
        { ...validCreateInput, name: uniqueName },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    )) as { templateId: string; status: string; name: string };

    expect(result.templateId).toMatch(/^[a-f0-9]{32}$/);
    expect(result.status).toBe('draft');
    expect(result.name).toBe(uniqueName);

    const docSnap = await templatesTestDb
      .collection('organizations')
      .doc(ORG_ID)
      .collection('templates')
      .doc(result.templateId)
      .get();
    expect(docSnap.exists).toBe(true);
    expect(docSnap.data()?.['name']).toBe(uniqueName);
    expect(docSnap.data()?.['status']).toBe('draft');
    expect(docSnap.data()?.['organization_id']).toBe(ORG_ID);
    expect(docSnap.data()?.['created_by']).toBe('admin-uid');
  });

  it('rechaza nombre duplicado en la misma organización (already-exists)', async () => {
    const handler = getLatestOnCallHandler(templatesOnCallRegistry);
    const dupName = `Duplicado-${Date.now()}`;

    await handler(
      buildAdminReq(
        { ...validCreateInput, name: dupName },
        { uid: 'admin-uid', organizationId: ORG_ID },
      ),
    );

    await expect(
      handler(
        buildAdminReq(
          { ...validCreateInput, name: dupName },
          { uid: 'admin-uid-2', organizationId: ORG_ID },
        ),
      ),
    ).rejects.toMatchObject({
      code: 'already-exists',
    });
  });
});

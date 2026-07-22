/**
 * v1TemplatesCreate — Integration test contra emuladores reales.
 *
 * SDD-10 §14.2: tests de integración del state machine + permisos.
 * Ejecutado por `pnpm --filter functions test:emulator`.
 *
 * NO mockeamos firebase-admin (Auth/Firestore van contra el emulador real).
 * Sólo capturamos el handler de `onCall` para invocarlo directamente.
 */

import { initializeApp as initAdminApp, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { v1TemplatesCreate } from '../create-template.js';

// =============================================================================
// vi.hoisted: setea env vars ANTES de que vitest hoiste los vi.mock y los
// static imports. El SDK firebase-admin lee FIRESTORE_EMULATOR_HOST al
// import time.
// =============================================================================
vi.hoisted(() => {
  process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  process.env['GCLOUD_PROJECT'] = 'admin-platform-dev';
  process.env['SESSION_COOKIE_SECRET'] = 'integration-test-secret-must-be-at-least-32-chars-long';
  process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
});

const onCallRegistry = vi.hoisted((): ((req: unknown) => Promise<unknown>)[] => []);

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
      onCallRegistry.push(handler);
      return ((req: unknown) => handler(req)) as unknown as ReturnType<typeof actual.onCall>;
    }) as typeof actual.onCall,
  };
});

const TEMPLATES_COL = 'templates';

describe('v1TemplatesCreate (integration)', () => {
  const ORG_ID = 'org_default';
  const ADMIN_EMAIL = 'admin-create@test.local';
  const ADMIN_UID = 'admin-create-uid';

  beforeAll(async () => {
    if (getApps().length === 0) {
      initAdminApp({ projectId: 'admin-platform-dev' });
    }
    const auth = getAdminAuth();
    const db = getAdminDb();

    // Setup admin user
    try {
      await auth.createUser({ uid: ADMIN_UID, email: ADMIN_EMAIL, password: 'pw' });
    } catch {
      // already exists
    }
    await auth.setCustomUserClaims(ADMIN_UID, { role: 'admin', organizationId: ORG_ID });
    // touch emulator
    await db.collection('_test_seed').doc('x').set({ ok: true });
  });

  afterAll(async () => {
    // Cleanup: delete all templates we created in this test run.
    const db = getAdminDb();
    const snap = await db.collection('organizations').doc(ORG_ID).collection(TEMPLATES_COL).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

  const baseInput = {
    name: 'Test Template Create',
    description: 'For integration tests',
    niche: 'school' as const,
    timeLimitMinutes: 60,
    maxRetries: 2,
    recipes: [
      {
        competencyName: 'Algebra',
        competencyContext: 'Resolver ecuaciones lineales de una variable',
        qtyMultipleChoice: 3,
        qtyMultiChoice: 1,
        difficulty: 'medium' as const,
        topicsCovered: ['suma', 'resta', 'multiplicación'],
      },
    ],
  };

  function callAs(
    role: 'admin' | 'expert' | 'recruiter',
    uid: string,
    data: unknown,
  ): Promise<unknown> {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    if (!handler) throw new Error('No handler registered');
    return handler({
      data,
      auth: {
        uid,
        token: { role, organizationId: ORG_ID },
      },
    });
  }

  it('admin puede crear un template en estado draft', async () => {
    const result = (await callAs('admin', ADMIN_UID, baseInput)) as {
      templateId: string;
      status: string;
      name: string;
    };
    expect(result.templateId).toBeTruthy();
    expect(result.status).toBe('draft');
    expect(result.name).toBe(baseInput.name);
  });

  it('OQ-1: rechaza segundo template con mismo nombre (already-exists)', async () => {
    await expect(callAs('admin', ADMIN_UID, baseInput)).rejects.toThrow(/Ya existe un template/);
  });

  it('rechaza cuando el rol no es admin', async () => {
    const expertUid = 'expert-uid-create';
    const auth = getAdminAuth();
    try {
      await auth.createUser({ uid: expertUid, email: 'expert@test.local', password: 'pw' });
    } catch {
      // already exists
    }
    await auth.setCustomUserClaims(expertUid, { role: 'expert', organizationId: ORG_ID });
    await expect(
      callAs('expert', expertUid, { ...baseInput, name: 'Otro Nombre' }),
    ).rejects.toThrow(/permission/i);
  });

  it('rechaza input inválido (Zod fail)', async () => {
    const invalid = { ...baseInput, name: 'a' }; // min 3 chars
    await expect(callAs('admin', ADMIN_UID, invalid)).rejects.toThrow(/validation/i);
  });
});

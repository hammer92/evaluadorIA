/**
 * v1TemplatesTransition — Integration test contra emuladores reales.
 *
 * SDD-10 §14.2: state machine end-to-end + permisos + OQ-6 soft check.
 */

import { initializeApp as initAdminApp, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { v1TemplatesCreate } from '../create-template.js';
import { v1TemplatesTransition } from '../transition-template.js';

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

describe('v1TemplatesTransition (integration)', () => {
  const ORG_ID = 'org_default';
  const ADMIN_UID = 'admin-trans-uid';
  const EXPERT_UID = 'expert-trans-uid';
  const RECRUITER_UID = 'recruiter-trans-uid';

  let adminTemplateId: string;

  beforeAll(async () => {
    if (getApps().length === 0) {
      initAdminApp({ projectId: 'admin-platform-dev' });
    }
    const auth = getAdminAuth();
    const db = getAdminDb();

    for (const [uid, email, role] of [
      [ADMIN_UID, 'admin-trans@test.local', 'admin'],
      [EXPERT_UID, 'expert-trans@test.local', 'expert'],
      [RECRUITER_UID, 'recruiter-trans@test.local', 'recruiter'],
    ] as const) {
      try {
        await auth.createUser({ uid, email, password: 'pw' });
      } catch {
        // already exists
      }
      await auth.setCustomUserClaims(uid, { role, organizationId: ORG_ID });
    }
    await db.collection('_test_seed').doc('x').set({ ok: true });

    // Crear template base para transiciones.
    const createHandler = onCallRegistry[onCallRegistry.length - 2];
    const result = (await createHandler({
      data: {
        name: 'Transition Test Template',
        niche: 'school',
        timeLimitMinutes: 60,
        maxRetries: 2,
        recipes: [
          {
            competencyName: 'Test',
            competencyContext: 'Lorem ipsum dolor sit amet consectetur',
            qtyMultipleChoice: 2,
            qtyMultiChoice: 0,
            difficulty: 'easy',
            topicsCovered: ['a'],
          },
        ],
      },
      auth: {
        uid: ADMIN_UID,
        token: { role: 'admin', organizationId: ORG_ID },
      },
    })) as { templateId: string };
    adminTemplateId = result.templateId;
  });

  afterAll(async () => {
    const db = getAdminDb();
    const snap = await db.collection('organizations').doc(ORG_ID).collection('templates').get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

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

  it('admin: draft → in_review', async () => {
    const result = (await callAs('admin', ADMIN_UID, {
      templateId: adminTemplateId,
      toStatus: 'in_review',
    })) as { status: string };
    expect(result.status).toBe('in_review');
  });

  it('expert: in_review → approved', async () => {
    const result = (await callAs('expert', EXPERT_UID, {
      templateId: adminTemplateId,
      toStatus: 'approved',
    })) as { status: string };
    expect(result.status).toBe('approved');
  });

  it('recruiter no puede transicionar', async () => {
    await expect(
      callAs('recruiter', RECRUITER_UID, {
        templateId: adminTemplateId,
        toStatus: 'in_review',
      }),
    ).rejects.toThrow();
  });

  it('rechaza transición inválida (approved → in_review)', async () => {
    await expect(
      callAs('admin', ADMIN_UID, {
        templateId: adminTemplateId,
        toStatus: 'in_review',
      }),
    ).rejects.toThrow(/Transición inválida/i);
  });

  it('changes_requested requiere comment', async () => {
    // Setup: template fresco en in_review.
    const createHandler = onCallRegistry[onCallRegistry.length - 2];
    const created = (await createHandler({
      data: {
        name: 'Comment Required Test',
        niche: 'school',
        timeLimitMinutes: 30,
        maxRetries: 1,
        recipes: [
          {
            competencyName: 'X',
            competencyContext: 'Lorem ipsum dolor sit amet consectetur adipiscing',
            qtyMultipleChoice: 1,
            qtyMultiChoice: 0,
            difficulty: 'easy',
          },
        ],
      },
      auth: { uid: ADMIN_UID, token: { role: 'admin', organizationId: ORG_ID } },
    })) as { templateId: string };
    await callAs('admin', ADMIN_UID, { templateId: created.templateId, toStatus: 'in_review' });

    // Intentar changes_requested sin comment.
    await expect(
      callAs('expert', EXPERT_UID, {
        templateId: created.templateId,
        toStatus: 'changes_requested',
      }),
    ).rejects.toThrow(/comentario/i);
  });
});

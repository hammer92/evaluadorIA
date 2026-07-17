/**
 * v1UsersCreate — Integration test contra emuladores reales.
 *
 * SDD-06 §4.15: "Test de integración de v1_users_create".
 * Gap remediation 2026-07-17: este test es ejecutado por `pnpm --filter
 * functions test:emulator` (firebase emulators:exec --only firestore,auth).
 *
 * NO mockeamos firebase-admin (Auth/Firestore van contra el emulador real).
 * Sólo capturamos el handler de `onCall` para invocarlo directamente.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { v1UsersCreate } from '../create-user.js';

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

// =============================================================================
// onCall capture: handler registrado cuando `onCall` se ejecuta en el
// import-time de los módulos de las Cloud Functions.
// =============================================================================
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

// =============================================================================
// Imports estáticos (vi.mock ya está hoisted por vitest)
// =============================================================================

if (getApps().length === 0) {
  initializeApp({ projectId: 'admin-platform-dev' });
}

const auth = getAuth();
const db = getFirestore();

// =============================================================================
// Helpers
// =============================================================================
interface CallableReq {
  data: unknown;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}
interface CreateUserInput {
  email: string;
  displayName?: string;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId?: string;
  sendInviteEmail?: boolean;
}

function adminReq(data: CreateUserInput, uid = 'admin-uid'): CallableReq {
  return {
    data,
    auth: { uid, token: { role: 'admin', email: `${uid}@platform.com` } },
    rawRequest: { headers: {} },
  };
}

function expertReq(data: CreateUserInput): CallableReq {
  return {
    data,
    auth: { uid: 'expert-uid', token: { role: 'expert' } },
    rawRequest: { headers: {} },
  };
}

function unauthReq(data: CreateUserInput): CallableReq {
  return { data, auth: null, rawRequest: { headers: {} } };
}

beforeAll(async () => {
  try {
    await db.collection('_health').limit(1).get();
  } catch (e) {
    throw new Error(`Firestore emulator no responde en 127.0.0.1:8080: ${(e as Error).message}`);
  }
});

afterAll(async () => {
  try {
    const users = await auth.listUsers(20);
    await Promise.all(
      users.users.map((u) => {
        return auth.deleteUser(u.uid).catch(() => undefined);
      }),
    );
  } catch {
    // ignorar
  }
});

// =============================================================================
// Tests
// =============================================================================
describe('v1UsersCreate (integration, contra emulador)', () => {
  it('registra handler de onCall al import (v1UsersCreate es callable)', () => {
    expect(typeof v1UsersCreate).toBe('function');
    expect(onCallRegistry.length).toBeGreaterThan(0);
  });

  it('rechaza cuando no hay auth (unauthenticated)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    expect(handler).toBeDefined();
    await expect(handler!(unauthReq({ email: 'x@y.com', role: 'expert' }))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rechaza cuando el role es expert (permission-denied)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    expect(handler).toBeDefined();
    await expect(handler!(expertReq({ email: 'x@y.com', role: 'expert' }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rechaza input inválido (invalid-argument)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!(adminReq({ email: 'not-an-email', role: 'recruiter' })),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('happy path: admin crea user → Auth + Firestore + claims + audit', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const email = `integration-admin-${Date.now()}@platform.com`;
    const result = (await handler!(
      adminReq({ email, role: 'recruiter', displayName: 'Invitee' }, 'admin-uid'),
    )) as { uid: string; email: string; role: string; status: string };

    expect(result.email).toBe(email);
    expect(result.role).toBe('recruiter');
    expect(result.status).toBe('invited');

    const userRecord = await auth.getUser(result.uid);
    expect(userRecord.email).toBe(email);
    expect((userRecord.customClaims as { role?: string }).role).toBe('recruiter');

    const userDoc = await db.collection('users').doc(result.uid).get();
    expect(userDoc.exists).toBe(true);
    const data = userDoc.data();
    expect(data?.['email']).toBe(email);
    expect(data?.['role']).toBe('recruiter');
    expect(data?.['status']).toBe('invited');
    expect(data?.['created_by']).toBe('admin-uid');

    const audit = await db
      .collection('audit_logs')
      .where('targetId', '==', result.uid)
      .where('action', '==', 'user.created')
      .get();
    expect(audit.size).toBe(1);
    const auditData = audit.docs[0]?.data();
    expect(auditData?.['action']).toBe('user.created');
    expect(auditData?.['actorId']).toBe('admin-uid');
  });

  it('rechaza email duplicado (already-exists)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const email = `dup-${Date.now()}@platform.com`;
    await handler!(adminReq({ email, role: 'expert' }));

    await expect(handler!(adminReq({ email, role: 'expert' }))).rejects.toMatchObject({
      code: 'already-exists',
    });
  });
});

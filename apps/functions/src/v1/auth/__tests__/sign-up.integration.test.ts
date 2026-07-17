/**
 * v1AuthSignUp — Integration test contra emulador (first-user-admin flow).
 *
 * Verifica:
 *   - Primer user del sistema → role='admin' automáticamente (bootstrap)
 *   - Segundo user SIN invitación → permission-denied
 *   - Email duplicado → already-exists
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { v1AuthSignUp } from '../sign-up.js';

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

if (getApps().length === 0) {
  initializeApp({ projectId: 'admin-platform-dev' });
}

const auth = getAuth();
const db = getFirestore();

// =============================================================================
// Helpers
// =============================================================================
interface SignUpReq {
  data: { email: string; password: string; displayName: string };
  auth?: null;
  rawRequest?: { headers?: Record<string, unknown> };
}

beforeAll(async () => {
  try {
    await db.collection('_health').limit(1).get();
  } catch (e) {
    throw new Error(`Firestore emulator no responde: ${(e as Error).message}`);
  }

  // El test "primer user → admin bootstrap" requiere emulador limpio.
  // Limpiamos todos los users + docs antes de empezar.
  try {
    const users = await auth.listUsers(100);
    await Promise.all(
      users.users.map((u) => {
        return auth.deleteUser(u.uid).catch(() => undefined);
      }),
    );
    // Borrar todos los docs de users/ + audit_logs/
    const usersCol = await db.collection('users').listDocuments();
    await Promise.all(usersCol.map((d) => d.delete().catch(() => undefined)));
    const auditCol = await db.collection('audit_logs').listDocuments();
    await Promise.all(auditCol.map((d) => d.delete().catch(() => undefined)));
  } catch {
    // ignorar — emulador puede estar vacío
  }
});

afterAll(async () => {
  try {
    const users = await auth.listUsers(50);
    await Promise.all(
      users.users
        .filter((u) => u.email?.includes('signup-int-'))
        .map((u) => {
          return auth.deleteUser(u.uid).catch(() => undefined);
        }),
    );
  } catch {
    // ignorar
  }
});

describe('v1AuthSignUp (integration, contra emulador)', () => {
  it('primer user → role=admin (bootstrap) + user doc + audit', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    expect(handler).toBeDefined();

    const email = `signup-int-first-${Date.now()}@platform.com`;
    const result = (await handler!({
      data: { email, password: '12345678', displayName: 'First User' },
      auth: null,
      rawRequest: { headers: {} },
    })) as { uid: string; role: string; isFirstUser: boolean };

    expect(result.role).toBe('admin');
    expect(result.isFirstUser).toBe(true);

    const userRecord = await auth.getUser(result.uid);
    expect((userRecord.customClaims as { role?: string }).role).toBe('admin');

    const userDoc = await db.collection('users').doc(result.uid).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.['role']).toBe('admin');
  });

  it('segundo user (sin invitación) → permission-denied', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const email = `signup-int-second-${Date.now()}@platform.com`;
    await expect(
      handler!({
        data: { email, password: '12345678', displayName: 'Second User' },
        auth: null,
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('email duplicado → RepositoryError(ALREADY_EXISTS)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const email = `signup-int-dup-${Date.now()}@platform.com`;
    const existing = await auth.createUser({ email, password: '12345678' });

    try {
      await expect(
        handler!({
          data: { email, password: '12345678', displayName: 'Dup' },
          auth: null,
          rawRequest: { headers: {} },
        }),
      ).rejects.toMatchObject({
        code: 'ALREADY_EXISTS',
        name: 'RepositoryError',
      });
    } finally {
      await auth.deleteUser(existing.uid).catch(() => undefined);
    }
  });

  it('input inválido (password corta) → invalid-argument', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!({
        data: { email: 'short@platform.com', password: 'short', displayName: 'X' },
        auth: null,
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

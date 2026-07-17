/**
 * v1UsersList — Integration test contra emulador.
 *
 * Crea varios users via Admin SDK y verifica paginación, filtros y orden.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { v1UsersList } from '../list-users.js';

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
interface ListReq {
  data: unknown;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}

function adminReq(data: unknown, uid = 'admin-uid', orgId = 'org-list-test'): ListReq {
  return {
    data,
    auth: { uid, token: { role: 'admin', email: `${uid}@platform.com`, organizationId: orgId } },
    rawRequest: { headers: {} },
  };
}

beforeAll(async () => {
  try {
    await db.collection('_health').limit(1).get();
  } catch (e) {
    throw new Error(`Firestore emulator no responde: ${(e as Error).message}`);
  }

  // Sembrar 5 users con org-list-test + role=recruiter, status=active
  for (let i = 0; i < 5; i++) {
    const email = `list-${i}-${Date.now()}@platform.com`;
    const u = await auth.createUser({ email });
    await auth.setCustomUserClaims(u.uid, { role: 'recruiter', organizationId: 'org-list-test' });
    await db
      .collection('users')
      .doc(u.uid)
      .set({
        email,
        display_name: `User ${i}`,
        photo_url: null,
        role: 'recruiter',
        organization_id: 'org-list-test',
        status: 'active',
        last_login_at: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        created_by: 'admin-uid',
        deleted_at: null,
      });
  }
});

afterAll(async () => {
  try {
    const users = await auth.listUsers(50);
    await Promise.all(
      users.users
        .filter((u) => u.email?.includes('list-'))
        .map((u) => {
          return auth.deleteUser(u.uid).catch(() => undefined);
        }),
    );
  } catch {
    // ignorar
  }
});

describe('v1UsersList (integration, contra emulador)', () => {
  it('admin (con organizationId) recibe lista paginada filtrada por org', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    expect(handler).toBeDefined();
    const result = (await handler!(adminReq({ page: 1, pageSize: 3 }))) as {
      items: { role: string; organizationId: string | null }[];
      total: number;
      hasMore: boolean;
    };

    expect(result.items.length).toBe(3);
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.hasMore).toBe(true);
    for (const item of result.items) {
      expect(item.organizationId).toBe('org-list-test');
      expect(item.role).toBe('recruiter');
    }
  });

  it('filtra por search (case-insensitive en email)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const result = (await handler!(adminReq({ search: 'LIST-', pageSize: 10 }))) as {
      items: { email: string }[];
      total: number;
    };

    expect(result.items.length).toBeGreaterThanOrEqual(5);
    for (const item of result.items) {
      expect(item.email.toLowerCase()).toContain('list-');
    }
  });

  it('rechaza expert (permission-denied)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!({
        data: { page: 1 },
        auth: { uid: 'expert-uid', token: { role: 'expert' } },
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza sin auth (unauthenticated)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!({ data: { page: 1 }, auth: null, rawRequest: { headers: {} } }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

/**
 * v1ReportsGenerate — Integration test contra emulador.
 *
 * Verifica que el handler retorna { jobId, status: 'queued', estimatedSeconds }
 * con jobId en formato UUID y sin tocar firestore (es solo un stub).
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { v1ReportsGenerate } from '../generate-report.js';

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

const db = getFirestore();

beforeAll(async () => {
  try {
    await db.collection('_health').limit(1).get();
  } catch (e) {
    throw new Error(`Firestore emulator no responde: ${(e as Error).message}`);
  }
});

describe('v1ReportsGenerate (integration, contra emulador)', () => {
  it('admin recibe { jobId, status: queued, estimatedSeconds }', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    expect(handler).toBeDefined();

    const result = (await handler!({
      data: { type: 'users_csv' },
      auth: { uid: 'admin-uid', token: { role: 'admin', email: 'admin@platform.com' } },
      rawRequest: { headers: {} },
    })) as { jobId: string; status: string; estimatedSeconds: number };

    expect(result.jobId).toMatch(/^job_[0-9a-f-]{36}$/);
    expect(result.status).toBe('queued');
    expect(typeof result.estimatedSeconds).toBe('number');
    expect(result.estimatedSeconds).toBeGreaterThan(0);
  });

  it('jobId es único entre invocaciones', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    const r1 = (await handler!({
      data: { type: 'users_csv' },
      auth: { uid: 'admin-uid', token: { role: 'admin', email: 'admin@platform.com' } },
      rawRequest: { headers: {} },
    })) as { jobId: string };
    const r2 = (await handler!({
      data: { type: 'audit_log_pdf' },
      auth: { uid: 'admin-uid', token: { role: 'admin', email: 'admin@platform.com' } },
      rawRequest: { headers: {} },
    })) as { jobId: string };

    expect(r1.jobId).not.toBe(r2.jobId);
  });

  it('rechaza no-admin (permission-denied)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!({
        data: { type: 'users_csv' },
        auth: { uid: 'recruiter-uid', token: { role: 'recruiter' } },
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza input inválido (type desconocido)', async () => {
    const handler = onCallRegistry[onCallRegistry.length - 1];
    await expect(
      handler!({
        data: { type: 'invalid_type' },
        auth: { uid: 'admin-uid', token: { role: 'admin', email: 'admin@platform.com' } },
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

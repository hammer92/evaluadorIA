/**
 * Shared helpers para integration tests de las Cloud Functions de templates.
 *
 * Patrón: `apps/functions/src/v1/users/__tests__/create-user.integration.test.ts`
 * es la referencia original. Este módulo consolida el setup común para que
 * cada `*.integration.test.ts` de templates solo necesite importar las
 * helpers y escribir sus tests.
 *
 * SDD-10 Backend Gaps Remediation (sprint `sdd-10-backend-gaps`, 2026-07-22).
 *
 * NO mockeamos firebase-admin — Auth/Firestore van contra el emulador real.
 * Solo capturamos el handler de `onCall` para invocarlo directamente.
 *
 * Run:
 *   pnpm --filter @platform/functions test:integration
 *   pnpm --filter @platform/functions test:emulator
 */

import type { Role } from '@platform/shared';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { vi } from 'vitest';

// =============================================================================
// vi.hoisted: setea env vars ANTES de que vitest hoiste los vi.mock y los
// static imports. El SDK firebase-admin lee FIRESTORE_EMULATOR_HOST al
// import time, y nuestras CFs leen SESSION_COOKIE_SECRET en with-auth.
// =============================================================================
export const setupTemplatesIntegrationEnv = vi.hoisted((): void => {
  process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  process.env['GCLOUD_PROJECT'] = 'admin-platform-dev';
  process.env['SESSION_COOKIE_SECRET'] = 'integration-test-secret-must-be-at-least-32-chars-long';
  process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
});

// =============================================================================
// onCall capture: handler registrado cuando `onCall` se ejecuta en el
// import-time de los módulos de las Cloud Functions. Cada test puede obtener
// el handler más reciente via `getLatestOnCallHandler()` o por nombre via
// `getOnCallHandlerByExport()`.
// =============================================================================
export const templatesOnCallRegistry = vi.hoisted((): ((req: unknown) => Promise<unknown>)[] => []);

export const mockOnCallHttps = vi.hoisted((): void => {
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
});

// =============================================================================
// firebase-admin init (lazy, después de vi.hoisted)
// =============================================================================
if (getApps().length === 0) {
  initializeApp({ projectId: 'admin-platform-dev' });
}

export const templatesTestAuth = getAuth();
export const templatesTestDb: Firestore = getFirestore();

// =============================================================================
// Tipos para requests de onCall
// =============================================================================
export interface CallableReq<T = unknown> {
  data: T;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}

export interface AuthedCallableReq<T = unknown> extends CallableReq<T> {
  auth: { uid: string; token: { role: Role; email?: string; organizationId?: string } };
}

// =============================================================================
// Builders de CallableReq con distintos roles
// =============================================================================
export interface BuildReqOptions {
  uid?: string;
  email?: string;
  organizationId?: string;
}

export function buildAdminReq<T>(data: T, opts: BuildReqOptions = {}): AuthedCallableReq<T> {
  const uid = opts.uid ?? 'admin-uid';
  return {
    data,
    auth: {
      uid,
      token: {
        role: 'admin',
        email: opts.email ?? `${uid}@platform.com`,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    },
    rawRequest: { headers: {} },
  };
}

export function buildRecruiterReq<T>(data: T, opts: BuildReqOptions = {}): AuthedCallableReq<T> {
  const uid = opts.uid ?? 'recruiter-uid';
  return {
    data,
    auth: {
      uid,
      token: {
        role: 'recruiter',
        email: opts.email ?? `${uid}@platform.com`,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    },
    rawRequest: { headers: {} },
  };
}

export function buildExpertReq<T>(data: T, opts: BuildReqOptions = {}): AuthedCallableReq<T> {
  const uid = opts.uid ?? 'expert-uid';
  return {
    data,
    auth: {
      uid,
      token: {
        role: 'expert',
        email: opts.email ?? `${uid}@platform.com`,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    },
    rawRequest: { headers: {} },
  };
}

export function buildUnauthReq<T>(data: T): CallableReq<T> {
  return { data, auth: null, rawRequest: { headers: {} } };
}

// =============================================================================
// onCall handler retrieval
// =============================================================================

/**
 * Devuelve el último handler registrado (más reciente `onCall` import).
 * Útil cuando cada test file solo importa una CF (la única registrada).
 */
export function getLatestOnCallHandler(): (req: unknown) => Promise<unknown> {
  const handler = templatesOnCallRegistry[templatesOnCallRegistry.length - 1];
  if (!handler) {
    throw new Error(
      'No onCall handler captured. ¿Importaste el módulo de la Cloud Function ANTES de llamar a getLatestOnCallHandler()?',
    );
  }
  return handler;
}

/**
 * Devuelve el N-ésimo handler (0-indexed desde el más antiguo).
 * Útil cuando el test importa múltiples CFs.
 */
export function getOnCallHandler(indexFromEnd: number): (req: unknown) => Promise<unknown> {
  const idx = templatesOnCallRegistry.length - 1 - indexFromEnd;
  const handler = templatesOnCallRegistry[idx];
  if (!handler) {
    throw new Error(
      `No onCall handler at index ${idx} (registry length=${templatesOnCallRegistry.length})`,
    );
  }
  return handler;
}

// =============================================================================
// Cleanup helpers (beforeAll / afterAll)
// =============================================================================

/**
 * Verifica que el emulador de Firestore responde. Llamar en `beforeAll`
 * de cada integration test para fallar rápido si el emulador no está up.
 */
export async function assertEmulatorsUp(): Promise<void> {
  try {
    await templatesTestDb.collection('_health').limit(1).get();
  } catch (e) {
    throw new Error(
      `Firestore emulator no responde en 127.0.0.1:8080: ${(e as Error).message}. ¿Arrancaste los emuladores? (pnpm emulators:detach)`,
    );
  }
}

/**
 * Borra todos los templates de todas las organizaciones y los users de prueba.
 * Llamar en `afterAll` de cada integration test.
 *
 * Nota: en el Firestore emulator, borrar el parent doc borra las
 * sub-collections automáticamente. En producción NO es así — pero estos
 * helpers son solo para tests contra emulador.
 */
export async function cleanupTemplatesIntegration(): Promise<void> {
  try {
    // Borrar templates (de todas las organizaciones)
    const orgsSnap = await templatesTestDb.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
      const templatesSnap = await templatesTestDb
        .collection('organizations')
        .doc(orgDoc.id)
        .collection('templates')
        .get();
      for (const tDoc of templatesSnap.docs) {
        await tDoc.ref.delete().catch(() => undefined);
      }
    }

    // Borrar organizations de prueba (cascada a sub-collections en emulator)
    for (const orgDoc of orgsSnap.docs) {
      await orgDoc.ref.delete().catch(() => undefined);
    }

    // Borrar users de prueba
    const users = await templatesTestAuth.listUsers(50);
    await Promise.all(
      users.users.map((u) => {
        return templatesTestAuth.deleteUser(u.uid).catch(() => undefined);
      }),
    );
  } catch {
    // ignorar — el cleanup no debe romper el test
  }
}

/**
 * Crea una organización mínima en Firestore (id, name, slug, plan, created_at).
 */
export async function seedTestOrg(
  orgId: string,
  fields: Partial<{ name: string; slug: string; plan: string }> = {},
): Promise<void> {
  await templatesTestDb
    .collection('organizations')
    .doc(orgId)
    .set({
      name: fields.name ?? 'Test Org',
      slug: fields.slug ?? orgId,
      plan: fields.plan ?? 'free',
      created_at: new Date(),
    });
}

/**
 * Borra una organización completa (incluyendo templates y review_comments
 * via cascade en el emulator).
 */
export async function deleteTestOrg(orgId: string): Promise<void> {
  const orgRef = templatesTestDb.collection('organizations').doc(orgId);
  const templatesSnap = await orgRef.collection('templates').get();
  for (const t of templatesSnap.docs) {
    await t.ref.delete().catch(() => undefined);
  }
  await orgRef.delete().catch(() => undefined);
}

# SDD-06: Cloud Functions v1

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 2 (semanas 5-6)
> **Depende de:** SDD-03, SDD-04
> **Bloquea a:** SDD-07 (algunas pantallas llaman a Functions)

---

## 1. Contexto

Necesitamos endpoints serverless tipados para:

1. Lógica que el cliente no puede hacer (setear Custom Claims requiere Admin SDK).
2. Operaciones multi-paso con privilegios elevados (crear user en Auth + Firestore + auditLog).
3. Trabajo async desacoplable (generar reporte bajo demanda, futura integración ATS).

Este SDD implementa los wrappers (`onCallAuth`, `validateInput`, `handleError`) y 2 endpoints de ejemplo (`v1_users_create`, `v1_reports_generate`). El resto se agrega siguiendo el mismo template.

## 2. Goals y Non-Goals

### Goals

- `apps/functions` shell con TS, build, deploy, emulación.
- Wrappers reutilizables (`onCallAuth`, `validateInput`, `handleError`).
- 2 endpoints HTTPS callable v1 funcionando.
- Tests de integración con emulador (`firebase emulators:exec`).
- Secret Manager para secrets (no env vars).
- CORS configurado explícitamente.
- Headers de seguridad.
- Bundle < 10MB por function (límite de deploy de Cloud Functions).

### Non-Goals

- REST API público (HTTPS callable es el contrato).
- Push notifications / FCM.
- Scheduled functions / cron (futuro).
- Cloud Tasks / Cloud Scheduler.
- Integración con Stripe / billing (otro SDD).
- Reportes complejos (PDF, charts) — solo stub.
- Rate limiting (App Check en SDD-08 si necesario).

## 3. Decisiones de arquitectura

| #   | Decisión                                                               | Justificación                                                          |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Callable HTTPS, no `onRequest`                                         | Mejor DX con TypeScript, validación tipada automática, CORS manejado.  |
| 2   | 2nd gen (`firebase-functions/v2/https`)                                | Cold starts menores, min-instances, mejor integración con EventBridge. |
| 3   | Node.js 20 LTS                                                         | EOL abril 2026. Actualizar a 22 cuando esté estable en Firebase.       |
| 4   | Secrets en Firebase Secret Manager (staging/prod), `.env.local` en dev | Secret Manager se monta como env vars en runtime.                      |
| 5   | Wrapper `onCallAuth` exportado, no función por handler                 | DRY. Tests unitarios del wrapper aislados.                             |
| 6   | Errors tipados (`HttpsError`)                                          | El cliente mapea a UI de forma predecible.                             |
| 7   | Cada función en archivo separado                                       | Tree-shaking, cold start por función.                                  |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
apps/functions/
├── package.json
├── tsconfig.json
├── .eslintrc.cjs                    # extends root + reglas adicionales
├── .env.example
├── src/
│   ├── index.ts                     # entry: re-exporta todas las funciones
│   ├── firebase-admin.ts            # ya creado en SDD-03
│   ├── shared/
│   │   ├── auth-context.ts          # tipo AuthedContext
│   │   ├── on-call-auth.ts          # wrapper
│   │   ├── validate-input.ts        # wrapper
│   │   ├── handle-error.ts          # mapeo de errores
│   │   ├── audit.ts                 # helper para escribir auditLogs
│   │   ├── errors.ts                # AppError tipados
│   │   └── __tests__/
│   │       ├── on-call-auth.test.ts
│   │       ├── validate-input.test.ts
│   │       └── handle-error.test.ts
│   └── v1/
│       ├── users/
│       │   ├── create-user.ts
│       │   ├── list-users.ts
│       │   ├── update-user.ts
│       │   ├── delete-user.ts
│       │   ├── set-role.ts
│       │   └── __tests__/
│       │       └── create-user.test.ts
│       ├── auth/
│       │   ├── create-session.ts    # POST onRequest para setear cookie
│       │   └── clear-session.ts
│       └── reports/
│           └── generate-report.ts
```

### 4.2 `apps/functions/package.json`

```jsonc
{
  "name": "@platform/functions",
  "version": "0.1.0",
  "private": true,
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:emulator": "firebase emulators:exec --only firestore,auth 'vitest run --testPathPattern=integration'",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log",
    "secrets:set": "node ./scripts/secret-set.js",
  },
  "dependencies": {
    "@platform/shared": "workspace:*",
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^6.0.0",
    "jose": "^5.9.0",
    "pino": "^9.4.0",
    "zod": "^3.23.0",
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
  },
}
```

### 4.3 `apps/functions/tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src",
    "lib": ["ES2022"],
    "types": ["node"],
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "**/__tests__/**"],
}
```

### 4.4 Wrapper `onCallAuth`

```ts
// apps/functions/src/shared/on-call-auth.ts
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAdminAuth } from '../firebase-admin';
import type { Role } from '@shared/schemas/common';

export type AuthedContext = {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
  traceId: string;
  request: CallableRequest<unknown>;
};

export async function onCallAuth(requiredRole?: Role | Role[]): Promise<AuthedContext> {
  // El request real se pasa vía el decorator `withAuth` más abajo.
  // Esta función solo recibe lo necesario; ver 4.4.1.
  throw new Error('Use withAuth decorator, not onCallAuth directly');
}
```

```ts
// apps/functions/src/shared/with-auth.ts
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAdminAuth } from '../firebase-admin';
import type { Role } from '@shared/schemas/common';
import type { AuthedContext } from './on-call-auth';

export async function buildAuthContext(
  request: CallableRequest<unknown>,
  requiredRole?: Role | Role[],
): Promise<AuthedContext> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const token = request.auth.token;
  const role = token.role as Role | undefined;
  if (!role || !['admin', 'recruiter', 'expert'].includes(role)) {
    throw new HttpsError('permission-denied', 'Invalid or missing role claim');
  }
  // Modelo ortogonal de capacidades (ver ADR-0006): no hay jerarquía implícita.
  // Cada endpoint declara explícitamente qué roles acepta vía requiredRole.
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(role)) {
      throw new HttpsError('permission-denied', `Required role: ${allowed.join(' | ')}`);
    }
  }
  return {
    uid: request.auth.uid,
    email: request.auth.token.email ?? '',
    role,
    organizationId: (token.organizationId as string | undefined) ?? null,
    traceId: request.rawRequest.headers['x-trace-id'] ?? crypto.randomUUID(),
    request,
  };
}
```

### 4.5 Wrapper `validateInput`

```ts
// apps/functions/src/shared/validate-input.ts
import { HttpsError } from 'firebase-functions/v2/https';
import type { ZodSchema } from 'zod';

export function validateInput<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpsError('invalid-argument', 'Input validation failed', {
      issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  return result.data;
}
```

### 4.6 Wrapper `handleError`

```ts
// apps/functions/src/shared/handle-error.ts
import { HttpsError } from 'firebase-functions/v2/https';
import { RepositoryError } from './errors';
import { logger } from 'firebase-functions/v2';

export function handleError(err: unknown): never {
  if (err instanceof HttpsError) throw err;
  if (err instanceof RepositoryError) {
    const map = {
      NOT_FOUND: 'not-found',
      ALREADY_EXISTS: 'already-exists',
      PERMISSION_DENIED: 'permission-denied',
      VALIDATION: 'invalid-argument',
      UNAVAILABLE: 'unavailable',
      INTERNAL: 'internal',
    } as const;
    throw new HttpsError(map[err.code], err.message, { code: err.code, cause: err.cause });
  }
  logger.error('Unhandled error', err);
  throw new HttpsError('internal', 'An unexpected error occurred', {
    cause: err instanceof Error ? err.message : 'unknown',
  });
}
```

### 4.7 `errors.ts`

```ts
// apps/functions/src/shared/errors.ts
export type RepositoryErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'VALIDATION'
  | 'INTERNAL'
  | 'UNAVAILABLE';

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
```

> Mismo tipo que en `apps/web/repositories/errors.ts` — se puede extraer a `packages/shared` si se quiere evitar duplicación. Decisión: **mantener duplicado** por ahora (simétrico y evita acoplamiento indebido). Si crece, mover.

### 4.8 `v1_users_create`

```ts
// apps/functions/src/v1/users/create-user.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { createUserInputSchema } from '@shared/schemas/users';
import { getAdminApp, getAdminAuth, getAdminDb } from '../../firebase-admin';
import { buildAuthContext } from '../../shared/with-auth';
import { validateInput } from '../../shared/validate-input';
import { handleError } from '../../shared/handle-error';
import { RepositoryError } from '../../shared/errors';
import { writeAuditLog } from '../../shared/audit';
import { FieldValue } from 'firebase-admin/firestore';

export const v1UsersCreate = onCall(
  {
    cors: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
    enforceAppCheck: false, // activar en SDD-08
  },
  async (request) => {
    try {
      const ctx = await buildAuthContext(request, 'admin');
      const input = validateInput(createUserInputSchema, request.data);

      const auth = getAdminAuth();
      const db = getAdminDb();

      // 1) Crear en Auth
      let userRecord;
      try {
        userRecord = await auth.createUser({ email: input.email, displayName: input.displayName });
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code === 'auth/email-already-exists') {
          throw new RepositoryError('ALREADY_EXISTS', 'Email already registered', e);
        }
        throw new RepositoryError('INTERNAL', 'Failed to create auth user', e);
      }

      // 2) Seteamos claims iniciales
      const claims: Record<string, unknown> = { role: input.role };
      if (input.organizationId) claims.organizationId = input.organizationId;
      await auth.setCustomUserClaims(userRecord.uid, claims);

      // 3) Crear doc en Firestore
      const now = FieldValue.serverTimestamp();
      await db
        .collection('users')
        .doc(userRecord.uid)
        .set({
          email: input.email,
          display_name: input.displayName ?? null,
          photo_url: null,
          role: input.role,
          organization_id: input.organizationId ?? null,
          status: 'invited',
          last_login_at: null,
          created_at: now,
          updated_at: now,
          created_by: ctx.uid,
          deleted_at: null,
        });

      // 4) Audit log
      await writeAuditLog({
        actorId: ctx.uid,
        actorEmail: ctx.email,
        action: 'user.created',
        targetType: 'user',
        targetId: userRecord.uid,
        metadata: { email: input.email, role: input.role },
      });

      // 5) (Opcional) enviar email de invitación
      if (input.sendInviteEmail) {
        // TODO: integrar con servicio de email en SDD-08
      }

      return {
        uid: userRecord.uid,
        email: input.email,
        displayName: input.displayName ?? null,
        photoURL: null,
        role: input.role,
        organizationId: input.organizationId ?? null,
        status: 'invited' as const,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: ctx.uid,
        deletedAt: null,
      };
    } catch (e) {
      handleError(e);
    }
  },
);
```

### 4.9 `v1_users_list`

```ts
// apps/functions/src/v1/users/list-users.ts
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { buildAuthContext } from '../../shared/with-auth';
import { validateInput } from '../../shared/validate-input';
import { handleError } from '../../shared/handle-error';
import { getAdminDb } from '../../firebase-admin';
import { roleSchema, statusSchema } from '@shared/schemas/common';

const listUsersInputSchema = z.object({
  organizationId: z.string().optional(),
  status: statusSchema.optional(),
  role: roleSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const v1UsersList = onCall(async (request) => {
  try {
    const ctx = await buildAuthContext(request, ['admin', 'recruiter']);
    const input = validateInput(listUsersInputSchema, request.data);
    const db = getAdminDb();

    const filters: FirebaseFirestore.Filter[] = [];
    filters.push(db.where('organization_id', '==', ctx.organizationId ?? '__none__'));
    if (input.status) filters.push(db.where('status', '==', input.status));
    if (input.role) filters.push(db.where('role', '==', input.role));

    const snap = await db
      .collection('users')
      .where(...filters)
      .orderBy('created_at', 'desc')
      .limit(input.pageSize * input.page)
      .get();

    const items = snap.docs
      .map((d) => mapUserDoc(d.id, d.data()))
      .filter((u) => u.deletedAt === null)
      .filter((u) =>
        input.search
          ? `${u.email} ${u.displayName ?? ''}`.toLowerCase().includes(input.search.toLowerCase())
          : true,
      );

    const start = (input.page - 1) * input.pageSize;
    const paged = items.slice(start, start + input.pageSize);
    return {
      items: paged,
      page: input.page,
      pageSize: input.pageSize,
      total: items.length,
      hasMore: start + paged.length < items.length,
    };
  } catch (e) {
    handleError(e);
  }
});

function mapUserDoc(id: string, raw: FirebaseFirestore.DocumentData) {
  return {
    uid: id,
    email: raw.email,
    displayName: raw.display_name ?? null,
    photoURL: raw.photo_url ?? null,
    role: raw.role,
    organizationId: raw.organization_id ?? null,
    status: raw.status,
    lastLoginAt: raw.last_login_at?.toDate?.() ?? null,
    createdAt: raw.created_at.toDate(),
    updatedAt: raw.updated_at.toDate(),
    createdBy: raw.created_by,
    deletedAt: raw.deleted_at?.toDate?.() ?? null,
  };
}
```

### 4.10 `v1_reports_generate` (stub)

```ts
// apps/functions/src/v1/reports/generate-report.ts
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { buildAuthContext } from '../../shared/with-auth';
import { validateInput } from '../../shared/validate-input';
import { handleError } from '../../shared/handle-error';
import { randomUUID } from 'node:crypto';

const inputSchema = z.object({
  type: z.enum(['users_csv', 'audit_log_pdf']),
  organizationId: z.string().optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
});

export const v1ReportsGenerate = onCall(async (request) => {
  try {
    const ctx = await buildAuthContext(request, 'admin');
    const input = validateInput(inputSchema, request.data);

    const jobId = `job_${randomUUID()}`;
    // En SDD futuro: encolar en Cloud Tasks o Pub/Sub
    // Por ahora, devolvemos estimado.
    return {
      jobId,
      status: 'queued' as const,
      estimatedSeconds: 30,
    };
  } catch (e) {
    handleError(e);
  }
});
```

### 4.11 `v1_auth_create_session` (onRequest)

```ts
// apps/functions/src/v1/auth/create-session.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getAdminAuth } from '../../firebase-admin';
import { logger } from 'firebase-functions/v2';

const COOKIE_NAME = '__session';
const MAX_AGE_S = 60 * 60 * 24 * 5;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');

export const createSession = onRequest({ cors: ALLOWED_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }
    const auth = getAdminAuth();
    const expiresIn = MAX_AGE_S * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}`,
    );
    res.json({ success: true });
  } catch (e) {
    logger.error('createSession failed', e);
    res.status(500).json({ error: 'internal' });
  }
});
```

> Justificación del cambio a `onRequest`: las Cloud Functions callable no permiten setear cookies en el response de forma confiable. `onRequest` es lo correcto para este caso.

### 4.12 `index.ts` (entry)

```ts
// apps/functions/src/index.ts
export { v1UsersCreate } from './v1/users/create-user';
export { v1UsersList } from './v1/users/list-users';
// export { v1UsersUpdate } from './v1/users/update-user'; // TODO siguiente sprint
// export { v1UsersDelete } from './v1/users/delete-user';
export { v1ReportsGenerate } from './v1/reports/generate-report';
export { createSession } from './v1/auth/create-session';
```

### 4.13 Secrets

```bash
# Set (una vez por entorno)
firebase functions:secrets:set SESSION_COOKIE_SECRET --project staging
firebase functions:secrets:set RESEND_API_KEY --project staging

# Access en código
import { defineSecret } from 'firebase-functions/params';
const sessionSecret = defineSecret('SESSION_COOKIE_SECRET');

export const v1UsersCreate = onCall({ secrets: [sessionSecret] }, async (req) => { ... });
```

### 4.14 Tests de `onCallAuth`

```ts
// apps/functions/src/shared/__tests__/with-auth.test.ts
import { describe, it, expect } from 'vitest';
import { buildAuthContext } from '../with-auth';
import { HttpsError } from 'firebase-functions/v2/https';

function makeReq(auth: { uid: string; token: Record<string, unknown> } | null) {
  return {
    auth,
    data: {},
    rawRequest: { headers: {} } as any,
  } as any;
}

describe('buildAuthContext', () => {
  it('throws unauthenticated si no hay auth', async () => {
    await expect(buildAuthContext(makeReq(null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('throws permission-denied si role claim falta', async () => {
    await expect(buildAuthContext(makeReq({ uid: 'u1', token: {} }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('throws permission-denied si role requerido no coincide', async () => {
    await expect(
      buildAuthContext(makeReq({ uid: 'u1', token: { role: 'expert' } }), 'admin'),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('retorna context con role y organizationId', async () => {
    const ctx = await buildAuthContext(
      makeReq({ uid: 'u1', token: { role: 'admin', organizationId: 'org_1', email: 'a@x' } }),
    );
    expect(ctx.role).toBe('admin');
    expect(ctx.organizationId).toBe('org_1');
    expect(ctx.traceId).toBeTruthy();
  });
});
```

### 4.15 Test de integración de `v1_users_create`

```ts
// apps/functions/src/v1/users/__tests__/create-user.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { httpsCallable } from 'firebase/functions';

const env = await initializeTestEnvironment({ projectId: 'demo-fn-test' /* ... */ });

describe('v1_users_create (integration)', () => {
  it('admin puede crear user', async () => {
    const adminCtx = env.authenticatedContext('u_admin', { role: 'admin' });
    const fn = httpsCallable(adminCtx.functions(), 'v1UsersCreate');
    const result = await fn({ email: 'new@x.com', role: 'expert' });
    expect(result.data.email).toBe('new@x.com');
  });

  it('expert no puede crear user', async () => {
    const viewerCtx = env.authenticatedContext('u_expert', { role: 'expert' });
    const fn = httpsCallable(viewerCtx.functions(), 'v1UsersCreate');
    await expect(fn({ email: 'new@x.com', role: 'expert' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rechaza email duplicado', async () => {
    // ...
  });
});

afterAll(() => env.cleanup());
```

### 4.16 Comportamiento esperado

- `pnpm --filter functions build` produce `lib/`.
- `firebase emulators:start --only functions` levanta emulador.
- `pnpm deploy` (con Firebase CLI auth) sube las funciones al proyecto activo.
- Cada función responde en ~100ms-1s para payloads típicos.

### 4.17 Errores y excepciones

| Error de input          | Resultado                                      |
| ----------------------- | ---------------------------------------------- |
| Schema Zod falla        | `invalid-argument` con `details.issues`        |
| Auth ausente            | `unauthenticated`                              |
| Rol insuficiente        | `permission-denied`                            |
| Email duplicado         | `already-exists`                               |
| Firestore no disponible | `unavailable` (mapped desde `RepositoryError`) |
| Otro                    | `internal` + log                               |

## 5. Criterios de aceptación

- [ ] `pnpm --filter functions build` produce `lib/` sin errores.
- [ ] `pnpm --filter functions typecheck` pasa.
- [ ] `pnpm --filter functions lint` pasa con `--max-warnings 0`.
- [ ] `pnpm --filter functions test` corre y pasa (al menos 6 tests del wrapper).
- [ ] `pnpm test:emulator` levanta emuladores y corre los integration tests.
- [ ] `v1UsersCreate` funciona contra emulador con admin.
- [ ] `v1UsersCreate` rechaza expert con `permission-denied`.
- [ ] `v1UsersCreate` rechaza email duplicado con `already-exists`.
- [ ] `v1ReportsGenerate` retorna `{ jobId, status: 'queued' }`.
- [ ] `createSession` setea cookie `__session` httpOnly.
- [ ] CORS configurado solo para orígenes en `ALLOWED_ORIGINS`.
- [ ] Secrets se acceden vía `defineSecret`, no `process.env`.
- [ ] Headers de seguridad presentes en responses.
- [ ] Coverage ≥ 75% en `v1/users/*` y wrappers.

## 6. Plan de testing

- **Unit** (sin emulador): todos los wrappers + lógica de validación.
- **Integration** (con emulador): cada endpoint v1, al menos 3 casos por endpoint (happy, perm fail, validation fail).

## 7. Riesgos y mitigaciones

| Riesgo                                   | Probabilidad | Impacto | Mitigación                                                                                                                     |
| ---------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Cold start > 5s en funciones poco usadas | M            | M       | `minInstances: 1` en staging/prod para funciones críticas (`v1UsersCreate`, `createSession`).                                  |
| Bundle > 10MB                            | B            | A       | Tree-shaking + no importar SDKs innecesarios + revisar con `firebase functions:list --json` y `pnpm dlx firebase-bundle-size`. |
| Callable no permite setear cookies       | A            | A       | `createSession` usa `onRequest` (ya documentado).                                                                              |
| Secrets en `.env` accidental             | M            | A       | `gitleaks` en CI + tests que `process.env.X` falle para vars en `defineSecret`.                                                |
| CORS abierto a todos                     | M            | A       | Whitelist explícita desde env var. Test verifica que orígenes no listados son rechazados.                                      |
| Race condition en setCustomUserClaims    | B            | B       | Llamadas secuenciales; documentar que el token tarda en propagarse (recomendar `getIdToken(true)` en cliente).                 |

## 8. Out of scope

- v2 (scheduled, push, tasks).
- Rate limiting (App Check en SDD-08).
- Logs centralizados (Cloud Logging — automático).
- Tracing distribuido (OpenTelemetry — decisión de SDD-08).

## 9. Open Questions

- [ ] ¿CORS en callable o solo en `createSession` (onRequest)? **Decisión**: ambos.
- [ ] ¿Audit log se escribe síncrono dentro del endpoint o async via Pub/Sub? **Decisión MVP**: síncrono (más simple, agregar DLQ si falla).
- [ ] ¿`v1_reports_generate` debe usar Cloud Tasks o un setInterval en Firestore? **Decisión**: stub por ahora. Diseño de jobs en sprint siguiente.

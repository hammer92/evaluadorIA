# SDD-03: Firebase Setup (Emulators + Rules + SDK Wrappers)

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 1 (semana 2)
> **Depende de:** SDD-01, SDD-02 (parcial — para integrar env vars)
> **Bloquea a:** SDD-04, SDD-05, SDD-06

---

## 1. Contexto

Necesitamos el setup de Firebase de modo que el equipo pueda desarrollar localmente contra **emuladores** (rápidos, gratis, sin tocar prod), y que las reglas de seguridad estén escritas desde el día 1 — antes de que haya datos. Las reglas con "denegación por defecto" son la línea base de seguridad de todo el sistema.

Este SDD también crea los **wrappers del SDK** (`lib/firebase/client.ts`, `lib/firebase/admin.ts`) que serán los únicos puntos de acceso a Firebase en el resto de la app. Cualquier uso del SDK fuera de estos archivos es violación arquitectónica (enforced por ESLint en SDD-01).

## 2. Goals y Non-Goals

### Goals

- `firebase.json` configurado con emuladores (auth, firestore, functions, storage).
- `pnpm emulators` levanta los 4 emuladores limpios.
- `firestore.rules` con denegación por defecto + reglas para `users`, `organizations`, `auditLogs`.
- `storage.rules` con denegación por defecto + regla básica para `avatars/{uid}`.
- `firestore.indexes.json` con los índices declarados en `data-model.md`.
- `lib/firebase/client.ts` (Next.js client-side, inicializa Firebase JS SDK).
- `lib/firebase/admin.ts` (Node-side, inicializa Firebase Admin SDK con credenciales).
- Custom Claims helper: `setUserRole(uid, role)`.
- Seed script (`pnpm seed:emulators`) que crea 3 usuarios (1 admin, 1 recruiter, 1 expert) + 1 org para dev local.

### Non-Goals

- Lógica de aplicación (eso es SDD-04 en adelante).
- Cloud Functions deployadas (SDD-06).
- Configuración de hosting/CDN (SDD-08).
- Backups / export programado.

## 3. Decisiones de arquitectura

| #   | Decisión                                                                                  | Justificación                                                       |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Auth emulator en puerto 9099, Firestore 8080, Functions 5001, Storage 9199                | Estándar Firebase.                                                  |
| 2   | `pnpm emulators` usa `firebase emulators:start --import ./emulator-data --export-on-exit` | Para que el state de emuladores persista entre sesiones.            |
| 3   | Rules denegando por defecto (`match /{document=**} { allow read, write: if false; }`)     | Cualquier acceso no explícito falla.                                |
| 4   | Custom Claims son la **única** fuente de verdad para roles                                | El campo `role` en Firestore es espejo/cache, server-authoritative. |
| 5   | Admin SDK inicializa lazy (solo si se llama desde server context)                         | Evita cargar credenciales en cliente.                               |
| 6   | Storage con path `avatars/{uid}/...` y reglas por uid                                     | Cada user solo escribe/lee su propia carpeta.                       |
| 7   | Seed usa Admin SDK contra emuladores                                                      | Idempotente: corre varias veces, mismo resultado.                   |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .firebaserc
│
├── apps/web/
│   ├── lib/firebase/
│   │   ├── client.ts
│   │   ├── auth.ts                   # helpers auth (signIn, signOut) — STUB aquí, real en SDD-05
│   │   └── __tests__/
│   │       └── client.test.ts        # test de inicialización
│   └── app/api/                      # NO se crea en este SDD — eso es SDD-06 (Cloud Functions)
│
└── apps/functions/                   # shell creado en este SDD, contenido en SDD-06
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts                  # placeholder
```

### 4.2 `firebase.json`

```jsonc
{
  "projects": { "default": "admin-platform-dev" },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json",
  },
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true,
  },
}
```

> `singleProjectMode: true` permite que auth + firestore + storage compartan el mismo proyecto fake en emulador.

### 4.3 `.firebaserc`

```json
{
  "projects": {
    "dev": "admin-platform-dev",
    "staging": "admin-platform-staging",
    "prod": "admin-platform-prod"
  }
}
```

> `firebase use dev` en local; en CI se pasa `FIREBASE_USE=staging` etc.

### 4.4 `firestore.rules`

```
rules_version = '2';

service cloud.firestore {
  match /{document=**} {
    // DENEGACIÓN POR DEFECTO
    allow read, write: if false;
  }

  // ============ USERS ============
  // Modelo de capacidades por rol: ver ADR-0006.
  //   admin     → superuser (puede todo)
  //   recruiter → gestiona candidatos (CRUD users OK, settings NO)
  //   expert    → edita technical tests (puede leer users, NO modificarlos)
  match /users/{uid} {
    // Lectura: el propio user, admin, o recruiter (necesita ver candidatos que invites)
    allow read: if isSignedIn() && (isSelf(uid) || hasAnyRole(['admin', 'recruiter']));

    // Creación: admin o recruiter (ambos pueden invitar)
    allow create: if isSignedIn() && hasAnyRole(['admin', 'recruiter'])
      && request.resource.data.keys().hasAll(['email', 'role', 'status', 'createdAt'])
      && request.resource.data.role in ['admin', 'recruiter', 'expert']
      && request.resource.data.status in ['active', 'invited', 'suspended'];

    // Update: admin total, recruiter puede editar excepto cambiar role,
    //         user solo displayName/photoURL propios.
    // Defense in depth: el código (services) ya valida esto, pero las reglas
    // son la última línea.
    allow update: if isSignedIn() && (
      hasRole('admin')
      || (hasRole('recruiter') && onlyAffects(['displayName', 'photoURL', 'status']))
      || (isSelf(uid) && onlyAffects(['displayName', 'photoURL']))
    );

    // Delete (soft): solo admin
    allow delete: if isSignedIn() && hasRole('admin');

    // Listado: admin, recruiter (gestiona candidatos), expert (necesita ver otros para asignar)
    allow list: if isSignedIn() && hasAnyRole(['admin', 'recruiter', 'expert']);
  }

  // ============ ORGANIZATIONS ============
  match /organizations/{orgId} {
    // Lectura: miembros de la org
    allow read: if isSignedIn() && isMemberOfOrg(orgId);
    // Settings/billing: solo admin
    allow create, update, delete: if isSignedIn() && hasRole('admin');

    // Subcollection memberships
    match /memberships/{membershipId} {
      allow read: if isSignedIn() && isMemberOfOrg(orgId);
      allow write: if isSignedIn() && hasAnyRole(['admin', 'recruiter']);
    }
  }

  // ============ AUDIT LOGS ============
  // Append-only. Lectura: admin (todas), recruiter/expert (filtrado a su org).
  // Escritura: SOLO desde Cloud Functions (Admin SDK bypassa reglas).
  match /auditLogs/{logId} {
    allow read: if isSignedIn() && (
      hasRole('admin')
      || (resource != null && resource.data.organization_id == request.auth.token.organizationId)
    );
    allow write: if false;
  }

  // ============ TEMPLATES (technical test recipes) ============
  // TODO Sprint futuro (SDD-10 templates): crear reglas cuando se agregue la colección.
  // Por ahora referenciar la matriz del ADR-0006.

  // ============ Helpers ============
  function isSignedIn() {
    return request.auth != null;
  }
  function isSelf(uid) {
    return request.auth.uid == uid;
  }
  function hasRole(role) {
    return request.auth.token.role == role;
  }
  function hasAnyRole(roles) {
    return request.auth.token.role in roles;
  }
  function isMemberOfOrg(orgId) {
    return request.auth.token.organizationId == orgId || hasRole('admin');
  }
  function onlyAffects(fields) {
    return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
  }
}
```

### 4.5 `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "actorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 4.6 `storage.rules`

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // DENEGACIÓN POR DEFECTO
      allow read, write: if false;
    }

    // Avatares de usuario — el user solo escribe/lee los suyos
    match /avatars/{uid}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 2 * 1024 * 1024  // 2MB
        && request.resource.contentType.matches('image/.*');
    }

    // Exports de reportes — solo admin
    match /reports/{fileName} {
      allow read: if request.auth != null && request.auth.token.role == 'admin';
      allow write: if false;  // solo Cloud Functions (Admin SDK)
    }
  }
}
```

### 4.7 `apps/web/lib/firebase/client.ts`

```ts
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { clientEnv } from '@/env';

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: clientEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
}

export const firebaseApp = createFirebaseApp();
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Conectar a emuladores si estamos en dev
if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev' && typeof window !== 'undefined') {
  // Solo conectar una vez
  // @ts-expect-error - emulators flag es interno del SDK pero es el patrón documentado
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  if (!(db as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  if (!(storage as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

// Exports de tipo
export type { FirebaseApp, Auth, Firestore, FirebaseStorage };
```

> Las guards `if (!(emulatorConfig))` evitan reconectar en HMR.

### 4.8 `apps/functions/src/firebase-admin.ts`

```ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

let _app: App | undefined;

export function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }
  _app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    }),
  });
  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
```

### 4.9 Custom Claims helper

```ts
// apps/functions/src/auth/set-custom-claims.ts
import { getAdminAuth } from '../firebase-admin';
import type { Role } from '@shared/schemas/users';

export async function setUserRole(uid: string, role: Role, organizationId?: string | null) {
  const auth = getAdminAuth();
  const claims: Record<string, unknown> = { role };
  if (organizationId !== undefined) {
    claims.organizationId = organizationId;
  }
  await auth.setCustomUserClaims(uid, claims);
}
```

### 4.10 Seed script

```ts
// scripts/seed-emulators.ts
import { getAdminApp, getAdminAuth, getAdminDb } from '../apps/functions/src/firebase-admin';

async function main() {
  // apuntar admin SDK a emuladores
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  // ...

  const auth = getAdminAuth();
  const db = getAdminDb();

  // Idempotente: si ya existe, no duplica
  await db
    .collection('organizations')
    .doc('org_default')
    .set(
      {
        name: 'Default Org',
        slug: 'default',
        plan: 'free',
        settings: { timezone: 'UTC', locale: 'es' },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system',
        deletedAt: null,
      },
      { merge: true },
    );

  const seedUsers = [
    { uid: 'u_admin', email: 'admin@example.com', role: 'admin' },
    { uid: 'u_recruiter', email: 'recruiter@example.com', role: 'recruiter' },
    { uid: 'u_expert', email: 'expert@example.com', role: 'expert' },
  ] as const;

  for (const u of seedUsers) {
    try {
      await auth.createUser({ uid: u.uid, email: u.email });
    } catch (e) {
      if (!String(e).includes('already exists')) throw e;
    }

    await auth.setCustomUserClaims(u.uid, { role: u.role, organizationId: 'org_default' });

    await db
      .collection('users')
      .doc(u.uid)
      .set(
        {
          email: u.email,
          display_name: u.email.split('@')[0],
          photo_url: null,
          role: u.role,
          organization_id: 'org_default',
          status: 'active',
          last_login_at: null,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          created_by: 'system',
          deleted_at: null,
        },
        { merge: true },
      );
  }
  console.log('✅ Seed done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> El script es idempotente: corre 5 veces y el resultado es el mismo.

### 4.11 Script `pnpm emulators`

En `package.json` root:

```jsonc
{
  "scripts": {
    "emulators": "firebase emulators:start --project dev --import ./emulator-data --export-on-exit",
    "emulators:reset": "rm -rf ./emulator-data && firebase emulators:start --project dev",
    "seed:emulators": "tsx scripts/seed-emulators.ts",
    "emulators:test": "firebase emulators:exec --project dev 'vitest run --testPathPattern=integration'",
  },
}
```

### 4.12 Test del cliente Firebase

```ts
// apps/web/lib/firebase/__tests__/client.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('firebase client', () => {
  it('inicializa con env vars de NEXT_PUBLIC_*', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'dev');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'test.appspot.com');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '0');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:0:web:0');

    const mod = await import('../client');
    expect(mod.firebaseApp).toBeDefined();
    expect(mod.auth).toBeDefined();
    expect(mod.db).toBeDefined();
    expect(mod.storage).toBeDefined();
  });
});
```

### 4.13 Comportamiento esperado

1. `pnpm emulators`:
   - Levanta auth (9099), firestore (8080), functions (5001), storage (9199), UI (4000).
   - Carga `./emulator-data/` si existe.
   - Al cerrar (Ctrl+C), exporta estado.
2. `pnpm seed:emulators` (con emuladores levantados):
   - Crea 1 org + 3 users con sus roles.
3. UI en `http://localhost:4000` muestra los datos sembrados.
4. Reglas se validan al deployar (`firebase deploy --only firestore:rules` falla si hay error de sintaxis).

### 4.14 Errores y excepciones

| Situación                             | Comportamiento                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm emulators` sin `firebase-tools` | Falla con mensaje claro; README documenta instalación.                            |
| Puerto ocupado                        | Firebase CLI lo detecta y falla con sugerencia de `--only` o de matar el proceso. |
| Reglas con error de sintaxis          | `firebase deploy` falla. En emulador, se loguea al cargar.                        |
| Seed corre sin emuladores             | Falla al conectar a `127.0.0.1:8080`.                                             |
| Env vars faltantes                    | `env.ts` (de SDD-02) falla antes de importar `client.ts`.                         |

## 5. Criterios de aceptación

- [ ] `pnpm emulators` levanta los 4 emuladores sin errores.
- [ ] UI de emuladores accesible en `http://localhost:4000`.
- [ ] `pnpm seed:emulators` puebla 1 org + 3 users idempotentemente.
- [ ] Las reglas niegan acceso a un user no autenticado a cualquier doc (verificable desde UI de emuladores).
- [ ] Las reglas permiten al admin leer `users/*`.
- [ ] Las reglas permiten al user editar solo `displayName`/`photoURL` de su propio doc (verificable con tests de integración).
- [ ] Las reglas **niegan** escritura directa a `auditLogs` desde cliente.
- [ ] `firestore.indexes.json` se valida con `firebase firestore:indexes --validate`.
- [ ] `lib/firebase/client.ts` y `lib/firebase/admin.ts` exportan singletons.
- [ ] En dev, `client.ts` se conecta automáticamente a los emuladores.
- [ ] Test unitario de `client.ts` pasa.
- [ ] ESLint rechaza `import { getAuth } from 'firebase/auth'` en `app/page.tsx`.

## 6. Plan de testing

- **Unit**: `client.test.ts` (inicialización con env vars).
- **Integration** (con emuladores, `@firebase/rules-unit-testing`):
  - `firestore-rules.test.ts`: tests por cada regla de cada colección.
  - `auth-flow.test.ts`: signup → set custom claims → read firestore with claims.
- **Manual**: checklist de criterios arriba.

### 6.1 Ejemplo de test de reglas

```ts
// apps/web/lib/firebase/__tests__/firestore-rules.test.ts
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it, beforeAll, afterAll } from 'vitest';

const env = await initializeTestEnvironment({ projectId: 'demo-test' });

describe('users collection rules (modelo ortogonal — ver ADR-0006)', () => {
  it('niega lectura a no autenticados', async () => {
    const ctx = env.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'users/u_admin')));
  });

  it('permite a user leer su propio doc', async () => {
    const ctx = env.authenticatedContext('u_expert', { role: 'expert' });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users/u_expert')));
  });

  it('permite admin leer otros users', async () => {
    const ctx = env.authenticatedContext('u_admin', { role: 'admin' });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users/u_expert')));
  });

  it('permite recruiter leer otros users (gestiona candidatos)', async () => {
    const ctx = env.authenticatedContext('u_recruiter', { role: 'recruiter' });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users/u_expert')));
  });

  it('permite expert leer otros users (para asignar a candidatos)', async () => {
    const ctx = env.authenticatedContext('u_expert', { role: 'expert' });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users/u_recruiter')));
  });

  it('permite admin crear users', async () => {
    const ctx = env.authenticatedContext('u_admin', { role: 'admin' });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'users/u_new'), {
        email: 'new@x.com',
        role: 'recruiter',
        status: 'invited',
        createdAt: new Date(),
        organizationId: 'org_default',
      }),
    );
  });

  it('permite recruiter crear users (su dominio es gestión de candidatos)', async () => {
    const ctx = env.authenticatedContext('u_recruiter', { role: 'recruiter' });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'users/u_new2'), {
        email: 'new2@x.com',
        role: 'recruiter',
        status: 'invited',
        createdAt: new Date(),
        organizationId: 'org_default',
      }),
    );
  });

  it('niega a expert crear users (no es su dominio)', async () => {
    const ctx = env.authenticatedContext('u_expert', { role: 'expert' });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'users/u_new3'), {
        email: 'new3@x.com',
        role: 'recruiter',
        status: 'invited',
        createdAt: new Date(),
        organizationId: 'org_default',
      }),
    );
  });

  it('niega a recruiter cambiar role de otro user', async () => {
    const ctx = env.authenticatedContext('u_recruiter', { role: 'recruiter' });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'users/u_expert'), {
        role: 'admin',
      }),
    );
  });
});

afterAll(() => env.cleanup());
```

## 7. Riesgos y mitigaciones

| Riesgo                                                    | Probabilidad | Impacto | Mitigación                                                                                              |
| --------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| Reglas Firestore permiten un hole de seguridad            | M            | A       | Tests de reglas obligatorios; code review con check explícito de seguridad.                             |
| Emulador lento al boot                                    | M            | B       | `--import` desde snapshot acorta el boot. Documentar.                                                   |
| Admin SDK no inicializa por falta de credenciales         | M            | M       | Fail-fast en `getAdminApp()` con mensaje claro.                                                         |
| Seed no idempotente y duplica datos                       | B            | M       | Usar `setDoc` con `merge: true` y `try/catch` en `createUser`.                                          |
| `firestore.indexes.json` desincronizado de queries reales | M            | M       | Tests de integración fallarán con `failed-precondition` si falta índice → alerta temprana.              |
| `client.ts` conecta a emulador en prod                    | B            | A       | La guard usa `clientEnv.NEXT_PUBLIC_APP_ENV === 'dev'`. CI verifica que `staging`/`prod` no triggereen. |

## 8. Out of scope

- Cloud Functions deployadas (SDD-06).
- Hosting config (SDD-08).
- Backups automáticos (producción → Cloud Storage).
- PITR (Point In Time Recovery) — activar en prod desde consola, no automatizado.
- Firebase Extensions.
- App Check / reCAPTCHA (se agrega en SDD-08 si hay tráfico suficiente).

## 9. Open Questions

- [ ] ¿Activamos Firebase App Check desde este SDD o esperamos a SDD-08? **Sugerido**: en SDD-08.
- [ ] ¿Las reglas Firestore deben rechazar `request.resource.data.createdAt` distinto a `request.time`? Más estricto, sí — considerar agregar.
- [ ] ¿Storage para avatares en este SDD o después? **Decisión**: incluido (es barato y muestra el patrón).

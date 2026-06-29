# Data Model

> **Estado:** Approved (pending)
> **DB:** Cloud Firestore
> **Convenciones:** snake_case en campos de Firestore, camelCase en TypeScript (mapeo en repository)

---

## 1. Principios generales

1. **Toda colección tiene al menos una regla de seguridad explícita** en `firestore.rules`.
2. **Toda colección tiene índice compuesto** declarado en `firestore.indexes.json` si se le hace query compuesta (where + orderBy de campos distintos).
3. **IDs de documentos**: el repo de cada entidad define si son auto-generated (`<entidad>_` + nanoid) o provistos (ej. `users/{uid}` usa el uid de Auth).
4. **Soft delete**: las entidades de dominio (`users`, `organizations`) usan campo `deletedAt: Timestamp | null`. Hard delete solo para `auditLogs` (cuando se rota por compliance).
5. **Timestamps**: siempre `createdAt`, `updatedAt`. Server-generated vía `FieldValue.serverTimestamp()`.
6. **PII**: emails y nombres se almacenan en texto plano solo cuando son necesarios para el feature (ej. nombre para mostrar). Datos sensibles (DNI, tarjetas) NO se almacenan — delegar a un vendor de pagos/ID.

---

## 2. Modelo entidad-relación (alto nivel)

```
organizations/{orgId}
    ├── users/{uid}              (auth del usuario, pertenencia opcional a org)
    ├── auditLogs/{logId}        (logs de la org)
    └── memberships/{membershipId} (relación user-org con rol)
```

Para el MVP, simplificamos:

- `organizations` es opcional pero prevista (multi-tenant-ready desde día 1).
- `users` puede existir sin `organizationId` (admins globales, dev accounts).
- `auditLogs` siempre referencia `organizationId` o es "system-level".

---

## 3. Colecciones

### 3.1 `users/{uid}`

**ID**: `uid` de Firebase Auth (no auto-generated).

| Campo            | Tipo                                   | Descripción                                                                                                                                    |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`          | `string`                               | Único. Indexado.                                                                                                                               |
| `displayName`    | `string \| null`                       | Nombre a mostrar.                                                                                                                              |
| `photoURL`       | `string \| null`                       | URL de avatar (de Auth o uploaded).                                                                                                            |
| `role`           | `'admin' \| 'recruiter' \| 'expert'`   | Espejo de Custom Claims (server-authoritative). Ver [ADR-0006](./decisions/0006-role-naming-and-permissions.md) para la matriz de capacidades. |
| `organizationId` | `string \| null`                       | Referencia a `organizations/{orgId}`.                                                                                                          |
| `status`         | `'active' \| 'invited' \| 'suspended'` | Estado de la cuenta.                                                                                                                           |
| `lastLoginAt`    | `Timestamp \| null`                    | Server-set en cada login.                                                                                                                      |
| `createdAt`      | `Timestamp`                            | Inmutable.                                                                                                                                     |
| `updatedAt`      | `Timestamp`                            | Server-set en cada update.                                                                                                                     |
| `createdBy`      | `string`                               | `uid` de quien creó el user.                                                                                                                   |
| `deletedAt`      | `Timestamp \| null`                    | Soft delete.                                                                                                                                   |

**Índices**:

- `(organizationId, role, status)`
- `(email ASC)` para login lookup
- `(status, createdAt DESC)` para dashboard

**Reglas** (resumen — ver `firestore.rules` completo en SDD-03):

- Lectura: usuario puede leerse a sí mismo. `admin` y `recruiter` pueden leer todos (reclutador gestiona candidatos).
- Escritura: `admin` o `recruiter` pueden crear. Usuario puede actualizar su propio `displayName` y `photoURL`. Cambiar `role` requiere `admin`. Soft delete requiere `admin`.

#### 3.1.1 Matriz de capacidades por rol

El modelo de permisos es **ortogonal por dominio**. No hay jerarquía implícita. Ver [ADR-0006](./decisions/0006-role-naming-and-permissions.md) para la justificación completa.

| Capacidad                          | `admin` |      `recruiter`       |        `expert`        |
| ---------------------------------- | :-----: | :--------------------: | :--------------------: |
| **Usuarios**                       |         |                        |                        |
| Crear / editar / eliminar usuarios |   ✅    |           ✅           |     ❌ (read only)     |
| Cambiar `role` de otros users      |   ✅    |           ❌           |           ❌           |
| Ver lista de usuarios              |   ✅    |           ✅           |           ✅           |
| **Candidatos / Evaluación**        |         |                        |                        |
| Invitar candidato                  |   ✅    |           ✅           |           ❌           |
| Asignar template a candidato       |   ✅    |           ✅           |     ❌ (read only)     |
| Ver resultados / reportes          |   ✅    |           ✅           |           ✅           |
| Cancelar / resetear evaluación     |   ✅    |           ✅           |           ❌           |
| **Pruebas técnicas (templates)**   |         |                        |                        |
| Crear / editar / archivar template |   ✅    |     ❌ (read only)     |           ✅           |
| Editar competencias y recetas      |   ✅    |           ❌           |           ✅           |
| Crear / editar question bank       |   ✅    |           ❌           |           ✅           |
| Aprobar template antes de uso      |   ✅    |           ❌           |           ✅           |
| **Organización**                   |         |                        |                        |
| Editar settings de la org          |   ✅    |           ❌           |           ❌           |
| Gestionar billing / plan           |   ✅    |           ❌           |           ❌           |
| **Auditoría**                      |         |                        |                        |
| Ver audit logs                     |   ✅    | ✅ (filtrado a su org) | ✅ (filtrado a su org) |

> **Default en signUp**: `role: 'recruiter'`. El admin puede cambiarlo después.

### 3.2 `organizations/{orgId}`

| Campo       | Tipo                              | Descripción                                  |
| ----------- | --------------------------------- | -------------------------------------------- |
| `name`      | `string`                          | Nombre legal o comercial.                    |
| `slug`      | `string`                          | URL-safe, único.                             |
| `plan`      | `'free' \| 'pro' \| 'enterprise'` | Billing.                                     |
| `settings`  | `object`                          | Config por org (timezone, locale, branding). |
| `createdAt` | `Timestamp`                       |                                              |
| `updatedAt` | `Timestamp`                       |                                              |
| `createdBy` | `string`                          |                                              |
| `deletedAt` | `Timestamp \| null`               |                                              |

**Índices**:

- `(slug ASC)`
- `(plan, createdAt DESC)`

**Reglas**:

- Lectura: solo miembros de la org.
- Escritura: solo admin.

### 3.3 `auditLogs/{logId}`

| Campo            | Tipo                                   | Descripción                                     |
| ---------------- | -------------------------------------- | ----------------------------------------------- |
| `organizationId` | `string \| null`                       | Org a la que aplica.                            |
| `actorId`        | `string`                               | `uid` que ejecutó la acción.                    |
| `actorEmail`     | `string`                               | Snapshot del email al momento de la acción.     |
| `action`         | `string`                               | Ver enum abajo.                                 |
| `targetType`     | `'user' \| 'organization' \| 'system'` |                                                 |
| `targetId`       | `string \| null`                       |                                                 |
| `metadata`       | `object`                               | Payload adicional (sanitizado).                 |
| `ip`             | `string \| null`                       | Para acciones sensibles (login, cambio de rol). |
| `userAgent`      | `string \| null`                       |                                                 |
| `createdAt`      | `Timestamp`                            | Inmutable. Server-set.                          |

**Acciones enum** (subset inicial, extensible):

```ts
type AuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.role_changed'
  | 'user.suspended'
  | 'organization.created'
  | 'organization.updated'
  | 'auth.login'
  | 'auth.failed_login'
  | 'auth.role_escalation_blocked';
```

**Índices**:

- `(organizationId, createdAt DESC)` — feed principal
- `(actorId, createdAt DESC)`
- `(targetType, targetId, createdAt DESC)`

**Reglas**:

- **Append-only**. Solo Cloud Functions pueden escribir (Admin SDK).
- Lectura: admin de la org o system-admin.

---

## 4. Esquema Zod compartido

Ubicación: `packages/shared/src/schemas/`.

```ts
// users.ts
export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(120).nullable(),
  photoURL: z.string().url().nullable(),
  role: z.enum(['admin', 'recruiter', 'expert']),
  organizationId: z.string().nullable(),
  status: z.enum(['active', 'invited', 'suspended']),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  deletedAt: z.date().nullable(),
});

export const createUserInputSchema = userSchema
  .pick({
    email: true,
    displayName: true,
    role: true,
    organizationId: true,
  })
  .extend({
    // campos derivados, no vienen en el input
    sendInviteEmail: z.boolean().default(true),
  });

export const updateUserInputSchema = z.object({
  uid: z.string(),
  displayName: z.string().min(1).max(120).nullable().optional(),
  photoURL: z.string().url().nullable().optional(),
  role: z.enum(['admin', 'recruiter', 'expert']).optional(),
  status: z.enum(['active', 'invited', 'suspended']).optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
```

```ts
// organizations.ts
export const organizationSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'pro', 'enterprise']),
  settings: z.object({
    timezone: z.string().default('UTC'),
    locale: z.string().default('en'),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  deletedAt: z.date().nullable(),
});

export const createOrganizationInputSchema = organizationSchema.pick({
  name: true,
  slug: true,
  plan: true,
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
```

```ts
// audit-logs.ts
export const auditLogSchema = z.object({
  logId: z.string(),
  organizationId: z.string().nullable(),
  actorId: z.string(),
  actorEmail: z.string().email(),
  action: z.string(), // ver enum en sección 3.3
  targetType: z.enum(['user', 'organization', 'system']),
  targetId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;
```

---

## 5. Mapeo snake_case (Firestore) ↔ camelCase (TS)

Decisión: el modelo público en TS es **camelCase** (consistente con JS). Firestore almacena **snake_case** (consistente con SQL/CSV/BI tools).

El mapeo se hace **dentro del repository**, en una sola capa:

```ts
// users/firebase.ts (extracto)
const toUser = (id: string, raw: UserRaw): User => ({
  uid: id,
  email: raw.email,
  displayName: raw.display_name ?? null,
  photoURL: raw.photo_url ?? null,
  role: raw.role,
  organizationId: raw.organization_id ?? null,
  status: raw.status,
  lastLoginAt: raw.last_login_at?.toDate() ?? null,
  createdAt: raw.created_at.toDate(),
  updatedAt: raw.updated_at.toDate(),
  createdBy: raw.created_by,
  deletedAt: raw.deleted_at?.toDate() ?? null,
});

const toFirestore = (u: User | CreateUserInput): UserRaw => ({
  email: u.email,
  display_name: u.displayName ?? null,
  // ...
});
```

> Esto se testea en `firebase.test.ts` con un roundtrip test (save → load → equal).

---

## 6. Versionado de esquema

Si un campo cambia de tipo o se elimina:

1. Crear `firestore.migrations/<version>.ts` con script de migración (usar Admin SDK).
2. Correr contra staging primero, verificar, luego prod.
3. Actualizar el schema Zod y el tipo TS en el mismo PR.
4. Documentar en `03-appendix/migration-log.md`.

**Nunca** se hace migración implícita. Toda migración es código revisado.

---

## 7. Multi-tenancy (futuro, no MVP)

El campo `organizationId` está previsto para cuando la app soporte múltiples tenants. En MVP puede ser `null` o apuntar a una única "default org" creada en bootstrap.

Cuando se active multi-tenancy:

- Toda query a `users` debe filtrar por `organizationId`.
- Las reglas de Firestore exigirán `request.auth.token.organizationId == resource.data.organizationId` para lectura/escritura.
- Un índice compuesto `(organizationId, ...)` debe existir por cada access pattern.

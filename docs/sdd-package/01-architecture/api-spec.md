# API Spec — Cloud Functions v1

> **Estado:** Approved (pending)
> **Base path:** `https://<region>-<project>.cloudfunctions.net`
> **Versión:** v1 (todas las rutas nuevas)
> **Formato:** callable HTTPS (Firebase) + REST opcional (decidido por SDD-06)

---

## 1. Principios

1. **Versionado en path**: `/v1/<recurso>/<acción>`. v1 es estable. Breaking changes → v2.
2. **Naming consistente**: `<verbo>` en presente para acciones (`createUser`), no `createNewUser` ni `addAUser`.
3. **Recursos en plural**: `users`, `organizations`, `reports`. Nunca `user`, `report`.
4. **Validación Zod obligatoria**: antes de cualquier lógica. Si falla, 400 con detalle.
5. **Auth + Custom Claims verificados en cada endpoint**: `onCallAuth('admin')` al inicio de cada handler.
6. **Errores tipados**: response de error con `{ code, message, details? }`. El cliente mapea a UI.

---

## 2. Convenciones de payload

### 2.1 Request

```ts
{
  data: { ... },       // payload específico
  context: {           // inyectado por el wrapper, no se manda
    auth: { uid, token },
    traceId: string,
  }
}
```

### 2.2 Response exitoso

```ts
{
  data: T;
} // T validado con Zod en salida también
```

### 2.3 Response de error (HttpsError tipado)

```ts
throw new HttpsError('not-found', 'User xyz not found', {
  code: 'USER_NOT_FOUND',
  details: { uid: 'xyz' },
});
```

### 2.4 Códigos de error usados

| HttpsError code       | HTTP equivalente | Cuándo                                        |
| --------------------- | ---------------- | --------------------------------------------- |
| `unauthenticated`     | 401              | JWT inválido, expirado o ausente              |
| `permission-denied`   | 403              | Custom Claims insuficientes                   |
| `not-found`           | 404              | Recurso no existe                             |
| `already-exists`      | 409              | Conflicto de unicidad                         |
| `invalid-argument`    | 400              | Zod validation failed                         |
| `failed-precondition` | 412              | Estado del recurso no permite la operación    |
| `internal`            | 500              | Error no esperado (siempre loggeado)          |
| `unavailable`         | 503              | Firestore/Storage temporalmente no disponible |

---

## 3. Endpoints — Catálogo inicial

### 3.1 Users

#### `v1_users_create` — Crear usuario

- **Auth**: requiere rol `admin`.
- **Side effects**: crea en Auth + Firestore, envía email de invitación (si `sendInviteEmail=true`), escribe `auditLogs`.

**Input** (`CreateUserInput`):

```ts
{
  email: string,                  // required, valid email
  displayName?: string,           // 1..120
  role: 'admin' | 'recruiter' | 'expert',
  organizationId?: string,
  sendInviteEmail?: boolean       // default true
}
```

**Output**: `User` (full doc).

**Errores específicos**:

- `already-exists` (email duplicado)
- `permission-denied` (rol del caller insuficiente)
- `invalid-argument` (Zod fail)
- `internal` (Auth o Firestore fallaron)

#### `v1_users_list` — Listar usuarios (paginado)

- **Auth**: requiere rol `admin` o `recruiter`.
- **Multi-tenant**: filtra por `organizationId` del caller si no es system-admin.

**Input**:

```ts
{
  organizationId?: string,        // si caller es system-admin
  status?: 'active' | 'invited' | 'suspended',
  role?: 'admin' | 'recruiter' | 'expert',
  page?: number,                  // 1-based, default 1
  pageSize?: number,              // default 20, max 100
  search?: string                 // match en email o displayName
}
```

**Output**:

```ts
{
  items: User[],
  page: number,
  pageSize: number,
  total: number,
  hasMore: boolean
}
```

#### `v1_users_update` — Actualizar usuario

- **Auth**: requiere rol `admin` para cambiar `role`/`status`. Usuarios pueden cambiar su propio `displayName`/`photoURL`.
- **Side effects**: si cambia `role`, escribe `auditLogs.user.role_changed`.

**Input** (`UpdateUserInput`):

```ts
{
  uid: string,
  displayName?: string | null,
  photoURL?: string | null,
  role?: 'admin' | 'recruiter' | 'expert',
  status?: 'active' | 'invited' | 'suspended'
}
```

**Output**: `User` actualizado.

#### `v1_users_delete` — Soft delete

- **Auth**: requiere rol `admin`.
- **Side effects**: marca `deletedAt`, suspende en Auth, escribe `auditLogs.user.deleted`.

**Input**: `{ uid: string }`
**Output**: `{ uid: string, deletedAt: Date }`

---

### 3.2 Reports

#### `v1_reports_generate` — Generar reporte bajo demanda

- **Auth**: requiere rol `admin`.
- **Descripción**: dispara un job que produce un reporte (ej. CSV de usuarios, o PDF de actividad). El endpoint encola y devuelve un jobId. El reporte final se notifica por otro canal (futuro: webhook, polling).

**Input**:

```ts
{
  type: 'users_csv' | 'audit_log_pdf',
  organizationId?: string,
  dateRange?: { from: string /* ISO */, to: string /* ISO */ }
}
```

**Output**:

```ts
{
  jobId: string,
  status: 'queued',
  estimatedSeconds: number
}
```

---

## 4. Wrapper helpers (contracts del SDD-06)

### 4.1 `onCallAuth(requiredRole?)`

```ts
export type AuthedContext = {
  uid: string;
  email: string;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId: string | null;
  traceId: string;
};

export function onCallAuth(
  requiredRole?: AuthedContext['role'] | AuthedContext['role'][],
): Promise<AuthedContext>;
```

Comportamiento:

- Si no hay `context.auth` → `unauthenticated`.
- Lee custom claims (`role`, `organizationId`).
- Si `requiredRole` y el rol no matchea → `permission-denied`.
- Genera `traceId` (uuid v4) y lo loguea.

### 4.2 `validateInput<T>(schema: ZodSchema<T>, data: unknown): T`

- `safeParse` el input.
- Si falla → `invalid-argument` con `details.issues = zodIssues`.
- Si pasa → retorna el valor parseado (con defaults aplicados, transformaciones, etc.).

### 4.3 `handleError(err: unknown): HttpsError`

- Si ya es `HttpsError` → re-throw.
- Si es `RepositoryError` → mapear a `HttpsError` según `code`.
- Otro → log + `internal`.

---

## 5. Headers de seguridad (Cloud Functions)

Todas las funciones HTTPS setean:

```ts
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}
```

> CSP estricta porque las respuestas son JSON, no HTML.

---

## 6. Modelo de autorización por endpoint (ortogonal)

A partir de [ADR-0006](./decisions/0006-role-naming-and-permissions.md), los roles `admin` / `recruiter` / `expert` no son jerárquicos. Cada endpoint declara **explícitamente** qué roles acepta. La matriz de capacidades completa está en `data-model.md` §3.1.1.

Resumen de endpoints v1 por rol aceptado:

| Endpoint                         | `admin` | `recruiter` |    `expert`    |
| -------------------------------- | :-----: | :---------: | :------------: |
| `v1_users_create`                |   ✅    |     ✅      |       ❌       |
| `v1_users_list`                  |   ✅    |     ✅      |       ✅       |
| `v1_users_update` (cambia role)  |   ✅    |     ❌      |       ❌       |
| `v1_users_update` (otros campos) |   ✅    |     ✅      | ❌ (solo self) |
| `v1_users_delete`                |   ✅    |     ❌      |       ❌       |
| `v1_reports_generate`            |   ✅    |     ❌      |       ❌       |

Cuando se agregue `v1_templates_*` (SDD futuro), la regla será: `expert` puede escribir, `recruiter` solo leer, `admin` todo.

---

## 7. Versionado y deprecación

- v1 es estable mientras exista.
- Para deprecar un endpoint:
  1. Marcarlo deprecated en el header `Deprecation: true` + `Sunset: <fecha>`.
  2. Loggear warning cada vez que se llama.
  3. Comunicar a consumidores con 90 días de anticipación.
  4. Después de la fecha, retornar `failed-precondition` con mensaje claro.

---

## 8. Rate limiting (futuro)

Implementado vía Cloud Armor / Firebase App Check cuando el tráfico lo justifique. **No en MVP**. Mencionado en el SDD-06 como non-goal.

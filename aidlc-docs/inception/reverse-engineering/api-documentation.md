# API Documentation

## Estado actual

No hay endpoints implementados en codigo. La pagina `/login` referenciada por middleware no existe. Las APIs documentadas abajo provienen de `doc/sdd-package/01-architecture/api-spec.md` (especificacion planificada).

## Next.js Routes (implementadas)

### Home

- **Method**: GET
- **Path**: `/`
- **Purpose**: Landing page publica
- **Response**: HTML estatico "Admin Platform"

### Admin Dashboard

- **Method**: GET
- **Path**: `/admin`
- **Purpose**: Dashboard administrativo (placeholder)
- **Auth**: Cookie `__session` requerida (middleware)
- **Response**: HTML con layout Sidebar + Header

### Admin Sub-routes (navegacion definida, rutas no implementadas)

- `/admin/users` — Referenciada en NAV_ITEMS, pagina no existe
- `/admin/settings` — Referenciada en NAV_ITEMS, pagina no existe

### Login (referenciada, no implementada)

- **Method**: GET
- **Path**: `/login?next=<path>`
- **Purpose**: Redirect target del middleware cuando no hay sesion

## Middleware

### Admin Route Guard

- **Matcher**: `/admin/:path*`
- **Logic**: Si no hay cookie `__session`, redirect 302 a `/login?next=<pathname>`
- **Implementation**: `apps/web/middleware.ts`

## Cloud Functions — REST/Callable (planificadas SDD-06)

Base path: `https://<region>-<project>.cloudfunctions.net`

### v1_users_create

- **Method**: Callable HTTPS
- **Path**: `v1_users_create`
- **Purpose**: Crear usuario en Auth + Firestore
- **Auth**: Rol `admin`
- **Request**: `{ email, displayName?, role, organizationId?, sendInviteEmail? }`
- **Response**: `User` document
- **Errors**: `already-exists`, `permission-denied`, `invalid-argument`, `internal`

### v1_users_list

- **Method**: Callable HTTPS
- **Path**: `v1_users_list`
- **Purpose**: Listar usuarios paginado
- **Auth**: Rol `admin` o `recruiter`
- **Request**: `{ pageSize?, cursor?, filters? }`
- **Response**: `{ items: User[], nextCursor? }`

### v1_reports_generate

- **Method**: Callable HTTPS
- **Path**: `v1_reports_generate`
- **Purpose**: Generar reporte de evaluacion
- **Auth**: Rol `admin` o `recruiter`

## Internal APIs (planificadas)

### UserRepository

- **Methods**: `findById`, `findByEmail`, `create`, `update`, `softDelete`, `list`
- **Parameters**: Tipados via Zod schemas en `packages/shared`
- **Return Types**: `User`, `PaginatedResult<User>`, `RepositoryError`

### OrganizationRepository

- **Methods**: `findById`, `findBySlug`, `create`, `update`, `list`
- **Return Types**: `Organization`, `PaginatedResult<Organization>`

### AuditLogRepository

- **Methods**: `append`, `listByOrganization`, `listByActor`
- **Return Types**: `AuditLog`, `PaginatedResult<AuditLog>`

## Data Models

### User (planificado — Firestore `users/{uid}`)

- **Fields**: email, displayName, photoURL, role, organizationId, status, lastLoginAt, createdAt, updatedAt, createdBy, deletedAt
- **Relationships**: Pertenece a Organization (opcional)
- **Validation**: Zod schema en `packages/shared` (pendiente)

### Organization (planificado)

- **Fields**: name, slug, plan, settings, createdAt, updatedAt, createdBy, deletedAt
- **Relationships**: Tiene muchos Users y AuditLogs

### Role (implementado parcialmente)

- **Fields**: `'admin' | 'recruiter' | 'expert'`
- **Location**: `apps/web/config/constants.ts`
- **Validation**: Const array ROLES

### NavItem (implementado)

- **Fields**: href, label, icon (LucideIcon)
- **Location**: `apps/web/config/constants.ts`

### UiState (implementado)

- **Fields**: sidebarCollapsed, toggleSidebar
- **Location**: `apps/web/stores/ui-store.ts`

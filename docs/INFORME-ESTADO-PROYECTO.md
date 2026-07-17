# Informe del estado actual del proyecto

**Proyecto:** `evaluadorIA` / `admin-platform`  
**Fecha de revisión:** 16 de julio de 2026  
**Rama:** `main`  
**Commit revisado:** `0a9cbe4` — `feat(aidlc): apply SDD-ALL compliance audit remediation`

## 1. Resumen ejecutivo

El proyecto es un monorepo `pnpm` compuesto por un frontend Next.js, un backend basado en Firebase Cloud Functions y un paquete compartido de esquemas y tipos.

La base técnica está bien estructurada: TypeScript estricto, separación por capas, Firebase Auth/Firestore/Storage, autorización por roles, validación con Zod, repositorios desacoplados, pruebas automatizadas, CI/CD y documentación extensa.

El estado actual puede describirse como **MVP técnico funcional para desarrollo local y demostraciones**, pero todavía no como una versión completamente preparada para producción. Las principales razones son:

1. Inconsistencia entre colecciones y campos de auditoría.
2. Invitaciones de usuarios sin flujo real de correo o recuperación de contraseña.
3. Configuración global sin persistencia.
4. Generación de reportes implementada únicamente como stub.
5. Cobertura baja para rutas y módulos críticos.
6. Integración con emuladores no validada durante esta revisión porque estaban detenidos.
7. Configuración operativa incompleta: sin remoto Git, sin tags y con scripts raíz pendientes.

La documentación AI-DLC declara un nivel de cumplimiento cercano al 99% después de la remediación, pero ese porcentaje representa el cumplimiento de los SDD y no equivale por sí mismo a que todas las funcionalidades estén listas para producción.

## 2. Validaciones ejecutadas

Los siguientes comandos fueron ejecutados sobre el estado actual del repositorio:

| Validación                       | Resultado                                                    |
| -------------------------------- | ------------------------------------------------------------ |
| `pnpm lint`                      | Correcto, sin errores ni warnings bloqueantes                |
| `pnpm typecheck`                 | Correcto en `apps/web`, `apps/functions` y `packages/shared` |
| `pnpm test`                      | 104 pruebas correctas y 1 omitida                            |
| `pnpm build`                     | Correcto                                                     |
| `pnpm format:check`              | Correcto                                                     |
| `pnpm test:coverage`             | Correcto, con 27.47% de cobertura de statements              |
| `pnpm --filter web bundle:check` | Correcto, dentro de los límites configurados                 |
| `pnpm emulators:status`          | Todos los emuladores estaban detenidos                       |

La build de Next.js se completó con **Next.js 14.2.35**, generando 11 rutas. El paquete de Cloud Functions y el paquete compartido también compilaron correctamente.

La cobertura obtenida fue:

- Statements: 27.47%.
- Branches: 73.79%.
- Functions: 47.48%.
- Lines: 27.47%.

El umbral configurado en `vitest.config.ts` está en cero, por lo que la CI no falla aunque la cobertura disminuya.

## 3. Arquitectura y tecnologías

### 3.1. Estructura del monorepo

```text
apps/web          Frontend Next.js 14 con App Router
apps/functions    Cloud Functions v2
packages/shared   Esquemas Zod y tipos compartidos
scripts/          Emuladores, seed y verificaciones de integración
docs/             Documentación operativa
doc/              SDDs, arquitectura y especificaciones
aidlc-docs/       Estado y auditoría del proceso AI-DLC
```

### 3.2. Stack principal

- TypeScript 5.6 con configuración estricta.
- Next.js 14.2 con App Router.
- React 18.
- Firebase Auth.
- Cloud Firestore.
- Firebase Storage.
- Firebase Cloud Functions v2.
- Zod para validación.
- `jose` para JWT HS256.
- TanStack Query.
- TanStack Table.
- Zustand.
- Tailwind CSS.
- Radix UI y componentes estilo shadcn.
- Vitest y Testing Library.
- ESLint y Prettier.
- Husky y Commitlint.
- GitHub Actions para CI/CD.

### 3.3. Flujo general

```text
Frontend / Server Components
        ↓
Next.js API Routes
        ↓
Cloud Functions
        ↓
Firebase Admin SDK / Repositorios
        ↓
Firestore / Auth / Storage
```

### 3.4. Fortalezas arquitectónicas

- Separación clara entre frontend, backend y contratos compartidos.
- Repositorios con implementaciones `memory` y `firebase`.
- Validación de entradas con Zod.
- Control de roles mediante custom claims.
- Soft delete para usuarios y organizaciones.
- Reglas Firestore con denegación por defecto.
- Reglas de Storage con denegación por defecto.
- Headers básicos de seguridad.
- Configuración de emuladores locales.
- Workflows separados para CI, staging, producción y releases.

### 3.5. Debilidades arquitectónicas

- Las Cloud Functions acceden directamente a Firestore en varios puntos, sin reutilizar consistentemente los repositorios.
- La validación de la cookie JWT está duplicada en varias capas.
- El modelo snake_case/camelCase no está alineado entre reglas, repositorios y funciones.
- El repositorio de organizaciones existe, pero no tiene consumidores activos relevantes en la aplicación web.
- Algunas decisiones documentadas y algunos nombres de archivos no coinciden con el código actual.

## 4. Funcionalidades implementadas

### 4.1. Autenticación

Implementado:

- Registro por email y contraseña.
- Promoción del primer usuario a `admin`.
- Inicio de sesión mediante Firebase Auth.
- Cookie de sesión `__session`.
- JWT HS256 firmado mediante `SESSION_COOKIE_SECRET`.
- Middleware de protección para `/admin/**`.
- Logout y eliminación de cookie.
- Validación de roles mediante custom claims.
- Fallback para validar sesión mediante cookie en Cloud Functions.

Archivos principales:

- `apps/web/middleware.ts:31-80`
- `apps/web/features/auth/api/auth-api.ts`
- `apps/functions/src/v1/auth/sign-up.ts`
- `apps/functions/src/v1/auth/create-session.ts`
- `apps/functions/src/shared/verify-session-cookie.ts`

No implementado o pendiente:

- Login con Google.
- Recuperación de contraseña.
- Verificación obligatoria de email.
- Flujo completo de invitación por correo.

### 4.2. Dashboard

Implementado:

- Estadísticas de usuarios.
- Conteos de usuarios activos, invitados y suspendidos.
- Actividad reciente.
- Layout administrativo con sidebar y header.
- Navegación según rol.

Riesgo funcional: ante ciertos errores de Firestore, el dashboard puede devolver ceros o una lista vacía en lugar de mostrar un error explícito. Esto puede hacer que un fallo de infraestructura parezca que no existen usuarios o actividad.

Archivo relevante:

- `apps/web/features/dashboard/api/dashboard-api.ts`

### 4.3. Gestión de usuarios

Implementado:

- Listado paginado.
- Filtros por estado, rol y texto de búsqueda.
- Creación de usuarios.
- Edición de usuarios.
- Eliminación lógica.
- Actualización de roles.
- Badges de rol y estado.
- Mutaciones con TanStack Query.
- Proxies same-origin mediante rutas API de Next.js.

Archivos principales:

- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/api/users/route.ts`
- `apps/web/app/api/users/list/route.ts`
- `apps/web/app/api/users/[uid]/route.ts`
- `apps/functions/src/v1/users/`

La autorización final se realiza en Cloud Functions, pero algunas rutas API de Next.js solo comprueban autenticación y delegan completamente el rol al backend. Es funcional, aunque convendría aplicar una política de autorización explícita también en la capa de rutas API.

### 4.4. Configuración global

La pantalla de configuración está visualmente desarrollada, pero no tiene persistencia real.

En `apps/web/features/settings/components/global-settings-view.tsx:120-122`, la función `save()` únicamente ejecuta:

```ts
setDirty(false);
```

No existe actualmente:

- Endpoint de guardado.
- Cloud Function para configuración.
- Repositorio de settings.
- Persistencia en Firestore.
- Carga de valores previamente guardados.

Otros componentes con funcionalidad limitada:

- `profile-form.tsx`: muestra un toast indicando actualización, pero es un mock.
- `billing-card.tsx`: contiene información estática.
- `team-list.tsx`: existe, pero no está integrado claramente con la página de settings.

### 4.5. Generación de reportes

`v1ReportsGenerate` está implementado como stub en:

`apps/functions/src/v1/reports/generate-report.ts:28-46`

Actualmente:

- Valida la entrada.
- Genera un UUID.
- Devuelve estado `queued`.
- Devuelve una estimación fija de 30 segundos.

No existe todavía:

- Cola de trabajos.
- Persistencia del job.
- Worker.
- Generación real de CSV.
- Generación real de PDF.
- Consulta de estado.
- Descarga del resultado.

### 4.6. Invitaciones

En `apps/functions/src/v1/users/create-user.ts:83-85`, la opción `sendInviteEmail` no realiza ninguna operación:

```ts
// TODO SDD-08: integrar servicio de email con magic link / reset password
```

El usuario se crea en Firebase Auth y Firestore, pero no recibe una contraseña ni un enlace funcional para establecerla. El script de integración utiliza un workaround para asignar una contraseña temporal, lo que confirma que el flujo productivo está incompleto.

## 5. Hallazgo crítico: inconsistencias en auditoría

Este es el principal problema técnico detectado.

### 5.1. Cloud Functions

`apps/functions/src/shared/audit.ts:20-34` escribe en la colección:

```text
audit_logs
```

con campos camelCase:

```text
organizationId
actorId
actorEmail
targetType
targetId
createdAt
```

### 5.2. Repositorio web

`apps/web/repositories/audit-logs/firebase.ts:29` utiliza la colección:

```text
auditLogs
```

y realiza consultas utilizando campos snake_case:

```text
organization_id
actor_id
target_type
target_id
created_at
```

### 5.3. Reglas Firestore

`firestore.rules:81-87` también protege la colección:

```text
auditLogs
```

### 5.4. Impacto

El Admin SDK puede escribir aunque las reglas Firestore bloqueen las escrituras de cliente, por lo que el problema principal no es necesariamente que la Cloud Function falle al escribir.

El problema es que:

- Las funciones escriben en `audit_logs`.
- El dashboard consulta `auditLogs`.
- Las funciones escriben campos camelCase.
- El repositorio consulta campos snake_case.
- Las reglas e índices están definidos para otra combinación.

El resultado probable es que los eventos se almacenen en una colección que el dashboard no consulta y la actividad reciente aparezca vacía.

### 5.5. Corrección recomendada

Elegir una única convención para:

- Nombre de colección.
- Nombre de campos.
- Reglas Firestore.
- Índices.
- Repositorios.
- Cloud Functions.
- Scripts de integración.
- Tests de contrato.

La corrección debe acompañarse con una prueba de integración que verifique que:

1. Una Cloud Function crea un audit log.
2. El repositorio puede listar el registro.
3. El dashboard recibe el registro.
4. El cliente no puede modificarlo.

## 6. Otras inconsistencias de datos

Existe un problema similar con los usuarios:

- Las reglas esperan `createdAt` en `firestore.rules:37-40`.
- Las Cloud Functions guardan `created_at` en `apps/functions/src/v1/users/create-user.ts:55-71`.
- Los repositorios utilizan snake_case.
- Los índices contienen referencias camelCase.

Como las Cloud Functions utilizan Admin SDK, pueden saltarse las reglas. Esto hace que el backend parezca funcionar, pero deja un contrato inconsistente para accesos directos desde cliente o futuras funciones.

Además, `organizationId` es opcional al crear usuarios y puede persistirse como `null` en `create-user.ts:64`. Esto puede afectar filtros, permisos y visualización por equipo.

## 7. Calidad y cobertura de pruebas

### 7.1. Cobertura global

La cobertura actual es:

- Statements: 27.47%.
- Branches: 73.79%.
- Functions: 47.48%.
- Lines: 27.47%.

### 7.2. Áreas bien cubiertas

- Esquemas compartidos.
- Repositorios en memoria.
- Mappers.
- Validación de inputs.
- Manejo de errores.
- Utilidades de autenticación.
- Utilidades de sesión.

### 7.3. Áreas con cobertura insuficiente

- `apps/web/middleware.ts`.
- Rutas API de Next.js.
- Componentes principales de usuarios.
- Hooks de usuarios.
- Repositorios Firebase reales.
- Firebase Admin.
- Cloud Functions completas.
- Dashboard.
- Settings.
- Componentes UI principales.

La prueba de Firebase users está omitida explícitamente en:

`apps/web/repositories/users/__tests__/firebase.test.ts`

Las pruebas de Cloud Functions para usuarios son principalmente smoke tests que comprueban que los handlers estén definidos, pero no prueban su lógica completa con Firebase o Firestore.

## 8. Seguridad

### 8.1. Medidas positivas

- Firestore con denegación por defecto.
- Storage con denegación por defecto.
- Roles mediante custom claims.
- Cookie HttpOnly.
- JWT firmado.
- Validación de inputs con Zod.
- CORS configurado.
- Control de acceso en Cloud Functions.
- Soft delete.
- No se detectaron secretos productivos visibles en el repositorio.

### 8.2. Riesgos o pendientes

1. **CSP no implementada**: `SECURITY.md:189` y `SECURITY.md:257` la mantienen como pendiente.
2. **Rate limiting no implementado**: `SECURITY.md:194` y `SECURITY.md:256`.
3. **Secreto de desarrollo hardcodeado**: `apps/web/lib/env-dev-defaults.ts:23` y `scripts/emulators.sh:23` comparten un secreto fijo.
4. **Flag `Secure` dependiente de `NODE_ENV`**: `apps/functions/src/v1/auth/create-session.ts` solo agrega `Secure` cuando `NODE_ENV === 'production'`.
5. **CORS con fallback permisivo**: debe revisarse el comportamiento cuando `ALLOWED_ORIGINS` está vacío o incorrectamente configurado.
6. **Documentación de seguridad incompleta**: `SECURITY.md:33` y `SECURITY.md:242` todavía contienen `<security-team-email>`.
7. **Referencias obsoletas**: algunos archivos mencionados en la documentación no coinciden con la estructura actual.

## 9. CI/CD y operación

La infraestructura de CI/CD está definida mediante GitHub Actions:

- CI para lint, typecheck, test, build y bundle size.
- Deploy de staging.
- Deploy de producción manual.
- Release Please.
- Dependabot.
- Codecov opcional.
- Environment de producción con aprobación manual.

### 9.1. Scripts raíz incompletos

En `package.json:10`:

```json
"dev": "echo 'dev script por SDD-02/03' && exit 1"
```

En `package.json:29-30`:

```json
"deploy:staging": "echo 'deploy por SDD-08' && exit 1"
"deploy:prod": "echo 'deploy por SDD-08' && exit 1"
```

Los workflows reemplazan parcialmente estas funciones, pero los comandos locales no funcionan como se esperaría.

### 9.2. Versiones de Node inconsistentes

- `.nvmrc` fija Node 20.
- El root declara Node `>=20`.
- `apps/functions` requiere Node 22.
- CI utiliza Node 20 según la configuración inspeccionada.

Conviene unificar la versión para evitar diferencias entre desarrollo, CI y despliegue.

### 9.3. Release Please

`.github/release-please-config.json:33` referencia:

```text
bootstrap-sha: ac2ed9a
```

Ese SHA no aparece en el historial actual inspeccionado. El primer workflow de release puede fallar o necesitar corrección.

### 9.4. Estado de Git

- Rama actual: `main`.
- Working tree limpio.
- Sin remotos configurados.
- Sin tags.
- Un stash existente: `stash@{0}`.
- Los commits visibles fueron generados por `AI-DLC Bot`.

El proyecto actualmente no tiene un remoto configurado para publicar cambios o ejecutar un flujo colaborativo normal.

También existen directorios de exportación de Firebase no cubiertos por `.gitignore`:

```text
firebase-export-*
```

Conviene ignorarlos antes de utilizar `git add -A`, porque pueden contener datos de prueba de los emuladores.

## 10. Documentación

La documentación es uno de los puntos fuertes del proyecto:

- `README.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `DEPLOY.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `docs/CI-CD.md`
- Paquete completo de SDDs.
- Documentación AI-DLC.
- Diagramas Mermaid.
- ADRs y modelos de datos.

No obstante, hay divergencias entre documentación y código:

- Se declara un nivel de cumplimiento cercano al 99%, pero aún existen funcionalidades críticas incompletas.
- La documentación o interfaz menciona Next.js 15, mientras que el proyecto usa Next.js 14.2.35.
- Los archivos y nombres de colecciones no son consistentes.
- Algunas referencias de líneas y rutas en `SECURITY.md` ya no coinciden.
- Se menciona integración con Google que no está implementada.
- Se describen settings por tabs, pero la implementación actual utiliza una vista global monolítica.

La documentación describe correctamente la intención arquitectónica, pero necesita una actualización contra el código ejecutable actual.

## 11. Evaluación por área

| Área                        | Estado                                          |
| --------------------------- | ----------------------------------------------- |
| Arquitectura base           | Bueno                                           |
| Frontend administrativo     | Parcialmente completo                           |
| Autenticación               | Funcional; integración pendiente de validar     |
| Gestión de usuarios         | Funcional con limitaciones                      |
| Dashboard                   | Funcional, afectado por auditoría               |
| Settings                    | Principalmente visual                           |
| Reportes                    | Stub                                            |
| Invitaciones                | Incompleto                                      |
| Persistencia                | Parcialmente funcional                          |
| Seguridad base              | Buena                                           |
| Seguridad avanzada          | Pendiente                                       |
| Tests unitarios             | Aceptables en utilidades                        |
| Tests de integración        | No validados en esta revisión                   |
| Cobertura                   | Baja                                            |
| Build y lint                | Correctos                                       |
| CI/CD                       | Definido, con configuración operativa pendiente |
| Documentación               | Amplia, aunque parcialmente desactualizada      |
| Preparación para producción | No recomendada todavía                          |

## 12. Plan de acción recomendado

### Prioridad crítica

1. Unificar `audit_logs`/`auditLogs` y snake_case/camelCase.
2. Añadir pruebas de integración para auditoría, usuarios y autorización.
3. Ejecutar `verify:auth` y `verify:rules` con emuladores activos.
4. Confirmar que el dashboard muestra los audit logs generados por Cloud Functions.

### Prioridad alta

5. Implementar el email de invitación y reset de contraseña.
6. Definir persistencia real para la configuración global.
7. Implementar o deshabilitar explícitamente la generación de reportes.
8. Alinear Node 20/22 entre `.nvmrc`, CI y Cloud Functions.
9. Revisar `Secure`, CORS y validación de entorno en staging.
10. Añadir pruebas para middleware, API routes y Cloud Functions.

### Prioridad media

11. Subir el umbral mínimo de cobertura desde cero.
12. Completar o corregir `profile`, `team` y `billing`.
13. Integrar CSP y rate limiting.
14. Corregir placeholders de seguridad y conducta.
15. Corregir el `bootstrap-sha` de Release Please.
16. Ignorar los exports de Firebase.
17. Configurar remoto Git, tags y protección de rama.

## Conclusión

El proyecto tiene una base técnica sólida y actualmente pasa lint, typecheck, pruebas, build y formato. Es apto para demostración local y para continuar en staging controlado, pero no está completamente listo para producción.

El bloqueo más importante es la inconsistencia del sistema de auditoría, seguida por las invitaciones sin email, los settings sin persistencia, los reportes simulados y la falta de pruebas de integración ejecutadas. La corrección de esos puntos elevaría el proyecto de un MVP técnico visualmente avanzado a una aplicación operativamente confiable.

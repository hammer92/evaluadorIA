# ADR 0006 — Role naming & modelo de permisos ortogonal

> **Estado:** Proposed
> **Fecha:** 2026-06-25
> **Decisión:** renombrar roles a `admin` / `recruiter` / `expert` y pasar de jerarquía simple a **modelo ortogonal con permisos explícitos por dominio**.
> **Supersede:** definición original de roles en `data-model.md` (líneas sobre `role: 'admin' | 'recruiter' | 'expert'`).

---

## Contexto

El master plan original definía 3 roles con naming genérico:

- `admin` — full
- `recruiter` — podía editar contenido
- `expert` — solo lectura

Esto tiene dos problemas:

1. **Naming genérico no refleja las personas reales del proyecto**:
   - El equipo de RRHH no se llama a sí mismo "recruiter". Son **recruiters**.
   - El SME técnico que crea/edita los templates y recetas del Agente Generador no es un "expert" — está activamente construyendo las pruebas. Es un **expert**.

2. **Jerarquía simple (admin > recruiter > expert) no modela bien la realidad**:
   - Un recruiter no necesita poder editar technical tests.
   - Un expert no necesita poder invitar candidatos.
   - Estos son **dominios ortogonales** con capacidades específicas en cada uno.

El stakeholder del proyecto recomienda explícitamente:

- `admin` → permisos totales
- `recruiter` → gestión de candidatos
- `expert` → edición de pruebas técnicas

---

## Decisión

### Naming

| Antes       | Después              | Persona                       |
| ----------- | -------------------- | ----------------------------- |
| `admin`     | `admin` (sin cambio) | RRHH Lead / System Owner      |
| `recruiter` | `recruiter`          | RRHH / Reclutador             |
| `expert`    | `expert`             | Subject Matter Expert técnico |

### Modelo de permisos

**Ortogonal por dominio**. No hay jerarquía implícita. Cada rol declara explícitamente qué puede hacer en cada área. `admin` es superusuario (puede todo), pero `recruiter` y `expert` tienen permisos disjuntos en su dominio principal y acceso de solo lectura en el otro.

#### Matriz de capacidades

| Capacidad                          |  `admin`  |      `recruiter`       |        `expert`        |
| ---------------------------------- | :-------: | :--------------------: | :--------------------: |
| **Usuarios**                       |           |                        |                        |
| Crear/editar/eliminar usuarios     |    ✅     |           ✅           |   ❌ (solo lectura)    |
| Cambiar roles de otros users       |    ✅     |           ❌           |           ❌           |
| Ver lista de usuarios              |    ✅     |           ✅           |           ✅           |
| **Candidatos / Evaluación**        |           |                        |                        |
| Invitar candidato                  |    ✅     |           ✅           |           ❌           |
| Asignar template a candidato       |    ✅     |           ✅           |       ❌ (read)        |
| Ver resultados / reportes          |    ✅     |           ✅           |           ✅           |
| Cancelar / resetear evaluación     |    ✅     |           ✅           |           ❌           |
| **Pruebas técnicas (templates)**   |           |                        |                        |
| Crear / editar / archivar template |    ✅     |   ❌ (solo lectura)    |           ✅           |
| Editar competencias y recetas      |    ✅     |           ❌           |           ✅           |
| Crear / editar question bank       |    ✅     |           ❌           |           ✅           |
| Aprobar template antes de uso      |    ✅     |           ❌           |           ✅           |
| **Organización**                   |           |                        |                        |
| Editar settings de la org          |    ✅     |           ❌           |           ❌           |
| Gestionar billing / plan           |    ✅     |           ❌           |           ❌           |
| **Auditoría**                      |           |                        |                        |
| Ver audit logs                     |    ✅     | ✅ (filtrado a su org) | ✅ (filtrado a su org) |
| Escribir audit logs                | ✅ (auto) |       ✅ (auto)        |       ✅ (auto)        |

#### Defaults

- **SignUp público**: se crea con `role: 'recruiter'` por default. Decisión que el admin puede cambiar después.
  - **Rationale**: la mayoría de usuarios que se registran son RRHH. Si es un expert técnico, el admin lo cambia.
  - Alternativa considerada: pedir el rol en signup. **Descartada** para MVP (más fricción).

---

## Consecuencias

### Positivas

- **Naming alineado con personas reales** — el equipo se identifica con su rol.
- **Permisos explícitos y auditables** — la matriz es la spec, no la implementación.
- **Mejor seguridad por default** — recruiter no puede romper templates por accidente.
- **Escala a futuro** — agregar `auditor` (solo lectura de audit logs) o `billing_manager` es agregar una columna a la matriz, no cambiar el modelo.

### Negativas

- **Más checks en código y reglas** — en vez de "role >= recruiter", ahora cada acción declara qué roles puede hacerla.
- **Naming rompe con docs/tickets previos** — pero estamos en Draft, todavía no hay prod.
- **SignUp con default `recruiter`** puede requerir cambio manual para los primeros experts — operacional, no técnico.

### Mitigaciones

- **Helper `hasRole(...)` en Firestore rules + `requireRole(...)` server-side** permiten chequeos legibles.
- **Constante `ROLES = ['admin', 'recruiter', 'expert']`** en `packages/shared` como single source of truth.
- **CHANGELOG** documenta el rename como breaking change pre-prod.

---

## Implementación (touches a aplicar)

### Archivos a modificar

| Archivo                                                   | Cambio                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/shared/src/schemas/common.ts`                   | `roleSchema = z.enum(['admin', 'recruiter', 'expert'])`                   |
| `packages/shared/src/schemas/users.ts`                    | Actualizar `userSchema`, `createUserInputSchema`, `updateUserInputSchema` |
| `01-architecture/data-model.md`                           | Documentar el role enum + matriz de permisos                              |
| `01-architecture/api-spec.md`                             | Actualizar todos los `role:` literals                                     |
| `01-architecture/coding-conventions.md`                   | Actualizar ejemplos                                                       |
| `01-architecture/decisions/0004-zod-shared-validation.md` | Actualizar ejemplos de schema                                             |
| `02-sdds/SDD-02-frontend-foundation.md`                   | `ROLES = ['admin', 'recruiter', 'expert']`                                |
| `02-sdds/SDD-03-firebase-setup.md`                        | Seed users (u_admin, u_recruiter, u_expert) + reglas Firestore            |
| `02-sdds/SDD-04-repository-layer.md`                      | Schema, tests contractuales, mapper                                       |
| `02-sdds/SDD-05-auth-authorization.md`                    | `useAuth` claims, `verifyAuth` default, tests                             |
| `02-sdds/SDD-06-cloud-functions.md`                       | `buildAuthContext` whitelist, tests, examples                             |
| `02-sdds/SDD-07-admin-ui.md`                              | `<select>` de roles en user form, `RoleBadge`                             |
| `03-appendix/acceptance-checklist.md`                     | Renombrar tests que decían "expert"                                       |
| `03-appendix/glossary.md`                                 | Definir `recruiter` y `expert`                                            |

### Cambios específicos por sección

#### `firestore.rules` (SDD-03)

```diff
- allow read: if isSignedIn() && (isSelf(uid) || hasRole('admin') || hasRole('recruiter'));
+ allow read: if isSignedIn() && (isSelf(uid) || hasAnyRole(['admin', 'recruiter']));

- allow create: if isSignedIn() && hasRole('admin') ...
+ allow create: if isSignedIn() && hasAnyRole(['admin', 'recruiter']) ...

- allow list: if isSignedIn() && (hasRole('admin') || hasRole('recruiter'));
+ allow list: if isSignedIn() && hasAnyRole(['admin', 'recruiter']);
```

#### Helper nuevo en reglas

```js
function hasAnyRole(roles) {
  return request.auth.token.role in roles;
}
```

> Esto permite checks legibles: `hasAnyRole(['admin', 'recruiter'])` en vez de `hasRole('admin') || hasRole('recruiter')`.

#### Cloud Functions `buildAuthContext`

```ts
// antes
if (!role || !['admin', 'recruiter', 'expert'].includes(role)) {

// después
if (!role || !['admin', 'recruiter', 'expert'].includes(role)) {
```

Y los endpoints que aceptaban `['admin', 'recruiter']` ahora aceptan `['admin', 'recruiter']` o `['admin', 'expert']` según el dominio.

#### UI Admin — user form

```diff
- <option value="expert">Viewer</option>
- <option value="recruiter">Editor</option>
+ <option value="expert">Expert</option>
+ <option value="recruiter">Recruiter</option>
```

#### Componente `RoleBadge`

```tsx
const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  expert: 'Expert',
};
```

### Migración

**No aplica** — el proyecto está en Draft, no hay datos en prod. Los seed users cambian de nombre (`u_admin`, `u_recruiter`, `u_expert`) sin pérdida.

---

## Riesgos

| Riesgo                                             | Mitigación                                    |
| -------------------------------------------------- | --------------------------------------------- |
| Rompe auth de usuarios ya creados en emulador      | Seed script es idempotente y reset-friendly   |
| Lógica de "expert" en código legacy                | Proyecto en Draft, no hay legacy. Riesgo = 0. |
| Empresa que se opondría al rename (cliente piloto) | N/A en esta fase                              |
| Tests viejos no se actualizan                      | Hacer el rename atómico con grep+verify.      |

---

## Métricas de éxito

- [ ] `grep -rn "recruiter\|expert" sdd-package/` retorna 0 hits en roles (puede haber "audit log explorer" como componente UI, OK).
- [ ] Todos los tests de Firestore rules pasan con los nuevos roles.
- [ ] Un dev nuevo lee el ADR y entiende qué puede hacer cada rol sin abrir el código.

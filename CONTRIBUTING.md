# Contributing

Gracias por contribuir. Este documento cubre el flujo de branching, los
tipos de commits, el checklist de PR y las convenciones del proyecto.

> **Onboarding rápido** (5 min): [`README.md`](./README.md) §Setup local.
> **Reglas de arquitectura** (qué capa toca Firebase): [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2.

---

## Tabla de contenidos

- [Branching](#branching)
- [Setup local](#setup-local)
- [Convenciones de código](#convenciones-de-código)
- [Commits (Conventional Commits)](#commits-conventional-commits)
- [Tests](#tests)
- [Pull Requests](#pull-requests)
- [Scope / SDD workflow](#scope--sdd-workflow)
- [Reportar bugs](#reportar-bugs)

---

## Branching

Estrategia **trunk-based** con ramas cortas:

| Rama               | Vida       | Base   | Merge a          |
| ------------------ | ---------- | ------ | ---------------- |
| `main`             | permanente | —      | —                |
| `feat/<scope>-…`   | < 7 días   | `main` | `main` (PR)      |
| `fix/<scope>-…`    | < 3 días   | `main` | `main` (PR)      |
| `chore/<scope>-…`  | < 7 días   | `main` | `main` (PR)      |
| `docs/<scope>-…`   | < 3 días   | `main` | `main` (PR)      |
| `hotfix/<scope>-…` | inmediato  | `main` | `main` (PR fast) |

**Reglas**:

- **No** commitear directo a `main` (excepto el dueño del repo en commits
  revert/bump triviales).
- Ramas se renombran al rebasear: `git branch -m feat/users-list main`.
- Borrar la rama local después del merge (`git fetch -p`).
- **Nunca** hacer `push --force` a `main`.

Para trabajo experimental: prefix `spike/<topic>` (sin PR, sin merge; se
borra después).

### Configuración recomendada (una sola vez)

```bash
git config --global user.name  "Tu Nombre"
git config --global user.email "tu@email.com"
git config --global pull.rebase true
git config --global core.autocrlf input     # linux/mac; en Windows: true
git config --global core.editor "code --wait"
```

---

## Setup local

Prereqs: **Node ≥ 20**, **pnpm ≥ 9**, **Java JRE ≥ 11** (Firebase emulators).

```bash
git clone <repo-url>
cd evaluadorIA
pnpm install
cp .env.example .env.local          # editar NEXT_PUBLIC_FIREBASE_*

# Emuladores (auth + firestore + functions + storage + UI)
pnpm emulators:detach               # background; ver scripts/emulators.sh

# Sembrar datos (1 org + 3 users)
pnpm seed:emulators

# Levantar web
pnpm --filter web dev               # http://localhost:3000
```

**Verificación end-to-end** (debe pasar antes de pedir review):

```bash
pnpm typecheck       # tsc strict en 3 paquetes
pnpm lint            # ESLint --max-warnings 0
pnpm test            # Vitest 94/94 + 1 skipped
pnpm build           # Next.js + shared + functions
pnpm verify:auth     # 11/11 contra emuladores (si toca auth/CF)
```

Detalle por entorno y troubleshooting: [`DEPLOY.md`](./DEPLOY.md) y
[`docs/CI-CD.md`](./docs/CI-CD.md).

---

## Convenciones de código

### TypeScript

- **Strict mode** activo en `tsconfig.base.json`
  (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes` cuando se pueda).
- **Sin `any`**. Usar `unknown` + type-guard o tipo inferido.
- Tipos de retorno explícitos en funciones públicas (no en helpers internos).
- Interfaces para objetos públicos, types para unions/intersections.

### Imports

Orden estricto (enforced por Prettier + ESLint):

```ts
// 1. externos
import { z } from 'zod';

// 2. internos con alias (@/)
import { db } from '@/lib/firebase/client';

// 3. internos con path relativo
import { RepositoryError } from '../errors';

// 4. tipos (separados al final con `type`)
import type { User } from '@shared/schemas/users';
```

**Reglas arquitectónicas** ([`ARCHITECTURE.md` §2](./ARCHITECTURE.md#2-la-regla-de-oro-capas)):

- ❌ NO importar `firebase/firestore|auth|storage|firebase-admin/*` fuera de
  `apps/web/repositories/<entidad>/firebase.ts`, `apps/web/repositories/<entidad>/mapper.ts`,
  `apps/web/repositories/<entidad>/__tests__/**`, `apps/web/lib/firebase/*`.
- ❌ NO importar `@/repositories/<entidad>/firebase` desde `features/` o `app/`.
  Solo `@/repositories` (factory) o el service que lo inyecta.
- ✅ Toda la lógica de vendor vive en la impl `firebase.ts`; el dominio solo ve
  la interfaz.

ESLint lo enforce (`eslint.config.mjs` →
`no-restricted-imports` con `group: [...]`). Si necesitás una excepción,
comentalo en el PR.

### Naming

| Concepto       | Convención                | Ejemplo                  |
| -------------- | ------------------------- | ------------------------ |
| Archivos TS    | `kebab-case.ts`           | `user-repository.ts`     |
| Componentes R  | `PascalCase.tsx`          | `UsersTable.tsx`         |
| Hooks          | `use-*.ts` (kebab)        | `use-auth.ts`            |
| Funciones      | `camelCase`               | `getUsersList`           |
| Tipos / clases | `PascalCase`              | `User`, `UserRepository` |
| Constantes     | `SCREAMING_SNAKE_CASE`    | `SESSION_COOKIE_NAME`    |
| Boolean vars   | pref. `is/has/can/should` | `isLoading`, `hasMore`   |
| Colecciones    | plural                    | `users`, `auditLogs`     |

### Formato y lint

- **Prettier** se ejecuta en pre-commit (`lint-staged`). No discutir formato.
- **ESLint** con `--max-warnings 0`. Cero warnings.
- Si una regla molesta: `// eslint-disable-next-line <regla> -- <razón>` (raro,
  pero válido).

### Comentarios

- **JSDoc** obligatorio en funciones y tipos públicos exportados (SDD-09 GAP-09-E).
- Comentarios inline solo para explicar _por qué_, no _qué_.
- Sin emojis en código (excepto CHANGELOG / docs públicas).

---

## Commits (Conventional Commits)

Cada commit sigue [Conventional Commits 1.0.0](https://www.conventionalcommits.org/).
El formato es enforced por **commitlint** (hook `commit-msg`).

### Formato

```
<type>(<scope>): <subject>

<body (opcional, 72 chars por línea)>

<footer (opcional)>
```

### Tipos permitidos (`commitlint.config.cjs`)

| Tipo       | Para qué                                                 | ¿Genera release? |
| ---------- | -------------------------------------------------------- | ---------------- |
| `feat`     | Nueva funcionalidad para el usuario                      | ✅ minor         |
| `fix`      | Bugfix                                                   | ✅ patch         |
| `perf`     | Cambio que mejora performance sin alterar comportamiento | ✅ patch         |
| `refactor` | Reestructuración sin cambio funcional                    | —                |
| `test`     | Solo tests (sin cambio de código de producción)          | —                |
| `docs`     | Solo documentación                                       | —                |
| `chore`    | Tareas de mantenimiento (deps, configs, build)           | —                |
| `ci`       | Cambios en workflows / pipelines                         | —                |
| `build`    | Cambios en build system o dependencias externas          | —                |
| `style`    | Formato, espacios, punto-y-coma (no CSS)                 | —                |
| `revert`   | Reverte un commit previo (`revert: <subject>`)           | —                |

### Scopes más usados

`auth`, `users`, `firestore`, `functions`, `storage`, `web`, `ui`,
`tooling`, `ci`, `docs`, `aidlc`, `repos`, `deps`.

### Ejemplos válidos

```bash
git commit -m "feat(users): add bulk invite with CSV upload"
git commit -m "fix(auth): refresh custom claims after role change"
git commit -m "refactor(repos): extract mapper to shared package"
git commit -m "docs(arch): add first-user-admin sequence diagram"
git commit -m "chore(deps): bump firebase-admin to 12.6.0"
git commit -m "ci(workflows): add emulators:exec integration step"
git commit -m "test(users): roundtrip mapper parse(toUser(toRaw(u)))"
```

### Ejemplos **rechazados** por commitlint

```bash
git commit -m "fix bug"                   # ❌ type: 'fix' requires scope
git commit -m "WIP"                       # ❌ subject-empty + type-empty
git commit -m "feat users add thing"      # ❌ scope sin paréntesis
git commit -m "feat(users):AddThing"      # ❌ subject no es lower-case
```

Si tu mensaje es rechazado: leer el output del hook `commit-msg` indica
qué regla falló. Solución: respetar formato.

### Política: 1 SDD = 1 commit (al cierre)

Cuando cerrás un sprint completo de una SDD, hacé un commit final con
tipo `feat(<scope>)` o `docs(...)` que consolide los cambios. Commits
intermedios pueden ser `wip:` solo en ramas personales (no se pushean).

---

## Tests

| Tipo            | Cuándo                                         | Comando                  |
| --------------- | ---------------------------------------------- | ------------------------ |
| Unit            | Lógica pura (mappers, hooks, schemas, utils)   | `pnpm test`              |
| Contract (repo) | Cada impl respeta `UserRepository` interface   | `pnpm test repositories` |
| Integration E2E | Auth, Cloud Functions, rules contra emuladores | `pnpm verify:auth`       |
| Rules           | Firestore + Storage rules contra emuladores    | `pnpm verify:rules`      |

### Cobertura

- Mínimo global: **80% stmts/lines** para código nuevo (ver `vitest.config.ts`).
- Spec del usuario: **> 90% en utils/helpers/env/schemas**. Mantener.
- Si agregás un archivo nuevo sin tests: el PR no se aprueba.

---

## Pull Requests

### Antes de abrir el PR

```bash
pnpm typecheck                 # 0 errors
pnpm lint                      # 0 warnings
pnpm test                      # todos verdes
pnpm build                     # compila
pnpm verify:auth               # si toca auth/CF
pnpm --filter web bundle:check # si toca frontend
```

### Título del PR

Conventional Commits también: `feat(users): add bulk invite with CSV`.

### Descripción (template `.github/PULL_REQUEST_TEMPLATE.md`)

Completar todas las secciones:

- **¿Qué hace este PR?** (1-3 líneas)
- **¿A qué SDD corresponde?** (SDD-04, SDD-07, fix-123, etc.)
- **Tipo de cambio** (tildar el correcto)
- **Checklist** (tildar todo lo que aplique)
- **Screenshots / videos** (si toca UI)
- **Notas para el reviewer** (decisiones, riesgos, links a ADRs)

### Reglas de merge

- **1 aprobación mínima** (2 si toca `apps/functions/` o reglas de
  seguridad).
- **CI verde** (lint + typecheck + test + build + bundle size).
- **Sin conflictos** con `main`.
- **No self-merge** sin aprobación externa (excepto typos).

### Después del merge

```bash
git checkout main
git pull --rebase
git branch -d feat/<scope>-<topic>     # borrar rama local
git fetch -p                            # borrar referencias remotas
```

---

## Scope / SDD workflow

El proyecto se planifica en **SDDs** (Software Design Documents). Cada SDD:

1. Vive en [`doc/sdd-package/02-sdds/`](./doc/sdd-package/02-sdds/) (la spec).
2. Tiene un sprint asociado (1 SDD ≈ 1 sprint = N commits).
3. Tiene un `execution-plan-<scope>.md` en
   [`aidlc-docs/inception/plans/`](./aidlc-docs/inception/plans/) (las
   decisiones Q1/Q2/Q3 aplicadas).
4. Cierra con un **compliance review** en
   [`aidlc-docs/inception/reports/`](./aidlc-docs/inception/reports/) que mide
   % de criterios cumplidos.

Cuando abrís un PR que toca una SDD, linkeá ambos documentos en la
descripción. El reviewer verifica cumplimiento de criterios de aceptación.

---

## Reportar bugs

1. Buscar en [issues](../../issues) (cerrados y abiertos).
2. Si no existe, abrir uno nuevo con:
   - Pasos para reproducir.
   - Comportamiento esperado vs actual.
   - Logs / screenshots.
   - Versión (`git rev-parse --short HEAD`).
   - Entorno (OS, Node, pnpm).
3. Label: `bug` + scope (`auth`, `web`, `functions`, etc).

Para **vulnerabilidades de seguridad**: NO abrir issue público. Seguir
[`SECURITY.md`](./SECURITY.md) §Reporte de vulnerabilidades.

---

## Code of Conduct

[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1.

---

## Licencia

Privado (proyecto interno). Ver header de cada archivo.

# ADR 0001 — Monorepo con pnpm workspaces

> **Estado:** Proposed
> **Fecha:** 2026-06-24
> **Decisión:** usar pnpm workspaces con estructura `apps/*` + `packages/*`

---

## Contexto

Necesitamos compartir código entre la app Next.js (`apps/web`) y las Cloud Functions (`apps/functions`), en particular:

- Schemas Zod de validación.
- Tipos TypeScript de dominio (`User`, `Organization`, `AuditLog`).
- Constantes y enums compartidos.

Sin esto, terminamos con schemas duplicados cliente/servidor y el clásico bug de "validé en el front pero el backend acepta otra cosa".

## Opciones consideradas

### Opción A — Dos repos separados + paquete publicado a npm

- ❌ Costo cognitivo alto: dos PRs para un cambio, versiones a coordinar.
- ❌ Rompe el inner dev loop (cambias el schema, publicás, reinstalás).
- ❌ Para un equipo de < 10 devs es overkill.

### Opción B — pnpm workspaces (monorepo) ✅

- ✅ Single source of truth. Cambias el schema, ambos paquetes lo ven al instante.
- ✅ TypeScript resuelve cross-package nativamente (`"shared": "workspace:*"`).
- ✅ CI único.
- ✅ pnpm es rápido y tiene buen soporte para workspaces.

### Opción C — Nx / Turborepo

- ❌ Para nuestro tamaño actual, suma complejidad sin beneficio claro.
- 🔄 Considerar si crecemos a > 5 apps o si los builds se vuelven lentos. Migrar desde pnpm workspaces a Turborepo es relativamente barato.

## Decisión

Adoptamos **pnpm workspaces** con la siguiente estructura:

```
apps/
  web/          # Next.js 14
  functions/    # Cloud Functions 2nd gen
packages/
  shared/       # Zod schemas + tipos compartidos
```

**Reglas**:

- `apps/web` y `apps/functions` importan de `@shared/*`.
- `apps/web` NO importa de `@functions/*` y viceversa (revisado en CI).
- `packages/shared` NO importa nada de Firebase, Next.js ni Node.js APIs del lado servidor.

**Package manager**: `pnpm@latest`, lockfile commiteado, `--frozen-lockfile` en CI.

## Consecuencias

**Positivas**:

- Una sola instalación (`pnpm install`) trae todo.
- Cambios en schemas se reflejan instantáneamente.
- `pnpm dev` puede correr web + functions watcher + emulators en paralelo (script a definir en SDD-01).

**Negativas**:

- Build de Next.js puede incluir código de `packages/shared` que no usa (mitigable con tree-shaking y barrel files disciplinados).
- Un cambio en `shared` puede romper ambas apps (mitigado con CI).

**Mitigaciones**:

- CI corre `pnpm typecheck` y `pnpm test` en root, no por paquete, para detectar regresiones cross-package.
- Husky pre-commit corre typecheck solo en archivos afectados (lint-staged) pero al menos el root typecheck corre en CI.

## Notas de implementación

- `pnpm-workspace.yaml` en root:
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- Cada paquete tiene su propio `tsconfig.json` que extiende de un `tsconfig.base.json` en root.
- Scripts en root: `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `emulators`.

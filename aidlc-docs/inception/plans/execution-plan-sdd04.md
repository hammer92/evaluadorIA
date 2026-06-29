# SDD-04 Execution Plan — Repository Layer

**Sprint**: Sprint 1 (semana 3) — 2026-06-29
**SDD**: [SDD-04-repository-layer.md](../../doc/sdd-package/02-sdds/SDD-04-repository-layer.md)
**Depends on**: SDD-01 ✅, SDD-02 ✅, SDD-03 ✅
**Blocks**: SDD-05, SDD-06, SDD-07

## Workflow Selection (Adaptive)

Etapas AI-DLC a **ejecutar** (gate humano único en Requirements Analysis):

1. **Workspace Detection** (already done — audit + state reflect SDD-03 closure)
2. **Requirements Analysis** (gate: 3 preguntas Q1/Q2/Q3 respondidas 2026-06-29)
3. **Workflow Planning** (este archivo)
4. **Code Generation**
5. **Build and Test**
6. **Commit** (conventional commits per `.agents/AGENTS.md`)

Etapas **saltadas** (justificadas):

- **User Stories**: gap-closure técnico, no producto nuevo. La spec SDD-04 define interfaces completas.
- **Application Design**: arquitectura aprobada en SDD-01 (monorepo) + SDD-02 (frontend base). Repos son additive sobre la estructura existente.
- **Units Generation**: entidades discretas y nombradas en spec (`users`, `organizations`, `auditLogs`).
- **Functional Design**: interfaces completas en spec §4.3-4.5. Tipos de input/output definidos inline.
- **NFR Requirements / Design**: seguridad cubierta por SDD-03 (firestore.rules + storage.rules). Performance OK para MVP.
- **Infrastructure Design**: infra cubierta en SDD-03 (emulators) + SDD-08 (deploy).

## Requirements Analysis — Decisions

### Q1 — Default factory driver

**Respuesta**: C (default `'firebase'` siempre)
**Cambio en env.ts**: `REPOSITORY_DRIVER.default('memory')` → `REPOSITORY_DRIVER.default('firebase')`
**Implicancia**: devs deben correr emuladores para `pnpm dev`. Tests `__tests__/*` deben setear `REPOSITORY_DRIVER=memory` (o via vitest env config) o correr con emuladores.

### Q2 — Firebase integration tests infra

**Respuesta**: A (Custom wrapper client SDK + Admin SDK — sin deps nuevas)
**Patrón**: reutilizar `scripts/verify-rules.ts` pattern. En `apps/web/repositories/<entidad>/__tests__/firebase.test.ts`:

- bootstrap cliente Firebase con `_emulatorConfig` guard
- Admin SDK para setCustomClaims y cleanup
- Tests verifican CRUD por rol contra emuladores reales

### Q3 — Test helpers API

**Respuesta**: A (métodos `__reset()` / `__seed()` en clase Memory + `__reset<Entity>Repository()` en factory)
**Patrón**:

```ts
export class MemoryUserRepository {
  __reset(): void {
    this.store.clear();
    this.emails.clear();
  }
  __seed(items: User[]): void {
    /* ... */
  }
}

let _instance: UserRepository | undefined;
export function __resetUserRepository(): void {
  _instance = undefined;
}
```

## Code Generation Plan

### Archivos a crear/modificar

**packages/shared** (refactor menor):

- `src/schemas/common.ts` — primitives (`emailSchema`, `slugSchema`, `timestampSchema`, `roleSchema`, `statusSchema`)

**apps/web/repositories/** (NUEVO):

- `errors.ts` — `RepositoryError` class + 6 códigos
- `index.ts` — re-exports de las 3 entidades + factory helpers
- `users/types.ts` — `ListUsersInput`, `ListUsersResult`, `Ctx`, `UserRepository`
- `users/firebase.ts` — `FirebaseUserRepository` (collection, doc, getDocs, where, orderBy, limit, serverTimestamp)
- `users/memory.ts` — `MemoryUserRepository` (Map + Set)
- `users/mapper.ts` — `UserRaw` snake_case ↔ `User` camelCase
- `users/index.ts` — interface re-export + `getUserRepository()` + `__resetUserRepository()`
- `users/__tests__/contract.test.ts` — corre el mismo suite contra Memory
- `users/__tests__/memory.test.ts` — tests específicos de Memory
- `users/__tests__/firebase.test.ts` — integration contra emuladores (skipped si REPOSITORY_DRIVER!=firebase)
- (misma estructura ×3 para `organizations/` y `audit-logs/`)

**apps/web/env.ts** (cambio mínimo):

- `REPOSITORY_DRIVER.default('memory')` → `REPOSITORY_DRIVER.default('firebase')`

**eslint.config.mjs** (cambio mínimo):

- Añadir exemption para `apps/web/repositories/**/firebase.ts` (puede importar firebase/firestore directamente)
- Mantener regla de no importar `*/firebase` desde features/components/app

**apps/web/vitest.config.ts** (cambio mínimo):

- Setear `REPOSITORY_DRIVER=memory` en `test.env` para que tests unit no necesiten emuladores

### Total archivos nuevos estimados

- packages/shared: +1 (`common.ts`)
- apps/web/repositories: ~28 archivos (errors + index + 3 × 8 archivos c/u — types, firebase, memory, mapper, index, contract/memory/firebase tests)
- env.ts: 1 línea cambiada
- eslint.config.mjs: ~3 líneas añadidas
- vitest.config.ts: 2 líneas añadidas

### Riesgos detectados

1. **`@firebase/rules-unit-testing` descartado** (Q2=A): el SDK cliente ya tiene `connectFirestoreEmulator` etc. Reutilizamos pattern. Riesgo bajo.
2. **`firebase.ts` accede a `db` singleton de `lib/firebase/client.ts`** — pero `db` se inicializa solo en browser (`typeof window !== 'undefined'`). Para tests integration hay que importar `client.ts` en jsdom o crear un db dedicado para emulador. **Mitigación**: `firebase.ts` importa `db` solo si `clientEnv.NEXT_PUBLIC_APP_ENV === 'dev'` y `typeof window !== 'undefined'`. Para tests integration, se mockea `lib/firebase/client` (verificar `__tests__/client.test.ts` ya tiene patrón).
3. **Memory `__reset` vs `__seed`**: helpers usan prefijo `__` para evitar lint warning de `no-console` o uso accidental en producción.
4. **Next.js 14 server components**: `lib/firebase/client.ts` solo debe importarse desde archivos client (`'use client'`). `repositories/*/firebase.ts` se importa solo desde `services/` que siempre son client o server-side explicit. Mantener consistente.

## Validation Gates

Al cerrar Code Generation:

1. `pnpm typecheck` — PASS
2. `pnpm lint` — PASS (max-warnings 0)
3. `pnpm test` — PASS (todos los tests memory + contract + integración si emuladores up)
4. `pnpm --filter web build` — PASS
5. **Architecture enforcement check** (manual via grep):
   - `pnpm exec eslint --no-eslintrc -c eslint.config.mjs --print-config apps/web/services/example.ts | grep "no-restricted-imports"` → confirmar patrón activo
   - `! grep -r "from 'firebase/firestore'" apps/web --include='*.ts' --include='*.tsx' | grep -v "repositories/" | grep -v "lib/firebase/"` → debe ser 0 matches

## Commit Strategy

Single commit `feat(repositories): sdd-04 vendor-agnostic repository layer with 3 entities` al cerrar Build & Test, cubriendo:

- 3 interfaces + 3 firebase impls + 3 memory impls + 3 mappers + 3 contract tests
- RepositoryError class con 6 códigos
- ESLint exemption update
- env.ts default change
- vitest config REPOSITORY_DRIVER=memory for tests
- aidlc-state.md + audit.md updated

Si Build & Test revela gaps, fixes adicionales en commits separados siguiendo política de commits por sprint (no dividir SDD-04 entre commits — es atómico).

## Out of Scope (per spec §8)

- Realtime listeners (`onSnapshot`)
- Bulk operations
- Transacciones multi-doc
- Paginación basada en cursors complejos
- Cache local (TanStack Query ya hace cache en UI)

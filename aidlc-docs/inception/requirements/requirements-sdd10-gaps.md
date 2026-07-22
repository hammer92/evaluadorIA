# Requirements Document: SDD-10 Backend Gaps Remediation

## Intent Analysis

- **User Request**: Cerrar gaps del backend SDD-10 antes de empezar Fase 2 UI
- **Request Type**: Gap Closure / Test Coverage Hardening
- **Scope Estimate**: Multiple Components (vitest config, integration tests, rules tests, CI)
- **Complexity Estimate**: Moderate

## Context

Sprint `sdd-10-templates-admin` (PR #21 mergeado a main como `1a91d9e`) implementó Fase 1 Backend completa. La retro-review (`bd195cc`) cerró 2 issues Required + 1 Optional. **Sin embargo, 2 gaps fueron explícitamente diferidos**:

1. **Integration tests contra emuladores para templates** — commit `2ff7145 test(functions): defer templates integration tests to follow-up sprint`. 2 archivos creados y luego removidos (`create-template.integration.test.ts`, `transition-template.integration.test.ts`) por conflicto de shared state entre test files.

2. **Firestore rules unit tests específicos para templates** — `scripts/verify-rules.ts` (382 líneas) cubre users/organizations/auditLogs/storage pero NO la sección `organizations/{orgId}/templates/{templateId}` agregada en este sprint.

## Key Functional Requirements

### FR-1: Vitest config — per-file worker pool para integration tests

- Modificar `apps/functions/vitest.config.ts` para usar `poolMatchGlobs` que asigne pool `forks` con `singleFork: false` (worker pool por archivo) a archivos `**/*.integration.test.ts`.
- Mantener `singleFork: true` para unit tests existentes (rápido, 268 tests).
- Verificar que `pnpm test` (excluye `*.integration.test.ts`) sigue verde.
- Verificar que `pnpm test:integration` corre cada archivo en su propio worker.

### FR-2: Re-implementar 8 integration tests para las Cloud Functions de templates

Cada CF debe tener su archivo `*.integration.test.ts` con happy path + 1-2 edge cases críticas:

| CF                            | Archivo                                    | Edge cases mínimos                                                    |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `v1TemplatesCreate`           | `create-template.integration.test.ts`      | valid input; receta inválida (qty<=0); user sin rol admin             |
| `v1TemplatesGet`              | `get-template.integration.test.ts`         | existing template; soft-deleted (sin permiso); not found              |
| `v1TemplatesList`             | `list-templates.integration.test.ts`       | admin ve todo; recruiter solo approved; filter por niche              |
| `v1TemplatesUpdate`           | `update-template.integration.test.ts`      | admin update draft; reject si status=approved; rechazar cambio status |
| `v1TemplatesDelete`           | `delete-template.integration.test.ts`      | soft delete admin; reject si no admin; hard delete bloqueado          |
| `v1TemplatesTransition`       | `transition-template.integration.test.ts`  | happy path draft→in_review; reject transition inválida;               |
| `v1TemplatesExpertEdit`       | `expert-edit-template.integration.test.ts` | expert en in_review OK; admin rechazado; campos no-permitidos         |
| `v1TemplatesGetReviewHistory` | `get-review-history.integration.test.ts`   | primera historia vacía; después de 3 transitions; sin auth            |

Cada test debe:

- Usar el patrón `vi.hoisted` para setear env vars antes de firebase-admin import
- Usar `onCallRegistry` capture pattern (igual que users/auth/reports)
- Cleanup de users + docs en `beforeAll`/`afterAll`
- NO usar mocks de firebase-admin (van contra emulador real)

### FR-3: Firestore rules unit tests con `@firebase/rules-unit-testing`

- Instalar `@firebase/rules-unit-testing` en `apps/functions` (devDependency).
- Crear `apps/functions/src/__tests__/firestore.rules.spec.ts` (o ubicación similar) con:
  - `initializeTestEnvironment` con las `firestore.rules` actuales
  - Tests `it(...)`/`expect(...)` usando `assertFails`/`assertSucceeds`
  - Cleanup con `cleanup()` después de cada test (`afterEach`)
  - Helper para setear `customClaims` por uid (admin/recruiter/expert)

### FR-4: Full matrix de coverage para sección templates en firestore.rules

Cobertura por **3 roles × 5 acciones × 5 estados** + sub-collection `review_comments`:

| Rol       | Acciones              | Estados                                                 | Casos totales |
| --------- | --------------------- | ------------------------------------------------------- | ------------- |
| admin     | read                  | draft, in_review, approved, rejected, changes_requested | 5             |
| admin     | list                  | (todos los estados en la query)                         | 1             |
| admin     | create                | status='draft' (allowed) + status='approved' (denied)   | 2             |
| admin     | update                | draft→draft OK, in_review→in_review denied              | 2             |
| admin     | delete                | any state OK (soft delete)                              | 1             |
| recruiter | read                  | approved OK; draft/in_review/rejected denied            | 4             |
| recruiter | list                  | OK (no per-doc filter en rules)                         | 1             |
| recruiter | create                | denied                                                  | 1             |
| recruiter | update                | denied                                                  | 1             |
| recruiter | delete                | denied                                                  | 1             |
| expert    | read                  | any non-archived OK; archived denied                    | 2             |
| expert    | list                  | OK                                                      | 1             |
| expert    | create                | denied                                                  | 1             |
| expert    | update                | in_review + recipes/updated_at only OK; otros denied    | 3             |
| expert    | delete                | denied                                                  | 1             |
| any       | review_comments read  | status=approved OK; other denied                        | 2             |
| any       | review_comments write | always denied (admin only via CF)                       | 1             |

**Total: ~30 escenarios** en `firestore.rules.spec.ts` para templates.

### FR-5: CI integration

- Agregar script `pnpm --filter @platform/functions firestore:rules` que corra los rules unit tests (`vitest run firestore.rules.spec`).
- Actualizar `.github/workflows/ci.yml`:
  - Job `lint-typecheck-test-build` ya corre `pnpm test` (excluye integration). Mantener.
  - Agregar step en `integration-emulator` o nuevo job `rules-unit-tests` que corra `pnpm --filter @platform/functions firestore:rules` standalone (no necesita emuladores si `@firebase/rules-unit-testing` usa sus propios emulators internos — TBD según implementación).
- Verificar CI pasa verde en cada PR del sprint.

## Key Non-Functional Requirements

- **NFR-1: Performance**: `pnpm test` debe seguir <30s (268 unit tests). Integration tests se ejecutan solo bajo `pnpm test:integration` o `pnpm test:emulator`.
- **NFR-2: Determinism**: Cada integration test corre en worker fresco, sin shared state. Cleanup determinístico en `afterAll`.
- **NFR-3: Coverage**: Integration tests cubren 100% de las 8 CFs. Rules tests cubren full matrix FR-4.
- **NFR-4: CI budget**: `integration-emulator` job sigue <10min (actualmente ~3min). Rules tests <2min.
- **NFR-5: Skill activation**: Cada unit debe activar skills MANDATORY del AI-DLC matrix: `code-review-and-quality`, `debugging-and-error-recovery`, `security-and-hardening`, `git-workflow-and-versioning`.

## Answers to Verification Questions (OQ)

- **OQ-1 (Integration isolation)**: A) Per-file worker pool via `poolMatchGlobs` en `vitest.config.ts`. Single-fork se mantiene solo para unit tests. Elimina shared state entre archivos `.integration.test.ts`.
- **OQ-2 (Rules test pattern)**: A) `@firebase/rules-unit-testing` oficial. `firestore.rules.spec.ts` con `it(...)`/`expect(...)`. Tests formales ejecutados por `pnpm test` (con exclude pattern) o `pnpm firestore:rules` (nuevo script).
- **OQ-3 (CF coverage scope)**: 8 CFs, una por archivo. ~100-150 líneas c/u. Happy path + 1-2 edge cases.
- **OQ-4 (Rules coverage scope)**: Full matrix (3 roles × 5 acciones × 5 estados + review_comments). ~30 escenarios.

## Out of Scope

- Implementar UI (Fase 2) — sprint futuro (`sdd-10-fase-2-ui`).
- Reescribir `scripts/verify-rules.ts` — sigue siendo útil para smoke manual; no se descarta.
- Migrar a `@firebase/rules-unit-testing` v3+ si requiere cambios significativos de API — usar v2.x que es estable.

## Risks

- **R-1**: `@firebase/rules-unit-testing` requiere Java JRE (igual que Firebase emulators). CI ya tiene `setup-java@v4` temurin 17, OK.
- **R-2**: `poolMatchGlobs` puede no aplicar a `pnpm test` (que excluye `*.integration.test.ts`). Verificar que el patrón de exclusion sigue funcionando.
- **R-3**: Si `firestore.rules.spec.ts` levanta su propio emulador interno, CI necesita asegurarlo. Plan: correr `firestore:rules` DENTRO del job `integration-emulator` que ya tiene emuladores up.
- **R-4**: Pool per-file aumenta startup time. Cada integration test ~5-10s extra de worker init. 8 tests × 8s = ~1min. Aceptable.

## Acceptance Criteria

- [ ] `apps/functions/vitest.config.ts` modificado con `poolMatchGlobs` para integration tests.
- [ ] 8 archivos `*.integration.test.ts` creados en `apps/functions/src/v1/templates/__tests__/`.
- [ ] `pnpm test` verde (268 unit tests, sin integration tests).
- [ ] `pnpm test:integration` verde (8 nuevos + 4 existentes = 12 archivos).
- [ ] `pnpm test:emulator` verde (corre todos los integration tests contra emuladores reales).
- [ ] `@firebase/rules-unit-testing` instalado y configurado.
- [ ] `firestore.rules.spec.ts` con ~30 escenarios para templates (full matrix).
- [ ] Script `pnpm --filter @platform/functions firestore:rules` agregado y documentado.
- [ ] `.github/workflows/ci.yml` actualizado para correr rules tests.
- [ ] CI run final verde (3/3 jobs + rules job si se agrega como nuevo job).
- [ ] Retro-review de cada PR con 0 issues Required.

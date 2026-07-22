# Execution Plan: SDD-10 Backend Gaps Remediation

**Sprint**: `sdd-10-backend-gaps`
**Fecha**: 2026-07-22
**Pre-requisito**: PR #21 mergeado en `f927107`, retro-review `bd195cc` aplicado, CI 100% verde.

## Goals

Cerrar los 2 gaps explícitamente diferidos del sprint `sdd-10-templates-admin`:

1. Integration tests contra emuladores para las 8 Cloud Functions de templates
2. Firestore rules unit tests para la sección `organizations/{orgId}/templates/{templateId}`

## Strategy

4 PRs incrementales, cada uno con CI verde independientemente:

1. **PR #A — Infrastructure**: vitest config (poolMatchGlobs) + install `@firebase/rules-unit-testing` + base helpers
2. **PR #B — 8 Integration Tests**: uno por CF, commits separados para traceability
3. **PR #C — Firestore Rules Spec**: full matrix (~30 escenarios)
4. **PR #D — CI Integration**: scripts + `ci.yml` para correr rules tests en CI

## Units

### PR #A — Infrastructure

#### Unit A1: vitest.config.ts con poolMatchGlobs

**Archivo**: `apps/functions/vitest.config.ts`

```ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // Unit tests: single fork (rápido, 268 tests, ~3s)
    // Integration tests: per-file worker (elimina shared state)
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    poolMatchGlobs: [
      [
        '**/*.integration.test.ts',
        { pool: 'forks', poolOptions: { forks: { singleFork: false } } },
      ],
    ],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      /* ... */
    },
  },
  // ...
});
```

**Verificación**:

- `pnpm test` verde (268 unit tests, integration excluidos).
- `pnpm test:integration` corre cada archivo en worker separado (verificable con logs `worker #N started`).

#### Unit A2: Install @firebase/rules-unit-testing

**Comando**: `pnpm --filter @platform/functions add -D @firebase/rules-unit-testing`

**Versión**: latest 2.x stable (verificar compat con firebase 10.x actual).

**Verificación**: package.json + pnpm-lock.yaml actualizados, typecheck verde.

#### Unit A3: Base helpers para integration tests (templates)

**Archivo**: `apps/functions/src/v1/templates/__tests__/helpers/integration-setup.ts`

Helper functions:

- `setupTemplatesIntegrationTestEnv()`: hoisted env vars + admin app init + cleanup
- `createTestOrg(orgId)`: crea org en firestore
- `createTestTemplate(orgId, partial)`: crea template en firestore con role-specific user
- `setUserRole(uid, role)`: set custom claim via adminAuth
- `signInAs(email)`: client auth login

**Tests asociados**: ninguno (helper module). Verificar compilación + typecheck.

---

### PR #B — 8 Integration Tests

8 archivos, 1 commit por archivo para traceability:

#### Unit B1: create-template.integration.test.ts

Patrón: `apps/functions/src/v1/users/__tests__/create-user.integration.test.ts` (referencia).

**Test cases**:

- `happy path: admin creates template with status='draft'`
- `rejects: recipe with qty <= 0`
- `rejects: non-admin user (recruiter)`

#### Unit B2: get-template.integration.test.ts

**Test cases**:

- `happy path: admin reads existing template`
- `rejects: soft-deleted template as recruiter (only admin can read)`
- `returns null: not found`

#### Unit B3: list-templates.integration.test.ts

**Test cases**:

- `admin sees all templates`
- `recruiter sees only approved`
- `filter by niche returns subset`

#### Unit B4: update-template.integration.test.ts

**Test cases**:

- `admin updates draft template (name/desc only)`
- `rejects: admin tries to change status via update`
- `rejects: non-admin update`

#### Unit B5: delete-template.integration.test.ts

**Test cases**:

- `admin soft-deletes (sets deleted_at)`
- `rejects: non-admin delete`
- `hard delete blocked (only soft allowed)`

#### Unit B6: transition-template.integration.test.ts

**Test cases**:

- `happy path: admin draft → in_review`
- `rejects: invalid transition (draft → approved)`
- `expert transitions in_review → changes_requested`

#### Unit B7: expert-edit-template.integration.test.ts

**Test cases**:

- `expert edits recipes in in_review`
- `rejects: expert edits name (not in allowed fields)`
- `rejects: admin tries expert-edit (expert-only)`

#### Unit B8: get-review-history.integration.test.ts

**Test cases**:

- `returns empty array for new template`
- `returns 3 entries after 3 transitions`
- `rejects: unauthenticated`

**Verificación PR #B**:

- `pnpm test` verde (268 unit).
- `pnpm test:integration` verde (8 nuevos + 4 existentes = 12 archivos, ~40-50 tests total).
- `pnpm test:emulator` verde (corre contra emuladores reales).
- `pnpm typecheck/lint/build` verde.

---

### PR #C — Firestore Rules Spec

#### Unit C1: firestore.rules.spec.ts (full matrix)

**Archivo**: `apps/functions/src/__tests__/firestore.rules.spec.ts`

Estructura:

```ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('firestore.rules — templates sub-collection', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-test',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../../../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // Helper: create user + org + template in various states
  const seedTemplate = async (uid: string, role: Role, template: Partial<Template>) => {
    /* ... */
  };

  describe('admin', () => {
    test('read draft OK', async () => {
      /* ... */
    });
    test('read in_review OK', async () => {
      /* ... */
    });
    // ... 30 tests total
  });

  // Similar for recruiter, expert, anonymous
});
```

**Verificación**:

- `pnpm --filter @platform/functions test firestore.rules.spec` verde (~30 tests).
- `pnpm typecheck/lint` verde.

---

### PR #D — CI Integration

#### Unit D1: Script firestore:rules

**Archivo**: `apps/functions/package.json`

```json
{
  "scripts": {
    "test": "vitest run --exclude '**/*.integration.test.ts' --exclude '**/firestore.rules.spec.ts'",
    "test:rules": "vitest run firestore.rules.spec"
  }
}
```

#### Unit D2: ci.yml workflow

**Archivo**: `.github/workflows/ci.yml`

Agregar nuevo job `rules-unit-tests` que corre `pnpm test:rules` standalone (sin emuladores externos — `@firebase/rules-unit-testing` los levanta internamente).

OR: agregar step al job `integration-emulator` (que ya tiene emuladores up).

**Decisión**: agregar como step dentro de `integration-emulator` para reusar infra.

```yaml
- name: Firestore rules unit tests
  run: pnpm --filter @platform/functions test:rules
```

**Verificación PR #D**:

- Push a main → CI run verde en 4 jobs (lint-typecheck-test-build, integration-emulator, coverage, rules).

---

## Commit Strategy

Cada PR = 1 squash commit en main con conventional format:

```
PR #A: chore(functions): add vitest poolMatchGlobs + @firebase/rules-unit-testing
PR #B: test(functions): add integration tests for 8 templates CFs
PR #C: test(functions): add firestore rules unit tests for templates section
PR #D: ci(ci): invoke firestore rules tests in CI pipeline
```

## Verification Gates (each PR)

Antes de merge, cada PR debe pasar:

1. **Local**:
   - `pnpm typecheck` (3 packages)
   - `pnpm lint --max-warnings 0`
   - `pnpm test` (excluye integration)
   - `pnpm test:integration` (PR B, D)
   - `pnpm test:rules` (PR C, D)
   - `pnpm build`
   - `pnpm format:check`

2. **CI**:
   - lint-typecheck-test-build ✅
   - integration-emulator ✅
   - coverage ✅
   - (PR D) rules step ✅

3. **Retro-review**:
   - `code-review-and-quality` skill activated, 5-axis review
   - 0 issues Required. Optional logged but not blocker.

## Skills Activation (per AI-DLC matrix)

| PR  | Skills MANDATORY                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------- |
| A   | code-review-and-quality, debugging-and-error-recovery, git-workflow-and-versioning                         |
| B   | code-review-and-quality, debugging-and-error-recovery, security-and-hardening, git-workflow-and-versioning |
| C   | code-review-and-quality, security-and-hardening, git-workflow-and-versioning                               |
| D   | code-review-and-quality, git-workflow-and-versioning                                                       |

`incremental-implementation` activo en todos (referencia para atomic commits).
`security-and-hardening` especialmente crítico en PR B (auth checks en cada CF).

## Out of Scope

- UI Fase 2 (próximo sprint).
- Modificar las 8 Cloud Functions (están completas).
- Migrar `scripts/verify-rules.ts` a TypeScript moderno (low value).

## Success Criteria

- 4 PRs merged en main.
- CI verde después de cada merge.
- Cobertura integration tests: 8/8 CFs.
- Cobertura rules tests: ~30 escenarios para templates.
- Retro-review final sin issues Required.

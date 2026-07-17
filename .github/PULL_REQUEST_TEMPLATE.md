## ¿Qué hace este PR?

<!-- descripción corta (1-3 líneas) -->

## ¿A qué SDD corresponde?

<!-- ej: SDD-04, SDD-07, o "ninguno (chore/tooling)" -->

## Tipo de cambio

- [ ] Feature (nueva funcionalidad)
- [ ] Bugfix (fix de bug)
- [ ] Refactor (sin cambio de comportamiento)
- [ ] Docs (solo documentación)
- [ ] CI/CD (workflows, configs)
- [ ] Hotfix crítico

## Trunk-Based checklist (obligatorio)

- [ ] **Rama basada en `main`** (`git log main..HEAD --oneline` muestra solo mis commits)
- [ ] **Rama con vida < 7 días** (o < 3 días si es `fix/` o `docs/`)
- [ ] **Sin merge commits propios** (rebase contra main antes de pedir review: `git fetch origin && git rebase origin/main`)
- [ ] **Naming**: `<type>/<scope>-<short-desc>` (ej: `feat/users-bulk-invite`, `fix/auth-cookie-expiry`)
- [ ] **Target = `main`** (no a otra rama de larga vida)
- [ ] **CI checks pasando** (ver abajo)
- [ ] **1+ reviewer aprobando** (ver CODEOWNERS para paths sensibles)

## Quality Gates

- [ ] Tests agregados/actualizados (Vitest unit + E2E contra emuladores si aplica)
- [ ] Documentación (JSDoc, README, docs/) actualizada si aplica
- [ ] No introduzco imports de `firebase/*` fuera de `apps/web/repositories/`, `apps/web/lib/firebase/` y `apps/functions/`
- [ ] `pnpm typecheck` pasa localmente
- [ ] `pnpm lint` pasa localmente (con `--max-warnings 0`)
- [ ] `pnpm test` pasa localmente
- [ ] `pnpm test:coverage` no baja coverage global
- [ ] `pnpm verify:auth` pasa contra emuladores (si toca auth/Cloud Functions)
- [ ] `pnpm emulators:test` pasa contra emuladores (si toca Cloud Functions)
- [ ] Bundle size check (`pnpm --filter web bundle:check`) pasa (si toca el frontend)
- [ ] Probé contra emuladores localmente (`pnpm emulators:detach` + manual)
- [ ] Commit messages siguen Conventional Commits (`feat/fix/refactor/chore/ci/...`)
- [ ] **Pre-commit hook pasó** (lint-staged + typecheck automático via Husky)

## Screenshots / videos

<!-- si aplica, especialmente cambios UI -->

## Notas para el reviewer

<!-- contexto adicional, riesgos, decisiones de diseño -->

## Post-merge

- [ ] Borrar rama local: `git branch -d <branch>`
- [ ] Borrar rama remota: automática (branch protection tiene `delete_branch_on_merge: true`)
- [ ] Si deployó a staging, smoke test post-deploy según `DEPLOY.md` §Smoke test

## ¿Qué hace este PR?

<!-- descripción corta (1-3 líneas) -->

## ¿A qué SDD corresponde?

<!-- ej: SDD-04, SDD-07 -->

## Tipo de cambio

- [ ] Feature (nueva funcionalidad)
- [ ] Bugfix (fix de bug)
- [ ] Refactor (sin cambio de comportamiento)
- [ ] Docs (solo documentación)
- [ ] CI/CD (workflows, configs)
- [ ] Hotfix crítico

## Checklist

- [ ] Tests agregados/actualizados (Vitest unit + E2E contra emuladores si aplica)
- [ ] Documentación (JSDoc, README, docs/) actualizada si aplica
- [ ] No introduzco imports de `firebase/*` fuera de `apps/web/repositories/`, `apps/web/lib/firebase/` y `apps/functions/`
- [ ] `pnpm typecheck` pasa localmente
- [ ] `pnpm lint` pasa localmente
- [ ] `pnpm test` pasa localmente
- [ ] `pnpm verify:auth` pasa contra emuladores (si toca auth/Cloud Functions)
- [ ] Bundle size check (`pnpm --filter web bundle:check`) pasa (si toca el frontend)
- [ ] Probé contra emuladores localmente (`pnpm emulators:detach` + manual)
- [ ] Commit messages siguen Conventional Commits (`feat/fix/refactor/chore/ci/...`)

## Screenshots / videos

<!-- si aplica, especialmente cambios UI -->

## Notas para el reviewer

<!-- contexto adicional, riesgos, decisiones de diseño -->

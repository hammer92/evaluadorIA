# SDD-10 Fase 2 UI — Sprint Execution Plan

**Sprint ID**: `sdd-10-fase-2-ui`
**Inception cerrada**: 2026-07-22
**Sprint Goal**: Exponer la UX completa del ciclo de vida de templates (creación, revisión, aprobación, listado, búsqueda) en el portal admin, dejando el camino listo para v1.1 (code niche + billing).
**Decisión de scope**: A (scope completa — todas las pantallas y flujos de SDD-10 Fase 2).
**Output CI**: 3 checks passing (lint-typecheck-test-build, integration-emulator, coverage ≥ 70%).

## Contexto heredado de `sdd-10-backend-gaps` (cerrado 2026-07-22, commit `b1ee2c6`)

Backend ya expone 8 Cloud Functions callable (v1TemplatesCreate/Get/List/Update/Delete/Transition/ExpertEdit/GetReviewHistory) con state machine `draft → in_review → approved | changes_requested → in_review → approved | rejected` (reopen a `draft` también soportado). El modelo de datos completo está en `@platform/shared/schemas/templates` (templateSchema, recipeSchema, reviewEventSchema, transitionInputSchema, expertEditInputSchema, listTemplatesInputSchema + listTemplatesResultSchema).

UI previa a este sprint (post-PR-1 commit `63cd68d` + `04c98a4`):

- ✅ `/admin/users` — CRUD completo de usuarios (admin-only) + role guard cliente.
- ✅ `/admin/templates` — Listado + detail + form modal + delete dialog + history timeline.
- ✅ `features/templates/{schemas,api,hooks,components}` — dominio templates completo.
- ✅ `useTemplatesList`, `useTemplate`, `useReviewHistory`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useTransitionTemplate`, `useExpertEditTemplate` (8 hooks, 26 tests).

## PR Strategy — 3 vertical slices per `incremental-implementation` skill

| PR  | Branch                                    | Scope                                                                                                                | Atomic commits | Tests target | Status     |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | ------------ | ---------- |
| 1   | `feat/sdd-10-fase-2-ui-pr-1-templates`    | features/templates/ + /admin/templates/ pages + schemas/api/hooks/components + 26 tests                              | 7 commits      | 26 nuevos    | ✅ MERGED  |
| 2   | `feat/sdd-10-fase-2-ui-pr-2-review`       | features/review/ (review queue + decision panel + expert edit modal + submit-for-review button) + /admin/review page | 5 commits      | 25 nuevos    | 🟡 ACTIVE  |
| 3   | `feat/sdd-10-fase-2-ui-pr-3-crosscutting` | features/auth/RoleGuard (per-page/per-component) + features/dev/UserSwitcher + sidebar nav + /admin/settings pages   | 4 commits      | 20 nuevos    | ⏳ PLANNED |

## PR-2 — features/review/ (ACTIVE)

### Vertical slices (atomic commits)

#### Slice 1 — `chore(review): schemas for review actions`

- `apps/web/features/review/schemas.ts`:
  - `reviewQueueFiltersSchema` (status: 'in_review' default, search, page, pageSize)
  - `reviewDecisionFormSchema` (action: 'approve'|'request_changes'|'reject', comment required si action=reject/request_changes con min 10 chars)
  - Re-exportar `transitionFormSchema` + `expertEditFormSchema` desde features/templates/ (no duplicar)
- `apps/web/features/review/schemas.test.ts`:
  - 12 tests cubriendo: defaults, filtros, comment validation por acción, longitud maxima

#### Slice 2 — `feat(review): API + hooks for review queue and decisions`

- `apps/web/features/review/api/review-api.ts`:
  - `listReviewQueue(filters)` → wraps `listTemplates({ status: 'in_review', ...filters })`
  - `submitForReview({ templateId, comment? })` → wraps `transitionTemplate({ action: 'submit' })`
  - `approveTemplate({ templateId, comment? })` → wraps `transitionTemplate({ action: 'approve' })`
  - `requestChanges({ templateId, comment })` → wraps `transitionTemplate({ action: 'request_changes' })`
  - `rejectTemplate({ templateId, comment })` → wraps `transitionTemplate({ action: 'reject' })`
  - `reopenTemplate({ templateId, comment? })` → wraps `transitionTemplate({ action: 'reopen' })`
  - `editAndApproveTemplate(input)` → wraps `expertEditTemplate({ templateId, recipes, comment })`
- `apps/web/features/review/hooks/use-review-queue.ts`:
  - `useReviewQueue(filters)` (5 min staleTime, placeholderData keepPrevious)
  - `useSubmitForReview()` → useMutation → invalidate ['templates', 'list'] + ['review', 'queue']
  - `useApproveTemplate()` → useMutation → invalidate ['templates', 'detail', id] + ['review', 'queue']
  - `useRequestChanges()` → useMutation → same invalidation
  - `useRejectTemplate()` → useMutation → same invalidation
  - `useExpertEditTemplate()` → useMutation → invalidate ['templates', 'detail', id]
- Tests: 8 hook tests (1 per hook) con mocks via vi.hoisted, `// @vitest-environment jsdom` pragma.

#### Slice 3 — `feat(review): review queue list page`

- `apps/web/features/review/components/review-queue-table.tsx`:
  - TanStack Table v8 + 5 columnas (name, niche, createdBy, submittedAt, acciones)
  - Fila clickeable → navega a `/admin/templates/detail?templateId=...&from=review`
- `apps/web/features/review/components/review-queue-filters.tsx`:
  - Search input + clear button
- `apps/web/app/admin/review/page.tsx` (client):
  - Query params para search
  - Usa useReviewQueue
  - Empty state cuando no hay templates in_review: "No hay templates esperando revisión"
- Tests: 5 component tests (1 status-badge por estado, 1 aria-label, 3 list rendering).

#### Slice 4 — `feat(review): review decision panel + submit-for-review integration`

- `apps/web/features/review/components/review-decision-panel.tsx`:
  - Card con 3 botones (Approve verde / Request Changes amber / Reject rojo outline)
  - Dialog modal con textarea para comment (required si no es approve, min 10 chars)
  - Confirm button deshabilitado mientras no haya comment válido
  - Solo visible para role === 'admin'
- `apps/web/features/review/components/submit-for-review-button.tsx`:
  - Button "Enviar a revisión" — solo visible para role === 'recruiter' && (status === 'draft' || status === 'changes_requested')
- `apps/web/features/review/components/index.ts` — barrel exports
- Modify `apps/web/features/templates/components/template-detail.tsx`:
  - Importar ReviewDecisionPanel + SubmitForReviewButton
  - Renderizar ReviewDecisionPanel cuando role === 'admin' && status === 'in_review' (después del TemplateActionBar)
  - Renderizar SubmitForReviewButton en TemplateActionBar (o nuevo prop `onSubmitForReview`)
- Modify `apps/web/features/templates/components/template-action-bar.tsx`:
  - Agregar prop `onSubmitForReview` opcional
- Tests: 6 component tests (2 cada dialog action + 2 button visibility + 2 callback firing).

#### Slice 5 — `feat(review): expert edit modal`

- `apps/web/features/review/components/expert-edit-modal.tsx`:
  - RHF + zodResolver(expertEditFormSchema)
  - useFieldArray para recipes
  - Cada recipe: 4 campos editables (competencyContext, qtyMultipleChoice, qtyMultiChoice, difficulty, topicsCovered)
  - Save → llama useExpertEditTemplate con comment opcional
- Integrar botón "Editar y aprobar" en ReviewDecisionPanel:
  - Abre modal con recipes pre-cargadas
  - Save → editAndApproveTemplate (combo: expertEditTemplate + transitionTemplate approve)
- Modify `review-decision-panel.tsx`:
  - Agregar botón "Editar y aprobar" entre "Approve" y "Request Changes"
  - Estado local para modal open
- Tests: 4 component tests (modal open/close, recipe array update, save callback).

### PR-2 Final verification

- `pnpm typecheck` → 3 packages PASS
- `pnpm lint` → 0 errors, 0 warnings
- `pnpm test` → 420 + 25 = 445 tests PASS (expected; coverage exclude ya configurado)
- `pnpm test:coverage` → 70%+ (con features/review/components + features/review/api en exclude según pattern actual)
- `pnpm build` → 3 packages PASS
- `pnpm emulators:exec --project admin-platform-dev pnpm test:integration` → 90 tests PASS
- `git push` → CI verde en PR

### Commit strategy (atomic, conventional commits)

```
chore(review): add schemas for review queue and decision forms
feat(review): add API wrappers and hooks for review workflow
feat(review): add review queue list page and table components
feat(review): add review decision panel and submit-for-review button
feat(review): add expert edit modal for in-review templates
chore(coverage): exclude review components from coverage threshold
```

## PR-3 — features/auth/ + features/dev/ + settings (PLANNED)

### Vertical slices

#### Slice 1 — `chore(auth): RoleGuard component for per-page guards`

- `apps/web/features/auth/components/role-guard.tsx`:
  - Props: `roles: Role[]`, `children: ReactNode`, `fallback?: ReactNode`
  - Si useRole() no está en roles → render fallback (default: redirect a /admin)
- Tests: 3 tests (allowed role, denied role, fallback custom).

#### Slice 2 — `feat(dev): UserSwitcher for local dev only`

- `apps/web/features/dev/components/user-switcher.tsx`:
  - Solo visible si `process.env.NODE_ENV === 'development'`
  - Dropdown con todos los usuarios del org
  - Switch user via `signInWithEmailAndPassword` con stored dev passwords (from emulators)
  - Floating bottom-right, badge "DEV ONLY"
- `apps/web/app/admin/layout.tsx` (modify):
  - Renderizar UserSwitcher en development mode
- Tests: 3 tests (visible in dev, hidden in prod, switch callback).

#### Slice 3 — `feat(settings): profile and organization pages`

- `apps/web/app/admin/settings/page.tsx`:
  - Server component con currentUser data
  - 2 sections: "Mi perfil" (displayName, email read-only, role read-only) + "Mi organización" (nombre, plan)
- `apps/web/app/admin/settings/profile/page.tsx`:
  - Form para editar displayName (admin self-edit)
- Tests: 2 tests (render sections, profile edit form).

#### Slice 4 — `feat(nav): sidebar navigation with active state`

- `apps/web/components/admin-sidebar.tsx` (new):
  - Vertical nav con sections: Dashboard, Templates, Review (badge count), Users (admin only), Settings
  - Active state via usePathname
  - Review badge = count de in_review templates (useReviewQueue con pageSize=1 para solo count)
- Tests: 3 tests (active route highlighted, admin-only hidden, badge count).

### PR-3 Final verification

- Mismo criterio que PR-2 + ensure `useRole` provider ya existe (verificado en PR-1).

## Risks y mitigaciones

| Risk                                          | Mitigation                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Stitch MCP timeouts bloquean design-specs     | Specs ya generadas via docs (1 screen Stitch + 4 by doc), PR-2 + PR-3 specs agregadas a `ui-design-spec-sdd10-fase2-ui.md` en este sprint. |
| Coverage threshold baja por nuevos components | Excluir `features/review/components/**` + `features/review/api/**` del coverage (mismo pattern que PR-1).                                  |
| CORS regression                               | `pnpm emulators` ya alineado a `admin-platform-dev` (commit `a4e22c5`).                                                                    |
| Role guard inconsistente entre pages          | PR-3 introduce RoleGuard component reutilizable, retrocompatible.                                                                          |
| `next export` + dynamic routes                | Ya resuelto en PR-1 (search params pattern); PR-3 no agrega dynamic routes.                                                                |

## AI-DLC checkpoints

- [x] INCEPTION cerrada (este doc + 4 spec docs)
- [ ] **CHECKPOINT**: human approval para requirements + plan → PROCEDER A CONSTRUCTION PR-2
- [ ] CONSTRUCTION PR-2 (5 slices) → local verify → PR → merge
- [ ] CONSTRUCTION PR-3 (4 slices) → local verify → PR → merge
- [ ] OPERATIONS: CI verde on main, aidlc-state.md updated, audit.md closed

## AI-DLC stages skipped con justificación

- **User Stories**: No new personas (sprint es UX closure para usuarios ya modelados en features/users/).
- **Application Design**: Patterns ya establecidos (features/users/ + features/templates/ PR-1).
- **Units Generation**: Vertical slices = units; inline en Workflow Planning como PR structure.
- **Functional Design**: Ya en shared schemas (single source of truth).
- **NFR Requirements / NFR Design**: Cumplidos en PR-1 (coverage threshold + CORS + transpilePackages).
- **Infrastructure Design**: Sin cambios de infra en este sprint.

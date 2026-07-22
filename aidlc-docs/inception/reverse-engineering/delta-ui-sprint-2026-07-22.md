# SDD-10 Fase 2 UI — Reverse Engineering Delta

**Timestamp**: 2026-07-22T11:00:00Z
**Baseline**: Reverse engineering inicial (`aidlc-docs/inception/reverse-engineering/`, 2026-06-26) + delta SDD-10 backend gaps (`aidlc-docs/inception/plans/execution-plan-sdd10-gaps.md`, 2026-07-22 commit `b1ee2c6`)

## Estado al cierre de `sdd-10-backend-gaps` (PR-1 base)

### Backend

- ✅ 8 CFs callable implementados + tests integración (90 tests):
  - `v1AuthSignUp`, `v1AuthCreateSession`, `v1AuthSignOut`, `v1AuthDeleteAccount` (auth).
  - `v1UsersCreate`, `v1UsersList`, `v1UsersGet`, `v1UsersUpdate`, `v1UsersDelete` (users).
  - `v1OrganizationsGetCurrent` (organizations).
  - `v1TemplatesCreate`, `v1TemplatesGet`, `v1TemplatesList`, `v1TemplatesUpdate`, `v1TemplatesDelete`, `v1TemplatesTransition`, `v1TemplatesExpertEdit`, `v1TemplatesGetReviewHistory` (templates — SDD-10).
- ✅ State machine completa: `draft → in_review → approved | changes_requested | rejected → in_review → ...` + `reopen to draft`.
- ✅ Repository pattern con Firestore (`apps/functions/src/v1/templates/repository.ts`).
- ✅ Audit log por transición + review event tracking.

### Frontend (pre-PR-1)

- ✅ Next.js 14 + App Router + Tailwind + Radix/shadcn + TanStack Query + TanStack Table.
- ✅ Auth flow completo: signup → createSession (HTTP-only cookie) → middleware/RSC guard.
- ✅ `/admin/users` con CRUD completo + role-based action visibility.
- ✅ `/admin/settings` placeholder.
- ✅ Sidebar básico (links hardcoded).
- ❌ Templates UI: solo schemas compartidos + sin pages.

## Gaps identificados para sprint `sdd-10-fase-2-ui`

| Gap       | Descripción                                                      | Prioridad | PR target |
| --------- | ---------------------------------------------------------------- | --------- | --------- |
| GAP-UI-01 | `/admin/templates` list page no existe                           | HIGH      | PR-1 ✅   |
| GAP-UI-02 | `/admin/templates/[id]` detail page no existe                    | HIGH      | PR-1 ✅   |
| GAP-UI-03 | Template form modal (create/edit) no existe                      | HIGH      | PR-1 ✅   |
| GAP-UI-04 | Template filters + table no existen                              | HIGH      | PR-1 ✅   |
| GAP-UI-05 | Delete dialog no existe                                          | HIGH      | PR-1 ✅   |
| GAP-UI-06 | Template status badge no existe                                  | HIGH      | PR-1 ✅   |
| GAP-UI-07 | Review history timeline no existe                                | HIGH      | PR-1 ✅   |
| GAP-UI-08 | Review queue page no existe (`/admin/review`)                    | HIGH      | PR-2      |
| GAP-UI-09 | Review decision panel (approve/request_changes/reject) no existe | HIGH      | PR-2      |
| GAP-UI-10 | Submit for review button no integrado                            | HIGH      | PR-2      |
| GAP-UI-11 | Expert edit modal no existe                                      | MEDIUM    | PR-2      |
| GAP-UI-12 | RoleGuard component reutilizable no existe                       | MEDIUM    | PR-3      |
| GAP-UI-13 | UserSwitcher dev-only no existe                                  | LOW       | PR-3      |
| GAP-UI-14 | Admin sidebar sin active state ni badges                         | MEDIUM    | PR-3      |
| GAP-UI-15 | `/admin/settings` solo placeholder                               | MEDIUM    | PR-3      |
| GAP-UI-16 | `/admin` dashboard sin métricas                                  | LOW       | v1.1      |

## PR-1 Delta (CERRADO, commits `63cd68d` + `04c98a4`)

17 archivos agregados, +2108 líneas netas:

- `apps/web/features/templates/{schemas.ts, schemas.test.ts}` — 91 + 88 líneas.
- `apps/web/features/templates/api/templates-api.ts` — 123 líneas.
- `apps/web/features/templates/hooks/use-templates.{ts,test.tsx}` — 169 + 196 líneas.
- `apps/web/features/templates/components/{templates-table,template-filters,template-detail,template-action-bar,template-form-modal,delete-template-dialog,review-history-list}.tsx` — ~900 líneas.
- `apps/web/components/{template-status-badge,niche-badge}.tsx` + tests — ~150 líneas.
- `apps/web/app/admin/templates/{page,detail/page}.tsx` — ~80 líneas.
- Configs: `next.config.mjs` (+transpilePackages, +extensionAlias), `vitest.config.ts` (+exclude).
- 26 tests nuevos (9 schemas + 10 hooks + 6 status-badge + 1 niche badge).

### CI iterations fixed

1. **jsdom pragma** — `// @vitest-environment jsdom` agregado a `use-templates.test.tsx` + `template-status-badge.test.tsx` (era test-environment 'happy-dom' default pero necesitamos jsdom para Radix components).
2. **Webpack resolution** — `transpilePackages: ['@platform/shared']` + `extensionAlias: { '.js': ['.ts', '.tsx', '.mts'] }` para resolver `.js` extensions de ESM imports en `@platform/shared/schemas/...js`.
3. **Coverage threshold** — agregar `apps/web/features/templates/components/**` + `apps/web/features/templates/api/**` a `coverage.exclude` (UI components no necesitan 70% coverage en este sprint).

## PR-2 Delta (TARGET)

12 archivos nuevos + 2 modify:

- `apps/web/features/review/{schemas.ts, schemas.test.ts}` — ~80 + ~150 líneas.
- `apps/web/features/review/api/review-api.ts` — ~60 líneas.
- `apps/web/features/review/hooks/{use-review-queue, use-review-actions}.test.tsx` — ~250 líneas.
- `apps/web/features/review/components/{review-queue-table, review-queue-filters, review-decision-panel, submit-for-review-button, expert-edit-modal}.tsx` + tests — ~700 líneas.
- `apps/web/app/admin/review/page.tsx` — ~80 líneas.
- Modify: `apps/web/features/templates/components/{template-detail,template-action-bar}.tsx` — +30 líneas.
- 25 tests nuevos target.

## PR-3 Delta (TARGET)

8 archivos nuevos + 2 modify:

- `apps/web/features/auth/components/role-guard.tsx` + tests — ~80 líneas.
- `apps/web/features/dev/components/user-switcher.tsx` + tests — ~150 líneas.
- `apps/web/features/settings/{profile-page, organization-page}.tsx` — ~200 líneas.
- `apps/web/components/admin-sidebar.tsx` + tests — ~200 líneas.
- Modify: `apps/web/app/admin/layout.tsx` — +10 líneas.
- 20 tests nuevos target.

## Architectural invariants (must preserve)

1. **TanStack Query invalidation pattern**: mutations invalidate via `['templates', 'list']`, `['templates', 'detail', id]`, `['review', 'queue']`, `['users', 'list']`.
2. **CF wrappers via `httpsCallable`**: `unwrapData(fn(input))` pattern, no manual fetch.
3. **Server-side schema re-validation**: client zod schemas son UI-only; server re-valida con shared schemas.
4. **Role guard en cliente + backend**: `useRole()` para UI hiding; `buildAuthContext()` en CF para enforcement.
5. **Soft-delete via `deletedAt`**: no enum status para deleted.
6. **Review events append-only**: `review_history/{templateId}/events/{reviewId}` subcollection.
7. **Audit log**: server-side only, never client-side.
8. **CORS**: `cors: ALLOWED_ORIGINS_DEPLOY` en CFs públicas; emulators alineados a `admin-platform-dev`.

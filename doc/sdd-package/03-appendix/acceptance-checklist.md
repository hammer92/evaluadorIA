# Acceptance Checklist

> Checklist agregado por SDD. Marcá cada item antes de cerrar el SDD. Si alguno falla, el SDD NO está completo.

---

## Cross-SDD (siempre)

- [ ] `pnpm install` funciona en máquina limpia.
- [ ] `pnpm lint` pasa con `--max-warnings 0`.
- [ ] `pnpm typecheck` pasa sin errores.
- [ ] `pnpm test` pasa.
- [ ] `pnpm build` produce artefactos sin errores.
- [ ] `pnpm emulators` levanta los 4 emuladores.
- [ ] No hay imports de `firebase/*` fuera de `/repositories/*/firebase.ts` y `/lib/firebase/*`.
- [ ] No hay `as any`, `@ts-ignore`, ni `@ts-expect-error` sin comentario.
- [ ] No hay `console.log` en código de aplicación (solo `console.warn`/`console.error` con prefijo).
- [ ] No hay secrets en código (verificado con grep + gitleaks).
- [ ] `README.md` está actualizado si cambió setup o comandos.
- [ ] `CHANGELOG.md` se actualiza (manual o via release-please).

---

## SDD-01 — Monorepo & Tooling

- [ ] Estructura `apps/web`, `apps/functions`, `packages/shared` creada.
- [ ] `pnpm-workspace.yaml` correcto.
- [ ] `tsconfig.base.json` con strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- [ ] ESLint flat config con `no-restricted-imports` para `firebase/*`.
- [ ] Prettier configurado.
- [ ] Husky con `pre-commit` + `commit-msg`.
- [ ] lint-staged configura `eslint --fix` + `prettier --write`.
- [ ] Vitest corre y reporta coverage.
- [ ] `.env.example` con TODAS las variables que el código referencia.
- [ ] `.gitignore` cubre `.env*`, `.firebase/`, `node_modules/`, `coverage/`, `.next/`.
- [ ] `.nvmrc` con `20`.
- [ ] `commitlint` rechaza mensajes no convencionales.
- [ ] `pnpm dev` y `pnpm emulators` son placeholders que mejoran en SDDs siguientes.

---

## SDD-02 — Frontend Foundation

- [ ] Next.js 14 con App Router.
- [ ] Tailwind + shadcn/ui inicializados.
- [ ] TanStack Query provider.
- [ ] Zustand store base.
- [ ] next-themes con dark mode funcional.
- [ ] `env.ts` valida con Zod al boot.
- [ ] Layout con sidebar colapsable.
- [ ] Header con user menu (placeholder).
- [ ] `middleware.ts` con stub de protección `/admin/**`.
- [ ] Página 404 + error boundary.
- [ ] Path aliases `@/` y `@shared/` funcionan en `tsconfig` y Vitest.
- [ ] Bundle inicial < 200KB gzip en `/`.
- [ ] Lighthouse Performance > 90 en `/`.

---

## SDD-03 — Firebase Setup

- [ ] `firebase.json` con emuladores auth/firestore/functions/storage.
- [ ] `.firebaserc` con aliases dev/staging/prod.
- [ ] `firestore.rules` con deny-by-default.
- [ ] Reglas para `users`, `organizations`, `auditLogs` documentadas.
- [ ] `storage.rules` con deny-by-default.
- [ ] `firestore.indexes.json` con índices del `data-model.md`.
- [ ] `lib/firebase/client.ts` inicializa Firebase JS SDK con env vars.
- [ ] `lib/firebase/client.ts` conecta a emuladores en dev.
- [ ] `lib/firebase/admin.ts` (en functions) inicializa Admin SDK.
- [ ] Helper `setUserRole(uid, role)` con Admin SDK.
- [ ] Seed script idempotente crea 1 org + 3 users.
- [ ] Test de reglas con `@firebase/rules-unit-testing` pasa.
- [ ] Test unitario de `client.ts` pasa.

---

## SDD-04 — Repository Layer

- [ ] `RepositoryError` con 6 códigos.
- [ ] Interfaz `UserRepository` con 5 métodos.
- [ ] `FirebaseUserRepository` implementa los 5 métodos.
- [ ] `MemoryUserRepository` implementa los 5 métodos.
- [ ] Mapper snake_case ↔ camelCase con roundtrip test.
- [ ] `getUserRepository()` factory retorna impl correcta.
- [ ] Mismas cosas para `OrganizationRepository` y `AuditLogRepository`.
- [ ] Schemas Zod en `packages/shared` (input, output).
- [ ] Tests contractuales pasan para `Memory*` (mínimo 8 casos por entidad).
- [ ] Tests de integración pasan para `Firebase*` con emuladores.
- [ ] Coverage ≥ 80% en `repositories/`.
- [ ] ESLint rechaza import de `firebase/firestore` fuera de `/repositories/*/firebase.ts`.
- [ ] ESLint rechaza import de `*/firebase.ts` desde UI/services.

---

## SDD-05 — Auth & Authorization

- [ ] SignUp con email + password.
- [ ] SignIn con email + password.
- [ ] SignIn con Google.
- [ ] SignOut limpia cookie.
- [ ] Custom Claims: set via `v1_users_set_role` (admin only).
- [ ] `useAuth()` hook retorna `{ user, claims, loading, error }`.
- [ ] Middleware Next.js valida sesión y claims.
- [ ] `/admin` muestra email + role del usuario.
- [ ] `/login` funcional.
- [ ] `/signup` funcional.
- [ ] Server-side `verifyAuth()` retorna datos correctos.
- [ ] Server-side `requireRole()` lanza si rol insuficiente.
- [ ] Cookie `__session` es httpOnly, Secure, SameSite=Lax.
- [ ] Sesión persiste entre reloads.
- [ ] Test del flujo completo contra emuladores.

---

## SDD-06 — Cloud Functions v1

- [ ] `apps/functions` shell con TS + build + lint + test.
- [ ] Wrapper `buildAuthContext` con tests (≥ 4 casos).
- [ ] Wrapper `validateInput` con tests.
- [ ] Wrapper `handleError` mapea `RepositoryError` a `HttpsError`.
- [ ] `v1UsersCreate` funciona; `admin` y `recruiter` pueden llamar; `expert` recibe `permission-denied`; email duplicado recibe `already-exists`. (Modelo ortogonal — ver ADR-0006.)
- [ ] `v1UsersList` pagina y filtra.
- [ ] `v1ReportsGenerate` retorna `{ jobId, status: 'queued' }`.
- [ ] `createSession` setea cookie httpOnly.
- [ ] CORS configurado solo para `ALLOWED_ORIGINS`.
- [ ] Secrets via `defineSecret`, no `process.env`.
- [ ] Headers de seguridad presentes.
- [ ] Coverage ≥ 75% en `v1/`.
- [ ] Test integration con emuladores (`firebase emulators:exec`).

---

## SDD-07 — Admin UI

- [ ] `/admin` dashboard con 4 stats cards.
- [ ] `/admin/users` con tabla (TanStack Table).
- [ ] Filtros (status, role, search) funcionan.
- [ ] Paginación funcional.
- [ ] Modal de crear usuario valida con RHF + Zod.
- [ ] Submit de crear llama a `v1UsersCreate` y refresca tabla.
- [ ] Modal de editar precargado.
- [ ] Confirm dialog de soft delete.
- [ ] `/admin/settings` con 3 tabs (profile/team/billing).
- [ ] Skeletons durante fetch.
- [ ] Error boundary en `/admin/users`.
- [ ] 404 + 500 personalizadas.
- [ ] Dark mode funcional en todas las páginas.
- [ ] Lighthouse Performance > 90 en `/admin/users`.
- [ ] No imports directos de `firebase/*` en componentes.

---

## SDD-08 — CI/CD & Deploy

- [ ] `.github/workflows/ci.yml` corre en cada PR.
- [ ] CI: install + lint + typecheck + test + build + bundle size check.
- [ ] CI completa en < 8 min.
- [ ] Coverage se sube (Codecov o similar).
- [ ] `.github/workflows/deploy-staging.yml` triggerea en merge a `main`.
- [ ] Deploy a staging completa en < 15 min.
- [ ] `.github/workflows/deploy-prod.yml` requiere confirmación manual.
- [ ] GitHub Environment `production` con required reviewers.
- [ ] Firebase Hosting configurado con cache headers correctos.
- [ ] SSR configurado para Cloud Run (si aplica).
- [ ] `.github/dependabot.yml` para pnpm + actions.
- [ ] PR template con checklist.

---

## SDD-09 — Documentación

- [ ] `README.md` con Quick Start de 5 min.
- [ ] `ARCHITECTURE.md` con diagrama Mermaid.
- [ ] `CONTRIBUTING.md` con flujo de PR + checklist.
- [ ] `DEPLOY.md` con staging + prod + rollback.
- [ ] `SECURITY.md` con contacto.
- [ ] Funciones públicas con JSDoc.
- [ ] Tipos públicos con JSDoc.
- [ ] release-please configurado (al menos 1 release para validar).

---

## Definition of Done global

Un PR se considera listo cuando:

1. ✅ Todos los criterios del SDD correspondiente marcados.
2. ✅ CI pasa (lint + typecheck + test + build).
3. ✅ Coverage no baja globalmente.
4. ✅ Al menos 1 reviewer aprobó.
5. ✅ Si cambió comportamiento, docs actualizadas.
6. ✅ Si introdujo decisión técnica, ADR creado.
7. ✅ Si cambió setup, README actualizado.

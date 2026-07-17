# SDD-05 — Auth/Authorization Execution Plan

**Sprint**: SDD-05 (Auth/Authorization)
**Decisions**: Q1=C (email + phone), Q2=A (jose HS256), Q3=C (híbrido bootstrap admin)
**Date**: 2026-06-29T08:00Z (Q1 reverted 2026-07-17 a Q1=A → Q1=C)
**ADR**: `docs/sdd-package/01-architecture/decisions/0007-auth-providers-email-and-phone.md`

---

## 1. Decisiones de implementación

### Q1 = C — Email + Phone (sin Google)

- **Providers habilitados**: `password` (Firebase Auth email/password) + `phone` (Firebase Auth phone con OTP).
- **NO Google**: omitir `social-buttons.tsx`, `signInWithGoogle()`, `GoogleAuthProvider` y OAuth setup en Firebase Console.
- **Phone login only** (no self-signup por phone): el admin crea el user con `phoneNumber` vía `v1UsersCreate` CF + Admin SDK. El cliente usa OTP puro (`signInWithPhoneNumber` → `ConfirmationResult.confirm`).
- **RecaptchaVerifier invisible** montado en `<div id="login-recaptcha-container">` (compartido entre tabs).
- **Auth emulator**: acepta ambos providers sin config adicional. Phone usa código `123456` universal en emulador.
- **Reducción de scope vs spec original**: -Google (+Phone). Phone = 4 archivos nuevos (schema, API, UI, tests).
- **Audit log extendido**: `auth.phone_login`, `auth.phone_otp_requested`, `auth.phone_otp_failed`.

### Q2 = A — HS256 con `jose`

- **Dependencia nueva**: `jose@^5.9` (~8kb gzipped, edge-compatible).
- **Secret compartido**: `SESSION_COOKIE_SECRET` env var, mismo valor en:
  - Cloud Function `v1_auth_create_session` (firma con HS256)
  - Middleware Next.js (verifica con HS256)
- **Cookie**: `__session` httpOnly, SameSite=Lax, Secure (en prod), 5 días.
- **Payload claims**: `{ uid, email, role, organizationId, iat, exp }`.
- **Trade-off documentado**: secret compartido entre 2 componentes. Mitigation: secret en `process.env` del servidor, nunca expuesto al cliente (sin `NEXT_PUBLIC_` prefix).

### Q3 = C — Híbrido: primer user es admin, resto por invitación

- **Public signup form**: existe, pero submission logic es distinta.
- **Cloud Function `v1_users_create`** (server-authoritative):
  - Recibe `{ idToken, displayName, sendInviteEmail }`.
  - Cuenta `users` collection.
  - Si `count === 0` → asigna `role='admin'`, crea user doc.
  - Si `count > 0` → rechaza con `HttpsError('permission-denied', 'Regístrate vía invitación')`.
  - Setea custom claims `{ role, organizationId: null }`.
  - Retorna `{ uid, role, isFirstUser }`.
- **Cloud Function `v1_users_invite`** (admin only):
  - Recibe `{ email, role, organizationId?, sendInviteEmail }`.
  - Crea user en Auth con `admin.auth.createUser({ email, emailVerified: false, disabled: false })`.
  - Crea user doc con status='invited'.
  - Setea custom claims.
  - (Para MVP, no envía email real — solo loguea. SendGrid/Resend integration en SDD-07+).
- **SignUp flow** (cliente):
  1. `createUserWithEmailAndPassword` → `idToken`.
  2. `httpsCallable(functions, 'v1_users_create')({ idToken, displayName })` → decide si es admin o rejected.
  3. Si OK → `signInWithEmailAndPassword` (re-login para refrescar claims) → create session.
- **Admin invite flow** (admin UI en SDD-07, pero endpoint ya existe):
  - Admin llama `v1_users_invite` con email del invitado.
  - El invitado recibe email (mock por ahora) con link a `/signup?invite=TOKEN`.
  - En `/signup`, si `?invite=TOKEN` presente, el form cambia a "Crear cuenta con invitación".

## 2. Archivos a crear / modificar

### Crear (NUEVO)

```
apps/web/
├── lib/firebase/
│   ├── auth.ts                        # re-exports nombrados de firebase/auth
│   └── __tests__/auth.test.ts         # smoke test (auth helper existe)
├── features/auth/
│   ├── schemas.ts                     # Zod: loginSchema, signupSchema, inviteTokenSchema
│   ├── schemas.test.ts                # unit tests
│   ├── types.ts                       # AuthState, ServerAuth (uid, email, role, orgId)
│   ├── api/auth-api.ts                # signInWithEmail, signUpWithEmail, signOutCurrent, createSession, verifyInviteToken
│   ├── api/auth-api.test.ts           # unit tests con mocks de firebase/auth
│   ├── hooks/use-auth.ts              # useAuth() cliente (user, claims, loading, error)
│   ├── hooks/use-auth.test.ts         # test con @testing-library/react
│   ├── components/
│   │   ├── login-form.tsx             # email/password
│   │   ├── signup-form.tsx            # email/password, con branch first-user vs invited
│   │   └── auth-error.tsx             # mapea auth/* codes a mensajes ES
│   ├── components/login-form.test.tsx # integration test
│   ├── components/signup-form.test.tsx# integration test
│   ├── server/
│   │   ├── session.ts                 # signSession(uid, role, orgId) con jose (HS256)
│   │   ├── session.test.ts            # unit tests
│   │   ├── verify-session.ts          # verifySessionCookie(cookie) con jose
│   │   └── verify-session.test.ts     # unit tests
│   └── server/middleware-jwt.ts       # verifyJwtForMiddleware() (edge-compatible wrapper)
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                 # layout mínimo (centered card)
│   │   ├── login/page.tsx             # usa LoginForm
│   │   └── signup/page.tsx            # usa SignupForm (con ?invite=)
│   ├── api/auth/
│   │   ├── __tests__/...              # tests con fetch
│   │   └── logout/route.ts            # POST: limpia cookie, redirect /login
│   └── admin/
│       ├── layout.tsx                 # MODIFICAR: usar verifyAuth + useAuth
│       └── page.tsx                   # MODIFICAR: mostrar email + role del user
├── components/layout/header.tsx       # MODIFICAR: pasar email + role
├── components/layout/user-menu.tsx    # MODIFICAR: avatar con initial, signOut onClick
├── middleware.ts                      # MODIFICAR: jose HS256, redirige /admin
└── services/
    └── auth-service.ts                # server-only: verifyAuth(), requireAuth(), requireRole()

apps/functions/src/
├── index.ts                           # MODIFICAR: exportar todas las functions
└── auth/
    ├── create-session.ts              # onRequest POST /v1/auth/session (set httpOnly cookie)
    ├── clear-session.ts               # onRequest POST /v1/auth/clear (clear cookie)
    ├── create-session.test.ts         # integration test con emuladores
    ├── create-user.ts                 # onCall v1_users_create (decide first-user-admin)
    ├── create-user.test.ts            # integration test
    ├── invite-user.ts                 # onCall v1_users_invite (admin only)
    └── invite-user.test.ts            # integration test
```

### Modificar (EXISTENTE)

- `apps/web/package.json` → agregar `jose@^5.9.6`, `next-themes` (ya está), `sonner` (ya está).
- `apps/web/middleware.ts` → JWT verify con `jose`, redirige sin cookie a `/login?next=`.
- `apps/web/env.ts` → agregar `SESSION_COOKIE_SECRET` (server-only).
- `apps/web/app/admin/layout.tsx` → server-side `verifyAuth()` + mostrar user.
- `apps/web/components/layout/header.tsx` → pasar `email` + `role` props.
- `apps/web/components/layout/user-menu.tsx` → render avatar initial + signOut action.
- `apps/functions/src/index.ts` → exportar `createSession`, `clearSession`, `createUser`, `inviteUser`.
- `apps/functions/src/firebase-admin.ts` → ya está OK.
- `apps/web/eslint.config.mjs` → ninguna nueva restricción (repositories/\* no se toca).
- `apps/web/vitest.config.ts` → agregar `SESSION_COOKIE_SECRET=test-secret-for-vitest`.
- `firebase.json` → no cambia.

### Total estimado

- **Nuevos**: ~25 archivos (4 server-side functions, 3 components, 4 hooks/api, 2 server helpers, 5 tests, 1 middleware update, 3 pages, 3 cloud function tests).
- **Modificados**: ~6 archivos (middleware, env, header, user-menu, admin layout, admin page, functions index, package.json).
- **Net delete**: 0.

## 3. Plan de Code Generation (orden de ejecución)

1. **Shared/Schemas**: agregar `inviteTokenSchema` (Zod), `authErrorSchema` (union de auth codes).
2. **Cloud Functions layer** (apps/functions/src/auth/\*): 4 functions + tests.
3. **Server-side helpers** (apps/web/features/auth/server/\*): session.ts + verify-session.ts + middleware-jwt.ts + tests.
4. **Client API** (apps/web/features/auth/api/\*): auth-api.ts + tests.
5. **Hooks** (apps/web/features/auth/hooks/\*): use-auth.ts + tests.
6. **Components** (apps/web/features/auth/components/\*): login-form, signup-form, auth-error + tests.
7. **Pages** (apps/web/app/(auth)/\*): layout, login/page, signup/page.
8. **API routes** (apps/web/app/api/auth/logout/\*).
9. **Admin integration**: admin/layout.tsx + admin/page.tsx + header.tsx + user-menu.tsx.
10. **Middleware** (apps/web/middleware.ts).
11. **Env + config**: env.ts, package.json, vitest.config.ts.
12. **Build & Test Verification**:
    - typecheck (3 paquetes)
    - lint
    - unit tests (vitest)
    - **build functions** (tsc)
    - **emulators:detach** start
    - **seed** emulators
    - **integration test full flow** (scripts/verify-auth.ts)
    - **build web** (next build)
13. **Commit**.

## 4. Plan de Testing (en orden)

### Unit (vitest, REPOSITORY_DRIVER=memory, sin emuladores)

- `features/auth/schemas.test.ts` (4 tests): loginSchema acepta OK + rechaza invalid.
- `features/auth/api/auth-api.test.ts` (6 tests): signIn/Up/SignOut wrappean SDK correctamente (mocks).
- `features/auth/hooks/use-auth.test.ts` (3 tests): useAuth retorna state shape correcto.
- `features/auth/server/session.test.ts` (3 tests): signSession + verifySession roundtrip.
- `features/auth/server/verify-session.test.ts` (4 tests): cookie válida/inválida/expirada/ausente.
- `features/auth/components/login-form.test.tsx` (3 tests): render + submit.
- `features/auth/components/signup-form.test.tsx` (4 tests): branch first-user / invited / error.

### Integration (emuladores detached, en orden)

1. **typecheck** (3 paquetes)
2. **lint** (max-warnings 0)
3. **build functions** (tsc)
4. **build web** (next build)
5. **emulators:detach** + status check
6. **seed:emulators** (1 org + 3 users)
7. **`scripts/verify-auth.ts`**: 10 integration tests:
   1. First user signup → role='admin' + cookie set.
   2. SignIn con admin → session cookie válida, claims.role='admin'.
   3. Middleware (test directo con `jose`) → cookie válida pasa, ausente redirige a /login.
   4. Second user signup (sin invitación) → rejected con `permission-denied`.
   5. Admin invites user → user creado en Auth + Firestore con status='invited' + claims seteadas.
   6. Second user signup con invitation token → role='expert' + cookie set.
   7. SignOut → cookie borrada.
   8. Custom claims (admin cambia rol de expert a recruiter) → claims actualizados.
   9. Firestore rules con custom claims → SDD-03 verify-rules subset (re-correr).
   10. Audit log entries creados (auth.login en cada signin).

### Cobertura esperada

- 27 unit tests nuevos
- 10 integration tests con emuladores
- 100% de criterios de aceptación SDD-05

## 5. Riesgos y mitigaciones (específicos SDD-05)

| Riesgo                                                  | Prob | Impact | Mitigación                                                                                |
| ------------------------------------------------------- | ---- | ------ | ----------------------------------------------------------------------------------------- |
| `jose` no funciona en edge runtime                      | B    | A      | Ya es edge-compatible nativamente. Plan B: usar `verifySessionCookie` con node runtime.   |
| `onCall` no setea cookie                                | A    | A      | Usar `onRequest` para `create-session` (más flexible, permite Set-Cookie).                |
| Custom claims stale después de signUp                   | A    | M      | El cliente re-fetcha idToken con `forceRefresh=true` antes de createSession.              |
| Race condition: 2 signups simultáneos como "first user" | B    | A      | Cloud Function usa transacción Firestore (count + create). Si count > 0 al commit, abort. |
| Secret débil en dev                                     | A    | B      | `SESSION_COOKIE_SECRET` con default warning en dev (>= 32 chars).                         |
| First-user admin sin guard de bootstrap                 | B    | A      | Test explícito en `verify-auth.ts`.                                                       |

## 6. Etapas AI-DLC a ejecutar

- ✅ Workspace Detection (ya hecho en SDD-04)
- ✅ Reverse Engineering (ya hecho)
- ✅ Requirements Analysis (Q1=A, Q2=A, Q3=C aplicadas)
- ⏭️ **Workflow Planning** ← este documento
- ⏭️ User Stories — SKIP (sprint técnico, no user-facing)
- ⏭️ Application Design — SKIP (sigue patrón SDD-02 frontend foundation + SDD-04 repos)
- ⏭️ Units Generation — SKIP (single unit: auth flow)
- ⏭️ Functional Design — SKIP (lógica simple, no business rules complejas)
- ⏭️ NFR Requirements/Design — SKIP (security baseline ya cubre auth)
- ⏭️ Infrastructure Design — SKIP (Cloud Functions emulador ya está en firebase.json)
- ⏸️ **Code Generation** (próximo)
- ⏸️ **Build and Test** (con emuladores)
- ⏸️ **Commit**

## 7. Pre-requisitos de entorno

- [x] `jre-openjdk-headless` instalado (de SDD-03)
- [x] `firebase-tools` global instalado
- [x] Emuladores scripts (`pnpm emulators:*`) funcionando
- [x] Firebase Admin SDK con `getAdminAuth` + `getAdminDb` disponibles
- [x] Repos + Custom Claims verificados con `verify-rules.ts`
- [ ] **Agregar `jose` a apps/web/package.json** ← próximo paso
- [ ] **SESSION_COOKIE_SECRET en .env.example** ← próximo paso
- [ ] **Build apps/functions** ← próximo paso

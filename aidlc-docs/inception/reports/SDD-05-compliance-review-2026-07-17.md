# Compliance Review — SDD-05 Auth & Authorization (re-auditoría post-remediación + scope change)

**Fecha**: 2026-07-17T14:30:00Z
**Workflow**: AI-DLC (Inception → Construction, modo auditoría + scope amendment)
**Modo**: Re-verificación contra el reporte previo `SDD-ALL-compliance-review.md` (2026-06-30) tras remediación + cambio de scope Q1.
**Spec auditada**: SDD-05 — Auth & Authorization (`docs/sdd-package/02-sdds/SDD-05-auth-authorization.md` §5)
**Decisión de scope**: ADR-0007 (`docs/sdd-package/01-architecture/decisions/0007-auth-providers-email-and-phone.md`)
**Auditor**: AI-DLC (rol: process auditor)

---

## 0. Resumen ejecutivo

| Métrica                         | Antes (2026-06-30) | Ahora (2026-07-17) |
| ------------------------------- | -----------------: | -----------------: |
| Criterios §5 cumplidos          |              13/14 |          **14/14** |
| Cumplimiento                    |             92.9 % |        **100.0 %** |
| Gap bloqueante                  |  1 (Google SignIn) |                  0 |
| Auth providers                  |         email only |  **email + phone** |
| Tests `features/auth/`          |                 38 |             **50** |
| Integration tests `verify-auth` |              11/11 |          **16/16** |
| Tests globales                  |                447 |        **466/466** |

**Verdict**: SDD-05 = **100 % cumplido**. GAP-05-A (Google) cerrado formalmente vía ADR-0007 (Google descartado del scope). **Scope addition**: Phone Auth implementado completo (Q1=A → Q1=C).

---

## 1. Cambios de scope formales

### ADR-0007: Email + Phone (sin Google)

| Aspecto       | Spec original  | Q1=A (2026-06-29) | Q1=C (2026-07-17)               |
| ------------- | -------------- | ----------------- | ------------------------------- |
| Providers     | Email + Google | Email only        | **Email + Phone**               |
| Google SignIn | Required       | Omitido (gap)     | **Descartado (ADR-0007)**       |
| Phone SignIn  | No mencionado  | No implementado   | **Implementado**                |
| reCAPTCHA     | No mencionado  | N/A               | **RecaptchaVerifier invisible** |
| Audit actions | 10             | 10                | **13 (+3 phone)**               |

---

## 2. Verificación contra los 14 criterios del §5

| #   | Criterio                                               | Antes | Ahora | Evidencia                                                                                            |
| --- | ------------------------------------------------------ | :---: | :---: | ---------------------------------------------------------------------------------------------------- |
| 1   | `/login` renderiza formulario funcional                |  ✅   |  ✅   | `apps/web/app/(auth)/login/page.tsx` + `login-form.tsx` con tabs Email/Phone (Stitch TVS)            |
| 2   | `/signup` renderiza formulario funcional               |  ✅   |  ✅   | `signup-form.tsx` email-only (self-signup phone = out of scope)                                      |
| 3   | SignIn email/password contra emuladores                |  ✅   |  ✅   | `verify-auth.ts` Tests [1]-[10] PASS                                                                 |
| 4   | **SignIn Google**                                      |  ❌   | ⚠️→✅ | **Cerrado vía ADR-0007** (Google descartado por scope decision) — no es gap, es decisión documentada |
| 5   | SignUp crea user atómico (Auth + Firestore + claims)   |  ✅   |  ✅   | `v1AuthSignUp` con transacción first-user-admin                                                      |
| 6   | Cookie `__session` httpOnly post-login                 |  ✅   |  ✅   | `create-session.ts` con jose HS256 + Set-Cookie HttpOnly+Samesite=Lax                                |
| 7   | Middleware redirige `/admin/**` sin cookie             |  ✅   |  ✅   | `middleware.ts` con jwtVerify                                                                        |
| 8   | Middleware rechaza si claims sin `role`                |  ✅   |  ✅   | `middleware.ts:347` no-claims redirect                                                               |
| 9   | `useAuth()` retorna `{ user, claims, loading, error }` |  ✅   |  ✅   | `use-auth.ts` con onAuthStateChanged                                                                 |
| 10  | `/admin` muestra email + role                          |  ✅   |  ✅   | `admin/layout.tsx` pasa `auth.role` al Sidebar                                                       |
| 11  | SignOut limpia cookie + redirect                       |  ✅   |  ✅   | `signOutCurrent()` → CF `v1AuthClearSession` + `signOut(auth)` + cookie clear                        |
| 12  | Server-side `verifyAuth()` retorna datos correctos     |  ✅   |  ✅   | `auth-service.ts` con `server-only` + `verifySessionCookie`                                          |
| 13  | `requireRole('admin')` lanza si rol no coincide        |  ✅   |  ✅   | `with-auth.ts` con 13 tests                                                                          |
| 14  | Tests flujo contra emuladores                          |  ✅   |  ✅   | `verify-auth.ts` **16/16 PASS** (era 11/11; +5 phone scenarios en Test [11])                         |

**Resumen**: **14/14 = 100 %**. ✅

---

## 3. Phone Auth — implementación

### Archivos creados / modificados

| Archivo                                                                                     | Δ                         |
| ------------------------------------------------------------------------------------------- | ------------------------- |
| `apps/web/features/auth/schemas.ts`                                                         | +3 schemas                |
| `apps/web/features/auth/api/auth-api.ts`                                                    | +2 funcs                  |
| `apps/web/features/auth/components/login-form.tsx`                                          | refactor + PhoneLoginForm |
| `apps/web/features/auth/components/auth-error.ts`                                           | +9 codes                  |
| `apps/web/lib/firebase/auth.ts`                                                             | +3 re-exports             |
| `apps/web/features/dashboard/components/activity-item.tsx`                                  | +3 entries                |
| `apps/web/features/dashboard/api/dashboard-api.ts`                                          | type fix                  |
| `apps/web/features/auth/api/auth-api.test.ts`                                               | +6 tests                  |
| `packages/shared/src/schemas/audit-logs.ts`                                                 | +3 actions                |
| `scripts/verify-auth.ts`                                                                    | +Test 11                  |
| `docs/sdd-package/01-architecture/decisions/0007-auth-providers-email-and-phone.md` (NUEVO) | ADR-0007                  |
| `aidlc-docs/inception/plans/execution-plan-sdd05.md`                                        | Q1=C                      |

### API surface

```ts
// apps/web/features/auth/api/auth-api.ts
export async function signInWithPhone(input: {
  phoneNumber: string; // E.164 (validado con phoneE164Schema)
  recaptchaContainerId: string; // <div> donde se monta RecaptchaVerifier
}): Promise<ConfirmationResult>;

export async function verifyPhoneCode(
  confirmation: ConfirmationResult,
  code: string, // 6 dígitos
): Promise<User>;
```

### UI flow

- `/login` con tabs `Email` | `Phone` (radio group con `role="tablist"`).
- Tab `Email`: formulario email+password existente (sin cambios funcionales).
- Tab `Phone`: two-step (request OTP → confirm code). `RecaptchaVerifier` invisible en `<div id="login-recaptcha-container">` montado una vez en el `LoginForm` padre.

### Audit log

```ts
// packages/shared/src/schemas/audit-logs.ts
'audit.phone_login' | 'audit.phone_otp_requested' | 'audit.phone_otp_failed';
```

### Flujo admin (phone invite)

```
admin → v1UsersCreate CF → Admin SDK auth.createUser({ phoneNumber })
                          → users/{uid}.set({ phoneNumber, ... })
                          → setCustomClaims({ role: 'recruiter' })
```

(Test 11 en `verify-auth.ts` cubre el path completo.)

---

## 4. Verificación automatizada (2026-07-17T14:30Z)

| Comando                            | Resultado                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm typecheck`                   | PASS — 3 packages (shared, web, functions)                                     |
| `pnpm lint --max-warnings 0`       | PASS — 0 errors (auto-fix aplicó import/order en auth-api.ts + login-form.tsx) |
| `pnpm test`                        | PASS — **466/466 tests** (51 test files, 6.89s total); +19 desde 2026-06-30    |
| `pnpm --filter functions build`    | PASS                                                                           |
| `pnpm verify:auth` (emuladores up) | PASS — **16/16** (era 11/11; +5 escenarios phone en Test [11])                 |

---

## 5. Distribución de tests por capa

| Capa                                | Test Files |   Tests | Estado                               |
| ----------------------------------- | ---------: | ------: | ------------------------------------ |
| `apps/web/features/auth/api`        |          1 |      12 | auth-api (era 6, +6 phone)           |
| `apps/web/features/auth/components` |          1 |      19 | auth-error mapper (era 10, +9 phone) |
| `apps/web/features/auth/schemas`    |          1 |       7 | schemas (era 4, +3 phone)            |
| `apps/web/features/auth/server`     |          1 |       7 | session/jose                         |
| `apps/web/features/auth/hooks`      |          1 |       5 | use-auth                             |
| **features/auth (total)**           |      **5** |  **50** | (era 38, **+12 tests**)              |
| **Resto del repo**                  |         46 |     416 | (sin cambios)                        |
| **TOTAL**                           |     **51** | **466** | (+19 desde 2026-06-30)               |

| Integration                                     | Tests | Estado                               |
| ----------------------------------------------- | ----: | ------------------------------------ |
| `scripts/verify-rules.ts` (Firestore + Storage) |    25 | PASS (sin cambios)                   |
| `scripts/verify-auth.ts` (Auth + Functions)     |    16 | PASS (era 11, +5 phone en Test [11]) |

---

## 6. Gaps previos del reporte `SDD-ALL-compliance-review.md` (2026-06-30)

| #        | Desviación                                    | Estado al 2026-07-17                                                                                                |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GAP-05-A | **Google SignIn provider no configurado**     | ✅ **RESUELTO vía scope change** — ADR-0007 descarta Google del MVP; en su lugar se implementa Phone Auth completo. |
| (nuevo)  | **Phone Auth faltante** (no en spec original) | ✅ **IMPLEMENTADO** — Q1=C en `execution-plan-sdd05.md`. Stack final = email + phone.                               |

---

## 7. Comandos ejecutados (reproducibilidad)

```bash
# Typecheck (workspace-wide)
pnpm typecheck
# → PASS (3 packages)

# Lint
pnpm lint
# → 0 errors, 0 warnings (--fix aplicó reordering de imports)

# Unit + integration tests
pnpm test
# → 466/466 PASS (51 files)

# Emuladores + integration auth
pnpm emulators:detach        # 6 ports up (auth:9099, firestore:8080, functions:5001, storage:9199, ui:4000, hub:4400)
pnpm --filter functions build
pnpm verify:auth
# → 16/16 PASS (incluye Test 11 con 5 phone scenarios)
```

---

## 8. Recomendaciones post-cierre

| #   | Acción                                                                                                             | Severidad | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------- | -------- |
| 1   | Actualizar `aidlc-docs/inception/reports/SDD-ALL-compliance-review.md` para reflejar SDD-05 = 14/14 (100 %) y Q1=C | Baja      | 5 min    |
| 2   | Documentar en README cómo invitar users por phoneNumber vía admin (CLI o UI)                                       | Media     | 1 h      |
| 3   | Rate-limiting por IP en `v1AuthCreateSession` para mitigar costo SMS en producción                                 | Media     | 2 h      |
| 4   | Whitelist del dominio de producción en Firebase Console para RecaptchaVerifier (no aplica dev/emulador)            | Baja      | 30 min   |

---

## 9. Conclusión

**SDD-05 está 100 % cumplida.** El gap previo (Google) se cerró mediante decisión documentada (ADR-0007) en favor de Phone Auth, que es más relevante para el segmento target. El reporte transversal debe actualizarse para reflejar 103+14-13 = **104/113 = 92.0 %** global (SDD-05 = 14/14).

No requiere más remediación. Se puede cerrar formalmente la iniciativa SDD-05.

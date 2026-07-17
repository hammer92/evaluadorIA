# ADR 0007 — Auth providers: Email + Phone (sin Google)

> **Estado:** Accepted (revierte Q1=A de `execution-plan-sdd05.md`)
> **Fecha:** 2026-07-17
> **Decisión:** implementar **Email/Password + Phone (OTP via SMS)** como únicos Auth providers. **NO Google**.
> **Supersede:** decisión Q1=A del documento `aidlc-docs/inception/plans/execution-plan-sdd05.md` (2026-06-29).

## Contexto

SDD-05 §1 y §2.1 mencionan "Email/password + Google provider" como stack de auth MVP. Durante la implementación (sprint `sdd-05-implementation`) se tomó la decisión táctica **Q1=A (email only)** documentada en `execution-plan-sdd05.md`, argumentando:

- Email/password cubre el 95 % de casos de uso target (RRHH + SMEs internos).
- Google provider introduce dependencia de OAuth client IDs y reCAPTCHA enterprise config en Firebase Console.
- El emulador Auth acepta email/password sin configuración adicional.

Al cierre del sprint, SDD-05 quedó en 13/14 (92.9 %) con GAP-05-A "Google SignIn no implementado" como única desviación.

Re-apertura 2026-07-17 (revisión AI-DLC):

- El equipo de producto decidió que **phone es más relevante que Google** para el segmento target (candidatos / evaluadores externos que no usan Google Workspace).
- Google queda descartado del scope MVP por decisión explícita.
- **Resultado**: stack final = **Email + Phone**, NO **Email + Google** como proponía el spec original.

## Decisión

1. **Auth providers soportados en MVP**: `password` (Firebase Auth email/password) + `phone` (Firebase Auth phone con OTP).
2. **NO Google SignIn**. No se configura `GoogleAuthProvider`, no se renderiza botón "Sign in with Google", no se importan primitivas de `firebase/auth` relacionadas.
3. **Phone login only** (no self-signup). Los users con phoneNumber son creados por admin vía `v1UsersCreate` CF + Admin SDK (`auth.createUser({ phoneNumber })`). El flujo cliente es OTP puro.
4. **RecaptchaVerifier invisible** montado en un `<div>` compartido en `/login` para reducir fricción UX.
5. **Audit log extendido** con 3 nuevos actions: `auth.phone_login`, `auth.phone_otp_requested`, `auth.phone_otp_failed`.

## Consecuencias

### Positivas

- Onboarding de evaluadores externos sin requerir email (solo teléfono).
- Cero dependencia de OAuth providers externos (Google, Apple, etc.).
- El emulador Auth soporta phone nativamente (cualquier `+E164` + código `123456`).
- Patrón consistente: ambos providers terminan llamando `createSession(user)` → cookie httpOnly.

### Negativas

- Costo de SMS en producción (Firebase Auth cobra por SMS). Mitigación: rate-limiting por IP en middleware (futuro SDD-08).
- `RecaptchaVerifier` requiere dominio whitelisted en Firebase Console para prod (no aplica en dev/emulador).
- Phone number changes post-onboarding requieren flujo adicional (out of scope MVP).

### Neutras

- El spec original queda parcialmente desactualizado en §1 (menciona Google). No se reescribe el spec; este ADR es la fuente de verdad sobre el scope real.
- `execution-plan-sdd05.md` debe actualizarse de **Q1=A → Q1=C (email + phone)**.

## Implementación

### Archivos nuevos / modificados (2026-07-17)

| Archivo                                                    | Cambio                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/web/features/auth/schemas.ts`                        | + `phoneE164Schema`, `phoneOtpRequestSchema`, `phoneOtpVerifySchema`                        |
| `apps/web/features/auth/api/auth-api.ts`                   | + `signInWithPhone()`, `verifyPhoneCode()`                                                  |
| `apps/web/features/auth/components/login-form.tsx`         | + tabs Email/Phone + `PhoneLoginForm` two-step                                              |
| `apps/web/features/auth/components/auth-error.ts`          | + 9 códigos de error de phone provider                                                      |
| `apps/web/lib/firebase/auth.ts`                            | + re-exports `signInWithPhoneNumber`, `RecaptchaVerifier`, `ConfirmationResult`             |
| `packages/shared/src/schemas/audit-logs.ts`                | + 3 audit actions (`auth.phone_login`, `auth.phone_otp_requested`, `auth.phone_otp_failed`) |
| `apps/web/features/dashboard/components/activity-item.tsx` | + labels/tone para los 3 nuevos actions                                                     |
| `apps/web/features/dashboard/api/dashboard-api.ts`         | `RecentAuditLog.action` ahora usa `AuditAction` (antes hardcoded union)                     |
| `scripts/verify-auth.ts`                                   | + Test 11 (5 pasos): phone-only user via Admin SDK                                          |
| `aidlc-docs/inception/plans/execution-plan-sdd05.md`       | Q1=A → Q1=C                                                                                 |

### Flujo cliente (Phone Login)

```
[PhoneLoginForm]
  ├── Step 1: user ingresa phone (E.164)
  │   ├── signInWithPhone({ phoneNumber, recaptchaContainerId })
  │   │   ├── valida phoneE164Schema
  │   │   ├── RecaptchaVerifier (invisible)
  │   │   └── signInWithPhoneNumber(auth, phone, verifier) → ConfirmationResult
  │   └── toast.success('Código enviado por SMS')
  │
  └── Step 2: user ingresa código de 6 dígitos
      ├── verifyPhoneCode(confirmation, code)
      │   ├── valida /^\d{6}$/
      │   └── confirmation.confirm(code) → User
      ├── createSession(user) → cookie httpOnly (mismo flow que email)
      └── router.push('/admin')
```

### Flujo admin (Phone invite)

```
admin (vía UI /admin/users) → v1UsersCreate CF
  ├── Admin SDK auth.createUser({ phoneNumber, displayName })
  ├── users/{uid}.set({ phoneNumber, ... })
  └── setCustomClaims({ role: 'recruiter' })
```

## Tests

- **Unit** (`apps/web/features/auth/api/auth-api.test.ts`): 6 nuevos casos para `signInWithPhone` y `verifyPhoneCode` (mockean SDK).
- **Integration** (`scripts/verify-auth.ts`): Test 11 con 5 pasos verifica Admin SDK path completo (createUser con phoneNumber, setUserRole, getUserByPhoneNumber).

## Alternativas consideradas

1. **Email + Google** (spec original, descartado): costo OAuth setup, friction para candidatos externos sin cuenta Google.
2. **Email + Apple** (considerado): misma friction de OAuth; menor adopción en el segmento target.
3. **Email + Phone + Google** (opción "full"): más trabajo, sin upside claro para el MVP.

## Referencias

- SDD-05 spec: `docs/sdd-package/02-sdds/SDD-05-auth-authorization.md`
- Execution plan previo: `aidlc-docs/inception/plans/execution-plan-sdd05.md`
- Compliance report: `aidlc-docs/inception/reports/SDD-05-compliance-review-2026-07-17.md`
- Firebase Auth Phone: https://firebase.google.com/docs/auth/web/phone-auth
- Auth emulator + phone: https://firebase.google.com/docs/emulator-suite/connect_auth#phone_numbers

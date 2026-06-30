# Security

Política de seguridad del proyecto, reporte de vulnerabilidades y lista
de hardenings aplicados.

> **Arquitectura de seguridad**: [`ARCHITECTURE.md` §8](./ARCHITECTURE.md#8-seguridad--checklist-aplicado).
> **CI/CD + secrets**: [`docs/CI-CD.md` §Secrets](./docs/CI-CD.md#secrets-requeridos).

---

## Tabla de contenidos

- [Reporte de vulnerabilidades](#reporte-de-vulnerabilidades)
- [Política de respuesta](#política-de-respuesta)
- [Versiones soportadas](#versiones-soportadas)
- [Hardenings aplicados](#hardenings-aplicados)
- [Modelo de amenazas](#modelo-de-amenazas)
- [Checklist para nuevos devs](#checklist-para-nuevos-devs)
- [Auditoría](#auditoría)

---

## Reporte de vulnerabilidades

**NO abras un issue público** para reportar vulnerabilidades. Tampoco lo
discutas en Slack/Discord público.

### Canal privado

Envía un email a:

```
<security-team-email>          # Reemplazar por el email real (ej. security@knowledgesync.app)
```

Con la siguiente información:

1. **Tipo** (XSS, SQLi, RCE, info disclosure, auth bypass, etc).
2. **Severidad estimada** (Critical / High / Medium / Low).
3. **Pasos para reproducir** (idealmente un PoC mínimo).
4. **Impacto potencial** (qué datos / sistemas están expuestos).
5. **Versión / commit SHA** donde se reproduce.
6. **Tu nombre y contacto** (opcional, para crédito en el fix).

### Cifrado opcional

Si preferís cifrar el reporte, solicitar la clave PGP pública por email
(no la publicamos acá porque este repo es público).

---

## Política de respuesta

| Severidad    | Acknowledgement | Triage    | Fix target     | Disclosure            |
| ------------ | --------------- | --------- | -------------- | --------------------- |
| **Critical** | < 24h           | < 24h     | < 7 días       | coordinada (90 días)  |
| **High**     | < 48h           | < 3 días  | < 30 días      | coordinada (90 días)  |
| **Medium**   | < 5 días        | < 7 días  | < 60 días      | coordinada (90 días)  |
| **Low**      | < 10 días       | < 30 días | próximo sprint | en el próximo release |

**Coordinated disclosure**: no publicamos el detalle de la vulnerabilidad
hasta que el fix esté disponible en una versión estable (o hasta cumplir
el plazo máximo de 90 días, lo que ocurra primero).

**Créditos**: si el reporter lo autoriza, lo mencionamos en el CHANGELOG
y en la sección [Auditoría](#auditoría) abajo.

---

## Versiones soportadas

| Versión              | Estado             | Seguridad             |
| -------------------- | ------------------ | --------------------- |
| `main`               | ✅ en desarrollo   | patches críticos ASAP |
| últimos 2 tags       | ✅ soportada       | patches de seguridad  |
| tags anteriores      | ⚠️ solo fix manual | best effort           |
| versiones muy viejas | ❌ no soportada    | EOL                   |

---

## Hardenings aplicados

Lista de medidas de seguridad implementadas. Cada item linkea al código
o config que lo enforce.

### Autenticación y autorización

- [x] **Custom Claims como única fuente de verdad para roles** — los roles
      viven en Firebase Auth custom claims (`setCustomUserClaims`). El front
      los lee vía `getIdTokenResult(true)`. Ver
      `apps/functions/src/v1/users/invite-user.ts` y
      `apps/web/features/auth/hooks/use-auth.ts`.
- [x] **First-user-admin bootstrap** — el primer signup se promueve a
      admin en una transacción atómica (`v1AuthSignUp`). Ver
      `apps/functions/src/v1/auth/sign-up.ts`.
- [x] **Sesiones con JWT HS256 firmado por backend** — cookie `__session`
      firmada con `jose.SignJWT` + `SESSION_COOKIE_SECRET` (Secret Manager).
      No usamos Firebase session cookie (decisión arquitectónica 0007).
- [x] **Middleware valida JWT y claims en cada request a `/admin/**`** —
`apps/web/middleware.ts`con`jose.jwtVerify` HS256.
- [x] **Defense in depth en repositorios** — los repos chequean rol del
      `Ctx` antes de mutar, además de las rules. Ver
      `apps/web/repositories/users/firebase.ts` (`update` / `delete`).

### Frontend

- [x] **ESLint rechaza imports directos de Firebase** fuera de
      `repositories/<entidad>/firebase.ts` + `lib/firebase/*`. Ver
      `eslint.config.mjs` (`no-restricted-imports`).
- [x] **Headers de seguridad en todas las responses** — configurados en
      `apps/web/next.config.mjs`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- [x] **Cookie `__session` con flags**: `HttpOnly`, `SameSite=Lax`,
      `Secure` en prod, `Path=/`, sin `Domain` (host-only).
- [x] **CSRF mitigado** por SameSite=Lax + verificación del Origin en
      Cloud Functions (`apps/functions/src/shared/with-auth.ts`).
- [x] **No secrets en cliente** — `NEXT_PUBLIC_*` solo expone keys de
      Firebase Config (públicas por diseño) y `APP_ENV`. Nada más.

### Backend (Cloud Functions)

- [x] **CORS whitelist explícito por entorno** — `ALLOWED_ORIGINS` se
      parsea en cada handler de CF y rechaza orígenes no listados. Ver
      `apps/functions/src/shared/handle-cors.ts`.
- [x] **Secrets vía `defineSecret`, no `process.env`** — `SESSION_COOKIE_SECRET`
      se inyecta con `defineSecret('SESSION_COOKIE_SECRET')` para que
      Firebase lo monte desde Secret Manager.
- [x] **Validación de input con Zod en cada handler** —
      `validateInput(<schema>)` en todos los endpoints v1. Ver
      `apps/functions/src/shared/validate-input.ts`.
- [x] **Wrappers reutilizables** — `with-auth` (verifyAuth + role check),
      `handle-error` (mapea errores a HTTP status + JSON), `validate-input`
      (Zod parse).

### Datos (Firestore + Storage)

- [x] **Rules de Firestore niegan por defecto**:
      `match /{document=**} { allow read, write: if false; }`. Ver
      `firestore.rules:120-123`.
- [x] **Rules de Storage niegan por defecto**. Ver `storage.rules:9-11`.
- [x] **`auditLogs` es append-only desde Admin SDK** — el cliente no
      puede escribir:
      `match /auditLogs/{logId} { allow read: if isSignedIn() && hasRole('admin'); allow write: if false; }`.
- [x] **Users pueden editar solo `displayName/photoURL` propios** —
      `firestore.rules:147-148`.
- [x] **Índices declarados explícitamente** en `firestore.indexes.json`
      para evitar scans de collection.
- [x] **Soft delete con `deleted_at`** — preserva auditoría. No se borra
      físicamente desde cliente.

### Dependencias

- [x] **Dependabot semanal** — `.github/dependabot.yml` con `pnpm` weekly
  - `github-actions` monthly.
- [x] **`pnpm audit`** antes de cada release (manual, agregado a
      `docs/CI-CD.md` §Troubleshooting).
- [x] **Lockfile committed** (`pnpm-lock.yaml`) — installs reproducibles.
- [x] **Sin deps con advisories críticos abiertos** — monitorear
      `dependabot` alerts + GitHub Security tab.

### CI/CD

- [x] **No se loguea contenido de secrets** — los workflows usan
      `${{ secrets.* }}` enmascarado automáticamente.
- [x] **PRs de externos requieren approval antes de correr CI con secrets**
      (configurar en branch protection, ver [`CONTRIBUTING.md`](./CONTRIBUTING.md)).
- [x] **Workflows `deploy-*` solo corren en `main`** + requieren
      aprobación manual para prod.

---

## Modelo de amenazas

### Actores

- **Usuario autenticado** (rol `admin`, `recruiter`, `expert`).
- **Atacante externo** sin credenciales (intenta robar sesiones, CSRF, XSS).
- **Usuario autenticado malicioso** (abusa de permisos legítimos, intenta
  escalar privilegios).
- **Insider con acceso a GitHub** (podría leer secrets si se filtran).

### Amenazas consideradas

| Amenaza                                            | Mitigación                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Robo de cookie de sesión                           | HttpOnly + Secure + SameSite=Lax + JWT firmado HS256 con TTL            |
| Suplantación de usuario (XSS)                      | Sin React `dangerouslySetInnerHTML`, headers CSP (TODO), escape HTML    |
| CSRF en mutaciones                                 | SameSite=Lax + Origin check en CFs                                      |
| Escalada de privilegios (user → admin)             | Solo admins pueden `setCustomUserClaims` (requiere service account)     |
| Lectura masiva de Firestore                        | Rules por documento + índices + paginación obligatoria (pageSize ≤ 100) |
| Escritura directa a `auditLogs` (borrar evidencia) | `allow write: if false` desde cliente                                   |
| Denegación de servicio (DoS)                       | Rate limiting en middleware (TODO v2) + emuladores separados            |
| Filtración de secrets en logs                      | GitHub Secrets enmascarados, sin `console.log` de tokens                |
| Inyección de dependencias (`npm`)                  | Lockfile + Dependabot + audit                                           |

### Amenazas NO consideradas (out of scope MVP)

- Ataques laterales en la infraestructura Firebase/GCP (asumimos que
  Google securiza la plataforma).
- Compromiso de la workstation del dev (asumimos device management).
- Insider con acceso root al repo (mitigado por principle of least
  privilege en GitHub + audit logs).
- Compliance con HIPAA / PCI / SOC2 (asumimos que el producto no maneja
  PHI ni datos de pago en MVP).

---

## Checklist para nuevos devs

Antes de mergear tu primer PR:

- [ ] Leíste [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2 (regla de capas).
- [ ] Leíste [`CONTRIBUTING.md`](./CONTRIBUTING.md) §Convenciones.
- [ ] Corriste `pnpm verify:auth` y `pnpm verify:rules` en local.
- [ ] Configuraste tu `git config` (ver [`CONTRIBUTING.md`](./CONTRIBUTING.md) §Configuración recomendada).
- [ ] No pusheaste secrets (verificaste `.gitignore` + no hay
      `credentials.json` / `*service-account*` en el diff).
- [ ] Tus PRs no introducen imports directos de `firebase/*` fuera de
      los paths permitidos (ESLint lo enforce).
- [ ] Si tocaste auth/CF/rules, agregaste tests de integración contra
      emuladores.
- [ ] Si tocaste headers / cookies, verificaste con
      `curl -I https://localhost:3000/<ruta>` que las flags siguen activas.

---

## Auditoría

| Fecha      | Auditor                | Hallazgos                                                                                                                                 |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-30 | AI-DLC process auditor | Compliance review SDD-ALL: 90.3% global; SDD-09 subimplementada (37.5%). Ver `aidlc-docs/inception/reports/SDD-ALL-compliance-review.md`. |

Reportes futuros se agregan como `aidlc-docs/operations/audits/<fecha>-<tipo>.md`
y se linkean desde acá.

---

## Contacto

- **Email de seguridad**: `<security-team-email>` (reemplazar).
- **Slack interno**: `#security` (no usar para reportes críticos; usar
  email).
- **GitHub Security Advisories**: ver tab Security del repo (deshabilitado
  en MVP privado).

---

## Out of scope (v2+)

- Pentesting externo anual con reporte público.
- Bug bounty program.
- SOC 2 / ISO 27001 compliance.
- WAF (Cloud Armor) delante del frontend.
- Rate limiting por IP en middleware.
- CSP estricta en headers.
- SSO (Google Workspace / Okta).
- Auditoría de logs inmutable (Cloud Audit Logs + export a BigQuery).
- Rotación automática de `SESSION_COOKIE_SECRET` cada 90 días.

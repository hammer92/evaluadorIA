# Master Plan — Plataforma Administrativa Full-Stack

> **Estado:** Draft v1.0
> **Autor:** Solution Architect
> **Fecha:** 2026-06-24

---

## 1. Objetivo

Construir una **aplicación web administrativa full-stack** desplegada sobre componentes serverless de Firebase, con una **arquitectura vendor-agnostic** en su capa de dominio. La capa `/repositories` aísla al vendor; el resto de la app (UI, services, features) no sabe ni le importa que el backing es Firebase. Migrar a AWS / GCP Cloud Run / Vercel debe requerir tocar **únicamente** `/repositories`, `/lib/firebase/*` y los archivos de deploy.

---

## 2. Entregables por fase (resumen)

Cada fase corresponde a **un SDD** y a **una o más épicas** del board. La numeración es la misma en los dos lados.

| Fase | SDD    | Épica(s)          | Resultado verificable                                                                                                  |
| ---- | ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | SDD-01 | Toolchain         | `pnpm install` + `pnpm dev` + `pnpm test` corren en local                                                              |
| 2    | SDD-02 | Frontend shell    | App Next.js levanta en `:3000`, layout con sidebar + dark mode                                                         |
| 3    | SDD-03 | Firebase infra    | Emulators (auth, firestore, functions, storage) levantan limpios; reglas niegan por defecto                            |
| 4    | SDD-04 | Capa repositorios | 3 entidades (`users`, `organizations`, `auditLogs`) con interfaz + impl Firebase + impl Memory + factory; tests verdes |
| 5    | SDD-05 | Auth              | Login funcional, sesión persiste, rutas `/admin/**` protegidas, custom claims operativos                               |
| 6    | SDD-06 | Cloud Functions   | 2 endpoints HTTPS v1 (`createUser`, `generateReport`) tipados, con auth + Zod                                          |
| 7    | SDD-07 | UI admin          | Dashboard, `/users` con tabla+modal, `/settings` con tabs                                                              |
| 8    | SDD-08 | CI/CD             | PR corre lint+typecheck+test; merge a `main` depliega a staging; workflow manual para prod                             |
| 9    | SDD-09 | Docs del repo     | README, ARCHITECTURE, CONTRIBUTING, DEPLOY completos                                                                   |

---

## 3. Roadmap sugerido (3 sprints)

### Sprint 1 — Cimientos (Fases 1-4)

**Objetivo:** el dev puede clonar, instalar, levantar emuladores, escribir un repositorio nuevo con tests, y mergear un PR que pase CI.

Tickets típicos:

- Inicializar monorepo con `pnpm` + workspaces (`apps/web`, `apps/functions`, `packages/shared`).
- Configurar TS estricto, ESLint, Prettier, Husky, Vitest en root y en cada paquete.
- Bootstrap de Next.js 14 + Tailwind + shadcn/ui + TanStack Query + Zustand.
- Configurar Firebase Emulator Suite.
- Implementar 3 repositorios con tests.

**Definition of Done del sprint:** un dev junior puede levantar el stack local y agregar una entidad nueva siguiendo la convención sin preguntar.

### Sprint 2 — Auth + Serverless (Fases 5-6)

**Objetivo:** un usuario puede registrarse, loguearse, acceder a `/admin`, y un endpoint protegido responde.

Tickets típicos:

- SignIn / SignUp / SignOut + `useAuth` hook.
- Middleware Next.js para `/admin/**`.
- `verifyAuth()` server-side + helper `onCallAuth`.
- 2 endpoints Cloud Functions v1 con tests.

**DoD:** flujo login → dashboard funciona contra emuladores; tests e2e del happy path verdes.

### Sprint 3 — Producto + Deploy (Fases 7-8)

**Objetivo:** la UI admin está completa y los deploys a staging/prod están automatizados.

Tickets típicos:

- Dashboard con stats cards.
- `/users` con tabla, filtros, paginación, modal de create/edit.
- `/settings` con tabs (profile, team, billing).
- GitHub Actions workflows (lint+test, deploy staging, deploy prod manual).
- Configurar Firebase Hosting con cache headers.

**DoD:** `pnpm deploy:staging` publica; preview URLs por PR funcionan.

### Sprint 4 (paralelo desde el sprint 1) — Documentación (Fase 9)

Se entrega junto con cada sprint. No se acumula al final.

---

## 4. Dependencias críticas entre fases

```
[Fase 1] ──► [Fase 2] ──► [Fase 5] ──► [Fase 7]
   │           │            │
   └──► [Fase 3] ──► [Fase 4] ──┘
                │
                └──► [Fase 6]
```

- **Fase 4 depende de Fase 3** (necesita emuladores corriendo para probar).
- **Fase 5 depende de Fase 4** (el `useAuth` consume el `UserRepository`).
- **Fase 7 depende de Fase 5** (la UI consume el hook de auth).
- **Fase 6 depende de Fase 3** (emuladores + reglas). Puede arrancar en paralelo a Fase 4-5.
- **Fase 8 puede arrancar tarde en Sprint 1** (solo necesita Fase 1 lista).

---

## 5. Stack confirmado

Ver `01-architecture/ARCHITECTURE.md` para el detalle de componentes y los ADRs individuales para el rationale de cada elección.

| Capa            | Tecnología                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | Next.js 14 (App Router, RSC), React 18, TypeScript estricto, Tailwind, shadcn/ui, TanStack Query v5, Zustand, React Hook Form + Zod, Lucide, next-themes |
| Backend         | Firebase Cloud Functions 2nd gen (Node.js 20 LTS)                                                                                                        |
| Validación      | Zod (compartido cliente/servidor en `packages/shared`)                                                                                                   |
| DB              | Cloud Firestore                                                                                                                                          |
| Storage         | Cloud Storage                                                                                                                                            |
| Auth            | Firebase Auth (Email + Google) + Custom Claims                                                                                                           |
| Hosting         | Firebase Hosting + Cloud Run para SSR (si se requiere)                                                                                                   |
| CI/CD           | GitHub Actions                                                                                                                                           |
| Package manager | pnpm (workspaces)                                                                                                                                        |
| Testing         | Vitest + Testing Library + Firebase Emulator Suite                                                                                                       |
| Lint/Format     | ESLint + Prettier + Husky + lint-staged                                                                                                                  |

---

## 6. Restricciones heredadas del brief

> Estas vienen del brief original y son **inquebrantables**. Si un SDD las viola, está mal.

- NO usar Realtime Database (siempre Firestore).
- NO instalar paquetes que toquen filesystem del cliente.
- NO usar Firebase Admin SDK en código de cliente.
- NO crear colecciones sin índices ni reglas de seguridad.
- NO hacer deploy a prod sin pasar emuladores y tests.
- NO usar `as any`, `@ts-ignore`, `@ts-expect-error` sin comentario explicativo.
- Cero secrets commiteados.
- Bundle inicial < 200KB gzip (objetivo, no hard limit para MVP).

---

## 7. Criterios globales de "Done" para cualquier SDD

Un SDD se considera completo cuando:

1. Todos los criterios de aceptación de su checklist están marcados.
2. `pnpm lint` pasa sin warnings.
3. `pnpm typecheck` pasa sin errores.
4. `pnpm test` pasa con coverage ≥ 70% en archivos nuevos.
5. La documentación JSDoc de las funciones públicas está escrita.
6. La sección "Open Questions" del SDD está vacía o tiene respuestas.
7. Un reviewer distinto al autor aprobó el PR.

---

## 8. Cómo contribuir a este paquete

1. Abrí un PR con un único cambio lógico.
2. Si es un cambio breaking, bump la versión del paquete en el front-matter.
3. Si introduce una decisión nueva, creá primero un ADR en `01-architecture/decisions/` siguiendo el template.

---

## 9. Riesgos de programa

| #   | Riesgo                                                                        | Mitigación                                                                                                                   |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | La disciplina del repository pattern se rompe en la primera presión de tiempo | Code review checklist específico + test que verifica que ningún módulo fuera de `/repositories` importa `firebase/firestore` |
| 2   | Los emuladores no matchean prod (ej. comportamiento de Auth en reglas)        | Smoke test post-deploy a staging contra proyecto real                                                                        |
| 3   | Migración futura a otro vendor es más difícil de lo que parece                | Mantener `memory.ts` siempre actualizado; agregar tests de contrato contra la interfaz                                       |
| 4   | Bundle crece sin control                                                      | Budget de bundle enforced en CI (size-limit) desde Fase 2                                                                    |
| 5   | Secrets se filtran en el PR inicial                                           | `gitleaks` en pre-commit + CI en Fase 1                                                                                      |

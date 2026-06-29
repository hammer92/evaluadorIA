# Component Inventory

## Application Packages

| Package          | Nombre npm      | Proposito               | Estado                      |
| ---------------- | --------------- | ----------------------- | --------------------------- |
| `apps/web`       | `@platform/web` | Panel admin Next.js 14  | Implementado (shell SDD-02) |
| `apps/functions` | —               | Cloud Functions 2nd gen | Placeholder vacio           |

## Infrastructure Packages

Ninguno en codigo. Infraestructura planificada via Firebase CLI (emulators, hosting, rules) — SDD-03/08.

## Shared Packages

| Package           | Nombre npm         | Proposito                       | Estado                        |
| ----------------- | ------------------ | ------------------------------- | ----------------------------- |
| `packages/shared` | `@platform/shared` | Schemas Zod + tipos compartidos | Minimal (solo version export) |

## Test Packages

No hay paquetes de test dedicados. Vitest configurado en root y `apps/web` pero sin archivos `*.test.ts` en el codigo fuente del proyecto.

## Documentation Packages

| Ubicacion                  | Proposito                               |
| -------------------------- | --------------------------------------- |
| `doc/sdd-package/`         | SDD-01 a SDD-09, arquitectura, ADRs     |
| `doc/System-Design.md`     | Diseno de sistema evaluacion candidatos |
| `doc/Propuesta-Negocio.md` | Contexto de negocio B2B                 |
| `aidlc-docs/`              | Artefactos AI-DLC workflow              |

## AI-DLC Rules

| Ubicacion                | Proposito                  |
| ------------------------ | -------------------------- |
| `.aidlc/aidlc-rules/`    | Reglas AWS AI-DLC workflow |
| `.agents/skills/ai-dlc/` | Skill Cursor para AI-DLC   |

## Total Count

- **Total Packages (codigo)**: 3
- **Application**: 2 (1 implementado, 1 placeholder)
- **Infrastructure**: 0
- **Shared**: 1
- **Test**: 0

## Modulos planificados (no creados aun)

Segun `doc/sdd-package/01-architecture/ARCHITECTURE.md`:

- `apps/web/repositories/` — Capa de datos vendor-agnostic
- `apps/web/services/` — Logica de negocio
- `apps/web/features/` — Modulos por dominio
- `apps/web/lib/firebase/` — SDK wrappers
- `packages/shared/src/schemas/` — Zod schemas
- `packages/shared/src/types/` — Tipos inferidos
- `packages/shared/src/errors/` — Errores tipados

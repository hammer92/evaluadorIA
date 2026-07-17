# Paquete de SDDs — Plataforma Administrativa Full-Stack

> **Estado:** Draft v1.0 — pendiente de aprobación del Engineering Lead
> **Autor:** Solution Architect
> **Fecha:** 2026-06-24
> **Stack objetivo:** Next.js 14 + Firebase (serverless) + arquitectura vendor-agnostic

---

## ¿Qué es este paquete?

Este es el **contrato técnico** entre Arquitectura y el equipo de desarrollo. Contiene las decisiones, especificaciones y criterios de aceptación que el equipo debe seguir para construir la plataforma. **No es código** — es la guía que define cómo se debe escribir el código.

Si algo en el código entra en conflicto con este paquete, gana este paquete.

---

## ¿Cómo navegarlo?

```
sdd-package/
├── README.md                         ← este archivo
├── 00-master-plan.md                 ← roadmap, fases, dependencias
│
├── 01-architecture/                  ← decisiones transversales
│   ├── ARCHITECTURE.md               ← diagrama de sistema + componentes
│   ├── coding-conventions.md         ← reglas de estilo inquebrantables
│   ├── data-model.md                 ← modelo de datos + reglas Firestore
│   ├── api-spec.md                   ← contratos HTTPS / callable
│   └── decisions/                    ← ADRs (Architecture Decision Records)
│       ├── 0001-monorepo-pnpm.md
│       ├── 0002-repository-pattern.md
│       ├── 0003-firestore-over-rtdb.md
│       └── 0004-zod-shared-validation.md
│
├── 02-sdds/                          ← specs implementables por fase
│   ├── _template.md                  ← plantilla para nuevos SDDs
│   ├── SDD-01-monorepo-tooling.md
│   ├── SDD-02-frontend-foundation.md
│   ├── SDD-03-firebase-setup.md
│   ├── SDD-04-repository-layer.md
│   ├── SDD-05-auth-authorization.md
│   ├── SDD-06-cloud-functions.md
│   ├── SDD-07-admin-ui.md
│   ├── SDD-08-cicd-deploy.md
│   └── SDD-09-documentation.md
│
└── 03-appendix/
    ├── glossary.md                   ← vocabulario del dominio
    ├── dependency-map.md             ← grafo de dependencias entre SDDs
    └── acceptance-checklist.md       ← checklist final por SDD
```

### Regla de lectura

| Si sos...              | Leé primero                                                 | Después                                      |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| **Tech Lead**          | `00-master-plan.md`                                         | `01-architecture/ARCHITECTURE.md`            |
| **Dev Frontend**       | `00-master-plan.md` → `SDD-01` → `SDD-02`                   | `SDD-04` → `SDD-05` → `SDD-07`               |
| **Dev Backend**        | `00-master-plan.md` → `SDD-01`                              | `SDD-03` → `SDD-04` → `SDD-06`               |
| **DevOps**             | `SDD-01` → `SDD-08`                                         | `SDD-03` (reglas)                            |
| **QA**                 | `03-appendix/acceptance-checklist.md`                       | cada SDD (sección "Criterios de aceptación") |
| **Nuevo en el equipo** | `01-architecture/coding-conventions.md` → `ARCHITECTURE.md` | después, el SDD de tu área                   |

---

## Principios arquitectónicos inquebrantables

Estos principios **no se negocian**. Cualquier desviación requiere aprobación explícita del arquitecto vía ADR nuevo.

1. **Aislamiento del vendor**: nada en `/app`, `/components`, `/features` o `/services` importa `firebase/*` directamente. Solo `/repositories` y `/lib/firebase/*` tocan el SDK.
2. **Repository pattern obligatorio**: cada entidad tiene una **interfaz TypeScript** en `/repositories/<entidad>/index.ts` con dos implementaciones: `firebase.ts` (producción) y `memory.ts` (tests). Inyección por factory.
3. **Validación con Zod en ambos extremos**: el mismo schema se usa en cliente (formularios) y servidor (Cloud Functions). Server **nunca confía** en el payload.
4. **Variables de entorno validadas al arranque**: `env.ts` con Zod. Cualquier `process.env.X` fuera de `env.ts` es bug.
5. **Reglas de Firestore / Storage denegando por defecto**: solo lo explícitamente permitido es accesible, basado en Custom Claims del JWT.
6. **Cero `any`**: si un boundary externo lo requiere (ej. SDK externo), comentario obligatorio explicando por qué y `# eslint-disable-next-line` solo con motivo.
7. **Tests obligatorios para repositories y services**: mínimo 70% coverage en esas capas. PR sin tests no se aprueba.
8. **Sin secretos en código**: variables sensibles vía Firebase Secret Manager o `.env.local` (nunca commiteado, en `.gitignore`).

---

## Cómo se usa este paquete en el día a día

### Al empezar una HU / ticket

1. Identificá a qué SDD pertenece (ver `03-appendix/dependency-map.md`).
2. Leé la sección **"Spec detallada"** del SDD completo.
3. Si tu ticket toca varias capas, consultá `01-architecture/` antes de escribir código.

### Al pedir revisión (PR)

- El reviewer verifica que el PR cumpla con el **"Acceptance Criteria"** del SDD correspondiente.
- Si tu PR introduce un cambio que no estaba en el SDD, abrí primero un ADR en `01-architecture/decisions/` y esperá aprobación.

### Al encontrar ambigüedad

- No asumas. Preguntá en el canal `#architecture` o abrí un **Open Question** en el SDD afectado (sección final).
- Si encontrás un error en este paquete, abrí un PR correctivo. No "arregles" el código para matchear tu interpretación.

---

## Convenciones del paquete

- **Idioma**: los SDDs se escriben en español; código y nombres de archivo en inglés.
- **Versionado**: este paquete se versiona con el repo. Cambios breaking → bump major.
- **Estado de cada SDD**: `Draft` → `In Review` → `Approved` → `Superseded`.
- **Decisiones con ADR**: cualquier decisión arquitectónica nueva se documenta en `01-architecture/decisions/` siguiendo el formato del template incluido.

---

## Próximos pasos

1. Revisión de Arquitectura → Tech Lead → Producto.
2. Aprobación de los 9 SDDs en sesión de planning.
3. Creación de tickets en el board a partir del `00-master-plan.md`.
4. **No se escribe código hasta que los SDDs estén `Approved`**.

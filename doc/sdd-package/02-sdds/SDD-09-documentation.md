# SDD-09: Documentación del repo

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Continuo desde Sprint 1
> **Depende de:** SDD-01
> **Bloquea a:** —

---

## 1. Contexto

Un repo sin documentación es un repo donde nadie quiere entrar. Este SDD define los 4 docs obligatorios del repo (README, ARCHITECTURE, CONTRIBUTING, DEPLOY) más los estándares de comentarios JSDoc en el código. La documentación se escribe **junto** con el código, no al final.

## 2. Goals y Non-Goals

### Goals

- `README.md` root con onboarding de 5 min para un dev nuevo.
- `ARCHITECTURE.md` con diagrama de sistema y referencia a los ADRs/SDDs.
- `CONTRIBUTING.md` con flujo de PR + checklist.
- `DEPLOY.md` con proceso paso a paso para deploy manual.
- JSDoc en todas las funciones/tipos públicos.
- Changelog automático (a partir de conventional commits).
- Diagramas Mermaid donde aporten (no decoración).

### Non-Goals

- Docs site con Docusaurus / Nextra (no en MVP).
- ADRs fuera de `01-architecture/decisions/`.
- Videos tutoriales.
- Traducción a otros idiomas.

## 3. Decisiones de arquitectura

| #   | Decisión                                             | Justificación                                                                 |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Markdown en el repo, no en un SaaS                   | Junto al código; mismo PR puede tocarlos.                                     |
| 2   | Conventional Commits + release-please para changelog | Automático, sin overhead manual.                                              |
| 3   | Mermaid para diagramas                               | Renderiza en GitHub nativo.                                                   |
| 4   | JSDoc con TSDoc-style tags                           | Compatible con most editors + typedoc si en el futuro se quiere generar site. |

## 4. Spec detallada

### 4.1 Estructura

```
/
├── README.md                     # onboarding
├── ARCHITECTURE.md               # visión técnica de alto nivel
├── CONTRIBUTING.md               # cómo contribuir
├── DEPLOY.md                     # cómo deployar
├── CHANGELOG.md                  # generado por release-please
├── LICENSE
├── CODE_OF_CONDUCT.md
├── SECURITY.md                   # cómo reportar vulnerabilidades
└── docs/
    ├── decisions/                # mirror de 01-architecture/decisions/
    │   └── README.md
    └── runbooks/
        ├── rollback.md
        ├── incident-response.md
        └── data-migration.md
```

### 4.2 `README.md`

Secciones obligatorias:

```markdown
# Admin Platform

> Plataforma administrativa full-stack construida sobre Firebase con arquitectura vendor-agnostic.

## Tabla de contenidos

- [Stack](#stack)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Estructura del repo](#estructura-del-repo)
- [Arquitectura](#arquitectura)
- [Documentación](#documentación)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Stack

[tabla con las tecnologías principales]

## Quick start

[5 pasos para levantar localmente]

## Scripts

[tabla de scripts pnpm]

## Estructura del repo

[árbol de carpetas con descripción de cada nivel]

## Arquitectura

[diagrama mermaid + link a ARCHITECTURE.md]

## Documentación

[links a todos los docs]

## Contribuir

[link a CONTRIBUTING.md]

## Licencia

[PROPRIETARY o la que aplique]
```

### 4.3 `ARCHITECTURE.md`

A nivel root, sirve de **entry point** a la documentación técnica. Contiene:

- Diagrama de sistema (Mermaid).
- Tabla de capas con qué puede importar qué.
- Tabla de decisiones clave con link a ADRs.
- Flujos críticos (login, llamada a Cloud Function) en diagramas de secuencia.
- Stack y versiones.
- Links a:
  - `sdd-package/` (SDDs).
  - `01-architecture/` en el repo o link a este paquete.
  - Diagramas Mermaid específicos.

### 4.4 `CONTRIBUTING.md`

Secciones obligatorias:

```markdown
# Contribuir

## Flujo de trabajo

1. Issue o ticket en el board.
2. Branch desde `main`: `feat/<scope>-<short-desc>`.
3. Commits con Conventional Commits.
4. PR con template completo + al menos 1 reviewer.
5. CI pasa → squash merge a `main`.

## Conventional Commits

[ejemplos de feat, fix, chore, docs, refactor, test, perf, ci]

## Estándares de código

- TypeScript estricto. Cero `any` salvo casos justificados.
- ESLint + Prettier. `pnpm lint` y `pnpm format`.
- Tests para nueva lógica. Coverage ≥ 70% en archivos nuevos.

## Checklist de PR

- [ ] Tests agregados
- [ ] Docs actualizadas si cambia comportamiento o API
- [ ] No imports de `firebase/*` fuera de `/repositories` y `/lib/firebase`
- [ ] CI pasa localmente (`pnpm lint`, `pnpm typecheck`, `pnpm test`)
- [ ] Probé contra emuladores

## Decisiones de arquitectura

Si tu cambio introduce una decisión técnica, primero un ADR en `01-architecture/decisions/`.

## Reportar bugs

[link a SECURITY.md si aplica, sino a issues]
```

### 4.5 `DEPLOY.md`

Secciones obligatorias:

```markdown
# Deploy

## Ambientes

[tabla con dev/staging/prod y URLs]

## Pre-requisitos

- Acceso al Firebase project
- Service account con rol de deploy
- GitHub Secrets configurados (ver `sdd-package/02-sdds/SDD-08-cicd-deploy.md`)

## Deploy a staging

[trigger automático por merge a main, paso a paso si manual]

## Deploy a prod

[workflow manual con confirmación]

## Rollback

[procedimiento]

## Logs

[comandos firebase functions:log, URLs de Cloud Logging]

## Troubleshooting

[problemas comunes]
```

### 4.6 `SECURITY.md`

```markdown
# Seguridad

## Reportar vulnerabilidad

Email: security@example.com (NO abrir issue público).
PGP key si aplica.

## Política de respuesta

- Acuse en 48h.
- Fix en 7 días para high/critical, 30 días para medium.

## Hardening ya implementado

- Reglas Firestore con denegación por defecto.
- Custom Claims como única fuente de roles.
- Secret Manager para secrets.
- gitleaks en CI.
- Cookies httpOnly + SameSite=Lax.
  [etc]
```

### 4.7 JSDoc estándar

Mínimo obligatorio en:

- Toda función exportada.
- Toda interfaz pública.
- Todo tipo público.

Template:

````ts
/**
 * Brief description in one line.
 *
 * Longer description if needed, explaining the why, edge cases, etc.
 *
 * @param paramName - Description
 * @returns Description
 * @throws {RepositoryError} When and why
 *
 * @example
 * ```ts
 * const result = await myFunction('input');
 * ```
 */
````

> El dev que escribe la función es responsable del JSDoc. No se acepta PR sin JSDoc en lo público.

### 4.8 release-please config

```jsonc
// release-please-config.json
{
  "release-please": {
    "package-name": "admin-platform",
    "version": "0.1.0",
    "changelog-path": "CHANGELOG.md",
    "pull-request-title-pattern": "chore(release): ${version}",
    "packages": {
      ".": {
        "release-type": "node",
        "package-name": "admin-platform",
      },
      "apps/web": { "package-name": "@platform/web" },
      "apps/functions": { "package-name": "@platform/functions" },
      "packages/shared": { "package-name": "@platform/shared" },
    },
  },
}
```

### 4.9 Comportamiento esperado

- Dev nuevo clona repo, lee README (5 min), corre `pnpm install && pnpm dev`, ve la app en localhost.
- Cualquier PR toca docs si cambia comportamiento.
- ADRs se acumulan en `01-architecture/decisions/` con numeración secuencial.
- `release-please` abre PR de release cuando hay commits desde el último release; al mergearlo, se taggea.

### 4.10 Errores y excepciones

| Situación              | Cómo se maneja                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ |
| README desactualizado  | Code review bloquea PR que cambia comportamiento sin actualizar README/ARCHITECTURE. |
| ADR nuevo no se agrega | Reviewer pide ADR antes de mergear decisión nueva.                                   |
| Changelog no se genera | release-please action corre en CI; si falla, notificar al maintainer.                |

## 5. Criterios de aceptación

- [ ] `README.md` permite a un dev nuevo levantar el stack en 5 minutos.
- [ ] `ARCHITECTURE.md` tiene diagrama mermaid renderizable.
- [ ] `CONTRIBUTING.md` tiene checklist de PR.
- [ ] `DEPLOY.md` cubre staging + prod + rollback.
- [ ] `SECURITY.md` tiene email de contacto.
- [ ] Funciones exportadas tienen JSDoc.
- [ ] Tipos públicos tienen JSDoc.
- [ ] release-please abre PR cuando hay commits con feat/fix desde el último release.

## 6. Plan de testing

- **Manual**: el primer dev nuevo prueba el README y reporta fricción.
- **Lint**: remark o markdownlint para estilo consistente (opcional, no bloqueante).

## 7. Riesgos y mitigaciones

| Riesgo                                    | Probabilidad | Impacto | Mitigación                                                                  |
| ----------------------------------------- | ------------ | ------- | --------------------------------------------------------------------------- |
| Docs se desactualizan                     | A            | M       | Code review incluye check de docs. Release notes incluyen cambios visibles. |
| Diagramas Mermaid no renderizan en GitHub | B            | B       | Usar solo sintaxis compatible (GitHub docs lista las soportadas).           |
| release-please mal configurado            | M            | M       | Empezar sin release-please en MVP; agregar cuando haya al menos 1 release.  |

## 8. Out of scope

- Docs site (Docusaurus, Nextra).
- Traducción.
- API reference auto-generado (typedoc).
- Architecture Decision Records como site estático.

## 9. Open Questions

- [ ] ¿Open source o privado? Determina si hay `LICENSE`/Code of Conduct visibles.
- [ ] ¿Conventional Commits enforcement solo en PR title o también en commits individuales? **Decisión**: en ambos (commitlint ya lo enforza en pre-commit).

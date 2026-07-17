# SDD-XX: <Título corto>

> **Estado:** Draft | In Review | Approved | Superseded
> **Owner:** Solution Architect
> **Reviewers:** <Tech Lead>, <dev representatives>
> **Sprint objetivo:** <Sprint N>
> **Depende de:** SDD-XX, SDD-YY
> **Bloquea a:** SDD-ZZ

## 1. Contexto

Por qué existe este SDD. Qué problema resuelve. Referencia al master plan si aplica.

## 2. Goals y Non-Goals

### Goals (lo que SÍ hace este SDD)

- ...

### Non-Goals (lo que EXPLÍCITAMENTE NO hace)

- ...
- ...

## 3. Decisiones de arquitectura

Listá las decisiones tomadas en este SDD con su justificación. Si son transversales, mover a un ADR.

| #        | Decisión | Alternativas consideradas | Justificación |
| -------- | -------- | ------------------------- | ------------- |
| ADR-XX-1 | Usamos X | Y, Z                      | Porque ...    |

## 4. Spec detallada

Esta es la sección que el dev implementa. Tiene que ser **suficiente para escribir código sin ambigüedad**.

### 4.1 Archivos a crear / modificar

```
<ruta desde raíz del repo>
```

### 4.2 Estructura interna

(Para cada archivo nuevo, indicar qué exporta y su firma.)

### 4.3 Contratos (interfaces, schemas, tipos)

(TypeScript / Zod schemas literales que se deben usar.)

### 4.4 Comportamiento esperado

(Edge cases, reglas de negocio, flujos.)

### 4.5 Errores y excepciones

(Tipos de error, cuándo se lanzan, cómo se manejan.)

### 4.6 Ejemplo de uso

(Código de ejemplo ejecutable.)

## 5. Criterios de aceptación

Checklist binario (sí/no) que el reviewer marca en el PR.

- [ ] ...
- [ ] Tests unitarios con coverage ≥ 70% en archivos nuevos.
- [ ] Sin warnings de TypeScript / ESLint.
- [ ] Documentación actualizada (JSDoc en funciones públicas).
- [ ] Sin secretos commiteados (verificado con `gitleaks`).

## 6. Plan de testing

- Unit tests: ...
- Integration tests: ...
- E2E tests (si aplica): ...
- Criterios de coverage: ...

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| ------ | ------------ | ------- | ---------- |
| ...    | M/M/B        | M/A/C   | ...        |

## 8. Out of scope (para futuro)

- ...

## 9. Open Questions

- [ ] ...

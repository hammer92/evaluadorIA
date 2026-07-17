# Execution Plan — SDD-08 Remediation Sprint (GAP-08-C)

**Fecha**: 2026-07-17T19:30:00Z
**Sprint**: sdd-08-remediation-gap-c
**Workflow**: AI-DLC (Inception → Construction)
**Modo**: Brownfield, gap-closure técnico
**Depende de**: SDD-08 ya implementado (10/11 = 90.9%)

---

## 1. Contexto

El compliance review consolidado (SDD-ALL, 2026-06-30T17:38Z) reporta SDD-08 en 10/11 = **90.9%**. Los gaps identificados son:

| #        | Gap                                   | Estado                                                                                                            | Severidad                   |
| -------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- |
| GAP-08-A | `firebase.json` sin sección `hosting` | Diferido Q1=A (2026-06-26) — "solo workflows CI/CD ahora, deferir hosting config hasta que exista la CF ssr real" | Baja (decisión documentada) |
| GAP-08-B | `preview-pr.yml` no implementado      | Diferido a v2 (cost/benefit)                                                                                      | Baja (no MVP)               |
| GAP-08-C | `emulators:test` no usado en CI       | **ACCIONABLE** — el script `firebase emulators:exec` existe pero no se invoca desde CI                            | Media                       |

## 2. Decisiones del usuario (2026-07-17)

| Pregunta                 | Respuesta                                                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| Q1 — Alcance del sprint  | **A**: Solo GAP-08-C. Respetar decisiones Q1=A (hosting) y v2 (preview-pr). |
| Q2 — Validación pre-push | **A**: Validar YAML + dry-run local (sin secrets Firebase reales).          |

## 3. Stages a ejecutar

- [x] INCEPTION — Workspace Detection (estado actual: SDD-08 = 10/11)
- [x] INCEPTION — Requirements Analysis (Q1=A, Q2=A)
- [x] INCEPTION — Workflow Planning (este documento)
- [ ] CONSTRUCTION — Code Generation
- [ ] CONSTRUCTION — Build and Test
- [ ] Commit + audit + state update

### Stages skipped (justificación)

- **User Stories**: gap-closure técnico, no afecta flujos de usuario.
- **Application Design**: cambio de CI, no de código de aplicación.
- **Units Generation**: no hay unidades nuevas.
- **Functional Design**: cambio aislado en workflow.
- **NFR Requirements / NFR Design**: el cambio refuerza NFR de CI (test contra emuladores).
- **Infrastructure Design**: la infra ya existe (`firebase.json` con emulators).

## 4. Plan de cambios

### 4.1 `.github/workflows/ci.yml` — agregar emulators:test al job `integration-emulator`

**Antes** (estado actual):

```yaml
integration-emulator:
  # ...
  steps:
    # ... install ...
    - name: Verify firestore + storage rules
      run: pnpm verify:rules
    - name: Integration E2E (auth + functions + firestore via emulators)
      run: pnpm verify:auth
```

**Después**:

```yaml
integration-emulator:
  # ...
  steps:
    # ... install ...
    - name: Verify firestore + storage rules
      run: pnpm verify:rules
    - name: Integration E2E (auth + functions + firestore via emulators)
      run: pnpm verify:auth
    # NUEVO: emulators:test corre el script pnpm (firebase emulators:exec + pnpm -r build + pnpm test:integration)
    # Cierra GAP-08-C.
    - name: Integration tests against emulators (Cloud Functions)
      run: pnpm emulators:test
      env:
        NEXT_PUBLIC_APP_ENV: dev
        NEXT_PUBLIC_FIREBASE_API_KEY: ci-test
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ci.firebaseapp.com
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: dev
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: dev.appspot.com
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0'
        NEXT_PUBLIC_FIREBASE_APP_ID: '1:0:web:0'
        SESSION_COOKIE_SECRET: ci-secret-must-be-at-least-32-characters-long-for-hs256
        ALLOWED_ORIGINS: http://localhost:3000
```

### 4.2 `package.json` (raíz) — ya tiene `emulators:test`

```json
"emulators:test": "firebase emulators:exec --project dev --only firestore,auth,functions 'pnpm -r build && pnpm test:integration'"
```

Verificación: el script YA EXISTE. Solo falta invocarlo desde CI.

### 4.3 Validación pre-push (Q2=A)

| Validación     | Cómo                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Sintaxis YAML  | `node -e "const yaml=require('js-yaml'); yaml.load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"` |
| Esquema        | `actionlint .github/workflows/ci.yml` (si está disponible)                                                          |
| dry-run        | `pnpm emulators:test --dry-run` si firebase CLI lo soporta; sino solo validar que `firebase emulators:exec` parsea  |
| Schema ci.yml  | `jq '.jobs                                                                                                          | keys' .github/workflows/ci.yml` (después de convertir) |
| Jobs esperados | `lint-typecheck-test-build`, `integration-emulator`, `coverage`                                                     |

## 5. Criterios de cierre del sprint

- [x] GAP-08-A — Diferido Q1=A (NO accionable, decisión documentada).
- [x] GAP-08-B — Diferido v2 (NO accionable, decisión documentada).
- [ ] **GAP-08-C — emulators:test invocado desde CI job integration-emulator.**
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS (max-warnings 0)
- [ ] `pnpm test` PASS (483/483 esperado)
- [ ] `pnpm emulators:test` corre localmente sin errores (GAP-08-C verification)
- [ ] YAML de ci.yml parsea con js-yaml
- [ ] actionlint (si está disponible) reporta 0 errores
- [ ] Commit con conventional format cierra el sprint
- [ ] aidlc-docs/audit.md actualizado con interaction entries
- [ ] aidlc-docs/aidlc-state.md actualizado con stage progress

## 6. Riesgos

| Riesgo                                                               | Mitigación                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm emulators:test` requiere Java JRE 17+ en GitHub Actions runner | El job integration-emulator YA tiene `setup-java@v4` con `temurin:17` instalado  |
| `firebase emulators:exec` lento en CI                                | Emulators solo firestore/auth/functions (no storage/UI) — < 60s startup          |
| Conflict con `verify:auth` que ya prueba CF                          | `emulators:test` corre DESPUÉS de `verify:auth`. Si falla, el job falla antes    |
| Firebase emulator no expone auth.functions en CI                     | `firebase.json` tiene `emulators.functions.port: 5001` + functions implementadas |

## 7. Out of scope (recordatorio)

- **Firebase Hosting config** (GAP-08-A): sigue diferido Q1=A. CF `ssr` no implementada. Cuando se implemente SSR, agregar sección `hosting` a `firebase.json` con rewrites → Cloud Run.
- **Preview deployments por PR** (GAP-08-B): v2. Requiere Firebase Hosting + token de PR-preview.
- **Canary deploys / traffic split**: v2.
- **Rollback automatizado**: v2 (con monitoring apropiado).

## 8. Métricas esperadas

- Tests antes: **483/483 PASS** (483 unit, 25 verify-auth, 16 verify-rules, 4 firebase 1 skipped)
- Tests después: **483/483 PASS** + `emulators:test` corre sin errores (no debería cambiar el conteo porque los integration tests ya estaban)
- Líneas modificadas: ~10 líneas (solo añadir step en ci.yml)
- Archivos modificados: 1 (`.github/workflows/ci.yml`)
- Archivos nuevos: 0

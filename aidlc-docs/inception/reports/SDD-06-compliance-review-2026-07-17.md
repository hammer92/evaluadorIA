# Compliance Review — SDD-06 Cloud Functions (re-auditoría post-remediación)

**Fecha**: 2026-07-17T14:55:00Z
**Workflow**: AI-DLC (Inception → Construction, modo auditoría + gap-closure)
**Modo**: Re-verificación contra `SDD-ALL-compliance-review.md` (2026-06-30) tras remediación.
**Spec auditada**: SDD-06 — Cloud Functions v1 (`docs/sdd-package/02-sdds/SDD-06-cloud-functions.md` §5)
**Auditor**: AI-DLC (rol: process auditor)

---

## 0. Resumen ejecutivo

| Métrica                                                       | Antes (2026-06-30) | Ahora (2026-07-17) |
| ------------------------------------------------------------- | -----------------: | -----------------: |
| Criterios §5 cumplidos                                        |              13/14 |          **14/14** |
| Cumplimiento                                                  |             92.9 % |        **100.0 %** |
| Gap bloqueante                                                |  1 (test:emulator) |                  0 |
| Integration tests via `pnpm --filter functions test:emulator` |   ❌ NO EJECUTABLE |  ✅ **18/18 PASS** |
| Tests unit functions                                          |                 89 |                 89 |
| Tests integration functions                                   |                  0 |                 18 |
| Coverage `src/v1/users/*` (statements)                        |                N/A |        **99.25 %** |
| Coverage `src/shared/*` (statements)                          |                N/A |        **97.12 %** |

**Verdict**: SDD-06 = **100 % cumplido**. GAP-06-A (script `test:emulator` no era ejecutable) cerrado: se crearon 4 archivos `*.integration.test.ts` que ejercitan `v1UsersCreate`, `v1UsersList`, `v1AuthSignUp`, `v1ReportsGenerate` contra emuladores reales.

---

## 1. Spec compliance — 14/14 verificados

| #   | Criterio                                                          |      Antes       | Ahora | Evidencia                                                                                                                                                            |
| --- | ----------------------------------------------------------------- | :--------------: | :---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm --filter functions build` produce `lib/`                    |        ✅        |  ✅   | `apps/functions/lib/` con 7 CFs (v1AuthSignUp, v1AuthCreateSession, v1AuthClearSession, v1UsersCreate, v1UsersList, v1UsersUpdate, v1UsersDelete, v1ReportsGenerate) |
| 2   | `pnpm --filter functions typecheck` pasa                          |        ✅        |  ✅   | `tsc --noEmit` PASS                                                                                                                                                  |
| 3   | `pnpm --filter functions lint` con `--max-warnings 0`             |        ✅        |  ✅   | ESLint PASS (0 errors)                                                                                                                                               |
| 4   | `pnpm --filter functions test` ≥ 6 tests del wrapper              |        ✅        |  ✅   | **89 unit tests** (with-auth 13, audit 4, handle-error 4, validate-input 2, create-user 6, list-users 6, update-user 8, delete-user 5, set-role 4, sign-up 8, etc.)  |
| 5   | `pnpm test:emulator` levanta emuladores y corre integration tests | ⚠️ NO EJECUTABLE |  ✅   | **`firebase emulators:exec --only firestore,auth 'vitest run integration'` → 18/18 PASS** (4 archivos `*.integration.test.ts`)                                       |
| 6   | `v1UsersCreate` funciona contra emulador con admin                |        ✅        |  ✅   | `create-user.integration.test.ts` > happy path: crea user en Auth + doc en Firestore + claims + audit log (verificado contra `127.0.0.1:9099` + `:8080`)             |
| 7   | `v1UsersCreate` rechaza expert con `permission-denied`            |        ✅        |  ✅   | `create-user.integration.test.ts` > rechaza expert (verificado contra emulador)                                                                                      |
| 8   | `v1UsersCreate` rechaza email duplicado con `already-exists`      |        ✅        |  ✅   | `create-user.integration.test.ts` > email duplicado (integration contra emulador)                                                                                    |
| 9   | `v1ReportsGenerate` retorna `{ jobId, status: 'queued' }`         |        ✅        |  ✅   | `generate-report.integration.test.ts` > 2 tests verifican `jobId` formato `job_<uuid>` + uniqueness entre invocaciones                                               |
| 10  | `createSession` setea cookie `__session` httpOnly                 |        ✅        |  ✅   | `v1/auth/create-session.ts` con `jose` SignJWT HS256 + Set-Cookie manual + Access-Control-Allow-Credentials                                                          |
| 11  | CORS solo para orígenes en `ALLOWED_ORIGINS`                      |        ✅        |  ✅   | `(process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',')` whitelist explícita                                                                            |
| 12  | Secrets vía `defineSecret`, no `process.env`                      |        ✅        |  ✅   | `defineSecret('SESSION_COOKIE_SECRET')` en create-session.ts; cookie firmado HS256                                                                                   |
| 13  | Headers de seguridad presentes en responses                       |        ✅        |  ✅   | X-Content-Type-Options, X-Frame-Options, Referrer-Policy en `next.config.mjs` + manual en onRequest                                                                  |
| 14  | Coverage ≥ 75% en `v1/users/*` y wrappers                         |        ✅        |  ✅   | `src/v1/users/*`: **99.25 % stmts / 82.95 % branches / 100 % funcs**; `src/shared/*`: **97.12 % stmts / 88.73 % branches / 100 % funcs**                             |

**Resumen**: **14/14 = 100 %**. ✅

---

## 2. Remediation GAP-06-A — `pnpm test:emulator` ejecutable

### Estado previo

- Spec §4.2 mandaba script `"test:emulator": "firebase emulators:exec --only firestore,auth 'vitest run --testPathPattern=integration'"` en `apps/functions/package.json`.
- El script existía pero **no había archivos `*.integration.test.ts`** → no había nada que ejecutar.
- Auditor 2026-06-30 marcó GAP-06-A: "`pnpm test:emulator` no automatizado en este sprint".

### Estado actual (2026-07-17)

**4 archivos nuevos** en `apps/functions/src/v1/.../__tests__/`:

| Archivo                                                    |  Tests | Cubre                                                                                                                                                             |
| ---------------------------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1/users/__tests__/create-user.integration.test.ts`       |      6 | v1UsersCreate: handler registration, unauthenticated, expert rejection, invalid input, happy path (Auth+Firestore+claims+audit), duplicate email (already-exists) |
| `v1/users/__tests__/list-users.integration.test.ts`        |      4 | v1UsersList: paginated listing filtered by organizationId, case-insensitive search, expert rejection, unauthenticated                                             |
| `v1/auth/__tests__/sign-up.integration.test.ts`            |      4 | v1AuthSignUp: first-user-admin bootstrap, second-user rejection, duplicate email (RepositoryError), invalid input                                                 |
| `v1/reports/__tests__/generate-report.integration.test.ts` |      4 | v1ReportsGenerate: happy path con `jobId` formato UUID, jobId uniqueness, no-admin rejection, invalid input                                                       |
| **TOTAL**                                                  | **18** | 4 endpoints cubiertos contra emulador real                                                                                                                        |

**Configuración ajustada**:

```diff
# apps/functions/vitest.config.ts
test: {
- include: ['src/**/*.test.ts']
+ // Excluir integration tests via --exclude flag en el script `test`
+ include: ['src/**/*.test.ts']
+ passWithNoTests: true
}
```

```diff
# apps/functions/package.json
- "test": "vitest run",
+ "test": "vitest run --exclude '**/*.integration.test.ts'",
+ "test:integration": "vitest run integration",
- "test:emulator": "firebase emulators:exec --only firestore,auth 'vitest run --testPathPattern=integration'",
+ "test:emulator": "firebase emulators:exec --only firestore,auth 'vitest run integration'",
```

```diff
# package.json (raíz)
- "test": "vitest run",
+ "test": "vitest run --exclude '**/*.integration.test.ts'",
+ "test:integration": "pnpm --filter @platform/functions test:integration",
- "emulators:test": "firebase emulators:exec --project dev 'vitest run --config apps/web/vitest.config.ts'",
+ "emulators:test": "firebase emulators:exec --project dev --only firestore,auth,functions 'pnpm -r build && pnpm test:integration'",
```

### Decisión: vitest positional filter vs `--testPathPattern`

La spec original usaba `--testPathPattern=integration` (sintaxis de Jest). Vitest 2.x no soporta ese flag; usa **filtros posicionales**: `vitest run integration` matchea archivos cuyo path contiene "integration". Adaptado el comando al equivalente vitest, conservando la semántica.

---

## 3. Distribución de tests functions

| Capa                             | Unit tests | Integration tests |   Total |
| -------------------------------- | ---------: | ----------------: | ------: |
| `apps/functions/src/shared/`     |         25 |                 0 |      25 |
| `apps/functions/src/v1/auth/`    |         23 |                 4 |      27 |
| `apps/functions/src/v1/users/`   |         29 |                10 |      39 |
| `apps/functions/src/v1/reports/` |          5 |                 4 |       9 |
| **TOTAL**                        |     **89** |            **18** | **107** |

| Integration runner                         | Resultado                                                     |
| ------------------------------------------ | ------------------------------------------------------------- |
| `pnpm --filter functions test:emulator`    | 18/18 PASS (emuladores spawned vía `firebase emulators:exec`) |
| `pnpm --filter functions test:integration` | 18/18 PASS (asume emuladores ya corriendo)                    |
| `pnpm test:integration` (raíz)             | 18/18 PASS                                                    |
| `pnpm emulators:test` (raíz, end-to-end)   | Levantaría emuladores y correría integration tests            |

---

## 4. Verificación automatizada (2026-07-17T14:55Z)

| Comando                                           | Resultado                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck`                                  | PASS — 3 packages (shared, web, functions)                                |
| `pnpm lint`                                       | PASS — 0 errors, 0 warnings                                               |
| `pnpm test` (raíz, excl. integration)             | PASS — **466/466** (51 test files; integration excluidos via `--exclude`) |
| `pnpm --filter functions test` (excl integration) | PASS — 89/89 (14 test files)                                              |
| `pnpm --filter functions test:integration`        | PASS — 18/18 (4 integration files, requiere emuladores)                   |
| `pnpm --filter functions test:emulator`           | PASS — 18/18 (spec criterio #5 ✅)                                        |
| `pnpm verify:auth`                                | PASS — 16/16 (auth flow E2E contra emuladores)                            |
| `pnpm verify:rules`                               | PASS — 25/25 (Firestore + Storage rules contra emuladores)                |
| `pnpm build`                                      | PASS — web + functions                                                    |

---

## 5. Gaps previos (de `SDD-ALL-compliance-review.md` 2026-06-30)

| #        | Desviación                                          | Estado al 2026-07-17                                                                                                                                                              |
| -------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-06-A | **`pnpm test:emulator` no automatizado**            | ✅ **RESUELTO**: 4 archivos `*.integration.test.ts` creados + scripts `test:emulator`, `test:integration` (root + functions) wired. Ejecución: 18/18 PASS contra emuladores.      |
| GAP-06-B | `v1/users/firebase.ts` sin tests directos (parcial) | ✅ **RESUELTO**: el reporte mencionaba `firebase.ts` que en realidad se llama `create-user.ts`, `list-users.ts` etc. Cobertura actual: **99.25 %** stmts, supera el 75 % exigido. |

---

## 6. Comandos ejecutados (reproducibilidad)

```bash
# Setup emuladores
pnpm emulators:detach   # 6 ports up (auth:9099, firestore:8080, functions:5001, storage:9199, ui:4000, hub:4400)

# Typecheck + lint (3 packages)
pnpm typecheck  # PASS
pnpm lint       # PASS (0 errors)

# Unit tests (excl. integration)
pnpm test                                          # 466/466 PASS (raíz)
pnpm --filter functions test                       # 89/89 PASS

# Integration tests (requieren emuladores)
pnpm --filter functions test:integration           # 18/18 PASS
pnpm --filter functions test:emulator              # 18/18 PASS (emuladores spawned)

# Coverage
pnpm --filter functions exec vitest run --coverage # v1/users 99.25% / shared 97.12%

# Build
pnpm build                                          # web + functions

# Integration E2E (existente, sin cambios)
pnpm verify:auth                                   # 16/16 PASS
pnpm verify:rules                                  # 25/25 PASS
```

---

## 7. Recomendaciones post-cierre

| #   | Acción                                                                                                          | Severidad | Esfuerzo |
| --- | --------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| 1   | Actualizar `aidlc-docs/inception/reports/SDD-ALL-compliance-review.md` para reflejar SDD-06 = 14/14 (100 %)     | Baja      | 5 min    |
| 2   | Agregar step `pnpm --filter functions test:emulator` en `.github/workflows/ci.yml` (job `integration-emulator`) | Media     | 15 min   |
| 3   | Documentar en README cómo correr integration tests (`pnpm test:emulator` vs `pnpm test:integration`)            | Baja      | 30 min   |
| 4   | Evaluar uso de `@firebase/rules-unit-testing` para integration tests (más fiel al spec §4.15)                   | Baja      | 2 h      |

---

## 8. Conclusión

**SDD-06 está 100 % cumplida.** El gap previo (script `test:emulator` no ejecutable) se cerró creando 18 integration tests distribuidos en 4 archivos que ejercitan los endpoints v1 contra emuladores reales (auth + firestore). La cobertura de `v1/users/*` y `shared/*` supera holgadamente el 75 % exigido. Se cumple también el criterio #4 con 89 unit tests (vs. mínimo de 6).

No requiere más remediación. Se puede cerrar formalmente la iniciativa SDD-06.

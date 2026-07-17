# SDD-08: CI/CD & Deploy

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 3 (semana 8) + continuo
> **Depende de:** SDD-01 (tooling base), SDD-02 (build de Next.js), SDD-06 (build de Functions)
> **Bloquea a:** —

---

## 1. Contexto

Necesitamos que cada PR sea validado automáticamente (lint + typecheck + test + build) y que merge a `main` despliegue automáticamente a staging. Deploy a prod queda como workflow manual con confirmación. Opcional: preview deployments por PR.

## 2. Goals y Non-Goals

### Goals

- Workflow `lint-test-build` corre en cada PR y en push a `main`.
- Workflow `deploy-staging` corre en merge a `main`.
- Workflow `deploy-prod` es manual (`workflow_dispatch`) con environment de GitHub que requiere aprobación.
- Cache de `pnpm` y `.next` para builds rápidos.
- Firebase Hosting configurado con headers de cache correctos.
- SSR de Next.js vía Cloud Run si el sitio es dinámico.
- Secrets de Firebase + otros en GitHub Secrets (o Secret Manager).
- Slack/Discord notification opcional en fallos.

### Non-Goals

- Canary deployments (no en MVP; Cloud Run revisions + traffic split son factibles).
- Multi-region deploys.
- A/B testing infrastructure.
- Migration scripts automatizados (van en `firestore.migrations/` cuando aparezcan).

## 3. Decisiones de arquitectura

| #   | Decisión                                                                  | Justificación                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | GitHub Actions                                                            | Standard para Firebase + integración directa con secrets.     |
| 2   | Firebase Hosting con SSR vía Cloud Run                                    | Hosting estático para assets; Cloud Run para rutas dinámicas. |
| 3   | `pnpm/action-setup` para cache                                            | Más rápido que `npm ci`.                                      |
| 4   | `workflow_dispatch` para prod                                             | Forzar revisión humana antes de prod.                         |
| 5   | Secrets vía GitHub Secrets para CI, Secret Manager para Functions runtime | Cada uno en su contexto natural.                              |
| 6   | Conventional Commits enforced en PR title                                 | Linear history + changelogs automáticos (futuro).             |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
.github/
├── workflows/
│   ├── ci.yml                       # lint + typecheck + test + build en cada PR
│   ├── deploy-staging.yml           # merge a main → staging
│   ├── deploy-prod.yml              # manual dispatch → prod
│   └── preview-pr.yml               # (opcional) preview deploy por PR
├── dependabot.yml                   # bump automático de deps
└── PULL_REQUEST_TEMPLATE.md         # template con checklist
```

### 4.2 `ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-typecheck-test-build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test -- --reporter=junit --outputFile.junit.xml
        env:
          # Env vars mínimas para que tests unitarios pasen
          NEXT_PUBLIC_APP_ENV: dev
          NEXT_PUBLIC_FIREBASE_API_KEY: ci-test
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ci.firebaseapp.com
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ci
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ci.appspot.com
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0'
          NEXT_PUBLIC_FIREBASE_APP_ID: '1:0:web:0'
          REPOSITORY_DRIVER: memory

      - name: Build
        run: pnpm build

      - name: Bundle size check
        run: pnpm bundle:check

      - name: Upload coverage
        if: always()
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

### 4.3 `deploy-staging.yml`

```yaml
name: Deploy Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}'
          projectId: admin-platform-staging
          channelId: live
        env:
          FIREBASE_CLI_PREVIEWS: ''
      - run: pnpm --filter functions deploy
        env:
          FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN_STAGING }}'
      - run: firebase deploy --only firestore:rules,storage --project staging
        env:
          FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN_STAGING }}'
```

### 4.4 `deploy-prod.yml`

```yaml
name: Deploy Prod

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "deploy-prod" to confirm'
        required: true
        default: ''

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  confirm:
    runs-on: ubuntu-latest
    steps:
      - run: |
          if [ "${{ github.event.inputs.confirm }}" != "deploy-prod" ]; then
            echo "Confirmation failed"
            exit 1
          fi

  deploy:
    needs: confirm
    runs-on: ubuntu-latest
    environment: production # requires manual approval in GitHub settings
    timeout-minutes: 60
    steps:
      # mismo que staging pero con projectId: admin-platform-prod y secrets PROD
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm --filter functions deploy
        env:
          FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN_PROD }}'
      - run: firebase deploy --only hosting,firestore:rules,storage --project prod
        env:
          FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN_PROD }}'
```

### 4.5 `firebase.json` para Hosting + SSR

```jsonc
{
  "hosting": {
    "public": "apps/web/.next/static",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "function": "api" }, // si hay onRequest
      { "source": "**", "function": "ssr", "region": "us-central1" },
    ],
    "headers": [
      {
        "source": "/_next/static/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }],
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }],
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        ],
      },
    ],
  },
}
```

> Para SSR via Cloud Run, Firebase Hosting usa Cloud Run automáticamente cuando el rewrite es una function.

### 4.6 `pnpm bundle:check` (script)

```jsonc
// apps/web/package.json
{
  "scripts": {
    "bundle:check": "size-limit",
  },
}
```

```jsonc
// .size-limit.json (root)
[
  { "path": "apps/web/.next/static/chunks/main-*.js", "limit": "200 KB" },
  { "path": "apps/web/.next/static/chunks/pages/_app-*.js", "limit": "200 KB" },
]
```

### 4.7 PR template

```markdown
## ¿Qué hace este PR?

<!-- descripción corta -->

## ¿A qué SDD corresponde?

<!-- ej: SDD-04, SDD-07 -->

## Checklist

- [ ] Tests agregados/actualizados
- [ ] Documentación (JSDoc, README) actualizada si aplica
- [ ] No introduzco imports de `firebase/*` fuera de `/repositories` y `/lib/firebase`
- [ ] `pnpm typecheck` pasa localmente
- [ ] `pnpm lint` pasa localmente
- [ ] Coverage no bajó globalmente
- [ ] Probé contra emuladores (`pnpm emulators` + manual)

## Screenshots / videos

<!-- si aplica -->
```

### 4.8 Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: pnpm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    groups:
      minor-and-patch: { patterns: ['*'], update-types: ['minor', 'patch'] }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
```

### 4.9 Secret Manager para prod

```bash
# Set inicial
firebase functions:secrets:set SESSION_COOKIE_SECRET --project prod
firebase functions:secrets:set RESEND_API_KEY --project prod

# Uso en código
import { defineSecret } from 'firebase-functions/params';
const sessionSecret = defineSecret('SESSION_COOKIE_SECRET');

export const createSession = onRequest({ secrets: [sessionSecret] }, async (req, res) => {
  // ...
});
```

### 4.10 GitHub Secrets requeridos

| Secret                             | Para                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | JSON de service account con rol Firebase Hosting Admin |
| `FIREBASE_TOKEN_STAGING`           | Token de Firebase CLI para `firebase deploy`           |
| `FIREBASE_SERVICE_ACCOUNT_PROD`    | Idem para prod                                         |
| `FIREBASE_TOKEN_PROD`              | Idem                                                   |
| `CODECOV_TOKEN`                    | (opcional) Para uploads a codecov.io                   |
| `SLACK_WEBHOOK_URL`                | (opcional) Notificaciones                              |

### 4.11 Comportamiento esperado

- PR abierto → CI corre ~3-5 min → status checks visibles.
- Merge a `main` → deploy-staging corre ~5-8 min → URL staging actualizada.
- Manual dispatch con `confirm=deploy-prod` + aprobación de environment → deploy a prod.
- PR preview (si activado) → URL única por PR.

### 4.12 Errores y excepciones

| Situación              | Comportamiento                          |
| ---------------------- | --------------------------------------- |
| Build falla en CI      | PR no mergea hasta arreglar             |
| Typecheck falla        | Igual                                   |
| Coverage < threshold   | Bloquea merge                           |
| Deploy a staging falla | Notification al equipo, no afecta prod  |
| Deploy a prod falla    | Rollback manual vía console de Firebase |

## 5. Criterios de aceptación

- [ ] Workflow `ci.yml` corre en cada PR y muestra status checks.
- [ ] CI corre lint, typecheck, test, build en menos de 8 min.
- [ ] Coverage se reporta (a Codecov o similar).
- [ ] Merge a `main` triggerea `deploy-staging.yml`.
- [ ] Deploy a staging completa en menos de 15 min.
- [ ] `workflow_dispatch` de prod requiere escribir `deploy-prod`.
- [ ] Environment `production` en GitHub tiene required reviewers.
- [ ] Firebase Hosting responde con `Cache-Control` correcto en `/_next/static/**`.
- [ ] Headers de seguridad presentes en responses de prod.
- [ ] Dependabot abre PRs semanales.
- [ ] Bundle size check pasa (límite 200KB gzip para chunks críticos).

## 6. Plan de testing

- **Smoke**: deploy a staging → verificar que `/admin/users` carga contra Firebase real (no emulador).
- **Manual**: dispatch prod en staging (con flag `--dry-run` si Firebase lo soporta) o en un proyecto "canary".

## 7. Riesgos y mitigaciones

| Riesgo                        | Probabilidad | Impacto | Mitigación                                                                                |
| ----------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------- |
| CI corre muy lento (>10 min)  | M            | M       | Cache agresivo; tests paralelos con sharding; tests unitarios primero.                    |
| Deploy a prod rompe algo      | M            | A       | Environment approval + smoke test post-deploy + ability to rollback via Firebase Console. |
| Secrets se filtran en logs    | B            | A       | `gitleaks` en CI + revisar outputs antes de mergear.                                      |
| pnpm version mismatch         | M            | B       | `packageManager` field en `package.json` + `pnpm/action-setup`.                           |
| Bundle size crece sin control | M            | M       | `size-limit` en CI desde Sprint 3.                                                        |

## 8. Out of scope

- Canary releases (Cloud Run traffic split) — factible en v2.
- Multi-region.
- Mobile CI/CD.
- E2E con Playwright en CI.
- Lighthouse CI automático en PR.

## 9. Open Questions

- [ ] ¿Habilitar preview deployments por PR desde día 1? **Decisión sugerida**: dejar para v2; cost/benefit no claro para MVP.
- [ ] ¿Usar `firebase-tools` con service account o token CI? **Decisión**: service account es más seguro (rotable, sin expiry).
- [ ] ¿Rollback automático si falla smoke test post-deploy? **Decisión v2**: con monitoring apropiado. v1: rollback manual.

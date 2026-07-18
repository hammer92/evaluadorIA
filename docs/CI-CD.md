# CI/CD & Deploy

Documentación operativa para los workflows de GitHub Actions, secrets,
environments y branch protection. Complementa a
[`doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md`](../doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md)
(spec) con instrucciones paso a paso.

## Tabla de contenidos

- [Workflows](#workflows)
- [Protocolo de despliegue paso a paso](#protocolo-de-despliegue-paso-a-paso)
- [Secrets requeridos en GitHub](#secrets-requeridos-en-github)
- [GitHub Environments](#github-environments)
- [Branch protection en `main`](#branch-protection-en-main)
- [Cómo correr un deploy](#cómo-correr-un-deploy)
- [Verificación post-despliegue](#verificación-post-despliegue)
- [Bundle size check](#bundle-size-check)
- [Dependabot](#dependabot)
- [Troubleshooting](#troubleshooting)
- [Notas de mantenimiento](#notas-de-mantenimiento)

---

## Workflows

| Workflow                               | Trigger                                              | Qué hace                                                                                     |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`             | PR + push a `main`                                   | Lint, typecheck, test, build, bundle size check. Coverage report en push a main (Codecov).   |
| `.github/workflows/main_deploy.yml`    | push a `main` (auto → staging) + `workflow_dispatch` | Build + deploy consolidado (Hosting + Functions + Firestore + Storage) a `staging` o `prod`. |
| `.github/workflows/release-please.yml` | push a `main` con Conventional Commits               | Genera release PR con versionado semántico + CHANGELOG.                                      |

`ci.yml` corre en **concurrency group** (`ci-${{ github.ref }}` con
`cancel-in-progress: true`), así PRs viejos se cancelan cuando llega un push
nuevo. El deploy usa `cancel-in-progress: false` para evitar deploys
parciales concurrentes contra el mismo environment.

---

## Protocolo de despliegue paso a paso

### 1. Habilitación de Infraestructura (Google Cloud)

Antes de configurar el deploy, las siguientes APIs deben estar activas en cada
proyecto GCP (`admin-platform-staging` y `admin-platform-prod`):

| API                                                                    | Por qué                                    |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| **IAM API** (`iam.googleapis.com`)                                     | Gestionar la cuenta de servicio del deploy |
| **Cloud Build API** (`cloudbuild.googleapis.com`)                      | Compilar Cloud Functions 2nd gen           |
| **Artifact Registry API** (`artifactregistry.googleapis.com`)          | Almacenar imágenes de las functions        |
| **Cloud Resource Manager API** (`cloudresourcemanager.googleapis.com`) | Validar permisos durante el deploy         |

Adicionalmente, las APIs que Firebase + Next.js SSR requieren en runtime:

- Cloud Functions API (`cloudfunctions.googleapis.com`)
- Cloud Run API (`run.googleapis.com`) — para CF 2nd gen
- Firebase Hosting API (`firebasehosting.googleapis.com`)
- Cloud Firestore API (`firestore.googleapis.com`)
- Firebase Admin API (`firebase.googleapis.com`)
- Cloud Storage API (`storage-api.googleapis.com`) — para `firebase.storage`
- Identity Toolkit API (`identitytoolkit.googleapis.com`) — para Auth

Habilitar via gcloud (idempotente, reemplaza `<project>` por `admin-platform-staging` o `admin-platform-prod`):

```bash
gcloud services enable \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  storage-api.googleapis.com \
  identitytoolkit.googleapis.com \
  --project <project>
```

### 2. Creación de la Cuenta de Servicio (Service Account)

Crear una cuenta dedicada para GitHub Actions aplicando **principio de mínimo
privilegio**. Una SA por proyecto (staging y prod):

```bash
PROJECT="admin-platform-staging"   # o "admin-platform-prod"
SA_NAME="github-deploy-agent"
SA_EMAIL="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

# 1. Crear la service account
gcloud iam service-accounts create $SA_NAME \
  --display-name "GitHub Actions deploy ($PROJECT)" \
  --project $PROJECT

# 2. Asignar los 5 roles obligatorios
for ROLE in \
  roles/firebase.admin \
  roles/cloudfunctions.admin \
  roles/iam.serviceAccountUser \
  roles/cloudbuild.builds.editor \
  roles/datastore.owner
do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None
done
```

**Roles obligatorios**:

| Rol                              | Cubre                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| `roles/firebase.admin`           | Hosting, reglas de Firestore, Cloud Storage, configuración Firebase  |
| `roles/cloudfunctions.admin`     | Deploy de Cloud Functions (build + upload source)                    |
| `roles/iam.serviceAccountUser`   | Permite que las CFs actúen como runtime service accounts             |
| `roles/cloudbuild.builds.editor` | Cloud Functions 2nd gen usa Cloud Build para compilar TS/JS          |
| `roles/datastore.owner`          | Gestionar índices y reglas de Firestore (compilados sobre Datastore) |

**Rol de mantenimiento** (agregar si falla el deploy por permisos en
Artifact Registry):

- `roles/artifactregistry.admin` — Functions 2nd gen suben imágenes a
  Artifact Registry

### 3. Generar clave JSON de la Service Account

Desde la consola GCP (IAM & Admin → Service Accounts → `github-deploy-agent`
→ Keys → Add Key → Create new key → JSON) o via gcloud:

```bash
PROJECT="admin-platform-staging"   # o "admin-platform-prod"
SA_NAME="github-deploy-agent"
SA_EMAIL="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

gcloud iam service-accounts keys create ./sa-key-$PROJECT.json \
  --iam-account=$SA_EMAIL
```

> **Importante**: este JSON contiene credenciales equivalentes a un usuario
> con permisos de deploy. Guardarlo temporalmente; el siguiente paso lo
> mueve a GitHub Secrets y se borra el archivo local.

### 4. Configuración de Secretos en GitHub

Ir a **Settings → Secrets and variables → Actions** del repo y registrar:

#### A. Secretos de Infraestructura (un par por environment)

| Secret                             | Valor                                              |
| ---------------------------------- | -------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | Contenido íntegro del JSON key de la SA de staging |
| `FIREBASE_SERVICE_ACCOUNT_PROD`    | Contenido íntegro del JSON key de la SA de prod    |

> **Por seguridad**: rotar la clave cada **90 días** (ver
> [Notas de mantenimiento](#notas-de-mantenimiento)). Si una clave se filtra,
> borrarla inmediatamente desde GCP Console (Keys → Delete) — la próxima
> ejecución de CI fallará y se regenera.

#### B. Secretos para el Frontend (Web)

Inyectados en `pnpm build` para embeber en el bundle de Next.js:

| Secret                                      | Para                            |
| ------------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`              | Firebase Web SDK — auth cliente |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`          | Firebase Auth                   |
| `NEXT_PUBLIC_FIREBASE_APP_ID`               | Firebase App ID                 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`           | Firebase Project ID             |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`       | Firebase Storage                |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`  | Firebase Cloud Messaging        |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (opt) | Firebase Analytics              |
| `NEXT_PUBLIC_API_BASE_URL` (opt)            | URL del API para el cliente     |

> Los valores exactos se obtienen de Firebase Console → Project Settings →
> General → "Your apps" → SDK setup and configuration.

#### C. Secretos para Cloud Functions (Backend)

Estos se setean como **runtime env vars en el deploy** (vía
`firebase deploy --set-env-vars`) o como **Firebase secrets** (recomendado
para material sensible):

| Secret                    | Cómo se inyecta                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| `SESSION_COOKIE_SECRET`   | **Firebase Secret** (recomendado, vía `firebase functions:secrets:set`) |
| `ALLOWED_ORIGINS`         | Variable de env en GitHub → inyectada via `--set-env-vars`              |
| `OPENAI_API_KEY` (futuro) | **Firebase Secret** cuando se integre                                   |

> **Por qué `SESSION_COOKIE_SECRET` va como Firebase Secret y no en GitHub
> Secrets**: aunque GitHub Secrets está cifrado, Firebase Secrets añade una
> capa de cifrado en reposo en GCP y rotación independiente del repo.
> Setup único (manual):
>
> ```bash
> echo -n "$(openssl rand -base64 48)" | \
>   firebase functions:secrets:set SESSION_COOKIE_SECRET --project <project>
> ```
>
> Luego la CF `ssr` debe declarar `defineSecret('SESSION_COOKIE_SECRET')` en
> su configuración para que Firebase lo inyecte en runtime.

#### D. Secretos opcionales

| Secret              | Para                                                      |
| ------------------- | --------------------------------------------------------- |
| `CODECOV_TOKEN`     | Upload coverage desde `ci.yml` (codecov.io)               |
| `SLACK_WEBHOOK_URL` | Notificaciones post-deploy a Slack (en `main_deploy.yml`) |

---

## Secrets requeridos en GitHub (resumen)

Resumen ejecutivo de qué secrets crear antes del primer deploy:

| Secret                             | Scope | Requerido | Origen                                                |
| ---------------------------------- | ----- | --------- | ----------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | Repo  | Sí        | JSON key de la SA `github-deploy-agent@…staging`      |
| `FIREBASE_SERVICE_ACCOUNT_PROD`    | Repo  | Sí        | JSON key de la SA `github-deploy-agent@…prod`         |
| `NEXT_PUBLIC_FIREBASE_*`           | Repo  | Sí        | Firebase Console → Project Settings                   |
| `NEXT_PUBLIC_API_BASE_URL`         | Repo  | No        | URL del backend (Functions SSR ya lo cubre)           |
| `ALLOWED_ORIGINS`                  | Repo  | Sí        | Dominio del frontend (ej: `https://…staging.web.app`) |
| `CODECOV_TOKEN`                    | Repo  | No        | codecov.io                                            |
| `SLACK_WEBHOOK_URL`                | Repo  | No        | Slack incoming webhook                                |

> **Regla de seguridad**: nunca commitear service account keys, tokens o
> secrets al repo. Si un secret se filtra, **borrarlo inmediatamente** de
> GCP Console (rotation) y re-generar el GitHub Secret.

---

## GitHub Environments

El workflow `main_deploy.yml` referencia environments. Estos se crean
**manualmente** desde GitHub UI (no viven en el repo porque son config de la
organización):

### `staging`

- Settings → Environments → New environment → `staging`
- **No requiere reviewers** (cualquier merge a `main` deploya)
- Variables de environment (opcional): si necesitás URLs custom por env

### `production`

- Settings → Environments → New environment → `production`
- **Required reviewers**: agregar 2+ owners del repo
- **Deployment branches**: solo permitir `main` (recomendado)
- **Wait timer**: 5 minutos opcional (para rollback manual si se detecta
  problema)
- **Prevent self-review**: activado (impide que el mismo user que dispatchea
  apruebe)

Setup inicial (con `gh` CLI autenticado):

```bash
gh api --method PUT repos/:owner/:repo/environments/staging -f wait_timer=0
gh api --method PUT repos/:owner/:repo/environments/production \
  --input - <<'JSON'
{
  "wait_timer": 5,
  "prevent_self_review": true,
  "reviewers": [{"type": "User", "id": <OWNER_USER_ID>}]
}
JSON
```

---

## Branch protection en `main`

**Setup manual via GitHub UI** (Settings → Branches → Add rule) o via
`gh api` (idempotente):

```bash
gh api --method PUT repos/:owner/:repo/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint-typecheck-test-build",
      "integration-emulator",
      "coverage"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_signatures": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

> **`enforce_admins: false`**: workaround para que el owner del repo pueda
> auto-aprobar PRs en un repo de un solo contribuidor. Cuando el equipo
> crezca, cambiar a `true` y deshabilitar self-approve.

Configurar el repo para usar **squash merge** (preserva historial lineal):

```bash
gh api --method PATCH repos/:owner/:repo \
  --input - <<'JSON'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": true,
  "delete_branch_on_merge": true
}
JSON
```

### CODEOWNERS

El archivo `CODEOWNERS` (raíz del repo) define quién puede aprobar cambios
en paths sensibles. GitHub automáticamente pide review a esos owners cuando
un PR toca un archivo matcheado.

Paths críticos en este repo (requieren owner review):

- `.github/workflows/` (CI/CD) — **incluye `main_deploy.yml`**
- `firebase.json`, `firestore.rules`, `storage.rules` (config Firebase)
- `apps/web/middleware.ts`, `apps/web/services/`, `apps/web/features/auth/` (auth)
- `apps/functions/src/v1/auth/`, `apps/functions/src/shared/with-auth.ts` (auth backend)
- `aidlc-docs/` (audit trail AI-DLC)
- `SECURITY.md`, `CONTRIBUTING.md`, `docs/` (governance)

---

## Cómo correr un deploy

### Staging (automático)

1. Crear PR a `main` desde una feature branch
2. CI valida (`lint-typecheck-test-build`, `integration-emulator`,
   `coverage`)
3. CODEOWNERS revisa y aprueba
4. Squash-merge a `main`
5. **`main_deploy.yml` triggerea automáticamente** → deploy a
   `admin-platform-staging` (~5-10 min)

### Staging (manual)

Si necesitás re-deployar sin merge:

- GitHub → Actions → "Deploy Full Firebase Stack" → Run workflow
- `environment` = `staging`

### Prod (manual, con approval)

1. Asegurarse de que la versión en `main` ya fue validada en staging
2. GitHub → Actions → "Deploy Full Firebase Stack" → Run workflow
3. `environment` = `prod`
4. **Aprobar manualmente** el environment `production` desde GitHub UI
   (los reviewers reciben notificación)
5. Monitorear el job `deploy` + smoke test (~5-10 min)

### Qué hace el deploy internamente

El job `deploy` ejecuta estos steps:

1. **Checkout** del repo
2. **Setup pnpm 9** + Node 22
3. **Install deps** con `pnpm install --frozen-lockfile`
4. **Build** (`pnpm build` → Next.js standalone + Functions TS compiled +
   `.next/` copiado a `lib/.next/`) con `NEXT_PUBLIC_FIREBASE_*` inyectadas
   desde GitHub Secrets
5. **Install Firebase CLI 13** vía `npm install -g firebase-tools@13`
6. **Resolve project ID** (staging → `admin-platform-staging`,
   prod → `admin-platform-prod`)
7. **Authenticate GCP** via `google-github-actions/auth@v2` usando
   `FIREBASE_SERVICE_ACCOUNT_<env>` como `credentials_json`
8. **Deploy** único:
   ```bash
   firebase deploy \
     --only hosting,functions,firestore,storage \
     --project $PROJECT \
     --non-interactive \
     --set-env-vars "REPOSITORY_DRIVER=firebase,ALLOWED_ORIGINS=$ORIGINS,FIREBASE_ADMIN_PROJECT_ID=$PROJECT"
   ```
9. **Smoke test** (solo si deploy fue exitoso): `curl` a la URL de Hosting
   del env y verificar HTTP 2xx/3xx
10. **Notify Slack** (opcional, requiere `SLACK_WEBHOOK_URL`)

---

## Verificación post-despliegue

Tras el primer deploy exitoso, **verificar manualmente** los 3 servicios:

### Hosting

```bash
curl -I https://admin-platform-staging.web.app
# → 200 OK + headers Cache-Control para /_next/static/**
```

Confirmar que la URL de Firebase Hosting carga el sitio con la
configuración inyectada (la web app se renderiza vía SSR Cloud Function).

### Functions

```bash
firebase functions:list --project <env>
# → ssr (2nd gen, region: us-central1)
```

Confirmar que `ssr` aparece con la etiqueta **"2nd gen"** y región
`us-central1`.

### Firestore

```bash
firebase firestore:rules:get --project <env> > /tmp/rules.txt
diff /tmp/rules.txt apps/web/firestore.rules
# → sin diferencias (rules desplegadas coinciden con el repo)
```

Confirmar que las reglas de seguridad reflejen la última versión del repo.

### Storage

```bash
firebase storage:rules:get --project <env> > /tmp/storage.txt
diff /tmp/storage.txt apps/web/storage.rules
# → sin diferencias
```

---

## Bundle size check

`apps/web/package.json` script `bundle:check` corre size-limit con config
en `.size-limit.json` (root). Límites actuales:

| Bundle                | Path                                         | Limit       |
| --------------------- | -------------------------------------------- | ----------- |
| `main-app`            | `apps/web/.next/static/chunks/main-app-*.js` | 200 KB gzip |
| `webpack-runtime`     | `apps/web/.next/static/chunks/webpack-*.js`  | 10 KB gzip  |
| `shared-chunks-total` | `apps/web/.next/static/chunks/*.js` (total)  | 500 KB gzip |

Para ajustar:

```bash
cd apps/web
pnpm bundle:check
# Editar .size-limit.json si algún bundle se pasa del límite
```

El step `Bundle size check` corre automáticamente en CI. Si falla, el PR no
mergea.

## Dependabot

`.github/dependabot.yml` abre PRs semanales para:

- **pnpm** deps (weekly, lunes 9 AM ART) — minor + patch, agrupados en un PR
  por sprint
- **GitHub Actions** versions (monthly)

PRs se labelean automáticamente (`dependencies`) y respetan Conventional
Commits (`chore(deps):` / `ci:`).

---

## Troubleshooting

### Deploy falla con `Permission denied to enable project APIs`

La SA no tiene permiso para habilitar APIs. Soluciones:

1. Verificar que las 4 APIs base (`iam`, `cloudbuild`, `artifactregistry`,
   `cloudresourcemanager`) estén habilitadas manualmente antes del primer
   deploy
2. Si persiste, agregar `roles/serviceusage.serviceUsageAdmin`
   temporalmente

### Deploy falla con `Permission denied` en Artifact Registry

Agregar el rol de mantenimiento `roles/artifactregistry.admin` a la SA
(ver [Notas de mantenimiento](#notas-de-mantenimiento)).

### Deploy falla con `invalid credentials` o `Could not load credentials`

El JSON key en `FIREBASE_SERVICE_ACCOUNT_<env>` está malformado o expiró.
Soluciones:

1. Regenerar el JSON key desde GCP Console
2. Pegarlo completo (sin espacios extra, sin comillas envolventes) en el
   GitHub Secret
3. Re-correr el workflow

### `firebase deploy` falla con `functions predeploy error`

El step `pnpm --filter @platform/functions build` (predeploy hook de
`firebase.json`) falló. Correr localmente:

```bash
pnpm build
pnpm --filter @platform/functions build
```

### Coverage no aparece en Codecov

1. Verificar que `CODECOV_TOKEN` esté en GitHub Secrets
2. El job `coverage` solo corre en push a `main` (no en PRs)
3. Revisar logs del step `Upload to Codecov` — puede ser silencioso si falla

### Deploy a `prod` queda pendiente de aprobación

Revisar:

- Settings → Environments → production → Required reviewers
- Que el usuario que dispara tenga reviewers configurados
- `prevent_self_review: true` impide que el mismo user apruebe su propio
  dispatch (workaround: usar `enforce_admins: false` en branch protection
  o agregar otro reviewer)

### Smoke test falla con HTTP 5xx

La Cloud Function `ssr` no arrancó. Verificar:

1. `firebase functions:list --project <env>` muestra `ssr` con estado
   `ACTIVE`
2. `firebase functions:log --project <env>` muestra el error de runtime
3. Variables de env (`REPOSITORY_DRIVER`, `ALLOWED_ORIGINS`,
   `FIREBASE_ADMIN_PROJECT_ID`) están seteadas en la CF
4. `SESSION_COOKIE_SECRET` está configurada como Firebase Secret

---

## Notas de mantenimiento

### Rotación de claves (cada 90 días)

Se recomienda **regenerar el JSON key de la Service Account cada 90 días**
para minimizar el blast radius de un leak:

```bash
# 1. Crear nueva key
gcloud iam service-accounts keys create ./sa-key-new.json \
  --iam-account=github-deploy-agent@<project>.iam.gserviceaccount.com \
  --project=<project>

# 2. Pegar contenido en GitHub Secret FIREBASE_SERVICE_ACCOUNT_<env>
#    (reemplaza el valor anterior)

# 3. Re-correr un deploy de prueba para validar

# 4. Borrar la key vieja desde GCP Console (IAM & Admin → Service Accounts
#    → Keys → Delete) — el ID de la key vieja está en la sección "Keys"
```

Automatizar con `gcloud` + `gh secret set` (script en
`scripts/rotate-deploy-sa.sh`, a crear si se vuelve tedioso).

### Permisos

Si el deploy falla por permisos en **Artifact Registry** (CF 2nd gen
sube imágenes ahí), añadir el rol `roles/artifactregistry.admin` a la
cuenta de servicio. Repetir el paso 2 de la sección "Creación de la
Service Account" con ese rol agregado.

### Out of scope (futuro)

- **Preview deployments por PR**: deferido. v2 (Firebase Hosting channels
  - Cloud Run revisions).
- **Canary releases** (Cloud Run traffic split): v2.
- **Rollback automático si falla smoke test post-deploy**: v2
  (requiere `firebase hosting:clone` o `functions:rollback`).
- **Playwright E2E en CI**: deferido.
- **Lighthouse CI automático**: deferido.

---

## Lo que NO está en este SDD (out of scope)

- **Mobile CI/CD**: N/A.

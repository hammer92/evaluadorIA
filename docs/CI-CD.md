# CI/CD & Deploy

Documentación operativa para los workflows de GitHub Actions, secrets,
environments y branch protection. Complementa a
[`doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md`](../doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md)
(spec) con instrucciones paso a paso.

## Tabla de contenidos

- [Workflows](#workflows)
- [Secrets requeridos](#secretes-requeridos)
- [GitHub Environments](#github-environments)
- [Branch protection en `main`](#branch-protection-en-main)
- [Cómo correr un deploy](#cómo-correr-un-deploy)
- [Bundle size check](#bundle-size-check)
- [Dependabot](#dependabot)
- [Troubleshooting](#troubleshooting)

---

## Workflows

| Workflow                               | Trigger                             | Qué hace                                                                                                             |
| -------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`             | PR + push a `main`                  | Lint, typecheck, test, build, bundle size check. Coverage report en push a main (Codecov).                           |
| `.github/workflows/deploy-staging.yml` | push a `main` + `workflow_dispatch` | Build + deploy Cloud Functions + Firestore/Storage rules a Firebase project `staging`.                               |
| `.github/workflows/deploy-prod.yml`    | `workflow_dispatch` (manual)        | Build + deploy Cloud Functions + rules a `prod`. Requiere escribir `deploy-prod` en el input + environment approval. |

`ci.yml` corre en **concurrency group** (`ci-${{ github.ref }}` con
`cancel-in-progress: true`), así PRs viejos se cancelan cuando llega un push
nuevo. Los deploys usan `cancel-in-progress: false` para evitar deploys
parciales concurrentes.

## Secrets requeridos

Los siguientes secrets deben existir en **GitHub repo → Settings → Secrets and
variables → Actions**:

| Secret                         | Para                                       | Cómo obtenerlo                                                                                      |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `FIREBASE_TOKEN_STAGING`       | `firebase deploy` contra project `staging` | `firebase login:ci` local → `firebase login:ci --project staging` → pega el token en GitHub Secret. |
| `FIREBASE_TOKEN_PROD`          | Idem para `prod`                           | Idem, con `--project prod`.                                                                         |
| `CODECOV_TOKEN` (opcional)     | Upload coverage desde `ci.yml`             | Crear cuenta en codecov.io, agregar el repo, copiar el token.                                       |
| `SLACK_WEBHOOK_URL` (opcional) | Notificaciones post-deploy a Slack         | Crear incoming webhook en Slack, pegar la URL.                                                      |

> **Seguridad**: nunca commitear los tokens. `gitleaks` corre como parte del
> pipeline (recomendado agregar en SDD futuro). Si un secret se filtra,
> rotarlo inmediatamente desde Firebase Console + regenerar el GitHub Secret.

## Service Account IAM Roles (CRÍTICO para deploy)

El token generado por `firebase login:ci` representa una **Google Cloud Service
Account**. Para que `firebase deploy` pueda subir Hosting, Functions, reglas
de Firestore + Storage, e índices de Firestore, la service account debe tener
estos roles en el **proyecto GCP** correspondiente (`staging` o `prod`):

| Rol                                                                  | Cubre                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Firebase Admin** (`roles/firebase.admin`)                          | Hosting, reglas de Firestore, Cloud Storage                              |
| **Cloud Datastore Admin** (`roles/datastore.admin`)                  | Índices de Firestore (Firestore se compila sobre Datastore internamente) |
| **Cloud Functions Admin** (`roles/cloudfunctions.admin`)             | Deploy de Cloud Functions (build + upload source)                        |
| **Service Account User** (`roles/iam.serviceAccountUser`)            | Para que la CF pueda actuar como runtime service account                 |
| **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)            | Cloud Functions 2nd gen usa Cloud Build para compilar TS/JS              |
| **Artifact Registry Administrator** (`roles/artifactregistry.admin`) | Functions 2nd gen suben imágenes a Artifact Registry                     |

> **Plus** el rol **Cloud Run Invoker** (`roles/run.invoker`) si la CF `ssr`
> recibe tráfico desde Firebase Hosting (caso típico de SSR).

### APIs a habilitar (GCP Console)

Además de los roles, hay que **habilitar las APIs** en cada proyecto (`staging` y `prod`):

- Cloud Functions API (`cloudfunctions.googleapis.com`)
- Cloud Build API (`cloudbuild.googleapis.com`)
- Cloud Run API (`run.googleapis.com`) — para CF 2nd gen
- Artifact Registry API (`artifactregistry.googleapis.com`)
- Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`) — **necesaria para validar permisos durante el deploy**
- Firebase Hosting API (`firebasehosting.googleapis.com`)
- Cloud Firestore API (`firestore.googleapis.com`)
- Firebase Admin API (`firebase.googleapis.com`)
- Identity Toolkit API (`identitytoolkit.googleapis.com`) — para Auth emulator + Auth en runtime

Habilitar via gcloud (idempotente):

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  --project <staging|prod>
```

### Setup de la Service Account (idempotente via gcloud)

```bash
SA_NAME="github-deploy-sa"
SA_EMAIL="$SA_NAME@<project-id>.iam.gserviceaccount.com"

# 1. Crear la service account (si no existe)
gcloud iam service-accounts create $SA_NAME \
  --display-name "GitHub Actions deploy" \
  --project <staging|prod>

# 2. Asignar los 6 roles
for ROLE in \
  roles/firebase.admin \
  roles/datastore.admin \
  roles/cloudfunctions.admin \
  roles/iam.serviceAccountUser \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.admin \
  roles/run.invoker
do
  gcloud projects add-iam-policy-binding <project-id> \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None
done

# 3. Generar el token (este es el que va en GitHub Secret)
firebase login:ci --project <staging|prod>
#   -> abre browser, login con la cuenta de la SA
#   -> genera token, copiarlo en GitHub Secret FIREBASE_TOKEN_<env>

# 4. (Opcional) Generar JSON key para usar en lugar del token
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=$SA_EMAIL
#   -> subir el JSON como FIREBASE_SERVICE_ACCOUNT_<env> secret
```

> **Tip de troubleshooting**: si el deploy falla con
> `Permission denied to deploy rules / indexes`, agregar temporalmente
> `roles/editor` (Project Editor) a la SA para descartar bloqueos de API. Si
> con Editor funciona, el problema es granularidad de roles. Luego refinar a
> los 6 roles de arriba.

### Alternativa moderna: `FirebaseExtended/action-hosting-deploy`

En vez de generar un token CI con `firebase login:ci`, podés usar
`FirebaseExtended/action-hosting-deploy@v0` con un JSON key de la SA:

```yaml
- uses: FirebaseExtended/action-hosting-deploy@v0
  with:
    repoToken: '${{ secrets.GITHUB_TOKEN }}'
    firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}'
    projectId: admin-platform-staging
    channelId: live
```

Ventajas: las keys son rotables y revocables desde GCP Console sin tocar
GitHub Secrets. La SA sigue necesitando los mismos 6 roles IAM.

## GitHub Environments

Los workflows `deploy-staging.yml` y `deploy-prod.yml` referencian
environments. Estos se crean **manualmente** desde GitHub UI (no viven en el
repo porque son config de la organización):

### `staging`

- Settings → Environments → New environment → `staging`
- **No requiere reviewers** (cualquier merge a `main` deploya)
- Variables de environment (opcional, sobreescriben secrets): si necesitás
  URLs custom por env, declaralas acá

### `production`

- Settings → Environments → New environment → `production`
- **Required reviewers**: agregar 2+ owners del repo. Los reviewers reciben
  email/notificación cuando alguien dispatchea el workflow.
- **Deployment branches**: solo permitir `main` (recomendado)
- **Wait timer**: 5 minutos opcional (para rollback manual en caso de detectarlo)

Setup inicial (con `gh` CLI autenticado):

```bash
gh api --method PUT repos/:owner/:repo/environments/staging -f wait_timer=0
gh api --method PUT repos/:owner/:repo/environments/production \
  --input - <<'JSON'
{
  "wait_timer": 5,
  "prevent_self_review": true,
  "reviewers": [{"type": "User", "id": 123456}]
}
JSON
```

## Branch protection en `main`

**Setup manual via GitHub UI** (Settings → Branches → Add rule):

- **Branch name pattern**: `main`
- **Require a pull request before merging**: ✓
- **Require approvals**: 1 (idealmente 2 para cambios en `apps/functions/`)
- **Require status checks to pass before merging**: ✓
  - Agregar: `lint-typecheck-test-build` (del workflow `ci.yml`)
- **Require conversation resolution before merging**: ✓
- **Do not allow force pushes**: ✓
- **Do not allow deletions**: ✓
- **Allow auto-merge**: ✓ (CI + review pasan → merge automático, sin intervención manual)

Setup via `gh api` (idempotente):

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
  "enforce_admins": true,
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

**Notas**:

- `require_code_owner_reviews: true` fuerza review del CODEOWNERS para paths
  sensibles (CI/CD, reglas Firebase, AI-DLC, auth, secrets).
- `required_linear_history: true` rechaza PRs con merge commits (trunk-based
  requiere squash o rebase merge).
- `allow_force_pushes: false` + `allow_deletions: false` refuerzan la regla
  de AI-DLC de NO reescribir historia de main.
- Los 3 status checks corresponden a los 3 jobs del workflow `ci.yml`.

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
un PR toca un archivo matcheado. Ver sintaxis en
<https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-customizations/about-code-owners>.

Paths críticos en este repo (requieren owner review):

- `.github/workflows/` (CI/CD)
- `firebase.json`, `firestore.rules`, `storage.rules` (config Firebase)
- `apps/web/middleware.ts`, `apps/web/services/`, `apps/web/features/auth/` (auth)
- `apps/functions/src/v1/auth/`, `apps/functions/src/shared/with-auth.ts` (auth backend)
- `aidlc-docs/` (audit trail AI-DLC)
- `SECURITY.md`, `DEPLOY.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md` (governance)

## Cómo correr un deploy

### Staging

- **Automático**: merge a `main` triggerea el deploy
- **Manual**: GitHub → Actions → "Deploy Staging" → Run workflow

### Prod

1. GitHub → Actions → "Deploy Prod" → Run workflow
2. En el input `confirm`, escribir **exactamente** `deploy-prod` (cualquier
   otro valor falla el job `confirm`)
3. En el input `reason`, escribir changelog / justificación (opcional, pero
   requerido por buena práctica)
4. **Aprobar manualmente** el environment `production` desde GitHub UI
   (los reviewers reciben notificación)
5. Monitorear el job `deploy` (~5-10 min)

### Smoke test post-deploy

Después de que el deploy a staging complete, verificar manualmente:

```bash
curl -f https://staging.knowledgesync.app/admin/users  # debe devolver 200/307
firebase functions:list --project staging             # muestra las funciones deployadas
firebase firestore:rules:get --project staging       # confirma rules
```

> **Firebase Hosting + SSR via Cloud Function `ssr`**: activado en
> `firebase.json` sección `hosting`. Frontend se deploya automaticamente
> en cada push a main. Assets estaticos (`/_next/static/**`) servidos
> directamente desde Hosting con cache 1 año. Rutas dinamicas (`/admin/**`,
> `/login`, etc.) se redirigen via rewrite → Cloud Function `ssr` que
> ejecuta Next.js via `next({ dev: false }).getRequestHandler()`. Build
> flow: `pnpm --filter web build` (output standalone) → `pnpm --filter
functions build` (tsc + copy `.next/` a `lib/.next/`) → `firebase deploy
--only functions,hosting`.

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

## Troubleshooting

### CI falla en `bundle:check` pero local pasa

Borrar `apps/web/.next` y rebuildear:

```bash
rm -rf apps/web/.next
pnpm build
pnpm --filter web bundle:check
```

### `FIREBASE_TOKEN_STAGING` expira

Los tokens de `firebase login:ci` no expiran automáticamente pero pueden
ser invalidados. Regenerar:

```bash
firebase login:ci --project staging
# copiar token a GitHub Secret
```

### Deploy a staging falla con `Permission denied`

La service account detrás del token necesita rol `Firebase Hosting Admin` +
`Cloud Functions Admin`. Verificar en Firebase Console → IAM.

### Coverage no aparece en Codecov

1. Verificar que `CODECOV_TOKEN` esté en GitHub Secrets
2. El job `coverage` solo corre en push a `main` (no en PRs)
3. Revisar logs del step `Upload to Codecov` — puede ser silencioso si falla

### Workflow `deploy-prod` queda pendiente de aprobación

Revisar:

- Settings → Environments → production → Required reviewers
- Que el usuario que dispara tenga reviewers configurados
- Que `prevent_self_review: false` si querés que el mismo user que dispara pueda aprobar

## Lo que NO está en este SDD (out of scope)

- **Preview deployments por PR**: deferido. v2.
- **Canary releases** (Cloud Run traffic split): v2.
- **Mobile CI/CD**: N/A.
- **Playwright E2E en CI**: deferido.
- **Lighthouse CI automático**: deferido.
- **Rollback automático si falla smoke test post-deploy**: v2.

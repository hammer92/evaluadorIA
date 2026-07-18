# CI/CD & Deploy — Protocolo Firebase Full-Stack

Documentación operativa del pipeline CD del proyecto `agente-entrevistador-ia`,
siguiendo el **Protocolo de Despliegue Firebase Full-Stack + GitHub Actions**
definido por el owner. Complementa a
[`doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md`](../doc/sdd-package/02-sdds/SDD-08-cicd-deploy.md)
(spec histórica) con instrucciones operativas paso a paso.

## Tabla de contenidos

- [1. Habilitación de Infraestructura (Google Cloud)](#1-habilitación-de-infraestructura-google-cloud)
- [2. Creación de la Cuenta de Servicio](#2-creación-de-la-cuenta-de-servicio)
- [3. Configuración de Secretos en GitHub](#3-configuración-de-secretos-en-github)
- [4. Estructura del Proyecto (firebase.json)](#4-estructura-del-proyecto-firebasejson)
- [5. Implementación del Workflow](#5-implementación-del-workflow)
- [6. Verificación Post-Despliegue](#6-verificación-post-despliegue)
- [Notas de Mantenimiento](#notas-de-mantenimiento)
- [Troubleshooting](#troubleshooting)

---

## 1. Habilitación de Infraestructura (Google Cloud)

Antes de configurar el deploy, las siguientes APIs deben estar activas en el
proyecto **`agente-entrevistador-ia`**:

| API                                                                    | Por qué                                    |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| **IAM API** (`iam.googleapis.com`)                                     | Gestionar la cuenta de servicio del deploy |
| **Cloud Build API** (`cloudbuild.googleapis.com`)                      | Compilar Cloud Functions 2nd gen           |
| **Artifact Registry API** (`artifactregistry.googleapis.com`)          | Almacenar imágenes de las functions        |
| **Cloud Resource Manager API** (`cloudresourcemanager.googleapis.com`) | Validar permisos durante el deploy         |

Habilitar via gcloud (idempotente):

```bash
gcloud services enable \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project agente-entrevistador-ia
```

> Adicionalmente, las APIs de runtime (Cloud Functions, Cloud Run, Firebase
> Hosting, Firestore, Firebase Admin, Cloud Storage, Identity Toolkit) deben
> estar habilitadas — Firebase las activa automáticamente al inicializar el
> proyecto, pero verificá con `gcloud services list --enabled`.

---

## 2. Creación de la Cuenta de Servicio

Crear una cuenta dedicada para GitHub Actions aplicando **principio de mínimo
privilegio**:

```bash
PROJECT="agente-entrevistador-ia"
SA_NAME="github-deploy-agent"
SA_EMAIL="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

# 1. Crear la service account
gcloud iam service-accounts create $SA_NAME \
  --display-name "GitHub Actions deploy" \
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

### Roles obligatorios

| Rol                              | Cubre                                                           |
| -------------------------------- | --------------------------------------------------------------- |
| `roles/firebase.admin`           | Administrador de Firebase (Hosting, reglas, Storage)            |
| `roles/cloudfunctions.admin`     | Administrador de Cloud Functions (deploy + runtime)             |
| `roles/iam.serviceAccountUser`   | Usuario de cuenta de servicio (las CFs actúan como runtime SAs) |
| `roles/cloudbuild.builds.editor` | Editor de Cloud Build (compila las CFs 2nd gen)                 |
| `roles/datastore.owner`          | Gestionar índices y reglas de Firestore                         |

### Generar clave JSON

Crear una clave en formato JSON desde la pestaña **Claves** de la cuenta de
servicio (GCP Console → IAM & Admin → Service Accounts → `github-deploy-agent`
→ Keys → Add Key → Create new key → JSON) o via gcloud:

```bash
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=github-deploy-agent@agente-entrevistador-ia.iam.gserviceaccount.com \
  --project=agente-entrevistador-ia
```

> **Importante**: este JSON contiene credenciales con permisos de deploy.
> Guardarlo temporalmente; el siguiente paso lo mueve a GitHub Secrets y se
> borra el archivo local.

---

## 3. Configuración de Secretos en GitHub

Ir al repositorio en GitHub → **Settings → Secrets and variables → Actions** y
registrar los siguientes secretos:

### A. Secreto de Infraestructura

| Secreto                    | Valor                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT` | Pegar el contenido íntegro del archivo JSON de la Service Account (todo en una línea) |

### B. Secretos para el Frontend (Web)

Si el frontend requiere `firebaseConfig` durante la compilación, registrar:

| Secreto                | Valor                          |
| ---------------------- | ------------------------------ |
| `FIREBASE_API_KEY`     | API key de Firebase Web SDK    |
| `FIREBASE_AUTH_DOMAIN` | Auth domain (Firebase Console) |
| `FIREBASE_APP_ID`      | App ID (Firebase Console)      |

> Estos 3 valores se mapean automáticamente a las env vars de Next.js en el
> step de build del workflow:
>
> ```yaml
> NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
> NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
> NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
> ```

> Los valores exactos se obtienen de Firebase Console → Project Settings →
> General → "Your apps" → SDK setup and configuration.

### C. Secretos para Cloud Functions (Backend)

Estos secrets se inyectan en el runtime de las CFs via `--set-env-vars` en
el step de deploy (NO via Firebase Secret Manager — más simple, evita
dependencia con `secretmanager.googleapis.com`).

| Secreto                 | Para                                                                                                                                                                         | Requerido |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `SESSION_COOKIE_SECRET` | HS256 secret para firmar/verificar la cookie `__session` (CFs `v1_auth_create_session` y `shared/verify-session-cookie`). Generar con `openssl rand -base64 48` (≥32 chars). | Sí        |
| `ALLOWED_ORIGINS`       | Dominios CORS permitidos para las CFs onRequest (CSV: `https://agente-entrevistador-ia.web.app,https://agente-entrevistador-ia.firebaseapp.com`)                             | Sí        |
| `OPENAI_API_KEY`        | API key de OpenAI (si las CFs la consumen)                                                                                                                                   | No        |

> **Variables de runtime adicionales (no son secrets, se hardcodean en
> el workflow):**
>
> - `REPOSITORY_DRIVER=firebase` — fija el driver del repositorio de users/orgs
> - `FIREBASE_ADMIN_PROJECT_ID=agente-entrevistador-ia` — project ID para Firebase Admin SDK
>
> Estas se setean en `.github/workflows/main_deploy.yml` directamente,
> sin pasar por GitHub Secrets, porque son valores no-sensibles.

> **Generar `SESSION_COOKIE_SECRET`** (una sola vez, mismo valor en
> local dev y prod):
>
> ```bash
> openssl rand -base64 48
> # Copiar el output a GitHub Secret SESSION_COOKIE_SECRET
> # Y al .env.local como SESSION_COOKIE_SECRET=...
> ```

---

## 4. Estructura del Proyecto (firebase.json)

El archivo `firebase.json` en la raíz del proyecto vincula todos los servicios
Firebase (functions, firestore, hosting, storage). Ejemplo mínimo:

```json
{
  "functions": { "source": "functions" },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

> **Nota para este repo (monorepo)**: las paths reales difieren porque la
> estructura es monorepo con `apps/`:
>
> - `functions.source` → `apps/functions` (no `functions`)
> - `hosting.public` → `apps/web/.next/static` (no `dist`)
> - `firestore.rules` → `firestore.rules` (raíz)
> - `storage.rules` → `storage.rules` (raíz)
>
> Las rewrites a Cloud Function `ssr` (Next.js SSR) están en
> `firebase.json:hosting.rewrites` — el protocolo no las excluye; son una
> extensión válida del mínimo "vincular todos los servicios".

---

## 5. Implementación del Workflow

El workflow vive en `.github/workflows/main_deploy.yml` y se triggerea
**únicamente con push a `main`** (deploy continuo a producción).

```yaml
name: Deploy Full Firebase Stack
on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy to Firebase
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # --- BLOQUE FRONTEND (WEB) ---
      - name: Install & Build Web
        run: pnpm build
        env:
          # Inyectar config de Firebase para el build de la web
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}

      # --- BLOQUE DESPLIEGUE FINAL ---
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy
        env:
          GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          PROJECT_ID: agente-entrevistador-ia

      - name: Post-deploy smoke test (Hosting URL reachable)
        if: success()
        run: |
          URL="https://agente-entrevistador-ia.web.app"
          echo "Smoke-testing $URL ..."
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 30 "$URL")
          if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 400 ]; then
            echo "::error::Smoke test failed for $URL (HTTP $HTTP_STATUS)"
            exit 1
          fi
          echo "Smoke test OK ($URL → HTTP $HTTP_STATUS)"
```

Ver el archivo real en
[`.github/workflows/main_deploy.yml`](../.github/workflows/main_deploy.yml).

### Diagrama del flujo

```
push a main
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Checkout                         │
│ 2. Setup pnpm 9 + Node 22            │
│ 3. pnpm install --frozen-lockfile   │
│ 4. pnpm build                       │
│    env: NEXT_PUBLIC_FIREBASE_*      │
│    (mapeadas desde secrets)         │
│ 5. Deploy to Firebase               │
│    uses: w9jds/firebase-action      │
│    args: deploy                     │
│    env:                             │
│      GCP_SA_KEY = FIREBASE_         │
│                    SERVICE_ACCOUNT  │
│      PROJECT_ID = agente-           │
│                    entrevistador-ia │
│ 6. Smoke test: curl a hosting URL   │
└─────────────────────────────────────┘
    │
    ▼
Deploy completo (~5-10 min)
```

### Notas sobre `w9jds/firebase-action@master`

- **Qué hace**: instala `firebase-tools`, autentica con la Service Account
  via `GCP_SA_KEY`, y ejecuta el comando `firebase` especificado en `args`.
- **Inputs clave**:
  - `args`: comando completo de `firebase` CLI (ej: `deploy`, `deploy --only
hosting`, `firestore:rules:get`).
  - `GCP_SA_KEY` (env): contenido del JSON key de la SA.
  - `PROJECT_ID` (env): ID del proyecto Firebase destino.
- **Por qué esta action en lugar de `google-github-actions/auth@v2` +
  `firebase deploy` manual**:
  - Encapsula la instalación de firebase-tools + autenticación en un solo
    step.
  - Maneja correctamente la propagación de credenciales al subprocess
    `firebase`.
  - Reduce el código del workflow (~30% menos líneas que el approach
    manual).

---

## 6. Verificación Post-Despliegue

Tras el primer despliegue exitoso, **verificar manualmente** los 3 servicios:

### Hosting

```bash
curl -I https://agente-entrevistador-ia.web.app
```

Confirmar que la URL de Firebase Hosting carga el sitio con la configuración
inyectada. La web app se renderiza vía SSR Cloud Function (`ssr`); assets
estáticos (`/_next/static/**`) servidos directamente desde Hosting con cache
1 año.

### Functions

```bash
firebase functions:list --project agente-entrevistador-ia
```

Revisar en la consola de Firebase que las funciones aparezcan con la etiqueta
**"2nd gen"** (si aplica). Funciones desplegadas en este repo:

- `ssr` — Next.js SSR handler (onRequest, region `us-central1`, 512MiB)
- `v1Auth*` — endpoints de auth (sign-up, sign-in, session, sign-out)
- `v1Users*` — endpoints CRUD de users
- `v1Reports*` — endpoints de reports

### Firestore

```bash
firebase firestore:rules:get --project agente-entrevistador-ia > /tmp/rules.txt
diff /tmp/rules.txt firestore.rules
# → sin diferencias (rules desplegadas coinciden con el repo)
```

Confirmar que las **reglas de seguridad reflejen la última versión del
repositorio** (workflow incluye step automático que falla el job si difieren).

### Storage

```bash
firebase storage:rules:get --project agente-entrevistador-ia > /tmp/storage.txt
diff /tmp/storage.txt storage.rules
# → sin diferencias
```

---

## Notas de Mantenimiento

### Rotación de Claves (cada 90 días)

Se recomienda **regenerar la clave JSON de la Service Account cada 90 días**
para minimizar el blast radius de un leak:

```bash
# 1. Crear nueva key
gcloud iam service-accounts keys create ./sa-key-new.json \
  --iam-account=github-deploy-agent@agente-entrevistador-ia.iam.gserviceaccount.com \
  --project=agente-entrevistador-ia

# 2. Pegar contenido en GitHub Secret FIREBASE_SERVICE_ACCOUNT
#    (reemplaza el valor anterior)

# 3. Re-correr un deploy de prueba (push a branch → PR → merge) para validar

# 4. Borrar la key vieja desde GCP Console
#    (IAM & Admin → Service Accounts → Keys → Delete)
```

### Permisos

Si el despliegue falla por permisos en **Artifact Registry**, añadir el rol
`roles/artifactregistry.admin` a la cuenta de servicio:

```bash
gcloud projects add-iam-policy-binding agente-entrevistador-ia \
  --member="serviceAccount:github-deploy-agent@agente-entrevistador-ia.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin" \
  --condition=None
```

Repetir el paso de asignación de roles y volver a deployar.

### Out of scope (futuro)

- **Multi-environment deploy** (staging / prod separados): el protocolo
  apunta a deploy continuo a un solo proyecto. Para staging separado, crear
  un workflow adicional con `--project <staging-project>` y SA distinta.
- **Preview deployments por PR** (Firebase Hosting channels): v2.
- **Canary releases** (Cloud Run traffic split): v2.
- **Rollback automático** si falla smoke test: v2 (manual via
  `firebase hosting:clone` + `functions:rollback`).

---

## Troubleshooting

### CI falla en `lint/typecheck/test/build`

Errores de código, no de deploy. Correr localmente:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### Deploy falla con `Permission denied to enable project APIs`

Las 4 APIs base no están habilitadas. Habilitar via gcloud (ver §1) o desde
GCP Console.

### Deploy falla con `Permission denied` en Artifact Registry

Agregar el rol `roles/artifactregistry.admin` a la SA (ver §Notas de
Mantenimiento).

### Deploy falla con `invalid credentials` o `Could not load credentials`

El JSON key en `FIREBASE_SERVICE_ACCOUNT` está malformado o expiró. Soluciones:

1. Regenerar el JSON key desde GCP Console
2. Pegarlo completo (sin espacios extra, sin comillas envolventes, **todo en
   una sola línea**) en el GitHub Secret
3. Re-correr el workflow

### `firebase deploy` falla con `functions predeploy error`

El step `pnpm --filter @platform/functions build` (predeploy hook de
`firebase.json`) falló. Correr localmente:

```bash
pnpm build
pnpm --filter @platform/functions build
```

### Hosting URL devuelve 404

El rewrite a la Cloud Function `ssr` no está configurado. Verificar
`firebase.json:hosting.rewrites` apunta a la CF correcta (`ssr`,
region `us-central1`).

### Functions no aparecen como "2nd gen"

`firebase-tools@13` deploya como 2nd gen por default. Si aparecen como
"1st gen", verificar:

- `runtime` en `firebase.json:functions` o en `package.json` engines (Node 22)
- `gen` explícito en la configuración de la CF (si aplica)

### Smoke test falla con HTTP 5xx

La Cloud Function `ssr` no arrancó. Verificar:

1. `firebase functions:list --project agente-entrevistador-ia` muestra
   `ssr` con estado `ACTIVE`
2. `firebase functions:log --project agente-entrevistador-ia` muestra el
   error de runtime
3. Variables de env requeridas (`SESSION_COOKIE_SECRET`,
   `ALLOWED_ORIGINS`, `REPOSITORY_DRIVER`, `FIREBASE_ADMIN_PROJECT_ID`,
   `OPENAI_API_KEY`) están configuradas como GitHub Secrets y se pasan
   al deploy via `--set-env-vars` en `.github/workflows/main_deploy.yml`.
   Verificá en la consola de la CF (Runtime environment variables).

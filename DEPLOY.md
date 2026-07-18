# Deploy & Rollback

Guía operativa para desplegar a **`agente-entrevistador-ia`**, hacer
**rollback**, y resolver problemas frecuentes.

> **CI/CD workflows**: [`docs/CI-CD.md`](./docs/CI-CD.md) (workflows de
> GitHub Actions + secrets + environments, sigue el Protocolo Firebase
> Full-Stack + GitHub Actions).
> **Arquitectura**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7.
> **Seguridad / secrets**: [`SECURITY.md`](./SECURITY.md).

---

## Tabla de contenidos

- [Entornos](#entornos)
- [Pre-flight checklist](#pre-flight-checklist)
- [Deploy a producción](#deploy-a-producción)
- [Smoke test post-deploy](#smoke-test-post-deploy)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)
- [Cloud Logging URLs](#cloud-logging-urls)

---

## Entornos

| Entorno | Firebase project          | Branch / trigger | Quién aprueba | Cuándo deploya      |
| ------- | ------------------------- | ---------------- | ------------- | ------------------- |
| dev     | (emulator local, no GCP)  | local (no CI)    | —             | `pnpm emulators`    |
| prod    | `agente-entrevistador-ia` | `main` (push)    | nadie (auto)  | cada merge a `main` |

> **Single-environment deploy**: el protocolo del proyecto apunta a
> deploy continuo a un solo proyecto (`agente-entrevistador-ia`). No hay
> ambiente staging intermedio. Para multi-environment (staging/prod
> separados), ver [Troubleshooting §Multi-environment](#multi-environment).

---

## Pre-flight checklist

Antes de cualquier deploy, **todos** los ítems deben estar verdes:

```bash
# En tu local, con main actualizado
git checkout main && git pull --rebase

# 1. Tests + typecheck + lint + build verdes
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# 2. Si toca Cloud Functions o reglas de seguridad
pnpm verify:auth    # 11/11 contra emuladores
pnpm verify:rules   # firestore + storage rules

# 3. Si toca frontend
pnpm --filter web bundle:check

# 4. Sin secrets nuevos en el diff
git diff main..HEAD --stat
# Verificar que .env*, credentials.json, *service-account* no estén
```

Checklist adicional para deploy a **producción**:

- [ ] CHANGELOG actualizado (release-please PR mergeado o nota manual).
- [ ] Branch `main` compila y pasa CI.
- [ ] No hay PRs abiertos con cambios conflictivos.
- [ ] Stakeholders notificados (canal `#deploys` en Slack).
- [ ] Ventana de mantenimiento definida (prod) — idealmente low-traffic.
- [ ] Secrets de GitHub configurados (5 obligatorios + 2 opcionales —
      ver [docs/CI-CD.md §3](./docs/CI-CD.md#3-configuración-de-secretos-en-github)).

---

## Deploy a producción

Prod deploya **automáticamente** en cada merge a `main` vía
[`.github/workflows/main_deploy.yml`](./.github/workflows/main_deploy.yml).
No hay paso manual — el protocolo es deploy continuo a un único proyecto.

### Deploy automático (recomendado)

```bash
# Mergea tu PR a main → prod deploya solo
gh pr merge <PR-number> --squash --delete-branch
# Esperar ~3-5 min a que termine el workflow
gh run watch
```

### Re-deploy sin PR (rollback / hotfix)

Si necesitás re-deployar el estado actual de `main` (por ejemplo, después de
un rollback manual del código):

```bash
# Disparar el workflow via push vacío (no-op commit)
git commit --allow-empty -m "ci: trigger deploy" && git push origin main
gh run watch
```

### Qué se deploya

| Componente                | Comando                                                              | Destino                      |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------- |
| Cloud Functions (todas)   | `firebase deploy --only functions --project agente-entrevistador-ia` | `agente-entrevistador-ia`    |
| Firestore rules + indexes | `firebase deploy --only firestore --project agente-entrevistador-ia` | `agente-entrevistador-ia`    |
| Storage rules             | `firebase deploy --only storage --project agente-entrevistador-ia`   | `agente-entrevistador-ia`    |
| Hosting (Next.js + CF)    | `firebase deploy --only hosting --project agente-entrevistador-ia`   | `agente-entrevistador-ia`    |
| **Workflow consolidado**  | `w9jds/firebase-action@master` con `args: deploy`                    | todos los servicios en 1 run |

> **Comando consolidado**: el workflow usa la acción
> [`w9jds/firebase-action@master`](https://github.com/w9jds/firebase-action)
> con `args: deploy`, que internamente ejecuta `firebase deploy` subiendo
> todos los servicios configurados en `firebase.json` (Hosting + Functions
>
> - Firestore + Storage) en una sola corrida.

6. **Smoke test** post-deploy (ver abajo).

> El protocolo del proyecto es **deploy continuo a un solo proyecto**: no
> hay paso manual de aprobación ni ventana de mantenimiento. El `pre-flight
checklist` de arriba se valida localmente antes de mergear el PR.

---

## Smoke test post-deploy

Inmediatamente después de que el workflow termine, ejecutar en orden:

### 1. Health checks de Cloud Functions

```bash
firebase functions:list --project agente-entrevistador-ia

# Cada función debe aparecer con su estado OK
# Esperado:
#   ssr                 ✓  (Next.js SSR handler)
#   v1AuthSignUp        ✓
#   v1AuthCreateSession ✓
#   v1AuthClearSession  ✓
#   v1UsersCreate       ✓
#   v1UsersList         ✓
#   v1UsersUpdate       ✓
#   v1UsersDelete       ✓
#   v1ReportsGenerate   ✓
```

### 2. Verificación de reglas deployadas

```bash
firebase firestore:rules:get --project agente-entrevistador-ia > /tmp/rules-prod.txt
diff /tmp/rules-prod.txt firestore.rules     # debe ser idéntico

firebase storage:rules:get --project agente-entrevistador-ia > /tmp/storage-prod.txt
diff /tmp/storage-prod.txt storage.rules     # debe ser idéntico
```

### 3. Frontend (Hosting + SSR)

```bash
curl -fI https://agente-entrevistador-ia.web.app/      # 200 OK
curl -fI https://agente-entrevistador-ia.web.app/login # 200 OK
curl -fI https://agente-entrevistador-ia.web.app/admin # 307 redirect a /login (sin cookie)
```

### 4. Login + flujo crítico

Hacer login manual con una cuenta de test en prod y verificar:

- [ ] Login con email/password funciona.
- [ ] Custom claims se cargan (`role: 'admin'`).
- [ ] `/admin` carga el dashboard.
- [ ] Listar usuarios en `/admin/users` funciona.
- [ ] Crear un usuario de prueba funciona y aparece en la tabla.
- [ ] Signout limpia la cookie y redirige a `/login`.

### 5. Logs

```bash
# Cloud Functions
gcloud functions logs read --project agente-entrevistador-ia --region us-central1 --limit 50

# Firestore (admin SDK writes)
# Ver Cloud Logging URLs más abajo
```

---

## Rollback

### Cuándo hacer rollback

- Funciones de auth rotas (login falla).
- Rules de Firestore que rompen reads/writes legítimos.
- 5xx errors > 5% del tráfico.
- Pérdida de datos detectada.

### Rollback de Cloud Functions

```bash
# Opción A: redeployar la versión anterior (más rápido)
git checkout vX.Y.Z
pnpm --filter @platform/functions build
firebase deploy --only functions --project agente-entrevistador-ia
git checkout main

# Opción B: usar Firebase CLI para revertir a la última versión "good known"
firebase functions:rollback --project agente-entrevistador-ia
# (requiere Firebase CLI 13.4+; revierte al último deploy)
```

### Rollback de Firestore rules

```bash
# Revertir a la versión del último tag
git checkout vX.Y.Z -- firestore.rules
firebase deploy --only firestore:rules --project agente-entrevistador-ia
git checkout main -- firestore.rules
```

> ⚠️ Si el problema es que las rules son **demasiado permisivas**, NO hacer
> rollback (la versión vieja es peor). En su lugar, corregir y deployar
> inmediatamente (hotfix).

### Rollback de frontend (Firebase Hosting + SSR CF)

Para revertir el frontend al estado del último tag bueno:

```bash
# Opción A: redeployar la versión anterior
git checkout vX.Y.Z
pnpm build
firebase deploy --only hosting,functions --project agente-entrevistador-ia
git checkout main

# Opción B: clonar el canal de hosting a production
# (Firebase Hosting channels, requiere Firebase CLI 13.4+)
```

### Rollback de indexes

```bash
# Borrar el index problemático (no se puede "rollback")
firebase firestore:indexes:delete <index-id> --project agente-entrevistador-ia
# Re-deployar el archivo firestore.indexes.json anterior
git checkout vX.Y.Z -- firestore.indexes.json
firebase deploy --only firestore:indexes --project agente-entrevistador-ia
```

---

## Troubleshooting

### Deploy falla con `Permission denied` en Functions

- Verificar que el JSON key en `FIREBASE_SERVICE_ACCOUNT` corresponda a la
  SA con rol `roles/cloudfunctions.admin`. GCP Console → IAM → buscar
  `github-deploy-agent@agente-entrevistador-ia.iam.gserviceaccount.com` →
  verificar roles.

### Deploy falla con `Permission denied` en Artifact Registry

Agregar rol `roles/artifactregistry.admin` a la SA (ver
[docs/CI-CD.md §Notas de Mantenimiento](./docs/CI-CD.md#notas-de-mantenimiento)).

### Deploy falla con `invalid credentials` o `Could not load credentials`

El JSON key en `FIREBASE_SERVICE_ACCOUNT` está malformado o expiró:

1. Regenerar el JSON key desde GCP Console
2. Pegarlo completo (sin espacios extra, sin comillas envolventes, todo en
   una sola línea) en el GitHub Secret
3. Re-correr el workflow

### Deploy falla con `Quota exceeded`

- Cloud Functions 2nd gen tiene límite de 1000 funciones por proyecto.
- Revisar funciones huérfanas con `firebase functions:list` y borrar.

### `pnpm verify:auth` falla contra emuladores

```bash
# 1. Verificar que los emuladores estén corriendo
pnpm emulators:status

# 2. Si están caídos, reiniciar
pnpm emulators:stop
pnpm emulators:reset     # borra datos y reinicia
pnpm emulators:detach

# 3. Re-sembrar
pnpm seed:emulators

# 4. Re-correr verify
pnpm verify:auth
```

### Cookie `__session` no se setea en prod

Verificar:

1. `ALLOWED_ORIGINS` (runtime env de la CF) incluye
   `https://agente-entrevistador-ia.web.app`.
2. El cliente hace `fetch(..., { credentials: 'include' })`.
3. HTTPS está activo (cookies `Secure` solo se setean sobre HTTPS).
4. `SameSite` es `Lax` (no `None`) para same-origin.
5. `SESSION_COOKIE_SECRET` está configurado como Firebase Secret
   (`firebase functions:secrets:get SESSION_COOKIE_SECRET`).

### Bundle > 200 KB en landing

```bash
pnpm --filter web build
# Revisar el reporte .next/analyze o el output del build

# Causas comunes:
# - Importaste toda una lib: cambiar a named imports.
# - Componente UI pesado que solo se usa en /admin: usar dynamic import.
# - Lucide icons: importar solo los íconos usados.
#   import { Plus } from 'lucide-react';  ✅
#   import * as Icons from 'lucide-react'; ❌
```

### Lighthouse score bajo en `/admin/users`

```bash
npx lighthouse http://localhost:3000/admin/users --output=json --output-path=./lh.json
# Abrir ./lh.json y revisar:
#   - LCP > 2.5s → imagen hero muy pesada o fonts bloqueantes.
#   - TBT > 200ms → JS bundle grande (ver §Bundle).
#   - CLS > 0.1 → layout shift (skeletons mal medidos).
```

### Multi-environment

> **Out of scope del protocolo actual**: el deploy va directo a
> `agente-entrevistador-ia` (un solo proyecto). Si en el futuro se necesita
> staging separado, crear:
>
> - Un segundo Firebase project (ej: `agente-entrevistador-ia-staging`)
> - Una segunda SA con los mismos 5 roles
> - Un segundo workflow (`.github/workflows/main_deploy_staging.yml`) con
>   `--project <staging-project>` y secret `FIREBASE_SERVICE_ACCOUNT_STAGING`
>
> El protocolo actual no contempla multi-environment.

---

## Cloud Logging URLs

Links directos a los logs del proyecto `agente-entrevistador-ia`:

| Recurso   | URL                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functions | `https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_function%22%20resource.labels.function_name%3D%22*%22;duration=P1D?project=agente-entrevistador-ia` |
| Firestore | `https://console.firebase.google.com/project/agente-entrevistador-ia/firestore/logs`                                                                                            |
| Hosting   | `https://console.firebase.google.com/project/agente-entrevistador-ia/hosting/logs`                                                                                              |

### Queries útiles en Cloud Logging

```
# Errores 5xx en functions (última hora)
severity>=ERROR
resource.type="cloud_function"
timestamp>="2026-06-30T00:00:00Z"

# Latencia p99 por función
resource.type="cloud_function"
jsonPayload.executionTimeMs>1000
```

---

## Out of scope (no incluido en el protocolo actual)

- **Multi-environment** (staging + prod separados): el protocolo actual es
  single-project deploy continuo.
- Canary releases (Cloud Run traffic split).
- Mobile CI/CD.
- Playwright E2E en CI.
- Auto-rollback si falla smoke test.
- Preview deployments por PR (Firebase Hosting channels).

Si alguna de estas se necesita, crear SDD-10+.

# Deploy & Rollback

Guía operativa para desplegar a **staging** y **producción**, hacer
**rollback**, y resolver problemas frecuentes.

> **CI/CD workflows**: [`docs/CI-CD.md`](./docs/CI-CD.md) (workflows de
> GitHub Actions + secrets + environments).
> **Arquitectura**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7 (entornos).
> **Seguridad / secrets**: [`SECURITY.md`](./SECURITY.md).

---

## Tabla de contenidos

- [Entornos](#entornos)
- [Pre-flight checklist](#pre-flight-checklist)
- [Deploy a staging](#deploy-a-staging)
- [Deploy a producción](#deploy-a-producción)
- [Smoke test post-deploy](#smoke-test-post-deploy)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)
- [Cloud Logging URLs](#cloud-logging-urls)

---

## Entornos

| Entorno | Firebase project    | Branch / trigger                    | Quién aprueba | Cuándo deploya            |
| ------- | ------------------- | ----------------------------------- | ------------- | ------------------------- |
| dev     | `<project>-dev`     | local (no CI)                       | —             | manual (`pnpm emulators`) |
| staging | `<project>-staging` | `main` (auto) o `workflow_dispatch` | nadie (auto)  | cada merge a `main`       |
| prod    | `<project>-prod`    | `workflow_dispatch` manual          | 2 owners      | bajo demanda              |

> **SDD-08 NO incluye Firebase Hosting config** (decisión Q1=A scope
> recortado). El frontend se sirve hoy vía `next start` detrás de Cloud
> Run manual o Vercel. Para hosting automático vía Firebase Hosting + Cloud
> Run SSR, ver [Troubleshooting §Firebase Hosting](#firebase-hosting).

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
- [ ] 2 reviewers aprobaron el environment `production`.

---

## Deploy a staging

Staging deploya automáticamente en cada merge a `main` vía
[`.github/workflows/deploy-staging.yml`](./.github/workflows/deploy-staging.yml).

### Deploy automático (recomendado)

```bash
# Mergea tu PR a main → staging deploya solo
gh pr merge <PR-number> --squash --delete-branch
# Esperar ~3-5 min a que termine el workflow
gh run watch
```

### Deploy manual (sin PR)

```bash
gh workflow run deploy-staging.yml \
  --ref main
gh run watch  # seguir logs
```

### Qué se deploya

| Componente               | Comando                                                      | Destino                        |
| ------------------------ | ------------------------------------------------------------ | ------------------------------ |
| Cloud Functions (v1\_\*) | `firebase deploy --only functions --project staging`         | `<project>-staging`            |
| Firestore rules          | `firebase deploy --only firestore:rules --project staging`   | `<project>-staging`            |
| Storage rules            | `firebase deploy --only storage --project staging`           | `<project>-staging`            |
| Firestore indexes        | `firebase deploy --only firestore:indexes --project staging` | `<project>-staging`            |
| Frontend (sin hosting)   | manual: `next build` + `next start` o Vercel                 | Vercel preview / server manual |

> **Nota SDD-08 §4.5**: hosting automático diferido. El bundle se construye en
> CI pero **no** se deploya a Firebase Hosting. Se sirve por Vercel / server
> manual.

---

## Deploy a producción

Prod es **siempre manual** con aprobación.

### Procedimiento

1. **Verificar staging sano** (no hay alertas rojas en las últimas 2h).
2. **Notificar** en `#deploys` (Slack): "Deploy prod a las HH:MM".
3. **Disparar workflow**:

   ```bash
   gh workflow run deploy-prod.yml \
     --ref main \
     -f confirm=deploy-prod \
     -f reason="changelog: https://github.com/<org>/<repo>/releases/tag/vX.Y.Z"
   ```

4. **Esperar aprobación** del environment `production` (2 reviewers
   requeridos). Si nadie aprueba en 30 min, cancelar el run.
5. **Monitorear** logs durante el deploy (~5-10 min):

   ```bash
   gh run watch
   ```

6. **Smoke test** post-deploy (ver abajo).

### Cuándo NO deployar a prod

- ❌ Hay un incidente abierto en prod o staging.
- ❌ Hay PRs críticos sin mergear que tocan el mismo componente.
- ❌ El equipo está en cambio de guardia (on-call ausente).
- ❌ Es viernes después de las 14:00 ART.
- ❌ Hay features con flag pero la mitad del rollout incompleto.

---

## Smoke test post-deploy

Inmediatamente después de que el workflow termine, ejecutar en orden:

### 1. Health checks de Cloud Functions

```bash
# Reemplazar <project>-prod con el real
firebase functions:list --project <project>-prod

# Cada función debe aparecer con su estado OK
# Esperado:
#   v1AuthSignUp         ✓
#   v1AuthCreateSession  ✓
#   v1AuthClearSession   ✓
#   v1UsersCreate        ✓
#   v1UsersList          ✓
#   v1UsersUpdate        ✓
#   v1UsersDelete        ✓
#   v1ReportsGenerate    ✓
```

### 2. Verificación de reglas deployadas

```bash
firebase firestore:rules:get --project <project>-prod > /tmp/rules-prod.txt
diff /tmp/rules-prod.txt firestore.rules     # debe ser idéntico
```

### 3. Frontend (si deployaste UI)

```bash
curl -fI https://<dominio-prod>/              # 200 OK
curl -fI https://<dominio-prod>/login         # 200 OK
curl -fI https://<dominio-prod>/admin         # 307 redirect a /login (sin cookie)
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
gcloud functions logs read --project <project>-prod --region us-central1 --limit 50

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
pnpm --filter functions build
firebase deploy --only functions --project <project>-prod
git checkout main

# Opción B: usar Firebase CLI para revertir a la última versión "good known"
firebase functions:rollback --project <project>-prod
# (requiere Firebase CLI 13.4+; revierte al último deploy)
```

### Rollback de Firestore rules

```bash
# Revertir a la versión del último tag
git checkout vX.Y.Z -- firestore.rules
firebase deploy --only firestore:rules --project <project>-prod
git checkout main -- firestore.rules
```

> ⚠️ Si el problema es que las rules son **demasiado permisivas**, NO hacer
> rollback (la versión vieja es peor). En su lugar, corregir y deployar
> inmediatamente (hotfix).

### Rollback de frontend (Vercel)

1. Vercel Dashboard → Deployments.
2. Buscar el último deploy bueno.
3. Click → "Promote to Production".

### Rollback de indexes

```bash
# Borrar el index problemático (no se puede "rollback")
firebase firestore:indexes:delete <index-id> --project <project>-prod
# Re-deployar el archivo firestore.indexes.json anterior
git checkout vX.Y.Z -- firestore.indexes.json
firebase deploy --only firestore:indexes --project <project>-prod
```

---

## Troubleshooting

### Deploy falla con `Permission denied` en Functions

- Verificar que el `FIREBASE_TOKEN_<env>` tenga rol **Cloud Functions Admin**.
- Firebase Console → IAM → buscar la service account → verificar roles.

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

1. `ALLOWED_ORIGINS` en el env del CF incluye `https://<dominio-prod>`.
2. El cliente hace `fetch(..., { credentials: 'include' })`.
3. HTTPS está activo (cookies `Secure` solo se setean sobre HTTPS).
4. `SameSite` es `Lax` (no `None`) para same-origin.

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

### Firebase Hosting

> **Status**: NO configurado (decisión Q1=A scope recortado SDD-08 §4.5).

Si en el futuro se necesita, agregar a `firebase.json`:

```json
{
  "hosting": {
    "public": "apps/web/.next/static",
    "rewrites": [{ "source": "**", "function": "ssr" }],
    "headers": [
      {
        "source": "/_next/static/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
```

Y agregar una Cloud Function 2nd gen `ssr` con `onRequest` que haga el
SSR de Next.js. Esto queda fuera del MVP actual.

---

## Cloud Logging URLs

Links directos a los logs por entorno:

| Entorno | Functions                                                                                                                                                                 | Firestore                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| staging | `https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_function%22%20resource.labels.function_name%3D%22*%22;duration=P1D?project=<project>-staging` | `https://console.firebase.google.com/project/<project>-staging/firestore/logs` |
| prod    | `https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_function%22%20resource.labels.function_name%3D%22*%22;duration=P1D?project=<project>-prod`    | `https://console.firebase.google.com/project/<project>-prod/firestore/logs`    |

> Reemplazar `<project>` con el ID real del proyecto Firebase.

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

## Out of scope (no incluido en SDD-08)

- Canary releases (Cloud Run traffic split).
- Mobile CI/CD.
- Playwright E2E en CI.
- Auto-rollback si falla smoke test.
- Preview deployments por PR (workflow `preview-pr.yml` no incluido —
  decisión v2 cost/benefit; ver [`docs/CI-CD.md`](./docs/CI-CD.md)).
- Firebase Hosting + Cloud Run SSR.

Si alguna de estas se necesita, crear SDD-10+.

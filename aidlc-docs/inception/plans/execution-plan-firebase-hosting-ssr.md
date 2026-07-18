# Execution Plan — Firebase Hosting + SSR Deploy Sprint

**Fecha**: 2026-07-17T23:40:00Z
**Sprint**: firebase-hosting-ssr-deploy
**Workflow**: AI-DLC (Inception → Construction → Operations)
**Modo**: Brownfield, infraestructura nueva

---

## 1. Contexto

El proyecto tiene CI/CD (lint, typecheck, test, build, integration, coverage) y deploy
de Cloud Functions + Firestore + Storage rules, pero NO despliega el web (Next.js)
a Firebase Hosting. La decisión original (Q1=A del 2026-06-26) defirió hosting
hasta que existiera la CF `ssr` real. Ahora activamos hosting + creamos la CF `ssr`.

## 2. Decisiones del usuario (2026-07-17T23:35Z)

| Pregunta                   | Respuesta                                                          |
| -------------------------- | ------------------------------------------------------------------ |
| Q1 — Estrategia de hosting | **A**: SSR via Cloud Run (Cloud Function `ssr`)                    |
| Q2 — Workflow updates      | **A**: Modificar deploy-staging + deploy-prod para incluir hosting |

## 3. Stages a ejecutar

- [x] INCEPTION — Workspace Detection
- [x] INCEPTION — Requirements Analysis (Q1=A, Q2=A)
- [x] INCEPTION — Workflow Planning (este documento)
- [ ] CONSTRUCTION — Code Generation
- [ ] CONSTRUCTION — Build and Test
- [ ] Commit + audit + state update

### Stages skipped (justificación)

- **User Stories**: infra change, no afecta flujos de usuario.
- **Application Design**: solo tooling/CI/infra.
- **Units Generation / Functional Design**: 1 nueva Cloud Function (small, well-defined).
- **NFR Requirements / NFR Design**: el cambio refuerza NFR de CI/CD.

## 4. Plan de cambios

### 4.1 Crear Cloud Function `ssr` (apps/functions/src/v1/hosting/ssr.ts)

Adapter que toma el output de Next.js standalone y lo sirve como Express app:

```typescript
// apps/functions/src/v1/hosting/ssr.ts
import { onRequest } from 'firebase-functions/v2/https';
// Next.js produce un server standalone en apps/web/.next/standalone/
// cuando se configura output: 'standalone' en next.config.mjs
// El server escucha en PORT (default 3000) y maneja todas las rutas.
```

**Alternativa más simple**: usar `next start` directamente via `onRequest` que ejecuta
el binary standalone de Next.js.

### 4.2 Actualizar `next.config.mjs` (apps/web)

Agregar `output: 'standalone'` para que el build produzca:

- `apps/web/.next/standalone/` → server Node.js ejecutable
- `apps/web/.next/static/` → assets estaticos para Firebase Hosting

### 4.3 Crear `apps/functions/src/v1/hosting/ssr.ts`

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

// Next.js standalone server env vars
const port = defineString('PORT', { default: '3000' });
const hostname = defineString('HOSTNAME', { default: '0.0.0.0' });

export const ssr = onRequest(
  {
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [], // Add if needed (e.g. SESSION_COOKIE_SECRET)
  },
  async (req, res) => {
    // Importa el server de Next.js standalone
    const nextServer = (await import('./next-server.js')).default;
    nextServer(req, res);
  },
);
```

El handler importa `next-server.js` que es el entry point del build standalone de Next.js.

### 4.4 Actualizar `firebase.json`

Agregar sección `hosting`:

```json
{
  "hosting": {
    "public": "apps/web/.next/static",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "function": "ssr", "region": "us-central1" }
    ],
    "headers": [
      {
        "source": "/_next/static/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
        ]
      }
    ]
  },
  ...
}
```

### 4.5 Actualizar `apps/functions/src/index.ts`

Agregar export del handler `ssr`:

```typescript
export { ssr } from './v1/hosting/ssr.js';
```

### 4.6 Actualizar `.github/workflows/deploy-staging.yml` y `deploy-prod.yml`

Agregar step `Deploy Hosting` después de functions + rules:

```yaml
- name: Deploy Firebase Hosting
  run: pnpm exec firebase deploy --only hosting --project staging
  env:
    FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN_STAGING }}
```

### 4.7 Actualizar `docs/CI-CD.md` y `CONTRIBUTING.md`

Documentar el nuevo flow:

- Build produce standalone output
- Firebase Hosting sirve assets estaticos
- Cloud Function `ssr` renderiza paginas dinamicas
- Deploy workflow ahora incluye 3 targets: functions + rules + hosting

## 5. Criterios de cierre

- [ ] `firebase.json` tiene sección `hosting` con rewrites → ssr function
- [ ] `apps/functions/src/v1/hosting/ssr.ts` implementa el adapter
- [ ] `next.config.mjs` tiene `output: 'standalone'`
- [ ] Build produce `apps/web/.next/standalone/`
- [ ] `apps/functions/src/index.ts` exporta `ssr`
- [ ] `pnpm typecheck/lint/test/build` PASS
- [ ] Deploy workflows tienen step de hosting
- [ ] Docs actualizadas (CI-CD.md, CONTRIBUTING.md)
- [ ] Commit con conventional format
- [ ] PR merged via trunk-based workflow
- [ ] CI en main verde

## 6. Riesgos

| Riesgo                                            | Mitigación                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Standalone build incluye dependencias incorrectas | Verificar `apps/web/.next/standalone/package.json` antes de deploy |
| Cold start de CF ssr (>5s primera request)        | Configurar `minInstances: 1` en CF (costo extra ~$5/mes)           |
| CORS issues entre hosting y ssr function          | `cors: true` en el onRequest handler                               |
| Cookies \_\_session no se setean en SSR           | Validar Set-Cookie headers en response de ssr (manual smoke test)  |
| Firebase Hosting no soporta algunos rewrites      | Limitar rewrites a `"**"` (catch-all) por ahora                    |

## 7. Out of scope (recordatorio)

- Preview deployments por PR (GAP-08-B, v2)
- Multi-region deploys (v2)
- Canary releases (v2)
- Custom domain setup (manual desde Firebase console)

## 8. Métricas esperadas

- Archivos nuevos: 2 (`apps/functions/src/v1/hosting/ssr.ts`, `apps/web/next-server.js` adapter si necesario)
- Archivos modificados: 5 (`firebase.json`, `next.config.mjs`, `apps/functions/src/index.ts`, 2 deploy workflows, 1 doc)
- Líneas: ~150 insertions
- Tiempo: ~20 min implementación + ~5 min build verification

## 9. Verificación post-deploy (manual)

Una vez pusheado y mergeado, se requiere verificación manual:

1. Configurar secrets Firebase reales en GitHub UI:
   - `FIREBASE_TOKEN_STAGING` (via `firebase login:ci`)
   - `FIREBASE_SERVICE_ACCOUNT_STAGING`
   - Idem para prod
2. Trigger workflow `deploy-staging.yml` desde GitHub UI (workflow_dispatch)
3. Visitar URL staging y verificar:
   - Landing `/` carga (200 OK)
   - `/login` carga (200 OK)
   - `/admin` redirige a `/login?next=/admin` (307)
   - Login con admin@empresa.com funciona
   - `/admin/users` muestra tabla con datos de seed

## 10. Smoke test post-deploy (automatizado, opcional v2)

```bash
# En el workflow, después de deploy
- name: Smoke test
  run: |
    curl -fsSL https://staging.evaluadorIA.web.app/ -o /dev/null -w "%{http_code}\n" | grep 200
    curl -fsSL https://staging.evaluadorIA.web.app/login -o /dev/null -w "%{http_code}\n" | grep 200
    curl -fsSL https://staging.evaluadorIA.web.app/admin -o /dev/null -w "%{http_code}\n" | grep 307
```

Implementación v2 — agregar smoke tests programáticos.

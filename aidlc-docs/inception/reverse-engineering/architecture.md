# System Architecture

## System Overview

Monorepo **pnpm** con arquitectura **vendor-agnostic** en capa de dominio. El panel admin (`apps/web`) usa Next.js 14 App Router. El backend serverless (`apps/functions`) esta planificado pero aun vacio. Los contratos compartidos viven en `packages/shared`.

**Estado de implementacion**: Fases SDD-01 y SDD-02 completadas parcialmente (toolchain + shell frontend). Firebase, repositorios, auth real y Cloud Functions pendientes (SDD-03 a SDD-08).

## Architecture Diagram

```mermaid
flowchart TB
  subgraph Client
    Browser["Navegador"]
  end

  subgraph apps_web["apps/web - Next.js 14"]
    AppRouter["app/ - Rutas"]
    Components["components/ - UI + layout"]
    Middleware["middleware.ts"]
    Stores["stores/ - Zustand"]
    Config["config/ + env.ts"]
    PlannedRepo["repositories/ - PLANIFICADO"]
    PlannedSvc["services/ - PLANIFICADO"]
  end

  subgraph apps_fn["apps/functions - PLANIFICADO"]
    CFv1["Cloud Functions v1 handlers"]
  end

  subgraph packages["packages/shared"]
    Schemas["schemas/ - PLANIFICADO"]
    Types["types/ - PLANIFICADO"]
  end

  subgraph Firebase["Firebase - PLANIFICADO SDD-03"]
    Auth["Firebase Auth"]
    FS["Cloud Firestore"]
    Storage["Cloud Storage"]
    Hosting["Firebase Hosting"]
  end

  Browser --> AppRouter
  AppRouter --> Middleware
  Middleware -->|"cookie __session"| AppRouter
  AppRouter --> Components
  Components --> Stores
  AppRouter -.-> PlannedSvc
  PlannedSvc -.-> PlannedRepo
  PlannedRepo -.-> FS
  AppRouter -.-> CFv1
  CFv1 -.-> FS
  CFv1 -.-> Auth
  AppRouter -.-> Schemas
  CFv1 -.-> Schemas
  Browser --> Hosting
```

## Component Descriptions

### apps/web (@platform/web)

- **Purpose**: Aplicacion web administrativa
- **Responsibilities**: UI, routing, middleware de auth, providers (theme, query, toast), layout admin
- **Dependencies**: React 18, Next.js 14, Radix/shadcn, TanStack Query, Zustand, Zod (env)
- **Type**: Application

### apps/functions

- **Purpose**: Backend serverless (Cloud Functions 2nd gen)
- **Responsibilities**: Endpoints callable HTTPS, operaciones privilegiadas
- **Dependencies**: Firebase Admin SDK (planificado)
- **Type**: Application (placeholder vacio)

### packages/shared (@platform/shared)

- **Purpose**: Tipos y schemas compartidos
- **Responsibilities**: Zod schemas, tipos inferidos, errores compartidos
- **Dependencies**: Zod
- **Type**: Shared/Model

## Data Flow

```mermaid
sequenceDiagram
  participant User
  participant Next as apps/web
  participant MW as middleware
  participant UI as Admin Layout

  User->>Next: Request /
  Next->>User: Landing page

  User->>Next: Request /admin
  Next->>MW: intercept
  alt no session
    MW->>User: redirect /login
  else session ok
    MW->>UI: render layout
    UI->>User: Dashboard placeholder
  end
```

## Integration Points

- **External APIs**: Cloud Functions callable HTTPS (planificado), webhooks ATS (planificado)
- **Databases**: Cloud Firestore — users, organizations, auditLogs (planificado SDD-04)
- **Third-party Services**: Firebase Auth (Email + Google planificado), Resend email (env var), Firebase Storage (planificado)

## Infrastructure Components

- **CDK Stacks**: No aplica — stack Firebase serverless, no CDK/Terraform en repo
- **Deployment Model**: Firebase Hosting + Cloud Functions (planificado SDD-08); scripts `deploy:staging`/`deploy:prod` son placeholders
- **Networking**: Cloud CDN via Firebase Hosting; CORS configurado via `ALLOWED_ORIGINS`

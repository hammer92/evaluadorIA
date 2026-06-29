# Interaction Diagrams

Diagramas de secuencia que muestran como las transacciones de negocio se implementan (o se planifican implementar) entre componentes.

## BT-01: Acceso a area admin (implementacion parcial)

**Estado actual**: Middleware verifica cookie `__session`; login no implementado.

```mermaid
sequenceDiagram
  participant Browser
  participant Middleware as Next.js Middleware
  participant AdminPage as /admin/page

  Browser->>Middleware: GET /admin
  alt sin cookie __session
    Middleware->>Browser: 302 redirect /login?next=/admin
  else con cookie __session
    Middleware->>AdminPage: next()
    AdminPage->>Browser: Dashboard placeholder
  end
```

## BT-02: Crear usuario (planificado SDD-04/05/06)

```mermaid
sequenceDiagram
  participant Admin as Admin UI
  participant Service as services/users
  participant CF as Cloud Functions v1_users_create
  participant Auth as Firebase Auth
  participant Repo as UserRepository
  participant FS as Firestore
  participant Audit as AuditLogRepository

  Admin->>Service: createUser(input)
  Service->>CF: callable HTTPS + JWT
  CF->>CF: onCallAuth admin + Zod validate
  CF->>Auth: createUser email
  CF->>Repo: save user doc
  Repo->>FS: users/{uid}
  CF->>Audit: log USER_CREATED
  CF->>Service: User
  Service->>Admin: success toast + refresh list
```

## BT-05: Flujo candidato evaluacion (planificado - System Design)

```mermaid
sequenceDiagram
  participant Recruiter as Admin UI
  participant API as Cloud Functions
  participant FS as Firestore
  participant Desktop as Desktop App
  participant AI as Agente IA

  Recruiter->>API: inviteCandidate email + templateId
  API->>FS: create invitation + OTP
  Desktop->>API: verifyOTP + startSession
  loop por cada pregunta
    Desktop->>AI: submitAnswer
    AI->>Desktop: feedback sincronico
  end
  Desktop->>API: finishSession
  API->>AI: generateFinalReport async
  AI->>FS: store report + nivelacion
  Recruiter->>API: getReport candidateId
  API->>Recruiter: informe + proctoring links
```

## BT-06: Generar reporte (planificado SDD-06)

```mermaid
sequenceDiagram
  participant Admin as Admin UI
  participant CF as v1_reports_generate
  participant FS as Firestore
  participant ATS as ATS externo

  Admin->>CF: generateReport params
  CF->>CF: auth + validate
  CF->>FS: fetch evaluation data
  CF->>CF: aggregate + format
  CF->>Admin: Report PDF/JSON
  opt integracion ATS
    CF->>ATS: POST webhook report
  end
```

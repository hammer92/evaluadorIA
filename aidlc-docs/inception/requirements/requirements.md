# Requirements Document: Firebase Setup (SDD-03)

## Intent Analysis

- **User Request**: Implementar SDD-03 (Firebase Setup)
- **Request Type**: New Feature / Infrastructure
- **Scope Estimate**: Multiple Components (Configuración emuladores, SDK Wrapper Web, SDK Wrapper Node, scripts de Seed)
- **Complexity Estimate**: Comprehensive

## Key Functional Requirements

- **Configuración de emuladores**: Configurar `firebase.json` para levantar los emuladores de Firebase (Auth, Firestore, Functions, Storage) en sus puertos por defecto.
- **Reglas de Firestore (`firestore.rules`)**:
  - Implementar denegación por defecto global (`allow read, write: if false;`).
  - Escribir reglas para `users`, `organizations`, y `auditLogs`.
  - **Decisión Aplicada**: Se implementará validación estricta para asegurar que `request.resource.data.createdAt == request.time` al crear nuevos documentos.
- **Reglas de Storage (`storage.rules`)**:
  - Implementar denegación por defecto.
  - Regla básica para permitir almacenamiento de imágenes en `avatars/{uid}/*` para el usuario correspondiente.
- **Índices de Firestore**: Especificar en `firestore.indexes.json` los índices necesarios definidos en el modelo de datos.
- **Cliente Firebase (`lib/firebase/client.ts`)**: Crear un wrapper del SDK de cliente (Next.js) que se conecte automáticamente a los emuladores en entorno `dev`.
- **Admin Firebase (`apps/functions/src/firebase-admin.ts`)**: Crear un wrapper del Firebase Admin SDK.
  - **Decisión Aplicada**: Inicializar el Admin SDK sin credenciales y utilizando un `projectId` ficticio (demo) si se detecta que el entorno es local/emulado (`FIRESTORE_EMULATOR_HOST` presente).
- **Custom Claims**: Crear un helper `setUserRole(uid, role)` para asignar roles de forma segura a través del Auth Emulator/Admin SDK.
- **Script de carga de datos (Seed)**: Proveer un script `pnpm seed:emulators` para popular los emuladores con 3 usuarios (admin, recruiter, expert) y 1 organización por defecto. El script debe ser idempotente.
- **Scripts NPM**: Añadir comandos para levantar emuladores de forma fácil con persistencia local (`emulator-data`).

## Key Non-Functional Requirements

- **Seguridad**: Asegurar que las reglas funcionen correctamente y bloqueen accesos no autorizados mediante pruebas.
  - **Decisión Aplicada**: Firebase App Check no se implementará en SDD-03 y se postergará para la fase de Infraestructura/Deploy (SDD-08).
- **Idempotencia**: Todas las operaciones del script `seed` deben manejar graciosamente los casos de datos ya existentes y no arrojar errores fatales.
- **DX (Developer Experience)**: Los emuladores deben exportar su estado al cerrarse (`--export-on-exit`) e importarlo al iniciar (`--import`), garantizando persistencia del estado en la máquina del desarrollador.

## Answers to Verification Questions

- **Q1 (App Check)**: A (Postergar a SDD-08).
- **Q2 (Firestore createdAt)**: A (Aplicar validación estricta `createdAt == request.time`).
- **Q3 (Admin SDK Init)**: A (Inicializar Admin SDK local sin credenciales).

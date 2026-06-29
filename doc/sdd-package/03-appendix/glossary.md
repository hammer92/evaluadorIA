# Glosario

> Vocabulario común usado en el proyecto. Si un término no está acá, preguntar antes de asumir.

---

## A

**ADR (Architecture Decision Record)**
Documento corto (1-2 páginas) que captura una decisión técnica importante, su contexto, alternativas consideradas y consecuencias. Vive en `01-architecture/decisions/`.

**Audit log**
Registro inmutable de una acción realizada en el sistema (quién, qué, cuándo, contra qué recurso). Se escribe solo desde Cloud Functions.

**Auth (Firebase)**
Servicio de Firebase que maneja identidad: signup, signin, sesiones, OAuth providers, MFA.

**App Router**
Sistema de routing de Next.js 14 basado en文件系统 (file-based), con layouts anidados, Server Components y streaming. Reemplaza al Pages Router.

## B

**Boundary**
Punto en el código donde los datos cruzan entre zonas de confianza (cliente ↔ servidor, código nuestro ↔ SDK externo). Toda data que cruza un boundary **debe** ser validada con Zod.

**Bundle size**
Tamaño en bytes (gzip) del código JavaScript/CSS que el cliente descarga para renderizar una página. Objetivo: < 200KB gzip para landing.

## C

**Callable function**
Cloud Function expuesta vía HTTPS que el cliente invoca con `httpsCallable()`. Tiene tipos firmes para request y response.

**Contract test**
Test que verifica que múltiples implementaciones de una misma interfaz (ej. `FirebaseUserRepository` y `MemoryUserRepository`) se comportan igual.

**Cookie de sesión (`__session`)**
Cookie httpOnly + Secure + SameSite=Lax que el server setea tras un signin exitoso. Contiene un session cookie de Firebase Auth (no el ID token).

**Custom Claims**
Datos arbitrarios embebidos en el JWT de un usuario de Firebase Auth. Se setean vía Admin SDK. Usamos `role` y `organizationId`.

## D

**Deny-by-default**
Política de seguridad: las reglas de Firestore/Storage niegan TODO acceso, y solo lo explícitamente permitido pasa. Es el opuesto de "allow-by-default".

**Domain**
Conjunto de entidades y reglas de negocio de un área (ej. `users`, `reports`). Un "domain" en este proyecto también = un módulo en `/features/<domain>`.

## E

**Expert**
Uno de los tres roles del sistema (ver [ADR-0006](../01-architecture/decisions/0006-role-naming-and-permissions.md)). Subject Matter Expert técnico. Tiene foco en **edición de pruebas técnicas**: puede CRUD templates, editar competencias y recetas, gestionar el question bank, aprobar templates antes de uso. NO puede invitar candidatos ni gestionar users (excepto su propio perfil).

**Edge runtime**
Runtime de Next.js que corre en el CDN (más cerca del usuario). Más rápido pero con menos APIs disponibles. Usado por el middleware.

**Emulator**
Servicio local de Firebase que simula producción (Auth, Firestore, Storage, Functions). Permite desarrollar sin tocar el proyecto real.

**ESLint flat config**
Formato nuevo de config de ESLint (a partir de v9) en un único archivo `eslint.config.mjs`. Reemplaza a `.eslintrc`.

## F

**Feature folder**
Convención de organización: `features/<domain>/` contiene todo lo específico de un dominio (components, hooks, api, schemas). Evita el "components" o "hooks" global con 50 archivos.

**Factory pattern**
Función que decide qué implementación concreta instanciar según una condición (en este caso, `env.REPOSITORY_DRIVER`).

## G

**Gzip size**
Tamaño del bundle después de compresión gzip. Es la métrica relevante para transferencia por red. Los límites de bundle size se miden en gzip.

## H

**httpsCallable**
Función de Firebase JS SDK para invocar un callable Cloud Function. Aplica tipos al request y response.

## I

**Implementation (`firebase.ts` / `memory.ts`)**
Las dos versiones concretas de un repository interface. La primera toca Firebase; la segunda vive en RAM para tests.

**Interface (`index.ts` del repository)**
Contrato TypeScript que define qué operaciones existen sobre una entidad y cómo se llaman. Es lo único que el resto de la app consume.

## J

**JWT (JSON Web Token)**
Token firmado que contiene claims. Firebase Auth lo emite para usuarios autenticados. Puede ser `idToken` (1h) o `sessionCookie` (5 días).

## L

**Layer**
Nivel de abstracción en la arquitectura (UI, services, repositories, lib). Las reglas del proyecto definen qué layer puede importar de qué.

**Linting**
Análisis estático del código para encontrar errores, inconsistencias y violaciones de estilo. ESLint es el linter de TypeScript.

## M

**Memory repository**
Implementación de un repository que mantiene los datos en RAM (Map/Set). Se usa en tests para evitar Firebase. Nunca se usa en producción.

**Mermaid**
Lenguaje de diagramas en texto plano que GitHub renderiza nativamente. Usado para diagramas de sistema, secuencia y ER.

**Middleware (Next.js)**
Función que corre antes de cada request a una ruta. Usado acá para proteger `/admin/**` redirigiendo a `/login` si no hay sesión.

## O

**OnCall (Cloud Functions)**
Decorator de `firebase-functions/v2/https` que define una función invocable vía `httpsCallable`. Tiene CORS automático, tipos y auth inyectado.

**OnRequest (Cloud Functions)**
Decorator de `firebase-functions/v2/https` para funciones HTTP tradicionales (REST). Usado cuando se necesita controlar el response (ej. setear cookies).

## P

**Provider**
Componente de React que envuelve la app y expone un valor via context (ej. QueryProvider expone el QueryClient, ThemeProvider expone el tema).

**Pagination**
Dividir una lista grande en páginas (ej. 20 items por página). El cliente pide `page=1, pageSize=20`.

**pnpm**
Package manager para Node.js. Usado en este proyecto por velocidad y soporte de workspaces.

## R

**Recruiter**
Uno de los tres roles del sistema (ver [ADR-0006](../01-architecture/decisions/0006-role-naming-and-permissions.md)). Persona del equipo de RRHH. Tiene foco en **gestión de candidatos**: puede CRUD users, invitar candidatos, asignar tests, ver reportes y cancelar evaluaciones. NO puede editar templates de pruebas técnicas ni settings/billing de la organización.

**RSC (React Server Components)**
Componente de React que se renderiza en el servidor y envía solo el HTML al cliente. Por defecto en Next.js 14 App Router.

**Repository pattern**
Patrón arquitectónico donde el acceso a datos se abstrae detrás de una interfaz. Permite cambiar el backing sin tocar la lógica de negocio.

**RHF (React Hook Form)**
Librería para manejar formularios en React con performance optimizada (uncontrolled por default).

**Rules (Firestore / Storage)**
Archivos de configuración declarativa que definen quién puede acceder a qué en la base de datos / storage. Se ejecutan en el servidor de Firebase.

## S

**SDD (Software/Solution Design Document)**
Documento que especifica cómo implementar una feature o componente. Incluye contexto, decisiones, spec detallada, criterios de aceptación y riesgos.

**Session cookie**
Cookie firmada de larga duración (5 días) emitida por `auth.createSessionCookie()`. A diferencia del idToken (1h), se puede usar directamente como credencial.

**Soft delete**
Marcar un registro como borrado (`deletedAt: Date`) sin eliminarlo físicamente. Permite recuperación y auditoría.

**snake_case ↔ camelCase**
Mapeo entre el formato de Firestore (snake_case) y TypeScript (camelCase). Se hace solo en `repositories/*/mapper.ts`.

**Spec**
En este proyecto, la sección "Spec detallada" de cada SDD. Es lo que el dev implementa.

## T

**TanStack Query**
Librería para data fetching + cache + sincronización en React. Usada por todas las pantallas que muestran datos.

**TanStack Table**
Librería headless para construir tablas con sort, filter, pagination. Usada en `/admin/users`.

**Tracing ID**
UUID generado por el backend en cada request y propagado a logs + audit. Permite seguir un request de punta a punta.

## V

**Vendor**
Proveedor de infraestructura. En este proyecto, el vendor actual es Firebase, pero la arquitectura está diseñada para migrar a AWS / GCP Cloud Run / Vercel tocando solo la capa `/repositories`.

**Verification**
Proceso de confirmar que algo cumple con su spec. En este proyecto: criterios de aceptación del SDD + tests + code review.

## W

**Workflow (GitHub Actions)**
Archivo YAML en `.github/workflows/` que define un job automatizado (CI, deploy, etc.).

**Worktree (git)**
Copia aislada del repo para trabajar sin afectar la rama principal. Usado por workers del agente para cambios en paralelo.

## Z

**Zod**
Librería de validación runtime + inferencia de tipos para TypeScript. Usada para validar todo input/output en boundaries y derivar tipos del dominio.

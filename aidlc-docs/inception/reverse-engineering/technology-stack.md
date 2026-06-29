# Technology Stack

## Programming Languages

| Lenguaje   | Version | Uso                                      |
| ---------- | ------- | ---------------------------------------- |
| TypeScript | ^5.6.0  | Todo el codigo fuente                    |
| JavaScript | ES2022+ | Config (eslint, commitlint, lint-staged) |

## Frameworks

| Framework         | Version | Proposito                                        |
| ----------------- | ------- | ------------------------------------------------ |
| Next.js           | ^14.2.0 | App web, App Router, middleware                  |
| React             | ^18.3.0 | UI components                                    |
| Tailwind CSS      | ^3.4.0  | Estilos utility-first                            |
| Radix UI / shadcn | varios  | Componentes accesibles                           |
| TanStack Query    | ^5.56.0 | Server state (configurado)                       |
| TanStack Table    | ^8.20.0 | Tablas (dependencia instalada, sin uso aun)      |
| React Hook Form   | ^7.53.0 | Formularios (dependencia instalada, sin uso aun) |
| Zustand           | ^4.5.0  | Client state (ui-store)                          |
| Zod               | ^3.23.0 | Validacion env + planificado dominio             |

## Infrastructure (planificado)

| Servicio                | Proposito                     |
| ----------------------- | ----------------------------- |
| Firebase Auth           | Autenticacion Email + Google  |
| Cloud Firestore         | Base de datos principal       |
| Cloud Storage           | Archivos, proctoring (futuro) |
| Cloud Functions 2nd gen | Backend serverless            |
| Firebase Hosting        | Deploy frontend + CDN         |
| Firebase Emulator Suite | Desarrollo local              |

## Build Tools

| Tool                | Version           | Proposito                    |
| ------------------- | ----------------- | ---------------------------- |
| pnpm                | >=9               | Package manager, workspaces  |
| Node.js             | >=20              | Runtime                      |
| TypeScript compiler | ^5.6.0            | Type checking + build shared |
| ESLint              | ^8.57.1 / ^9.12.0 | Linting                      |
| Prettier            | ^3.3.0            | Formateo                     |
| Husky               | ^9.1.0            | Git hooks                    |
| lint-staged         | ^15.2.0           | Pre-commit lint              |
| commitlint          | ^19.5.0           | Conventional commits         |
| Vitest              | ^2.1.0            | Unit/integration tests       |
| tsx                 | ^4.19.0           | TS execution scripts         |

## Testing Tools

| Tool                      | Version | Proposito             |
| ------------------------- | ------- | --------------------- |
| Vitest                    | ^2.1.0  | Test runner           |
| @vitest/coverage-v8       | ^2.1.0  | Coverage              |
| @testing-library/react    | ^16.0.0 | Component tests (web) |
| @testing-library/jest-dom | ^6.5.0  | DOM matchers          |
| jsdom                     | ^25.0.0 | DOM environment       |

## UI Libraries

| Library                  | Proposito               |
| ------------------------ | ----------------------- |
| lucide-react             | Iconos                  |
| next-themes              | Dark/light mode         |
| sonner                   | Toast notifications     |
| class-variance-authority | Variants de componentes |
| clsx + tailwind-merge    | Merge de clases CSS     |

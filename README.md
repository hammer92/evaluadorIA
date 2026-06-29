# Admin Platform

> Plataforma administrativa full-stack construida sobre Firebase (serverless) con arquitectura vendor-agnostic.

## Requisitos

- Node.js 20 LTS (usar `nvm install 20` si tenés nvm)
- pnpm 9+ (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`) — requerido desde SDD-03

## Setup local

1. Clonar el repo
2. `pnpm install`
3. `cp .env.example .env.local` y completar las variables
4. `pnpm prepare` (instala hooks de Husky)
5. `pnpm typecheck` para verificar que todo compila
6. `pnpm test` para correr la suite

> **Nota sobre `pnpm dev`**: hasta SDD-02 solo se valida build + tests. Desde SDD-03 se requieren los emuladores de Firebase levantados (`pnpm emulators`) antes de `pnpm --filter web dev`.

## Workflow AI-DLC

Este proyecto sigue AI-DLC. Cada SDD se cierra con un commit que sigue Conventional Commits (validado por `commitlint`). Hooks activos:

- `pre-commit`: `pnpm lint-staged` + `pnpm typecheck`
- `commit-msg`: `pnpm commitlint --edit`

Para detalles ver [.agents/AGENTS.md](.agents/AGENTS.md).

## Comandos principales

| Comando              | Qué hace                                             |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | Levanta Next.js + emuladores (definido en SDD-02/03) |
| `pnpm build`         | Build de todos los paquetes                          |
| `pnpm test`          | Corre Vitest una vez                                 |
| `pnpm test:watch`    | Modo watch                                           |
| `pnpm test:coverage` | Con coverage                                         |
| `pnpm lint`          | ESLint sobre todo el repo                            |
| `pnpm typecheck`     | TS en todos los paquetes                             |
| `pnpm format`        | Prettier write                                       |
| `pnpm emulators`     | Levanta los emuladores de Firebase                   |

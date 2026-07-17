# Admin Platform

> Plataforma administrativa full-stack construida sobre Firebase (serverless) con arquitectura vendor-agnostic.

## Requisitos

- Node.js 20 LTS (usar `nvm install 20` si tenés nvm)
- pnpm 9+ (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`) — **requerido desde SDD-03**
- Java JRE 11+ (lo usan los emuladores de Firestore/Storage)

## Setup local

1. Clonar el repo
2. `pnpm install`
3. `cp .env.example .env.local` y completar las variables (alternativamente, los defaults del repo permiten arrancar contra emuladores sin configuración adicional)
4. `pnpm prepare` (instala hooks de Husky)
5. `pnpm typecheck` para verificar que todo compila
6. `pnpm test` para correr la suite

> **Nota sobre `pnpm dev`**: la landing pública (`/`) y el placeholder `/login` funcionan **sin emuladores**. Las rutas `/admin/**` requieren:
>
> - Emuladores levantados (`pnpm emulators` en otra terminal, ver sección siguiente)
> - Cookie `__session` válida (obtenible vía signup en `/login` o vía `pnpm seed:emulators`)
>
> Sin esto, `middleware.ts` y `app/admin/layout.tsx` redirigen a `/login?next=/admin`.
>
> Si usás `pnpm dev` (en lugar de `pnpm dev:web`), los emuladores se arrancan automáticamente en background; Ctrl+C detiene **ambos** (Next.js + emuladores) limpiamente vía trap en `scripts/dev.sh`.

## Firebase Emulators (SDD-03)

Desde SDD-03 toda la app se desarrolla contra emuladores locales (rápidos, gratis, sin tocar prod).

```bash
# Levanta los 4 emuladores (auth:9099, firestore:8080, functions:5001, storage:9199, UI:4000)
# Carga state desde ./emulator-data si existe y exporta al cerrar.
pnpm emulators

# Reset completo (borra ./emulator-data y arranca limpio)
pnpm emulators:reset

# Seed: 1 organización + 3 users (admin, recruiter, expert) en org_default
# Requiere emuladores levantados en otra terminal.
pnpm seed:emulators

# UI del emulador: http://localhost:4000
```

Si los emuladores fallan al boot:

- **Puerto ocupado**: matá el proceso (`lsof -ti:8080 | xargs kill`) o cambiá puertos en `firebase.json`.
- **Java faltante**: instalá JRE 11+ (`sudo apt install default-jre` en Ubuntu).
- **`firebase` no encontrado**: instalá CLI globalmente (`npm install -g firebase-tools`).

## Workflow AI-DLC

Este proyecto sigue AI-DLC. Cada SDD se cierra con un commit que sigue Conventional Commits (validado por `commitlint`). Hooks activos:

- `pre-commit`: `pnpm lint-staged` + `pnpm typecheck`
- `commit-msg`: `pnpm commitlint --edit`

Para detalles ver [.agents/AGENTS.md](.agents/AGENTS.md).

## Comandos principales

| Comando              | Qué hace                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`           | Levanta Next.js + emuladores (script `scripts/dev.sh`, cleanup en Ctrl+C) |
| `pnpm dev:web`       | Solo Next.js (asume emuladores ya corriendo)                              |
| `pnpm dev:emulators` | Solo emuladores (sin Next.js)                                             |
| `pnpm build`         | Build de todos los paquetes                                               |
| `pnpm test`          | Corre Vitest una vez                                                      |
| `pnpm test:watch`    | Modo watch                                                                |
| `pnpm test:coverage` | Con coverage                                                              |
| `pnpm lint`          | ESLint sobre todo el repo                                                 |
| `pnpm typecheck`     | TS en todos los paquetes                                                  |
| `pnpm format`        | Prettier write                                                            |
| `pnpm emulators`     | Levanta los emuladores de Firebase                                        |

# SDD-01: Monorepo & Tooling

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 1 (semana 1)
> **Depende de:** —
> **Bloquea a:** SDD-02, SDD-03, SDD-04, SDD-06, SDD-08

---

## 1. Contexto

Necesitamos un repositorio único, instalable y testeable desde un solo comando, que aloje tres paquetes (`apps/web`, `apps/functions`, `packages/shared`) con tooling consistente (TS estricto, ESLint, Prettier, Husky, Vitest). Este SDD es **prerequisito** para todos los demás: cualquier SDD posterior asume que esta base existe.

## 2. Goals y Non-Goals

### Goals

- Un solo `pnpm install` resuelve todas las dependencias.
- `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm emulators` funcionan desde root.
- TypeScript estricto en todos los paquetes, con config base compartida.
- Pre-commit hook corre lint + typecheck.
- Tests con Vitest corren rápido (< 5s en suite básica sin emuladores).
- `.env.example` documenta todas las variables necesarias.

### Non-Goals

- CI/CD (SDD-08).
- Despliegue real (SDD-08).
- Lógica de aplicación (SDD-02 en adelante).
- Configuración de Firebase concreta más allá de tener Firebase CLI disponible (eso es SDD-03).

## 3. Decisiones de arquitectura

| #   | Decisión                                                          | ADR                                                            |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | pnpm workspaces                                                   | [ADR-0001](../01-architecture/decisions/0001-monorepo-pnpm.md) |
| 2   | TS strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes | convención                                                     |
| 3   | ESLint flat config (ESLint 9+) con `@typescript-eslint`           | convención                                                     |
| 4   | Vitest en lugar de Jest (más rápido, ESM nativo, mismo API)       | decisión interna                                               |
| 5   | Husky v9 con `lint-staged` v15                                    | convención                                                     |
| 6   | `commitlint` con Conventional Commits                             | convención                                                     |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
/
├── .gitignore
├── .gitattributes
├── .nvmrc                          # node 20
├── .npmrc                          # pnpm config
├── .editorconfig
├── .env.example
├── README.md                       # setup paso a paso
├── package.json                    # root, solo scripts y devDeps compartidas
├── pnpm-workspace.yaml
├── tsconfig.base.json              # config estricto compartido
├── tsconfig.json                   # root, extends base, no incluye nada
├── eslint.config.mjs               # flat config root
├── .prettierrc.json
├── .prettierignore
├── vitest.config.ts                # config compartida
├── commitlint.config.cjs
├── lint-staged.config.js
├── .husky/
│   ├── pre-commit
│   └── commit-msg
│
├── apps/
│   ├── .gitkeep
│   ├── web/                        # creado en SDD-02
│   └── functions/                  # creado en SDD-06 (estructura vacía en este SDD)
│
└── packages/
    ├── .gitkeep
    └── shared/                     # creado en este SDD (estructura mínima)
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts            # placeholder
```

### 4.2 Contenido de archivos clave

#### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### `package.json` (root)

```jsonc
{
  "name": "admin-platform",
  "private": true,
  "version": "0.1.0",
  "engines": { "node": ">=20 <21", "pnpm": ">=9" },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "echo 'dev script por SDD-02/03' && exit 1",
    "build": "pnpm -r build",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "emulators": "echo 'emulators por SDD-03' && exit 1",
    "deploy:staging": "echo 'deploy por SDD-08' && exit 1",
    "deploy:prod": "echo 'deploy por SDD-08' && exit 1",
    "prepare": "husky",
  },
  "devDependencies": {
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "@typescript-eslint/parser": "^8.8.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^9.12.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0",
    "prettier": "^3.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
  },
}
```

> Los scripts de `dev`/`emulators`/`deploy` son placeholders. Cada SDD subsiguiente los sobrescribe.

#### `tsconfig.base.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
  },
}
```

> `lib` incluye `DOM` porque Next.js lo necesita. `packages/shared` debería sobreescribirlo a `["ES2022"]` solo.

#### `tsconfig.json` (root)

```jsonc
{
  "extends": "./tsconfig.base.json",
  "include": [],
  "exclude": ["node_modules", "dist", ".next"],
}
```

#### `eslint.config.mjs` (flat config, raíz)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Estas reglas solo se aplican a apps/web, verificado por archivo
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'firebase/firestore',
                'firebase/auth',
                'firebase/storage',
                'firebase-admin/*',
              ],
              message:
                'No importes Firebase directamente desde esta capa. Usá el repository correspondiente.',
            },
            {
              group: ['@/repositories/*/firebase', '@/repositories/*/firebase.ts'],
              message: 'No importes la impl Firebase directamente. Usá el índice del repository.',
            },
          ],
        },
      ],
    },
  },
  prettier, // debe ir último
);
```

#### `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

#### `.prettierignore`

```
node_modules
.next
dist
coverage
.firebase
```

#### `.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Next.js
.next/
out/

# Build
dist/
build/

# Testing
coverage/
*.lcov

# Env
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
*-debug.log

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Cache
.turbo/
.cache/
```

#### `.nvmrc`

```
20
```

#### `.npmrc`

```
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
engine-strict=true
```

#### `.env.example`

```bash
# === Firebase Client (NEXT_PUBLIC_*) ===
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# === App Config ===
NEXT_PUBLIC_APP_ENV=dev               # dev | staging | prod
NEXT_PUBLIC_API_BASE_URL=             # URL base de Cloud Functions

# === Server-side (NUNCA exponer al cliente) ===
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=           # \n escapado

# === Repository driver ===
# dev/test: memory | staging/prod: firebase
REPOSITORY_DRIVER=memory

# === CORS ===
ALLOWED_ORIGINS=http://localhost:3000

# === Secrets (Firebase Secret Manager en staging/prod) ===
RESEND_API_KEY=                      # ejemplo
```

#### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        // Aplicables a SDD-04+
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
      exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/*.config.{ts,js,mjs}'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/web'),
      '@shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
});
```

> Los aliases `@` y `@shared` se configuran en cada paquete también (tsconfig paths) y en Vitest.

#### `.husky/pre-commit`

```sh
pnpm lint-staged
pnpm typecheck
```

#### `.husky/commit-msg`

```sh
pnpm commitlint --edit "$1"
```

#### `commitlint.config.cjs`

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'perf', 'ci', 'build', 'style'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'web',
        'functions',
        'shared',
        'auth',
        'users',
        'orgs',
        'audit',
        'reports',
        'tooling',
        'ci',
        'docs',
        'deps',
      ],
    ],
  },
};
```

> `scope-enum` es warn (1), no error (2), porque scopes nuevos pueden aparecer.

#### `lint-staged.config.js`

```js
export default {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
```

#### `README.md` (root) — sección "Setup"

```markdown
## Requisitos

- Node.js 20 LTS (usar `nvm install 20` si tenés nvm)
- pnpm 9+ (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`)

## Setup local

1. Clonar el repo
2. `pnpm install`
3. `cp .env.example .env.local` y completar las variables
4. `pnpm prepare` (instala hooks de Husky)
5. `pnpm typecheck` para verificar que todo compila
6. `pnpm test` para correr la suite

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
```

#### `packages/shared/package.json` (placeholder)

```jsonc
{
  "name": "@platform/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.6.0" },
}
```

#### `packages/shared/tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"], // no DOM
    "composite": true,
  },
  "include": ["src/**/*"],
}
```

#### `packages/shared/src/index.ts`

```ts
// placeholder. Contenido real en SDD-04+.
export const SHARED_PACKAGE_VERSION = '0.1.0';
```

### 4.3 Comportamiento esperado

1. `pnpm install` en root:
   - Crea `node_modules` en root.
   - Crea `node_modules` en cada paquete del workspace.
   - Ejecuta `prepare` que activa Husky.
2. `pnpm typecheck`:
   - Recorre todos los paquetes y corre `tsc --noEmit`.
   - Falla con exit code != 0 si hay cualquier error.
3. `pnpm lint`:
   - Corre ESLint en todo el repo.
   - Falla con `--max-warnings 0`.
4. `pnpm test`:
   - Corre Vitest en modo `run` (no watch).
   - Genera reporte en consola.
5. `pnpm test:coverage`:
   - Genera reporte `coverage/` + texto en consola.
   - Falla si coverage < thresholds.
6. `git commit`:
   - Pre-commit corre lint + format en archivos modificados + typecheck global.
   - Commit-msg valida conventional commit.

### 4.4 Errores y excepciones

| Situación                       | Comportamiento                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` sin `node >= 20` | Falla con mensaje claro gracias a `engine-strict=true`.                                                             |
| Falta `.env.local`              | `pnpm typecheck` puede fallar si algún paquete lee env al import-time. Por eso `env.ts` se valida con Zod (SDD-02). |
| Test con `import` de Firebase   | Falla ESLint si está fuera de `/repositories/*/firebase.ts` o `/lib/firebase/*`.                                    |
| Hook de Husky no se ejecuta     | `pnpm prepare` lo re-instala.                                                                                       |

### 4.5 Ejemplo de uso

```bash
# Setup
git clone <repo>
cd admin-platform
nvm use
pnpm install
cp .env.example .env.local
pnpm prepare

# Verificar que todo compila
pnpm typecheck
pnpm test

# Crear branch y PR
git checkout -b feat/users-bulk-invite
# ... cambios ...
git add .
git commit -m "feat(users): add bulk invite endpoint"
git push -u origin feat/users-bulk-invite
```

## 5. Criterios de aceptación

- [ ] `pnpm install` termina sin errores en una máquina limpia.
- [ ] `pnpm typecheck` pasa con `tsconfig.base.json` estricto.
- [ ] `pnpm lint` pasa con `--max-warnings 0`.
- [ ] `pnpm test` corre y termina con exit 0 (puede haber 0 tests al inicio).
- [ ] `pnpm test:coverage` genera carpeta `coverage/`.
- [ ] `git commit -m "feat(users): test"` pasa pre-commit + commit-msg.
- [ ] `git commit -m "mensaje random"` falla commit-msg.
- [ ] `pnpm format` formatea un archivo intencionalmente mal formateado.
- [ ] ESLint rechaza un `import { getFirestore } from 'firebase/firestore'` en `apps/web/app/page.tsx` (verificable manualmente una vez creado el archivo en SDD-02).
- [ ] `.env.example` lista todas las variables que aparecen en el código (grep test).
- [ ] `README.md` tiene sección "Setup local" con los pasos exactos.

## 6. Plan de testing

En este SDD no hay lógica de aplicación que testear. Tests concretos empiezan en SDD-04. **Para este SDD**, el testing es **smoke test**:

- `pnpm typecheck` exit 0.
- `pnpm lint` exit 0.
- `pnpm test` exit 0 (sin tests, pero el runner corre).
- Hooks de Husky se ejecutan en un commit de prueba.

## 7. Riesgos y mitigaciones

| Riesgo                                               | Probabilidad | Impacto | Mitigación                                                                            |
| ---------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------- |
| Versión de Node inconsistente entre devs             | M            | M       | `.nvmrc` + `engines` en `package.json` + `engine-strict`.                             |
| pnpm no se instala por permisos globales             | M            | B       | Documentar instalación con `npm i -g` y alternativa con `corepack enable`.            |
| Husky no se activa en Windows                        | B            | M       | Documentar workaround `git config core.hooksPath .husky/_/` (solo si aparece el bug). |
| Commitlint muy estricto al inicio                    | M            | B       | `scope-enum` como warn (no error) hasta que el equipo se acostumbre.                  |
| ESLint flat config incompatible con alguna extensión | B            | M       | Pinning de versiones en `devDependencies`; documentar en README.                      |

## 8. Out of scope (para futuro)

- Husky `pre-push` con `pnpm test:coverage` (se agrega en SDD-08 cuando CI está afinado).
- Renovate / Dependabot config (SDD-08).
- Storybook / Chromatic.
- Internacionalización del README.

## 9. Open Questions

- [ ] ¿Usamos `commitlint` scope `users` o `user` (singular)? Decidir antes del primer PR real.
- [ ] ¿Publicamos `@platform/shared` a un registry privado o solo interno? Decisión: **interno (workspace)**, no se publica.

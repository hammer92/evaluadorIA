# Coding Conventions

> **Estado:** Approved (pending)
> **Aplicable a:** todos los paquetes del monorepo
> **Fuente de verdad:** este documento + ESLint config

---

## 1. TypeScript

### 1.1 Configuración estricta obligatoria

`tsconfig.json` (root y cada paquete) debe tener **como mínimo**:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
  },
}
```

### 1.2 Reglas sobre `any`

- **Prohibido** usar `any` salvo en boundaries externos justificados (SDK de Firebase en wrappers específicos, parsing de respuestas externas).
- Cuando se use, debe llevar comentario `// eslint-disable-next-line` con motivo de una línea.
- **Prohibido** `as any` salvo el mismo caso.
- **Prohibido** `@ts-ignore`. Se permite `@ts-expect-error` solo cuando se está esperando un bug de TS justificado, con comentario explicando cuándo se puede remover.
- Preferir `unknown` + narrowing con Zod en boundaries.

### 1.3 Tipos vs interfaces

- `type` para uniones, intersecciones, mapped types y function signatures.
- `interface` para objetos extensibles (ej. contratos de repository).
- `interface` cuando se usa `implements` en clases.

### 1.4 Exports

- **Nunca** `export default`. Siempre named exports (mejor refactoring y tree-shaking).
- Evitar barrel files (`index.ts` que re-exporta todo) salvo en puntos de entrada oficiales.

### 1.5 Naming

| Elemento                   | Convención                                                     | Ejemplo                             |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| Variables, funciones       | camelCase                                                      | `getUserById`                       |
| Types, interfaces, classes | PascalCase                                                     | `UserRepository`, `CreateUserInput` |
| Constantes globales        | UPPER_SNAKE_CASE                                               | `MAX_RETRIES`                       |
| Archivos                   | kebab-case                                                     | `user-repository.ts`                |
| Directorios                | kebab-case                                                     | `audit-logs/`                       |
| React components           | PascalCase                                                     | `UserTable.tsx`                     |
| Hooks                      | camelCase con `use`                                            | `useAuth.ts`                        |
| Booleanos                  | prefijo `is/has/should/can`                                    | `isAdmin`, `hasAccess`              |
| Funciones async            | sufijo opcional pero recomendado `Async` o prefijo `fetch/get` | `fetchUser`                         |

---

## 2. ESLint

### 2.1 Reglas activas (no negociables)

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unsafe-*: error`
- `@typescript-eslint/consistent-type-imports: error`
- `@typescript-eslint/no-floating-promises: error`
- `import/order: error` (orden alfabético, groups: builtin, external, internal, parent, sibling)
- `no-console: warn` (permitido solo con `// eslint-disable-next-line` y motivo en scripts de dev)
- `@next/next/no-img-element: warn` (usar `next/image` en su lugar)
- `react-hooks/exhaustive-deps: error`

### 2.2 Imports prohibidos por capa

Aplicado vía `no-restricted-imports` con `patterns`:

```js
// En apps/web, módulos fuera de /repositories y /lib/firebase:
{
  patterns: [
    {
      group: ['firebase/firestore', 'firebase/auth', 'firebase/storage', 'firebase-admin/*'],
      message:
        'Esta capa no puede importar Firebase directamente. Usá el repository correspondiente.',
    },
  ];
}
```

```js
// En cualquier archivo de UI:
{
  patterns: [
    {
      group: ['@/repositories/*/firebase'],
      message: 'No importes la impl Firebase directamente. Usá la interfaz del repository.',
    },
  ];
}
```

> ESLint fallará en CI si alguna de estas reglas se rompe.

---

## 3. Prettier

Config única en root:

```jsonc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
}
```

`pnpm format` para formatear todo. Hook pre-commit lo aplica solo a archivos modificados.

---

## 4. Husky + lint-staged

### 4.1 Pre-commit (`.husky/pre-commit`)

```sh
pnpm lint-staged
pnpm typecheck
```

### 4.2 Commit message (`.husky/commit-msg`)

Conventional Commits enforced via `@commitlint/cli`:

```
feat(users): add bulk invite endpoint
fix(auth): handle token refresh on 401
chore(deps): bump zod to 3.23
docs(sdd-04): clarify memory impl lifecycle
```

Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `style`.

### 4.3 lint-staged (`lint-staged.config.js`)

```js
export default {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
```

---

## 5. Estructura de imports (orden)

```ts
// 1. Node built-ins
import { readFileSync } from 'node:fs';

// 2. External packages (alfabético)
import { z } from 'zod';
import type { User } from '@shared/types';

// 3. Internal packages (con alias)
import { Button } from '@/components/ui/button';
import { env } from '@/config/env';

// 4. Parent imports
import { useAuth } from '../hooks/use-auth';

// 5. Sibling imports
import { UserTable } from './user-table';

// 6. Types (siempre con `import type`)
import type { UserRepository } from '@/repositories/users';
```

`@/` resuelve a `apps/web/`. `@shared/` resuelve a `packages/shared/src/`. `@functions/` no es importable desde `@web/` ni viceversa (revisado en CI).

---

## 6. Manejo de errores

### 6.1 Tipos de error

Todos en `packages/shared/src/errors/`:

```ts
export class RepositoryError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'ALREADY_EXISTS'
      | 'PERMISSION_DENIED'
      | 'INTERNAL'
      | 'VALIDATION',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
```

### 6.2 Reglas

- **Nunca** `throw new Error('mensaje genérico')` en código de aplicación. Usar el tipo apropiado.
- En services: capturar errores de repository y transformar a error de dominio si aplica.
- En UI: usar `sonner` (o lo que se decida en Fase 7) para feedback al usuario. NUNCA `alert()` ni `console.error` directo en componentes.
- Catch siempre con tipo: `catch (err: unknown) { ... }` + narrowing.

### 6.3 Logging

- Server-side: `pino` con level configurable por env.
- Client-side: solo `console.warn`/`console.error` con prefijo `[scope]`.
- **Nunca** loguear tokens, passwords, PII o secrets.

---

## 7. Comentarios y JSDoc

### 7.1 Cuándo comentar

- **Sí**: decisiones no obvias, warnings sobre SDK tricky, links a issues.
- **No**: lo que el código ya dice.

### 7.2 JSDoc obligatorio

- Toda función pública exportada.
- Toda interfaz pública.
- Todo tipo público.

Plantilla:

````ts
/**
 * Crea un usuario y dispara el envío del email de bienvenida.
 *
 * @param input - Datos validados del usuario (ver {@link CreateUserInput})
 * @param ctx - Contexto con auth y trazabilidad
 * @returns El usuario creado
 * @throws {RepositoryError} Si el email ya existe o no hay permisos
 *
 * @example
 * ```ts
 * const user = await createUser({ email: 'a@b.c', name: 'Ana' }, ctx);
 * ```
 */
export async function createUser(input: CreateUserInput, ctx: Ctx): Promise<User> { ... }
````

---

## 8. Testing

### 8.1 Cobertura mínima

- Repositories: **80%** (son críticos y baratos de testear).
- Services: **75%**.
- UI components: **60%** (puede ser menor para componentes puramente presentacionales).
- Cloud Functions: **75%**.

Coverage reportado en CI. PR que baja el coverage global **se rechaza**.

### 8.2 Estructura de un test

```ts
// user-repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryUserRepository } from './memory';

describe('MemoryUserRepository', () => {
  let repo: MemoryUserRepository;

  beforeEach(() => {
    repo = new MemoryUserRepository();
  });

  describe('create', () => {
    it('persiste el usuario con id generado', async () => { ... });
    it('falla con VALIDATION si el email es inválido', async () => { ... });
    it('falla con ALREADY_EXISTS si el email existe', async () => { ... });
  });
});
```

### 8.3 Mocks

- **Nunca** mockear `firebase/*` directamente. Usar `Memory*Repository`.
- Para tests de integración con Firebase, usar emulators (`@firebase/rules-unit-testing`).

---

## 9. Git y branches

- Branch principal: `main` (protegida).
- Convención de branches: `<tipo>/<scope>-<short-desc>`.
  - `feat/users-bulk-invite`
  - `fix/auth-token-refresh`
  - `chore/deps-bump-zod`
  - `docs/sdd-04-revision`
- PRs requieren al menos 1 reviewer distinto al autor.
- Squash merge a `main`. El mensaje del squash es el conventional commit final.

---

## 10. Dependencias

- Toda dep nueva debe justificarse en el PR (qué resuelve, por qué no se resuelve con lo que ya hay).
- `pnpm` resuelve `*` con lockfile estricto (`pnpm install --frozen-lockfile` en CI).
- Auditoría semanal: `pnpm audit --prod`. Vulnerabilidades altas se arreglan en < 7 días.
- No instalar paquetes con dependencies que toquen filesystem del cliente (ej. `fs-extra`, `glob` browser-side).

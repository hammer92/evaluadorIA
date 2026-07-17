# ADR 0002 — Repository pattern con interfaz + impl Firebase + impl Memory

> **Estado:** Proposed
> **Fecha:** 2026-06-24
> **Decisión:** toda entidad de dominio expone una **interfaz** consumida por services, con dos implementaciones intercambiables: `firebase.ts` y `memory.ts`.

---

## Contexto

El objetivo explícito del brief es:

> Arquitectura abstraída para poder migrar a AWS, GCP Cloud Run, Vercel o cualquier otro proveedor sin reescribir lógica de negocio.

Si el código de la app importa `firebase/firestore` directamente desde componentes, hooks o services, esa migración se vuelve un refactor de semanas. Hay que aislar el vendor **estrictamente**.

Además, los tests unitarios de services se vuelven lentos y flaky si dependen de emuladores o mocks de SDK. Necesitamos poder instanciar un repository en memoria que sea trivial de testear.

## Opciones consideradas

### Opción A — Acceso directo a Firebase desde services

- ❌ Acopla el dominio al vendor.
- ❌ Migración futura = refactor masivo.
- ❌ Tests requieren emuladores.

### Opción B — Una sola impl + mock manual en tests

- ⚠️ Funciona pero los mocks se desincronizan con la impl real constantemente.
- ❌ El mock se vuelve "fake hasta que alguien se da cuenta de que falta un caso".

### Opción C — Repository pattern con interfaz + 2 impls + factory ✅

- ✅ El **service** solo conoce la interfaz. Le inyectás la impl.
- ✅ `memory.ts` se usa en tests. Como implementa la misma interfaz, cualquier cambio en la interfaz rompe el build en ambos lugares.
- ✅ Migrar a otro vendor = escribir `aws.ts` o `rest.ts`. El resto del código no se entera.
- ✅ El service es testeable sin emuladores.

## Decisión

Cada entidad de dominio expone **una interfaz** en:

```
apps/web/repositories/<entidad>/index.ts
```

Y dos implementaciones:

```
apps/web/repositories/<entidad>/firebase.ts   # producción
apps/web/repositories/<entidad>/memory.ts     # tests
```

La **selección de la impl** se hace en una sola función factory:

```
apps/web/repositories/index.ts
  → getUserRepository(): UserRepository
```

El factory decide según `env.repositoryDriver` (en `dev`/`test` usa `memory`, en `staging`/`prod` usa `firebase`).

### Forma de la interfaz

```ts
export interface UserRepository {
  list(input: ListUsersInput): Promise<ListUsersResult>;
  getById(uid: string): Promise<User | null>;
  create(input: CreateUserInput, ctx: Ctx): Promise<User>;
  update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User>;
  delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }>;
}
```

### Forma de los errores

Toda operación retorna `Promise<T>` o `throw new RepositoryError(...)`. Nunca retorna `null` cuando el problema es de validación o permisos (eso es error, no "no encontrado"). El "no encontrado" sí es `null` en `getById`.

### Forma del factory

```ts
// apps/web/repositories/index.ts
let _users: UserRepository | undefined;

export function getUserRepository(): UserRepository {
  if (_users) return _users;
  const driver = env.REPOSITORY_DRIVER;
  _users = driver === 'firebase' ? new FirebaseUserRepository() : new MemoryUserRepository();
  return _users;
}
```

(Memoización opcional para tests — en prod se instancia una vez.)

### Constraint enforcement

ESLint rule `no-restricted-imports` en `apps/web`:

- Bloquea `import ... from 'firebase/firestore'` en archivos fuera de `/repositories/*/firebase.ts` y `/lib/firebase/*`.
- Bloquea `import ... from '@/repositories/*/firebase'` desde `/components`, `/features`, `/app`, `/services`.

> Si alguien intenta saltarse el patrón, el linter falla en CI.

## Consecuencias

**Positivas**:

- Migración de vendor = tocar solo `/repositories` y `/lib`.
- Tests de services sin emuladores (rápidos, determinísticos).
- Onboarding: para entender cómo se accede a los datos, mirás solo 2 archivos por entidad.

**Negativas**:

- Más boilerplate por entidad (interfaz + 2 impls).
- Riesgo de drift entre `firebase.ts` y `memory.ts` si no se testea el contrato.

**Mitigaciones**:

- Tests "contractuales" en `apps/web/repositories/<entidad>/contract.test.ts` que corren las mismas aserciones contra ambas impls.
- ESLint enforcement del patrón.
- Code review checklist incluye "¿este archivo toca Firebase y NO está en /repositories/_/firebase.ts o /lib/firebase/_?"

## Anti-patterns explícitos (a evitar)

❌ `const db = getFirestore(); db.collection(...)` en un componente o service.
❌ Importar `firebase/firestore` desde un hook.
❌ Mockear `firebase/firestore` directamente en tests (en su lugar, usar `MemoryUserRepository`).
❌ Crear una entidad sin su `memory.ts` "porque para tests ya está el mock".

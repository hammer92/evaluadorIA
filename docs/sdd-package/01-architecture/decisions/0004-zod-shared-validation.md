# ADR 0004 — Validación con Zod compartido cliente/servidor

> **Estado:** Proposed
> **Fecha:** 2026-06-24
> **Decisión:** usar Zod para validar TODA entrada/salida en boundaries, con los schemas viviendo en `packages/shared` y siendo el único punto de verdad.

---

## Contexto

En cualquier app full-stack, el bug más común y más caro es la **asimetría de validación**:

> El front valida X. El back valida Y. El atacante manda X y rompe algo.

La solución estándar es: **el mismo schema se ejecuta en ambos lados**.

Además, queremos que los tipos TypeScript de las entidades se **infran** del schema, no se declaren a mano. Esto elimina la posibilidad de que `interface User` y `zod schema de User` se desincronicen.

## Opciones consideradas

### A — Tipos TypeScript + validación manual

- ❌ El tipo no se ejecuta en runtime. Nada impide que el cliente mande algo que no matchea.
- ❌ Doble mantenimiento (tipo + validador).

### B — Tipos generados desde OpenAPI / protobuf

- ✅ Single source of truth.
- ❌ Mucho tooling, build steps, code-gen.
- ❌ Para una app de este tamaño es overkill.

### C — Zod en `packages/shared`, tipos inferidos ✅

- ✅ Un solo archivo define: validación runtime + tipo TS.
- ✅ El mismo schema se usa en:
  - React Hook Form (vía `@hookform/resolvers/zod`) en el front.
  - Validación de payloads en Cloud Functions.
  - Validación de respuestas externas (Firestore raw docs).
- ✅ Ecosistema enorme (`zod`, `@hookform/resolvers/zod`, `zod-to-openapi` si después queremos docs).
- ✅ Mensajes de error estructurados y traducibles.

## Decisión

`packages/shared/src/schemas/` contiene **todos** los schemas del dominio:

```
packages/shared/src/
  schemas/
    users.ts
    organizations.ts
    audit-logs.ts
    common.ts          # primitives reusables
  types/
    index.ts           # re-export de tipos inferidos
  errors/
    index.ts
```

### Reglas de uso

1. **Toda función que recibe `unknown` desde un boundary externo valida con Zod antes de usar**.
   - Server: `validateInput(schema, data)` en cada Cloud Function.
   - Client: parser de respuestas de Cloud Functions y de Firestore raw docs.

2. **Los tipos de dominio se exportan solo vía `z.infer`**. Nunca `interface User { ... }` declarado a mano.

3. **Mensajes de error en español** por defecto (la app es para un cliente hispanohablante). Si en el futuro hay multi-idioma, se externalizan.

4. **Schemas componibles**: usar `.pick`, `.omit`, `.extend`, `.partial`, `.merge` para variantes (input vs update vs output).

### Ejemplo de patrón

```ts
// packages/shared/src/schemas/users.ts

export const userRoleSchema = z.enum(['admin', 'recruiter', 'expert']);
export const userStatusSchema = z.enum(['active', 'invited', 'suspended']);

export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(120).nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  organizationId: z.string().nullable(),
  createdAt: z.coerce.date(), // coerce para Firestore Timestamp
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});

export const createUserInputSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120).optional(),
  role: userRoleSchema.default('expert'),
  organizationId: z.string().optional(),
  sendInviteEmail: z.boolean().default(true),
});

export const updateUserInputSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1).max(120).nullable().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
```

```ts
// apps/functions/src/v1/users/create-user.ts
import { createUserInputSchema } from '@shared/schemas/users';

export const createUser = onCall(async (req) => {
  const ctx = await onCallAuth('admin');
  const input = validateInput(createUserInputSchema, req.data); // ← acá
  // ...lógica
});
```

```tsx
// apps/web/features/users/components/create-user-modal.tsx
import { createUserInputSchema } from '@shared/schemas/users';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(createUserInputSchema), // ← el mismo schema
  defaultValues: { role: 'expert', sendInviteEmail: true },
});
```

## Consecuencias

**Positivas**:

- Imposible que el front y el back divergan en validación.
- Cambio de schema = cambio en un archivo + autocomplete en todos los callsites.
- Errores estructurados (`ZodIssue[]`) se pueden devolver al cliente para UX rica (mostrar qué campo falló).
- Tests de validación son triviales: `expect(schema.parse(good)).toEqual(...); expect(() => schema.parse(bad)).toThrow();`.

**Negativas**:

- Bundle size: Zod pesa ~50KB minified. Es aceptable.
- Performance: parsing repetido en hot paths. Mitigable cacheando validadores o usando `zod/v4-mini` si en el futuro hace falta.

**Mitigaciones**:

- No re-parsear el mismo input dos veces en el mismo request.
- Schemas pesados (los que validan documentos grandes) se definen una sola vez a nivel de módulo.

## Anti-patterns (a evitar)

❌ Declarar `interface User { ... }` y aparte un `zod schema`. Usar SIEMPRE `z.infer`.
❌ Validar en el cliente y NO validar en el server (o viceversa).
❌ Usar Zod para lógica de negocio compleja (Zod es para shape, no para reglas condicionales). Para reglas, usar services.
❌ `as` castings sobre datos que vienen de la red. Validar primero.

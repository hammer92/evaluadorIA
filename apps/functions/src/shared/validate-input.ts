import { HttpsError } from 'firebase-functions/v2/https';
import type { ZodTypeAny } from 'zod';
import type { z } from 'zod';

/**
 * Wrapper que valida input con Zod y traduce errores a HttpsError.
 * Retorna z.output<TSchema> — los defaults están aplicados, así que
 * `input.page` es `number` (no `number | undefined`) y el handler no
 * necesita ramificar para campos con `.default(N)`.
 */
export function validateInput<TSchema extends ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpsError('invalid-argument', 'Input validation failed', {
      issues: result.error.issues.map((i) => ({
        path: i.path,
        message: i.message,
      })),
    });
  }
  return result.data as z.output<TSchema>;
}

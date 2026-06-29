import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { validateInput } from '../validate-input.js';

describe('validateInput', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(0),
  });

  it('retorna data parseada si pasa', () => {
    const result = validateInput(schema, { name: 'Ana', age: 30 });
    expect(result).toEqual({ name: 'Ana', age: 30 });
  });

  it('lanza HttpsError invalid-argument si falla', () => {
    try {
      validateInput(schema, { name: 'A', age: -1 });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpsError);
      const err = e as HttpsError;
      expect(err.code).toBe('invalid-argument');
      const details = err.details as { issues: { path: (string | number)[]; message: string }[] };
      expect(details.issues.length).toBeGreaterThan(0);
    }
  });
});

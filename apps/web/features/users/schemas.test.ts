import { describe, expect, it } from 'vitest';

import { defaultFilters, userFiltersSchema } from './schemas';

describe('userFiltersSchema', () => {
  it('aplica defaults cuando el input es vacío', () => {
    const result = userFiltersSchema.parse({});
    expect(result).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('acepta filtros explícitos válidos', () => {
    const result = userFiltersSchema.parse({
      status: 'active',
      role: 'admin',
      search: 'foo',
      page: 2,
      pageSize: 50,
    });
    expect(result).toEqual({
      status: 'active',
      role: 'admin',
      search: 'foo',
      page: 2,
      pageSize: 50,
    });
  });

  it('acepta status="all" y role="all" como sentinel', () => {
    const result = userFiltersSchema.parse({
      status: 'all',
      role: 'all',
      page: 1,
      pageSize: 20,
    });
    expect(result.status).toBe('all');
    expect(result.role).toBe('all');
  });

  it('rechaza status fuera del enum', () => {
    const result = userFiltersSchema.safeParse({
      status: 'banned',
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza role fuera del enum', () => {
    const result = userFiltersSchema.safeParse({
      role: 'superuser',
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza search de más de 100 chars', () => {
    const result = userFiltersSchema.safeParse({
      search: 'x'.repeat(101),
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('acepta search de exactamente 100 chars', () => {
    const result = userFiltersSchema.safeParse({
      search: 'x'.repeat(100),
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza page < 1', () => {
    const result = userFiltersSchema.safeParse({ page: 0, pageSize: 20 });
    expect(result.success).toBe(false);
  });

  it('rechaza pageSize > 100', () => {
    const result = userFiltersSchema.safeParse({ page: 1, pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it('rechaza pageSize < 1', () => {
    const result = userFiltersSchema.safeParse({ page: 1, pageSize: 0 });
    expect(result.success).toBe(false);
  });

  it('rechaza page no entero', () => {
    const result = userFiltersSchema.safeParse({ page: 1.5, pageSize: 20 });
    expect(result.success).toBe(false);
  });

  it('acepta status omitido (undefined)', () => {
    const result = userFiltersSchema.safeParse({ page: 1, pageSize: 20 });
    expect(result.success).toBe(true);
  });

  it('acepta search vacío como string (default no aplica porque es opcional)', () => {
    const result = userFiltersSchema.parse({ page: 1, pageSize: 20 });
    expect(result.search).toBeUndefined();
  });
});

describe('defaultFilters', () => {
  it('tiene los defaults esperadas', () => {
    expect(defaultFilters).toEqual({
      status: 'all',
      role: 'all',
      search: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('pasa la validación de userFiltersSchema', () => {
    const result = userFiltersSchema.safeParse(defaultFilters);
    expect(result.success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('combina clases condicionales', () => {
    const hidden = false;
    expect(cn('foo', hidden && 'bar', 'baz')).toBe('foo baz');
  });

  it('resuelve conflictos de Tailwind', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('retorna string vacío sin argumentos', () => {
    expect(cn()).toBe('');
  });
});

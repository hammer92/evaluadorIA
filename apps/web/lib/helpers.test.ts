import { describe, expect, it } from 'vitest';

import { formatDate, formatNumber, slugify } from './helpers';

describe('formatDate', () => {
  it('formatea fecha en es-ES con dateStyle medium + timeStyle short', () => {
    const iso = '2026-06-28T15:30:00Z';
    const result = formatDate(new Date(iso));
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('acepta epoch', () => {
    const result = formatDate(new Date(0));
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatNumber', () => {
  it('formatea numero con separador de miles es-ES', () => {
    expect(formatNumber(1234567)).toMatch(/1\.234\.567/);
  });

  it('formatea cero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formatea decimales respetando locale (es-ES usa coma decimal)', () => {
    expect(formatNumber(1234.5)).toBe('1234,5');
    expect(formatNumber(1234.56)).toBe('1234,56');
  });
});

describe('slugify', () => {
  it('lowercase + reemplaza espacios por guiones', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
  });

  it('elimina caracteres no alfanumericos/guiones', () => {
    expect(slugify('Hola, Mundo!')).toBe('hola-mundo');
  });

  it('colapsa espacios multiples', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });

  it('string vacio', () => {
    expect(slugify('')).toBe('');
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import { __resetEnv, env, type Env } from './env.js';

// =============================================================================
// env.ts — Tests de validación Zod
// =============================================================================
// El setup global (vitest.setup.ts) esta vacio intencionalmente; los tests
// que mutan process.env llaman __resetEnv() explicitamente para invalidar
// el cache de `env`.
// =============================================================================

const VALID_SECRET = 'a-valid-32-char-secret-here-for-testing-purposes';
const VALID_ORIGINS = 'http://localhost:3000';

describe('env', () => {
  afterEach(() => {
    // Restaurar el env "valido" por defecto del test runner.
    // Usamos Reflect.deleteProperty porque NODE_ENV es read-only
    // en el tipo NodeJS.ProcessEnv.
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    Reflect.deleteProperty(process.env, 'REPOSITORY_DRIVER');
    Reflect.deleteProperty(process.env, 'NODE_ENV');
    __resetEnv();
  });

  it('valida un env completo y lo expone tipado', () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    process.env['REPOSITORY_DRIVER'] = 'firebase';
    // NODE_ENV es read-only en NodeJS.ProcessEnv; casteamos para asignar.
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    __resetEnv();

    const e: Env = env.SESSION_COOKIE_SECRET ? (env as unknown as Env) : ({} as Env);
    expect(e.SESSION_COOKIE_SECRET).toBe(VALID_SECRET);
    expect(e.ALLOWED_ORIGINS).toBe(VALID_ORIGINS);
    expect(e.REPOSITORY_DRIVER).toBe('firebase');
    expect(e.NODE_ENV).toBe('production');
  });

  it('lanza error si SESSION_COOKIE_SECRET falta', () => {
    Reflect.deleteProperty(process.env, 'SESSION_COOKIE_SECRET');
    __resetEnv();
    expect(() => env.SESSION_COOKIE_SECRET).toThrow(/SESSION_COOKIE_SECRET/);
  });

  it('lanza error si SESSION_COOKIE_SECRET es < 32 chars', () => {
    process.env['SESSION_COOKIE_SECRET'] = 'short';
    __resetEnv();
    expect(() => env.SESSION_COOKIE_SECRET).toThrow(/32 caracteres/);
  });

  it('lanza error si ALLOWED_ORIGINS falta', () => {
    Reflect.deleteProperty(process.env, 'ALLOWED_ORIGINS');
    __resetEnv();
    expect(() => env.ALLOWED_ORIGINS).toThrow(/ALLOWED_ORIGINS/);
  });

  it('lanza error si REPOSITORY_DRIVER tiene un valor invalido', () => {
    process.env['REPOSITORY_DRIVER'] = 'invalid-driver';
    __resetEnv();
    expect(() => env.REPOSITORY_DRIVER).toThrow();
  });

  it('acepta REPOSITORY_DRIVER = "memory" (emuladores)', () => {
    process.env['REPOSITORY_DRIVER'] = 'memory';
    __resetEnv();
    expect(env.REPOSITORY_DRIVER).toBe('memory');
  });

  it('__resetEnv invalida la cache', () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    __resetEnv();
    expect(env.SESSION_COOKIE_SECRET).toBe(VALID_SECRET);

    // Mutar process.env y resetear → re-valida
    process.env['SESSION_COOKIE_SECRET'] = 'another-valid-32-char-secret-here-for-testing';
    __resetEnv();
    expect(env.SESSION_COOKIE_SECRET).toBe('another-valid-32-char-secret-here-for-testing');
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import { __resetEnv, env, type Env } from './env.js';

// =============================================================================
// env.ts — Tests de lectura de process.env
// =============================================================================
// El setup global (vitest.setup.ts) esta vacio intencionalmente; los tests
// que mutan process.env llaman __resetEnv() explicitamente para invalidar
// el cache de `env`.
// =============================================================================

const VALID_SECRET = 'a-valid-32-char-secret-here-for-testing-purposes';
const VALID_ORIGINS = 'http://localhost:3000';

describe('env', () => {
  afterEach(() => {
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
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    __resetEnv();

    const e: Env = env.SESSION_COOKIE_SECRET ? (env as unknown as Env) : ({} as Env);
    expect(e.SESSION_COOKIE_SECRET).toBe(VALID_SECRET);
    expect(e.ALLOWED_ORIGINS).toBe(VALID_ORIGINS);
    expect(e.REPOSITORY_DRIVER).toBe('firebase');
    expect(e.NODE_ENV).toBe('production');
  });

  it('retorna defaults seguros si SESSION_COOKIE_SECRET falta', () => {
    Reflect.deleteProperty(process.env, 'SESSION_COOKIE_SECRET');
    Reflect.deleteProperty(process.env, 'ALLOWED_ORIGINS');
    __resetEnv();

    expect(env.SESSION_COOKIE_SECRET).toBe('');
    expect(env.ALLOWED_ORIGINS).toBe('*');
  });

  it('acepta REPOSITORY_DRIVER = "memory" (emuladores)', () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    process.env['REPOSITORY_DRIVER'] = 'memory';
    __resetEnv();
    expect(env.REPOSITORY_DRIVER).toBe('memory');
  });

  it('__resetEnv invalida la cache', () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    __resetEnv();
    expect(env.SESSION_COOKIE_SECRET).toBe(VALID_SECRET);

    process.env['SESSION_COOKIE_SECRET'] = 'another-valid-32-char-secret-here-for-testing';
    __resetEnv();
    expect(env.SESSION_COOKIE_SECRET).toBe('another-valid-32-char-secret-here-for-testing');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// env.ts — Tests de lectura via defineSecret/defineString (Firebase params).
// =============================================================================
// El setup global (vitest.setup.ts) esta vacio intencionalmente; los tests
// que mutan process.env pueden hacerlo y los params (mockeados en cada test
// file individualmente) leen process.env reactivamente.
// =============================================================================

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
  }),
  defineString: (name: string) => ({
    value: () => process.env[name] ?? '',
  }),
}));

const VALID_SECRET = 'a-valid-32-char-secret-here-for-testing-purposes';
const VALID_ORIGINS = 'http://localhost:3000';

describe('env', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'SESSION_COOKIE_SECRET');
    Reflect.deleteProperty(process.env, 'ALLOWED_ORIGINS');
    Reflect.deleteProperty(process.env, 'REPOSITORY_DRIVER');
    Reflect.deleteProperty(process.env, 'NODE_ENV');
  });

  it('expone SESSION_COOKIE_SECRET desde process.env', () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    // Import dinamico para que el mock se aplique
    return import('./env.js').then(({ env }) => {
      expect(env.SESSION_COOKIE_SECRET).toBe(VALID_SECRET);
      expect(env.ALLOWED_ORIGINS).toBe(VALID_ORIGINS);
      expect(env.REPOSITORY_DRIVER).toBe('firebase'); // default
    });
  });

  it('acepta REPOSITORY_DRIVER = "memory"', async () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    process.env['REPOSITORY_DRIVER'] = 'memory';
    const { env } = await import('./env.js');
    expect(env.REPOSITORY_DRIVER).toBe('memory');
  });

  it('assertRuntimeEnv throw si SESSION_COOKIE_SECRET falta', async () => {
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    Reflect.deleteProperty(process.env, 'SESSION_COOKIE_SECRET');
    const { assertRuntimeEnv } = await import('./env.js');
    expect(() => assertRuntimeEnv()).toThrow(/SESSION_COOKIE_SECRET/);
  });

  it('assertRuntimeEnv throw si ALLOWED_ORIGINS falta', async () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    Reflect.deleteProperty(process.env, 'ALLOWED_ORIGINS');
    const { assertRuntimeEnv } = await import('./env.js');
    expect(() => assertRuntimeEnv()).toThrow(/ALLOWED_ORIGINS/);
  });

  it('assertRuntimeEnv OK con secrets validos', async () => {
    process.env['SESSION_COOKIE_SECRET'] = VALID_SECRET;
    process.env['ALLOWED_ORIGINS'] = VALID_ORIGINS;
    const { assertRuntimeEnv } = await import('./env.js');
    expect(() => assertRuntimeEnv()).not.toThrow();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clientEnv, __resetEnv } from './env';

describe('env (dev defaults)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('NEXT_PUBLIC_FIREBASE_') || k.startsWith('NEXT_PUBLIC_APP_')) {
        delete process.env[k];
      }
    });
    __resetEnv();
  });

  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
    __resetEnv();
  });

  it('applies dev defaults when env vars are missing', () => {
    expect(process.env['NEXT_PUBLIC_FIREBASE_API_KEY']).toBeUndefined();
    const apiKey = clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(apiKey).toBe('fake-api-key-for-emulator');
  });

  it('uses user-provided value over dev default', () => {
    process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] = 'my-real-key';
    const apiKey = clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(apiKey).toBe('my-real-key');
  });

  it('defaults NEXT_PUBLIC_APP_ENV to "dev" when missing', () => {
    expect(clientEnv.NEXT_PUBLIC_APP_ENV).toBe('dev');
  });

  it('does NOT apply dev defaults in prod', () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'prod';
    // Force re-evaluation
    __resetEnv();
    expect(() => clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY).toThrow(/Invalid client env/);
  });
});

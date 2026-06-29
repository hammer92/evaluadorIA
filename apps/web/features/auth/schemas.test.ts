import { emailSchema } from '@shared/schemas/common';
import { describe, expect, it } from 'vitest';

import { loginSchema, signupSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a valid email + password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 chars', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('accepts a valid signup payload', () => {
    const result = signupSchema.safeParse({
      email: 'new@example.com',
      password: '12345678',
      displayName: 'New User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty displayName', () => {
    const result = signupSchema.safeParse({
      email: 'new@example.com',
      password: '12345678',
      displayName: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('emailSchema (shared primitive)', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });

  it('rejects malformed', () => {
    expect(emailSchema.safeParse('not-email').success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { getAuthErrorCode, getAuthErrorMessage, mapAuthErrorMessage } from './auth-error';

describe('getAuthErrorCode', () => {
  it('returns "unknown" for null and undefined', () => {
    expect(getAuthErrorCode(null)).toBe('unknown');
    expect(getAuthErrorCode(undefined)).toBe('unknown');
  });

  it('returns "unknown" for primitives (string/number/boolean)', () => {
    expect(getAuthErrorCode('boom')).toBe('unknown');
    expect(getAuthErrorCode(42)).toBe('unknown');
    expect(getAuthErrorCode(true)).toBe('unknown');
  });

  it('returns code string when error has a string .code', () => {
    expect(getAuthErrorCode({ code: 'auth/wrong-password' })).toBe('auth/wrong-password');
  });

  it('returns "unknown" when .code is empty string or not a string', () => {
    expect(getAuthErrorCode({ code: '' })).toBe('unknown');
    expect(getAuthErrorCode({ code: 123 })).toBe('unknown');
    expect(getAuthErrorCode({ code: null })).toBe('unknown');
  });

  it('returns auth/network-request-failed for TypeError instances', () => {
    expect(getAuthErrorCode(new TypeError('fetch failed'))).toBe('auth/network-request-failed');
  });

  it('returns code even on Error instances that have a code', () => {
    const e = new Error('msg') as Error & { code?: string };
    e.code = 'auth/too-many-requests';
    expect(getAuthErrorCode(e)).toBe('auth/too-many-requests');
  });

  it('returns "unknown" for plain Error without code', () => {
    expect(getAuthErrorCode(new Error('something failed'))).toBe('unknown');
  });

  it('returns "unknown" for plain object without code', () => {
    expect(getAuthErrorCode({})).toBe('unknown');
    expect(getAuthErrorCode({ message: 'no code' })).toBe('unknown');
  });
});

describe('getAuthErrorMessage', () => {
  it('returns friendly message for known Firebase Auth codes', () => {
    expect(getAuthErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Email o contraseña incorrectos',
    );
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toBe(
      'Ese email ya está registrado',
    );
    expect(getAuthErrorMessage({ code: 'auth/weak-password' })).toBe(
      'La contraseña debe tener al menos 8 caracteres',
    );
  });

  it('returns friendly message for known Firebase Functions codes', () => {
    expect(getAuthErrorMessage({ code: 'functions/permission-denied' })).toBe(
      'No tenés permisos para hacer esto',
    );
    expect(getAuthErrorMessage({ code: 'functions/unavailable' })).toBe(
      'Servicio no disponible. Reintentá en unos segundos',
    );
  });

  it('returns friendly message for custom auth-api codes', () => {
    expect(getAuthErrorMessage({ code: 'signup-rejected' })).toBe(
      'El registro público está cerrado. Pedile a un admin que te invite',
    );
    expect(getAuthErrorMessage({ code: 'session-failed' })).toBe(
      'No se pudo crear la sesión. Reintentá',
    );
  });

  it('returns auth/network-request-failed friendly message for TypeError', () => {
    expect(getAuthErrorMessage(new TypeError('fetch failed'))).toBe(
      'Error de red. Verificá tu conexión',
    );
  });

  it('falls back to Error.message for unknown codes', () => {
    expect(getAuthErrorMessage(new Error('custom failure'))).toBe('custom failure');
  });

  it('falls back to .message string property when not an Error instance', () => {
    expect(getAuthErrorMessage({ code: 'unknown/code', message: 'something happened' })).toBe(
      'something happened',
    );
  });

  it('returns default when no message is available', () => {
    expect(getAuthErrorMessage({ code: 'unknown/code' })).toBe('Ocurrió un error inesperado');
    expect(getAuthErrorMessage({})).toBe('Ocurrió un error inesperado');
    expect(getAuthErrorMessage(null)).toBe('Ocurrió un error inesperado');
  });

  it('returns default for empty/non-string .message on unknown code', () => {
    expect(getAuthErrorMessage({ code: 'unknown/code', message: '' })).toBe(
      'Ocurrió un error inesperado',
    );
    expect(getAuthErrorMessage({ code: 'unknown/code', message: 123 })).toBe(
      'Ocurrió un error inesperado',
    );
  });
});

describe('mapAuthErrorMessage', () => {
  it('returns default for null and undefined', () => {
    expect(mapAuthErrorMessage(null)).toBe('Ocurrió un error inesperado');
    expect(mapAuthErrorMessage(undefined)).toBe('Ocurrió un error inesperado');
  });

  it('returns friendly message for known codes', () => {
    expect(mapAuthErrorMessage('auth/invalid-credential')).toBe('Email o contraseña incorrectos');
    expect(mapAuthErrorMessage('functions/internal')).toBe('Error interno del servidor');
  });

  it('returns "Error: <code>" for unknown codes (instead of generic default)', () => {
    expect(mapAuthErrorMessage('custom/code')).toBe('Error: custom/code');
    expect(mapAuthErrorMessage('foo/bar')).toBe('Error: foo/bar');
  });
});

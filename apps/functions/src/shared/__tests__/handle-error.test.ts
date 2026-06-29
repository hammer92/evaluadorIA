import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect } from 'vitest';

import { RepositoryError } from '../errors.js';
import { handleError } from '../handle-error.js';

describe('handleError', () => {
  it('re-lanza HttpsError tal cual', () => {
    const err = new HttpsError('not-found', 'nope');
    expect(() => handleError(err)).toThrow(HttpsError);
  });

  it('mapea RepositoryError a HttpsError por código', () => {
    const cases: [RepositoryError['code'], string][] = [
      ['NOT_FOUND', 'not-found'],
      ['ALREADY_EXISTS', 'already-exists'],
      ['PERMISSION_DENIED', 'permission-denied'],
      ['VALIDATION', 'invalid-argument'],
      ['UNAVAILABLE', 'unavailable'],
      ['INTERNAL', 'internal'],
    ];
    for (const [code, httpsCode] of cases) {
      try {
        handleError(new RepositoryError(code, 'x'));
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpsError);
        const err = e as HttpsError & { details?: { code: string } };
        expect(err.code).toBe(httpsCode);
        expect(err.details?.code).toBe(code);
      }
    }
  });

  it('mapea cualquier otro error a internal', () => {
    try {
      handleError(new Error('boom'));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpsError);
      const err = e as HttpsError & { details?: { cause: string } };
      expect(err.code).toBe('internal');
      expect(err.details?.cause).toBe('boom');
    }
  });

  it('handleError returna never (TypeScript lo enforza)', () => {
    expect(() => handleError('string error')).toThrow(HttpsError);
  });
});

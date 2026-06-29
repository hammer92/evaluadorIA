import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';

import { RepositoryError } from './errors.js';

const REPO_TO_HTTPS: Record<
  RepositoryError['code'],
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'invalid-argument'
  | 'unavailable'
  | 'internal'
> = {
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  PERMISSION_DENIED: 'permission-denied',
  VALIDATION: 'invalid-argument',
  UNAVAILABLE: 'unavailable',
  INTERNAL: 'internal',
};

export function handleError(err: unknown): never {
  if (err instanceof HttpsError) throw err;
  if (err instanceof RepositoryError) {
    throw new HttpsError(REPO_TO_HTTPS[err.code], err.message, {
      code: err.code,
      cause: err.cause,
    });
  }
  logger.error('Unhandled error', err);
  throw new HttpsError('internal', 'An unexpected error occurred', {
    cause: err instanceof Error ? err.message : 'unknown',
  });
}

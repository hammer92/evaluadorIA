export type RepositoryErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'VALIDATION'
  | 'INTERNAL'
  | 'UNAVAILABLE';

export class RepositoryError extends Error {
  public readonly code: RepositoryErrorCode;
  public override readonly cause?: unknown;

  constructor(code: RepositoryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

// =============================================================================
// RepositoryError — error tipado compartido por todos los repositories.
// =============================================================================
// Cada impl (Firebase, Memory, futura AWS) traduce errores vendor-specific a
// uno de estos 6 códigos semánticos. Los services/UI consumen el código para
// tomar decisiones sin acoplarse al vendor.
// =============================================================================

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

  static notFound(resource: string, id: string): RepositoryError {
    return new RepositoryError('NOT_FOUND', `${resource} con id "${id}" no encontrado`);
  }

  static alreadyExists(resource: string, field: string, value: string): RepositoryError {
    return new RepositoryError('ALREADY_EXISTS', `${resource} con ${field}="${value}" ya existe`);
  }

  static validation(message: string, cause?: unknown): RepositoryError {
    return new RepositoryError('VALIDATION', message, cause);
  }

  static permissionDenied(message = 'Permisos insuficientes'): RepositoryError {
    return new RepositoryError('PERMISSION_DENIED', message);
  }

  static internal(message = 'Error interno del repositorio', cause?: unknown): RepositoryError {
    return new RepositoryError('INTERNAL', message, cause);
  }

  static unavailable(message = 'Servicio no disponible', cause?: unknown): RepositoryError {
    return new RepositoryError('UNAVAILABLE', message, cause);
  }
}

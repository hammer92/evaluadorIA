'use client';

// =============================================================================
// Auth error mapper — Firebase Auth + Functions codes → mensajes en español.
// =============================================================================
// Tabla de códigos que tratamos explícitamente. Cualquier código no mapeado
// cae en el fallback que muestra el mensaje original (en vez de "Error: unknown").
// =============================================================================

const MESSAGES: Record<string, string> = {
  // Firebase Auth
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/email-already-in-use': 'Ese email ya está registrado',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres',
  'auth/user-not-found': 'No existe una cuenta con ese email',
  'auth/wrong-password': 'Email o contraseña incorrectos',
  'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos',
  'auth/network-request-failed': 'Error de red. Verificá tu conexión',
  // Firebase Functions
  'functions/permission-denied': 'No tenés permisos para hacer esto',
  'functions/not-found': 'Función no encontrada',
  'functions/unavailable': 'Servicio no disponible. Reintentá en unos segundos',
  'functions/internal': 'Error interno del servidor',
  'functions/unauthenticated': 'Necesitás estar autenticado',
  // Custom codes (auth-api.ts)
  'signup-rejected': 'El registro público está cerrado. Pedile a un admin que te invite',
  'session-failed': 'No se pudo crear la sesión. Reintentá',
};

export function getAuthErrorCode(error: unknown): string {
  if (error == null) return 'unknown';
  if (typeof error === 'object') {
    // FirebaseError y AuthApiError tienen .code
    if ('code' in error) {
      const code = (error).code;
      if (typeof code === 'string' && code.length > 0) return code;
    }
    // Errores de red/fetch (TypeError) no tienen .code → 'network'
    if (error instanceof TypeError) return 'auth/network-request-failed';
  }
  return 'unknown';
}

export function getAuthErrorMessage(error: unknown): string {
  // 1. Si tiene code conocido, devolver el friendly
  const code = getAuthErrorCode(error);
  if (code !== 'unknown' && MESSAGES[code]) {
    return MESSAGES[code];
  }
  // 2. Si no, devolver el mensaje original (si existe)
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error).message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return 'Ocurrió un error inesperado';
}

// Mantener mapAuthErrorMessage como wrapper para no romper imports existentes
export function mapAuthErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Ocurrió un error inesperado';
  return MESSAGES[code] ?? `Error: ${code}`;
}

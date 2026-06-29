'use client';

// =============================================================================
// Auth error mapper — Firebase Auth codes → mensajes en español.
// =============================================================================
// Tabla cerrada de códigos que tratamos explícitamente. Cualquier otro código
// cae en el fallback "default".
// =============================================================================

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/email-already-in-use': 'Ese email ya está registrado',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres',
  'auth/user-not-found': 'No existe una cuenta con ese email',
  'auth/wrong-password': 'Email o contraseña incorrectos',
  'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos',
  'auth/network-request-failed': 'Error de red. Verificá tu conexión',
  'signup-rejected': 'El registro público está cerrado. Pedile a un admin que te invite',
};

export function mapAuthErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Ocurrió un error inesperado';
  return MESSAGES[code] ?? `Error: ${code}`;
}

export function getAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}

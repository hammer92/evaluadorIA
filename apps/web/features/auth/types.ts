import type { Role } from '@shared/schemas/common';

// =============================================================================
// Auth feature — types
// =============================================================================
// Tipos compartidos entre cliente (hooks/components) y server (services).
// =============================================================================

/**
 * Estado de autenticación en el cliente.
 * Expuesto por `useAuth()`.
 */
export interface AuthState {
  user: AuthUser | null;
  claims: AuthClaims | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Datos del usuario autenticado (subset de Firebase User).
 * Solo lo que necesitamos en la UI.
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Custom claims expuestas por el hook. La fuente de verdad es el JWT.
 */
export interface AuthClaims {
  role: Role;
  organizationId: string | null;
}

/**
 * Payload firmado en la cookie de sesión (HS256).
 * Lo emite la Cloud Function `createSession` y lo verifica `verifySession`
 * (server) + el middleware (edge).
 */
export interface SessionPayload {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
  iat: number;
  exp: number;
}

/**
 * Resultado de `verifyAuth()` en server-side.
 * Devuelve `null` si no hay cookie válida.
 */
export interface ServerAuth {
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

'use client';

import { clientEnv } from '@/env';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from '@/lib/firebase/auth';

// =============================================================================
// Auth API — cliente (signIn/signUp/signOut + session helpers).
// =============================================================================
// Q1=A (email/password only). Q3=C (híbrido: primer user admin, resto por invitación).
//
// Para tests, todas las llamadas al SDK Firebase se hacen a través de
// `@/lib/firebase/auth` re-exports, que se pueden mockear con vi.mock().
// =============================================================================

const COOKIE_NAME = '__session';

function getFunctionsBase(): string {
  // En dev/staging, el emulator corre en localhost:5001.
  // En prod, NEXT_PUBLIC_API_BASE_URL apunta a las functions desplegadas.
  if (clientEnv.NEXT_PUBLIC_API_BASE_URL) {
    // Si el base URL ya incluye /<project>/<region>, lo usamos tal cual.
    return clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev') {
    return 'http://127.0.0.1:5001/admin-platform-dev/us-central1';
  }
  // Fallback vacío — el fetch fallará con un mensaje claro.
  return '';
}

function getSessionEndpoint(): string {
  return `${getFunctionsBase()}/v1_auth_create_session`;
}

function getLogoutEndpoint(): string {
  return `${getFunctionsBase()}/v1_auth_clear_session`;
}

function getCreateUserEndpoint(): string {
  return `${getFunctionsBase()}/v1_users_create`;
}

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * SignIn con email + password. Devuelve el `User` de Firebase Auth.
 * No setea cookie — eso lo hace la página vía `fetch(SESSION_ENDPOINT)`.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * SignUp público. Q3=C: si es el primer user del sistema, se asigna role='admin'
 * server-side. Resto: rejected (debe usar invitación).
 *
 * Retorna `{ user, isFirstUser }` para que la UI sepa si es admin bootstrap.
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: User; isFirstUser: boolean }> {
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(cred.user, { displayName: input.displayName });

  // Llama a la Cloud Function que decide si es first-user-admin.
  // onCall: POST con envelope { data: {...} }.
  const idToken = await cred.user.getIdToken();
  const endpoint = getCreateUserEndpoint();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { idToken, displayName: input.displayName },
    }),
  });
  if (!res.ok) {
    // Rollback: borrar el user recién creado si la CF rechaza (no es first user).
    await cred.user.delete().catch(() => undefined);
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new AuthApiError(
      'signup-rejected',
      body.error?.message ?? 'No se pudo completar el registro',
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    result?: { isFirstUser?: boolean };
  };
  return { user: cred.user, isFirstUser: body.result?.isFirstUser === true };
}

/**
 * Crea la cookie de sesión httpOnly. La setea el server tras verificar
 * el idToken contra Firebase Admin SDK. Devuelve `true` si la cookie se seteó.
 */
export async function createSession(user: User): Promise<boolean> {
  const idToken = await user.getIdToken();
  const res = await fetch(getSessionEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return false;
  return true;
}

/**
 * Cierra sesión: limpia Firebase Auth + borra cookie httpOnly.
 */
export async function signOutCurrent(): Promise<void> {
  await signOut(auth);
  await fetch(getLogoutEndpoint(), { method: 'POST' }).catch(() => undefined);
}

/**
 * Helper para tests: setea una cookie de sesión directamente (sin pasar por
 * Cloud Function). Solo se usa en `verify-auth.ts` con emuladores.
 */
export { COOKIE_NAME };

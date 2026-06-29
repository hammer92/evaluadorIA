'use client';

import { clientEnv } from '@/env';
import {
  auth,
  functions,
  httpsCallable,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from '@/lib/firebase/auth';

// =============================================================================
// Auth API — cliente (signIn/signUp/signOut + session helpers).
// =============================================================================
// Q1=A (email/password only). Q3=C (híbrido: primer user admin, resto por invitación).
//
// El flow de signup es SIMPLE:
//   1. signUpWithEmail({ email, password, displayName })
//      → Llama CF v1AuthSignUp (pública, no requiere auth previa) con el
//        form data. La CF crea el user en Auth via Admin SDK + setea claims
//        (admin si first-user, rejected si no).
//   2. Si la CF retorna OK → signInWithEmailAndPassword (login normal)
//   3. createSession(user) → llama CF onRequest que setea cookie httpOnly
//   4. router.push('/admin')
//
// NO usamos createUserWithEmailAndPassword directo del SDK porque
// (a) requiere que el cliente ya esté autenticado para llamar la CF que
//     decide first-user-admin (raro), (b) hace rollback complejo si la CF
//     rechaza. Es más limpio delegar todo a la CF.
// =============================================================================

const COOKIE_NAME = '__session';

function getFunctionsBase(): string {
  if (clientEnv.NEXT_PUBLIC_API_BASE_URL) {
    return clientEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev') {
    return 'http://127.0.0.1:5001/admin-platform-dev/us-central1';
  }
  return '';
}

function getSessionEndpoint(): string {
  return `${getFunctionsBase()}/v1AuthCreateSession`;
}

function getLogoutEndpoint(): string {
  return `${getFunctionsBase()}/v1AuthClearSession`;
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
 * SignIn con email + password (user YA EXISTE en Auth).
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * SignUp público: delega TODO a la Cloud Function v1AuthSignUp (que es
 * server-authoritative para first-user-admin y para crear el Auth user
 * con Admin SDK).
 *
 * Flow:
 *   1. CF v1AuthSignUp({ email, password, displayName }) - pública, no auth
 *   2. Si OK → signInWithEmailAndPassword (login normal)
 *   3. createSession (cookie httpOnly)
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: User; isFirstUser: boolean }> {
  // 1. Crear user via CF (server-authoritative)
  const signUpFn = httpsCallable<
    { email: string; password: string; displayName: string },
    { uid: string; role: string; isFirstUser: boolean }
  >(functions, 'v1AuthSignUp');

  let result: { uid: string; role: string; isFirstUser: boolean };
  try {
    const cfResult = await signUpFn({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    result = cfResult.data;
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: unknown };
    console.error('[signUpWithEmail] v1AuthSignUp CF failed:', {
      code: err.code,
      message: err.message,
      details: err.details,
    });
    throw new AuthApiError(
      err.code ?? 'signup-rejected',
      err.message ?? 'No se pudo completar el registro',
    );
  }

  // 2. Login normal (para tener una sesión Firebase Auth + poder llamar createSession)
  const user = await signInWithEmail(input.email, input.password);

  return { user, isFirstUser: result.isFirstUser };
}

/**
 * Crea la cookie de sesión httpOnly. Llama a la Cloud Function onRequest
 * v1AuthCreateSession que verifica el idToken contra Firebase Admin SDK,
 * firma un JWT con jose HS256, y setea la cookie via Set-Cookie.
 */
export async function createSession(user: User): Promise<boolean> {
  const idToken = await user.getIdToken(true);
  const res = await fetch(getSessionEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });
  if (!res.ok) {
    console.error('[createSession] failed:', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

/**
 * Cierra sesión: limpia Firebase Auth + borra cookie httpOnly.
 */
export async function signOutCurrent(): Promise<void> {
  await signOut(auth);
  await fetch(getLogoutEndpoint(), { method: 'POST', credentials: 'include' }).catch(
    () => undefined,
  );
}

export { COOKIE_NAME };

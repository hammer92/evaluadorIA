'use client';

import { phoneE164Schema } from '../schemas';

import {
  auth,
  functions,
  httpsCallable,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from '@/lib/firebase/auth';

// =============================================================================
// Auth API — cliente (signIn/signUp/signOut + session helpers).
// =============================================================================
// Q1=C (email/password + phone). Q3=C (híbrido: primer user admin, resto por invitación).
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
//
// PHONE AUTH (login only, no self-signup):
//   - User YA EXISTE en Auth con phoneNumber (admin lo invitó vía
//     v1UsersCreate + Admin SDK updatePhoneNumber o directamente
//     auth.createUser({ phoneNumber })).
//   - 1. signInWithPhone({ phoneNumber, recaptchaContainerId })
//        → signInWithPhoneNumber() retorna ConfirmationResult
//   - 2. verifyPhoneCode(confirmationResult, code)
//        → confirmationResult.confirm(code) → user
//   - 3. createSession(user) → cookie httpOnly (igual que email)
// =============================================================================

const COOKIE_NAME = '__session';

function getSessionEndpoint(): string {
  // Same-origin: la cookie queda en localhost:3000, no en 127.0.0.1:5001
  // (ver apps/web/app/api/session/route.ts para la explicación completa).
  return '/api/session';
}

function getLogoutEndpoint(): string {
  return '/api/session/clear';
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
 * SignIn con teléfono (phone OTP). El user YA EXISTE en Auth con ese
 * phoneNumber (admin lo invitó). Devuelve el `ConfirmationResult` que
 * el caller debe guardar y pasar a {@link verifyPhoneCode} con el código
 * de 6 dígitos que el usuario recibió por SMS.
 *
 * @param phoneNumber - E.164 canónico (ej: `+5491155554444`). Validado
 *   contra `phoneE164Schema` antes de invocar el SDK.
 * @param recaptchaContainerId - ID del div en el DOM donde se monta el
 *   `RecaptchaVerifier` invisible. Si el div no existe, Firebase Auth
 *   lanza `auth/captcha-check-failed`.
 *
 * @throws AuthApiError si la validación falla o si Firebase rechaza el
 *   número (`auth/invalid-phone-number`, `auth/quota-exceeded`, etc).
 */
export async function signInWithPhone(input: {
  phoneNumber: string;
  recaptchaContainerId: string;
}): Promise<ConfirmationResult> {
  const parse = phoneE164Schema.safeParse(input.phoneNumber);
  if (!parse.success) {
    throw new AuthApiError(
      'auth/invalid-phone-number',
      parse.error.issues[0]?.message ?? 'Número inválido',
    );
  }
  const verifier = new RecaptchaVerifier(auth, input.recaptchaContainerId, {
    size: 'invisible',
  });
  try {
    return await signInWithPhoneNumber(auth, input.phoneNumber, verifier);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error('[signInWithPhone] failed:', err.code, err.message);
    throw new AuthApiError(
      err.code ?? 'auth/unknown',
      err.message ?? 'No se pudo enviar el código',
    );
  }
}

/**
 * Confirma el código OTP de 6 dígitos recibido por SMS y devuelve el user.
 *
 * Después de llamar a esta función, el caller debe invocar
 * {@link createSession} para setear la cookie httpOnly (igual que en el
 * flow de email).
 *
 * @throws AuthApiError si el código es inválido/expirado.
 */
export async function verifyPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<User> {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthApiError('auth/invalid-verification-code', 'El código debe tener 6 dígitos');
  }
  try {
    const result = await confirmation.confirm(code);
    return result.user;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error('[verifyPhoneCode] failed:', err.code, err.message);
    throw new AuthApiError(err.code ?? 'auth/unknown', err.message ?? 'Código inválido o expirado');
  }
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

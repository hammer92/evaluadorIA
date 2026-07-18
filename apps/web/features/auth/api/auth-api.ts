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
// Auth API — cliente (signIn/signUp/signOut).
// =============================================================================
// Arquitectura estática (sin SSR, sin /api/* routes, sin middleware):
//   1. signUpWithEmail({ email, password, displayName })
//      → Llama CF v1AuthSignUp (pública, no requiere auth previa) con el
//        form data. La CF crea el user en Auth via Admin SDK + setea claims
//        (admin si first-user, rejected si no).
//   2. Si la CF retorna OK → signInWithEmailAndPassword (login normal)
//   3. NO hay cookie httpOnly. La auth pasa por Firebase Auth ID token que
//      el cliente incluye automáticamente en cada httpsCallable.
//   4. router.push('/admin') — admin layout hace check client-side con useAuth.
//
// PHONE AUTH (login only, no self-signup):
//   - User YA EXISTE en Auth con phoneNumber (admin lo invitó vía
//     v1UsersCreate + Admin SDK updatePhoneNumber o directamente
//     auth.createUser({ phoneNumber })).
//   - 1. signInWithPhone({ phoneNumber, recaptchaContainerId })
//   - 2. verifyPhoneCode({ confirmation, code }) → user con claims
// =============================================================================

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
 *   3. Firebase Auth ID token contiene role/claims para client-side guards
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: User; isFirstUser: boolean }> {
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

  // 2. Login normal (para tener una sesión Firebase Auth con claims)
  const user = await signInWithEmail(input.email, input.password);

  return { user, isFirstUser: result.isFirstUser };
}

/**
 * SignIn con teléfono (phone OTP). El user YA EXISTE en Auth con ese
 * phoneNumber (admin lo invitó). Devuelve el `ConfirmationResult` que
 * el caller debe guardar y pasar a {@link verifyPhoneCode} con el código
 * de 6 dígitos que el usuario recibió por SMS.
 *
 * @throws AuthApiError si la validación falla o si Firebase rechaza el
 *   número.
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
 * Cierra sesión Firebase Auth (no hay cookie httpOnly que limpiar).
 */
export async function signOutCurrent(): Promise<void> {
  await signOut(auth);
}

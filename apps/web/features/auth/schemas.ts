import { z } from 'zod';

// =============================================================================
// Auth feature schemas
// =============================================================================
// Validación de formularios de auth (login/signup). Mensajes en español por
// convención del proyecto (ver ADR-0004).
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email('Email inválido').max(254),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * E.164 formato internacional: `+` seguido de 7-15 dígitos.
 *
 * Aceptamos solo el formato canónico (sin espacios, dashes, paréntesis).
 * El cliente puede formatear el input con `libphonenumber-js` o similar
 * antes de llegar al schema; esta validación es el último guard.
 */
export const phoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Número inválido. Usá formato internacional (ej: +5491155554444)');

export const phoneOtpRequestSchema = z.object({
  phoneNumber: phoneE164Schema,
});
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;

export const phoneOtpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;

export const signupSchema = z.object({
  email: z.string().email('Email inválido').max(254),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  displayName: z.string().min(1, 'El nombre es obligatorio').max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

// Map de códigos de error de Firebase Auth → mensaje user-friendly (ES).
// Solo los que tratamos explícitamente. Otros caen en el fallback "default".
export const authErrorMessageSchema = z.enum([
  'auth/invalid-credential',
  'auth/email-already-in-use',
  'auth/weak-password',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/too-many-requests',
  'auth/network-request-failed',
  'auth/invalid-phone-number',
  'auth/missing-phone-number',
  'auth/quota-exceeded',
  'auth/captcha-check-failed',
  'auth/invalid-verification-code',
  'auth/invalid-verification-id',
  'auth/code-expired',
  'auth/popup-closed-by-user',
]);
export type AuthErrorCode = z.infer<typeof authErrorMessageSchema>;

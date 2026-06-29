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
]);
export type AuthErrorCode = z.infer<typeof authErrorMessageSchema>;

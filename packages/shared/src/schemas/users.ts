import { z } from 'zod';

// =============================================================================
// Users schema
// =============================================================================
// Modelo público (TS/UI): camelCase. Firestore almacena snake_case — el
// mapeo se hace en el repository (ver data-model.md sección 5).
// =============================================================================

export const roleSchema = z.enum(['admin', 'recruiter', 'expert']);
export type Role = z.infer<typeof roleSchema>;

export const userStatusSchema = z.enum(['active', 'invited', 'suspended']);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(120).nullable(),
  photoURL: z.string().url().nullable(),
  role: roleSchema,
  organizationId: z.string().nullable(),
  status: userStatusSchema,
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  deletedAt: z.date().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120).optional(),
  role: roleSchema,
  organizationId: z.string().optional(),
  sendInviteEmail: z.boolean().default(true),
});
// z.input preserva optional+default; z.infer los aplicaría y haría obligatorio.
export type CreateUserInput = z.input<typeof createUserInputSchema>;

export const updateUserInputSchema = z
  .object({
    displayName: z.string().min(1).max(120).nullable().optional(),
    photoURL: z.string().url().nullable().optional(),
    role: roleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo',
  });
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

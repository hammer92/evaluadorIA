import { z } from 'zod';

// =============================================================================
// Common primitives reused across entity schemas.
// =============================================================================
// Source of truth para tipos compartidos. Cada schema es una primitiva que se
// compone en schemas de dominio (users.ts, organizations.ts, audit-logs.ts).
// Mensajes en español por convención del proyecto (ver ADR-0004).
// =============================================================================

export const emailSchema = z.string().email().max(254);
export type Email = z.infer<typeof emailSchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug inválido (solo minúsculas, números y guiones)')
  .min(1)
  .max(64);
export type Slug = z.infer<typeof slugSchema>;

// Coerce para aceptar Firestore Timestamp.toDate() o string ISO o Date.
export const timestampSchema = z.coerce.date();
export type Timestamp = z.infer<typeof timestampSchema>;

export const roleSchema = z.enum(['admin', 'recruiter', 'expert']);
export type Role = z.infer<typeof roleSchema>;

export const statusSchema = z.enum(['active', 'invited', 'suspended']);
export type Status = z.infer<typeof statusSchema>;

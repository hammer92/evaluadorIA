import { z } from 'zod';

// =============================================================================
// Audit Logs schema
// =============================================================================
// Append-only. Escritura SOLO desde Cloud Functions (Admin SDK bypassa reglas
// de Firestore). Ver data-model.md sección 3.3 para el detalle completo.
// =============================================================================

export const auditActionSchema = z.enum([
  'user.created',
  'user.updated',
  'user.deleted',
  'user.role_changed',
  'user.suspended',
  'organization.created',
  'organization.updated',
  'auth.login',
  'auth.failed_login',
  'auth.role_escalation_blocked',
  'auth.phone_login',
  'auth.phone_otp_requested',
  'auth.phone_otp_failed',
  'template.created',
  'template.submitted',
  'template.approved',
  'template.rejected',
  'template.changes_requested',
  'template.resubmitted',
  'template.reopened',
  'template.deleted',
  'template.edited',
  'template.expert_edited',
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditTargetTypeSchema = z.enum(['user', 'organization', 'system']);
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>;

export const auditLogSchema = z.object({
  logId: z.string(),
  organizationId: z.string().nullable(),
  actorId: z.string(),
  actorEmail: z.string().email(),
  action: auditActionSchema,
  targetType: auditTargetTypeSchema,
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

// logId y createdAt se asignan server-side (Cloud Functions / Admin SDK).
export const createAuditLogInputSchema = auditLogSchema.omit({
  logId: true,
  createdAt: true,
});
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;

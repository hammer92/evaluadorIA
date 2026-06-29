import type { AuditLog } from '@shared/schemas/audit-logs';
import type { Timestamp as FbTimestamp } from 'firebase/firestore';

export interface AuditLogRaw {
  organization_id: string | null;
  actor_id: string;
  actor_email: string;
  action: AuditLog['action'];
  target_type: AuditLog['targetType'];
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: FbTimestamp;
}

export const toAuditLog = (logId: string, raw: AuditLogRaw): AuditLog => ({
  logId,
  organizationId: raw.organization_id,
  actorId: raw.actor_id,
  actorEmail: raw.actor_email,
  action: raw.action,
  targetType: raw.target_type,
  targetId: raw.target_id,
  metadata: raw.metadata,
  ip: raw.ip,
  userAgent: raw.user_agent,
  createdAt: raw.created_at.toDate(),
});

export const toAuditLogInputRaw = (
  input: Omit<AuditLog, 'logId' | 'createdAt'>,
): Omit<AuditLogRaw, 'created_at'> => ({
  organization_id: input.organizationId,
  actor_id: input.actorId,
  actor_email: input.actorEmail,
  action: input.action,
  target_type: input.targetType,
  target_id: input.targetId,
  metadata: input.metadata,
  ip: input.ip,
  user_agent: input.userAgent,
});

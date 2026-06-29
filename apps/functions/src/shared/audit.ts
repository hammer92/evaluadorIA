import type { AuditAction, AuditTargetType } from '@platform/shared';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { getAdminDb } from '../firebase-admin.js';

export interface AuditLogInput {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  metadata?: Record<string, unknown>;
  organizationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const db: Firestore = getAdminDb();
  await db
    .collection('audit_logs')
    .doc()
    .set({
      organizationId: input.organizationId ?? null,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
}

import type { AuditLog, CreateAuditLogInput } from '@shared/schemas/audit-logs';

import type { Ctx } from '../users/types';

export type { Ctx };

export interface ListAuditLogsInput {
  organizationId?: string;
  actorId?: string;
  targetType?: 'user' | 'organization' | 'system';
  targetId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAuditLogsResult {
  items: AuditLog[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// =============================================================================
// AuditLogRepository — append-only (no update/delete).
// =============================================================================
// Los audit logs solo se escriben desde Cloud Functions (Admin SDK bypassa
// reglas). Ver firestore.rules §AUDIT LOGS + ADR-0006 matriz de capacidades.
// =============================================================================

export interface AuditLogRepository {
  append(input: CreateAuditLogInput, ctx: Ctx): Promise<AuditLog>;
  list(input: ListAuditLogsInput, ctx: Ctx): Promise<ListAuditLogsResult>;
  getById(logId: string, ctx: Ctx): Promise<AuditLog | null>;
}

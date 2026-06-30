import 'server-only';

import { getUserRepository, getAuditLogRepository } from '@/repositories';
import type { Ctx } from '@/repositories/users';
import { requireAuth, type ServerAuth } from '@/services/auth-service';

function toCtx(auth: ServerAuth): Ctx {
  return { ...auth, traceId: 'rsc' };
}

export interface DashboardStats {
  total: number;
  active: number;
  invited: number;
  suspended: number;
}

export interface RecentAuditLog {
  logId: string;
  actorEmail: string;
  action:
    | 'user.created'
    | 'user.updated'
    | 'user.deleted'
    | 'user.role_changed'
    | 'user.suspended'
    | 'organization.created'
    | 'organization.updated'
    | 'auth.login'
    | 'auth.failed_login'
    | 'auth.role_escalation_blocked';
  targetId: string | null;
  createdAt: string;
}

export async function getUsersStats(ctx?: ServerAuth): Promise<DashboardStats> {
  try {
    const userCtx = toCtx(ctx ?? (await requireAuth()));
    const repo = getUserRepository();
    const [active, invited, suspended] = await Promise.all([
      repo.list({ status: 'active', page: 1, pageSize: 1 }, userCtx),
      repo.list({ status: 'invited', page: 1, pageSize: 1 }, userCtx),
      repo.list({ status: 'suspended', page: 1, pageSize: 1 }, userCtx),
    ]);
    return {
      total: active.total + invited.total + suspended.total,
      active: active.total,
      invited: invited.total,
      suspended: suspended.total,
    };
  } catch (e) {
    // Firestore index puede faltar en dev/emulator; degradar a zeros
    // en vez de romper todo el dashboard.
    console.error('[dashboard] getUsersStats failed (degraded to zeros):', (e as Error).message);
    return { total: 0, active: 0, invited: 0, suspended: 0 };
  }
}

export async function getRecentAuditLogs(
  limit: number,
  ctx?: ServerAuth,
): Promise<RecentAuditLog[]> {
  try {
    const userCtx = toCtx(ctx ?? (await requireAuth()));
    const repo = getAuditLogRepository();
    const result = await repo.list({ page: 1, pageSize: limit }, userCtx);
    return result.items.map((log) => ({
      logId: log.logId,
      actorEmail: log.actorEmail,
      action: log.action,
      targetId: log.targetId,
      createdAt: log.createdAt.toISOString(),
    }));
  } catch (e) {
    // Firestore index puede faltar en dev/emulator; degradar a empty
    // en vez de romper todo el dashboard.
    console.error(
      '[dashboard] getRecentAuditLogs failed (degraded to empty):',
      (e as Error).message,
    );
    return [];
  }
}

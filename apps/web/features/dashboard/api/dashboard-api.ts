import { functions, httpsCallable } from '@/lib/firebase/auth';

// =============================================================================
// Dashboard API (cliente) — llama a Cloud Functions callable via httpsCallable.
// =============================================================================

export interface DashboardStats {
  total: number;
  active: number;
  invited: number;
  suspended: number;
}

export interface RecentAuditLog {
  logId: string;
  actorEmail: string;
  action: string;
  targetId: string | null;
  createdAt: string;
}

export async function getUsersStats(): Promise<DashboardStats> {
  try {
    const fn = httpsCallable<undefined, DashboardStats>(functions, 'v1ReportsStats');
    const result = await fn();
    return result.data;
  } catch (e) {
    console.error('[dashboard] getUsersStats failed (degraded to zeros):', (e as Error).message);
    return { total: 0, active: 0, invited: 0, suspended: 0 };
  }
}

export async function getRecentAuditLogs(limit: number): Promise<RecentAuditLog[]> {
  try {
    const fn = httpsCallable<
      { type: 'audit_log_pdf'; pageSize: number },
      { items: RecentAuditLog[] }
    >(functions, 'v1ReportsGenerate');
    const result = await fn({ type: 'audit_log_pdf', pageSize: limit });
    return result.data.items;
  } catch (e) {
    console.error(
      '[dashboard] getRecentAuditLogs failed (degraded to empty):',
      (e as Error).message,
    );
    return [];
  }
}

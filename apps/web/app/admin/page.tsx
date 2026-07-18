'use client';

import { UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { getRecentAuditLogs, getUsersStats } from '@/features/dashboard/api/dashboard-api';
import {
  RecentActivity,
  type RecentActivityItem,
} from '@/features/dashboard/components/recent-activity';
import { StatsCard } from '@/features/dashboard/components/stats-card';

// =============================================================================
// DashboardPage — client component (output: 'export' = sin server runtime).
// =============================================================================
// Llama a las CFs via httpsCallable. Auth via Firebase Auth ID token
// (incluido automáticamente por el SDK cliente).
// =============================================================================

export default function DashboardPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    invited: number;
    suspended: number;
  }>({
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
  });
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    void (async () => {
      try {
        const [s, a] = await Promise.all([getUsersStats(), getRecentAuditLogs(5)]);
        if (cancelled) return;
        setStats(s);
        setActivity(a as RecentActivityItem[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-stack-lg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const emailPrefix = auth.user?.email?.split('@')[0] ?? 'admin';

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">DASHBOARD</p>
        <h1 className="font-hanken text-display-lg text-on-surface">
          Bienvenido, <span className="text-navy">{emailPrefix}</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Resumen general del sistema y actividad reciente.
        </p>
      </header>

      <section
        aria-label="Estadísticas de usuarios"
        className="grid grid-cols-1 gap-stack-md sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatsCard label="Total usuarios" value={stats.total} icon={<Users />} tone="neutral" />
        <StatsCard label="Activos" value={stats.active} icon={<UserCheck />} tone="success" />
        <StatsCard label="Invitados" value={stats.invited} icon={<UserPlus />} tone="info" />
        <StatsCard label="Suspendidos" value={stats.suspended} icon={<UserX />} tone="error" />
      </section>

      <RecentActivity items={activity} />
    </div>
  );
}

import { UserCheck, UserPlus, Users, UserX } from 'lucide-react';

import { getRecentAuditLogs, getUsersStats } from '@/features/dashboard/api/dashboard-api';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { StatsCard } from '@/features/dashboard/components/stats-card';
import { verifyAuth } from '@/services/auth-service';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await verifyAuth();
  if (!auth) {
    return (
      <div className="space-y-stack-md">
        <h1 className="font-hanken text-display-lg text-on-surface">Dashboard</h1>
        <p className="text-body-md text-on-surface-variant">Sin sesión activa.</p>
      </div>
    );
  }

  const [stats, activity] = await Promise.all([getUsersStats(auth), getRecentAuditLogs(5, auth)]);

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">DASHBOARD</p>
        <h1 className="font-hanken text-display-lg text-on-surface">
          Bienvenido, <span className="text-navy">{auth.email.split('@')[0]}</span>
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

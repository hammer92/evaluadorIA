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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Sin sesión activa.</p>
      </div>
    );
  }

  const [stats, activity] = await Promise.all([getUsersStats(auth), getRecentAuditLogs(5, auth)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, <span className="font-medium text-foreground">{auth.email}</span> ({auth.role}
          )
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total usuarios" value={stats.total} icon={<Users />} />
        <StatsCard label="Activos" value={stats.active} icon={<UserCheck />} />
        <StatsCard label="Invitados" value={stats.invited} icon={<UserPlus />} />
        <StatsCard label="Suspendidos" value={stats.suspended} icon={<UserX />} />
      </div>
      <RecentActivity items={activity} />
    </div>
  );
}

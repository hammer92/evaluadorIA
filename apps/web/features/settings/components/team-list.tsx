import 'server-only';

import { RoleBadge } from '@/features/users/components/role-badge';
import { StatusBadge } from '@/features/users/components/status-badge';
import { getUserRepository } from '@/repositories';
import { verifyAuth } from '@/services/auth-service';

export async function TeamList(): Promise<React.JSX.Element> {
  const auth = await verifyAuth();
  if (!auth) {
    return (
      <div className="rounded-tv border border-border-standard bg-surface-subtle p-stack-md text-body-md text-on-surface-variant">
        Sin sesión activa.
      </div>
    );
  }

  try {
    const repo = getUserRepository();
    const result = await repo.list(
      { organizationId: auth.organizationId ?? '__none__', page: 1, pageSize: 50 },
      { ...auth, traceId: 'rsc' },
    );

    if (result.items.length === 0) {
      return (
        <div className="rounded-tv border border-dashed border-border-standard bg-surface-subtle p-stack-md text-body-md text-on-surface-variant">
          Sin miembros en el equipo.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-tv border border-border-standard bg-white shadow-tv-card">
        <ul className="divide-y divide-border-standard">
          {result.items.map((u) => (
            <li key={u.uid} className="flex items-center justify-between gap-stack-md p-stack-md">
              <div className="min-w-0">
                <p className="truncate font-medium text-on-surface">{u.displayName ?? u.email}</p>
                <p className="truncate text-body-md text-on-surface-variant">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RoleBadge role={u.role} />
                <StatusBadge status={u.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch (e) {
    console.error('[team-list] repo.list failed (degraded to empty):', (e as Error).message);
    return (
      <div className="rounded-tv border border-dashed border-status-warning/40 bg-status-warning/5 p-stack-md text-body-md text-status-warning">
        No se pudo cargar el equipo. Reintentá más tarde.
      </div>
    );
  }
}

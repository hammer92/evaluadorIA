import 'server-only';

import { RoleBadge } from '@/features/users/components/role-badge';
import { StatusBadge } from '@/features/users/components/status-badge';
import { getUserRepository } from '@/repositories';
import { verifyAuth } from '@/services/auth-service';

export async function TeamList(): Promise<React.JSX.Element> {
  const auth = await verifyAuth();
  if (!auth) return <p className="text-sm text-muted-foreground">Sin sesión.</p>;

  try {
    const repo = getUserRepository();
    const result = await repo.list(
      { organizationId: auth.organizationId ?? '__none__', page: 1, pageSize: 50 },
      { ...auth, traceId: 'rsc' },
    );

    if (result.items.length === 0) {
      return <p className="text-sm text-muted-foreground">Sin miembros en el equipo.</p>;
    }

    return (
      <div className="rounded-md border divide-y">
        {result.items.map((u) => (
          <div key={u.uid} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{u.displayName ?? u.email}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RoleBadge role={u.role} />
              <StatusBadge status={u.status} />
            </div>
          </div>
        ))}
      </div>
    );
  } catch (e) {
    // Firestore index puede faltar en dev/emulator; degradar a empty.
    console.error('[team-list] repo.list failed (degraded to empty):', (e as Error).message);
    return <p className="text-sm text-muted-foreground">No se pudo cargar el equipo.</p>;
  }
}

'use client';

import type { User } from '@shared/schemas/users';
import { useEffect, useState } from 'react';

import { listUsers } from '@/features/users/api/users-api';
import { RoleBadge } from '@/features/users/components/role-badge';
import { StatusBadge } from '@/features/users/components/status-badge';

// =============================================================================
// TeamList — client component (output: 'export' = sin server runtime).
// =============================================================================
// Lista los miembros del equipo via CF v1UsersList.
// =============================================================================

export function TeamList(): React.JSX.Element {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listUsers({ page: 1, pageSize: 50 });
        if (!cancelled) setItems(result.items);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-tv border border-border-standard bg-surface-subtle p-stack-md text-body-md text-on-surface-variant">
        Cargando equipo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-tv border border-status-error bg-status-error/10 p-stack-md text-body-md text-status-error">
        Error: {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-tv border border-dashed border-border-standard bg-surface-subtle p-stack-md text-body-md text-on-surface-variant">
        Sin miembros en el equipo.
      </div>
    );
  }

  return (
    <div className="space-y-stack-sm">
      {items.map((u) => (
        <div
          key={u.uid}
          className="rounded-tv border border-border-standard bg-white p-stack-md flex items-center justify-between shadow-tv-card"
        >
          <div>
            <p className="text-body-md font-body-md text-on-surface">{u.displayName ?? u.email}</p>
            <p className="text-label-sm text-on-surface-variant">{u.email}</p>
          </div>
          <div className="flex items-center gap-stack-sm">
            <RoleBadge role={u.role} />
            <StatusBadge status={u.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

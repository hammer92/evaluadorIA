import type { AuditAction } from '@shared/schemas/audit-logs';

import { ActivityItem } from './activity-item';

export interface RecentActivityItem {
  logId: string;
  actorEmail: string;
  action: AuditAction;
  targetId: string | null;
  createdAt: string;
}

export function RecentActivity({ items }: { items: RecentActivityItem[] }): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-2">Actividad reciente</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Sin actividad reciente.</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <ActivityItem
              key={it.logId}
              actorEmail={it.actorEmail}
              action={it.action}
              targetId={it.targetId}
              createdAt={it.createdAt}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

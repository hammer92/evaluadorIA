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
    <section className="rounded-tv border border-border-standard bg-white shadow-tv-card">
      <header className="flex items-center justify-between border-b border-border-standard px-stack-lg py-stack-md">
        <div>
          <h2 className="font-hanken text-headline-md text-on-surface">Actividad reciente</h2>
          <p className="text-body-md text-on-surface-variant">
            Últimos eventos del sistema y auditoría.
          </p>
        </div>
        <span className="rounded-md bg-navy/5 px-2 py-0.5 text-label-sm text-navy">
          {items.length} {items.length === 1 ? 'evento' : 'eventos'}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-stack-lg py-stack-md text-body-md text-on-surface-variant">
          Sin actividad reciente.
        </p>
      ) : (
        <ul className="divide-y divide-border-standard">
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
    </section>
  );
}

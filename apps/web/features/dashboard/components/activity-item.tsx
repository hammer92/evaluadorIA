import type { AuditAction } from '@shared/schemas/audit-logs';

const ACTION_LABELS: Record<AuditAction, string> = {
  'user.created': 'creó el usuario',
  'user.updated': 'actualizó el usuario',
  'user.deleted': 'eliminó el usuario',
  'user.role_changed': 'cambió el rol del usuario',
  'user.suspended': 'suspendió al usuario',
  'organization.created': 'creó la organización',
  'organization.updated': 'actualizó la organización',
  'auth.login': 'inició sesión',
  'auth.failed_login': 'falló al iniciar sesión',
  'auth.role_escalation_blocked': 'bloqueó un intento de escalación de rol',
};

export interface ActivityItemProps {
  actorEmail: string;
  action: AuditAction;
  targetId: string | null;
  createdAt: string;
}

export function ActivityItem({
  actorEmail,
  action,
  targetId,
  createdAt,
}: ActivityItemProps): React.JSX.Element {
  const verb = ACTION_LABELS[action] ?? action;
  const date = new Date(createdAt);
  return (
    <li className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{actorEmail}</span>{' '}
          <span className="text-muted-foreground">{verb}</span>
          {targetId && (
            <>
              {' '}
              <code className="text-xs text-muted-foreground">{targetId.slice(0, 8)}…</code>
            </>
          )}
        </p>
      </div>
      <time className="shrink-0 text-xs text-muted-foreground" dateTime={date.toISOString()}>
        {date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
      </time>
    </li>
  );
}

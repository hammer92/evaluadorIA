import type { AuditAction } from '@shared/schemas/audit-logs';

import { cn } from '@/lib/utils';

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
  'auth.phone_login': 'inició sesión por teléfono',
  'auth.phone_otp_requested': 'solicitó código OTP por teléfono',
  'auth.phone_otp_failed': 'falló al verificar código OTP',
  'template.created': 'creó el template',
  'template.submitted': 'envió el template a revisión',
  'template.approved': 'aprobó el template',
  'template.rejected': 'rechazó el template',
  'template.changes_requested': 'solicitó cambios en el template',
  'template.resubmitted': 'reenvió el template a revisión',
  'template.reopened': 'reabrió el template como borrador',
  'template.deleted': 'archivó el template',
  'template.edited': 'editó el template',
  'template.expert_edited': 'ajustó parámetros técnicos del template',
};

const ACTION_TONE: Record<AuditAction, 'info' | 'success' | 'warning' | 'error' | 'neutral'> = {
  'user.created': 'success',
  'user.updated': 'info',
  'user.deleted': 'error',
  'user.role_changed': 'warning',
  'user.suspended': 'error',
  'organization.created': 'success',
  'organization.updated': 'info',
  'auth.login': 'neutral',
  'auth.failed_login': 'error',
  'auth.role_escalation_blocked': 'warning',
  'auth.phone_login': 'neutral',
  'auth.phone_otp_requested': 'info',
  'auth.phone_otp_failed': 'error',
  'template.created': 'success',
  'template.submitted': 'info',
  'template.approved': 'success',
  'template.rejected': 'error',
  'template.changes_requested': 'warning',
  'template.resubmitted': 'info',
  'template.reopened': 'info',
  'template.deleted': 'error',
  'template.edited': 'info',
  'template.expert_edited': 'info',
};

const TONE_DOT: Record<'info' | 'success' | 'warning' | 'error' | 'neutral', string> = {
  info: 'bg-status-info',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-status-error',
  neutral: 'bg-navy',
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
  const tone = ACTION_TONE[action] ?? 'neutral';
  const date = new Date(createdAt);
  return (
    <li className="flex items-start justify-between gap-3 px-stack-lg py-stack-md">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[tone])} />
        <div className="min-w-0">
          <p className="text-body-md text-on-surface">
            <span className="font-medium">{actorEmail}</span>{' '}
            <span className="text-on-surface-variant">{verb}</span>
            {targetId && (
              <>
                {' '}
                <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-jetbrains text-xs text-on-surface-variant">
                  {targetId.slice(0, 8)}…
                </code>
              </>
            )}
          </p>
        </div>
      </div>
      <time
        className="shrink-0 font-jetbrains text-xs text-outline-tv"
        dateTime={date.toISOString()}
      >
        {date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
      </time>
    </li>
  );
}

import type { UserStatus } from '@shared/schemas/users';

import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<UserStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Activo',
    className: 'bg-status-success/10 text-status-success ring-1 ring-inset ring-status-success/30',
    dot: 'bg-status-success',
  },
  invited: {
    label: 'Invitado',
    className: 'bg-status-warning/10 text-status-warning ring-1 ring-inset ring-status-warning/30',
    dot: 'bg-status-warning',
  },
  suspended: {
    label: 'Suspendido',
    className: 'bg-status-error/10 text-status-error ring-1 ring-inset ring-status-error/30',
    dot: 'bg-status-error',
  },
};

export function StatusBadge({ status }: { status: UserStatus }): React.JSX.Element {
  const { label, className, dot } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-label-sm',
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}

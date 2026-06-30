import type { UserStatus } from '@shared/schemas/users';

import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<UserStatus, { label: string; className: string }> = {
  active: {
    label: 'Activo',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  invited: {
    label: 'Invitado',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  suspended: {
    label: 'Suspendido',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

export function StatusBadge({ status }: { status: UserStatus }): React.JSX.Element {
  const { label, className } = STATUS_CONFIG[status];
  return <Badge className={className}>{label}</Badge>;
}

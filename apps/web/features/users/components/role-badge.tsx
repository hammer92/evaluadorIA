import type { Role } from '@shared/schemas/common';

import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  admin: {
    label: 'Admin',
    className: 'bg-navy text-white',
  },
  recruiter: {
    label: 'Recruiter',
    className: 'bg-status-info/10 text-status-info ring-1 ring-inset ring-status-info/30',
  },
  expert: {
    label: 'Expert',
    className: 'bg-surface-subtle text-on-surface-variant ring-1 ring-inset ring-border-standard',
  },
};

export function RoleBadge({ role }: { role: Role }): React.JSX.Element {
  const { label, className } = ROLE_CONFIG[role];
  return (
    <span
      className={cn('inline-flex items-center rounded-lg px-2 py-0.5 text-label-sm', className)}
    >
      {label}
    </span>
  );
}

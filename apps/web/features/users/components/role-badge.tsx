import type { Role } from '@shared/schemas/common';

import { Badge } from '@/components/ui/badge';

const ROLE_LABELS: Record<Role, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  admin: { label: 'Admin', variant: 'default' },
  recruiter: { label: 'Recruiter', variant: 'secondary' },
  expert: { label: 'Expert', variant: 'outline' },
};

export function RoleBadge({ role }: { role: Role }): React.JSX.Element {
  const { label, variant } = ROLE_LABELS[role];
  return <Badge variant={variant}>{label}</Badge>;
}

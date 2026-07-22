import type { Niche } from '@shared/schemas/templates';
import { NICHE_LABELS } from '@shared/schemas/templates';

import { cn } from '@/lib/utils';

const NICHE_CONFIG: Record<Niche, { className: string }> = {
  school: {
    className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  },
  university: {
    className: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
  },
  exam_practice: {
    className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  },
};

export function NicheBadge({ niche }: { niche: Niche }): React.JSX.Element {
  const { className } = NICHE_CONFIG[niche];
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-label-sm', className)}
    >
      {NICHE_LABELS[niche]}
    </span>
  );
}

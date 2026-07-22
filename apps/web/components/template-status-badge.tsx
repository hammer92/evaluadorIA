import type { TemplateStatus } from '@shared/schemas/templates';
import { STATUS_LABELS } from '@shared/schemas/templates';

import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<TemplateStatus, { className: string; dot: string }> = {
  draft: {
    className: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300',
    dot: 'bg-slate-500',
  },
  in_review: {
    className: 'bg-status-info/10 text-status-info ring-1 ring-inset ring-status-info/30',
    dot: 'bg-status-info',
  },
  changes_requested: {
    className: 'bg-status-warning/10 text-status-warning ring-1 ring-inset ring-status-warning/30',
    dot: 'bg-status-warning',
  },
  approved: {
    className: 'bg-status-success/10 text-status-success ring-1 ring-inset ring-status-success/30',
    dot: 'bg-status-success',
  },
  rejected: {
    className: 'bg-status-error/10 text-status-error ring-1 ring-inset ring-status-error/30',
    dot: 'bg-status-error',
  },
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }): React.JSX.Element {
  const { className, dot } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-label-sm',
        className,
      )}
      aria-label={`Estado: ${STATUS_LABELS[status]}`}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

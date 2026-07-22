'use client';

import { REVIEW_ACTION_LABELS } from '@shared/schemas/templates';

import { Skeleton } from '@/components/ui/skeleton';

export interface ReviewEventView {
  reviewId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  comment?: string;
  createdAt: string;
}

function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReviewHistoryList({
  events,
  loading,
}: {
  events: ReviewEventView[];
  loading?: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <div className="space-y-stack-sm">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-tv border border-border-standard bg-white p-stack-lg text-center shadow-tv-card">
        <h3 className="text-headline-sm font-semibold text-navy">Sin eventos</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Aún no hay eventos de revisión registrados para este template.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-stack-sm">
      {events.map((event) => {
        const actionLabel =
          REVIEW_ACTION_LABELS[event.action as keyof typeof REVIEW_ACTION_LABELS] ?? event.action;
        return (
          <li
            key={event.reviewId}
            className="rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-stack-sm">
              <div className="space-y-stack-xs">
                <p className="text-label-sm text-outline-tv">{actionLabel}</p>
                <p className="text-body-md text-on-surface">
                  <span className="font-medium">{event.actorName}</span>
                  <span className="text-on-surface-variant"> · {event.actorRole}</span>
                </p>
              </div>
              <time className="text-body-sm text-on-surface-variant">
                {formatDateTime(event.createdAt)}
              </time>
            </div>
            {event.comment && (
              <p className="mt-stack-sm border-l-2 border-outline pl-stack-sm text-body-md text-on-surface-variant">
                {event.comment}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

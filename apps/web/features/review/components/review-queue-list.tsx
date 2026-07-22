'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { ReviewQueueFiltersBar } from '@/features/review/components/review-queue-filters';
import { ReviewQueueTable } from '@/features/review/components/review-queue-table';
import { useReviewQueue } from '@/features/review/hooks/use-review-hooks';

export interface ReviewQueueListProps {
  search: string;
  niche: string;
}

export function ReviewQueueList({ search, niche }: ReviewQueueListProps): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { data, isLoading, isError, error } = useReviewQueue({
    search,
    niche,
    page: 1,
    pageSize: 100, // Sin paginación en este sprint; cola de revisión típicamente < 50 templates.
  });

  function applyFilters(next: { search: string; niche: string }): void {
    const params = new URLSearchParams();
    if (next.search.length > 0) params.set('search', next.search);
    if (next.niche !== 'all') params.set('niche', next.niche);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs.length > 0 ? `/admin/review?${qs}` : '/admin/review');
    });
  }

  if (isLoading || pending) {
    return (
      <div className="space-y-stack-md" aria-busy="true" aria-label="Cargando cola de revisión">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error"
      >
        Error al cargar la cola de revisión: {error?.message ?? 'desconocido'}
      </div>
    );
  }

  return (
    <div className="space-y-stack-md">
      <ReviewQueueFiltersBar initialSearch={search} initialNiche={niche} onApply={applyFilters} />
      <ReviewQueueTable templates={data?.items ?? []} />
    </div>
  );
}

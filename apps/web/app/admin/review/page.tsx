'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { ReviewQueueList } from '@/features/review/components/review-queue-list';

function ReviewPageContent() {
  const params = useSearchParams();
  const search = params.get('search') ?? '';
  const niche = params.get('niche') ?? 'all';

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">ADMINISTRACIÓN</p>
        <h1 className="font-hanken text-display-lg text-on-surface">Cola de revisión</h1>
        <p className="text-body-lg text-on-surface-variant">
          Templates enviados por recruiters que esperan tu aprobación.
        </p>
      </header>
      <ReviewQueueList search={search} niche={niche} />
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" aria-label="Cargando..." />}>
      <ReviewPageContent />
    </Suspense>
  );
}

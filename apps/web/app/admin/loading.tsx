import { Skeleton } from '@/components/ui/skeleton';

export default function Loading(): React.JSX.Element {
  return (
    <div className="space-y-stack-lg" aria-busy aria-live="polite">
      <div className="space-y-stack-sm">
        <Skeleton className="h-3 w-32 bg-surface-subtle" />
        <Skeleton className="h-9 w-48 bg-surface-subtle" />
        <Skeleton className="h-5 w-96 bg-surface-subtle" />
      </div>
      <div className="grid grid-cols-1 gap-stack-md sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-tv bg-surface-subtle" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-tv bg-surface-subtle" />
    </div>
  );
}

import { Skeleton } from '@/components/ui/skeleton';

export default function Loading(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-10 w-full" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

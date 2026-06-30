'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('[/admin/users]', error);
  }, [error]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Error cargando usuarios</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}

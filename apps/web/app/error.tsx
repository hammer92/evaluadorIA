'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4">
      <p className="text-6xl font-bold tracking-tight">500</p>
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-md">{error.message}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}

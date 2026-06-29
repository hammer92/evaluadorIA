'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Algo se rompió</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="underline">
        Reintentar
      </button>
    </div>
  );
}

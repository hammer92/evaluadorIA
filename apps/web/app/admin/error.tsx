'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('[admin error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-tv border border-status-error/30 bg-status-error/5 p-stack-lg text-center shadow-tv-card">
        <span className="mx-auto mb-stack-md flex h-12 w-12 items-center justify-center rounded-md bg-status-error/10 text-status-error">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="font-hanken text-headline-md text-on-surface">Algo salió mal</h1>
        <p className="mt-stack-sm text-body-md text-on-surface-variant">
          {error.message || 'Error inesperado al cargar la página.'}
        </p>
        {error.digest && (
          <p className="mt-stack-sm font-jetbrains text-xs text-outline-tv">
            digest: {error.digest}
          </p>
        )}
        <Button onClick={reset} className="mt-stack-md">
          Reintentar
        </Button>
      </div>
    </div>
  );
}

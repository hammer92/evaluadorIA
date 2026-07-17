'use client';

import * as React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional custom fallback renderer. Receives `error` + `resetErrorBoundary`
   * from `react-error-boundary`. If omitted, renders `ErrorBoundaryDefaultFallback`.
   */
  fallback?: (props: FallbackProps) => ReactNode;
}

function ErrorBoundaryDefaultFallback({
  error,
  resetErrorBoundary,
}: FallbackProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-stack-md rounded-lg border border-status-error/30 bg-status-error/5 p-stack-lg"
    >
      <h2 className="font-hanken text-headline-sm text-status-error">Algo salió mal</h2>
      <p className="max-w-prose text-center text-body-sm text-on-surface-variant">
        {error instanceof Error ? error.message : 'Error inesperado.'}
      </p>
      <Button variant="outline" onClick={resetErrorBoundary}>
        Reintentar
      </Button>
    </div>
  );
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps): React.JSX.Element {
  const handleError = (error: Error, info: ErrorInfo): void => {
    console.error('[ErrorBoundary]', error, info.componentStack);
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ?? ErrorBoundaryDefaultFallback}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
}

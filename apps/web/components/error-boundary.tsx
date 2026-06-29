'use client';

import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

/**
 * Stub de ErrorBoundary para Client Components.
 *
 * NOTA: En este proyecto, el boundary oficial para errores de Server
 * Components es la convención de App Router `apps/web/app/error.tsx`.
 * Este componente queda como placeholder para eventual integración
 * con `react-error-boundary` cuando se necesite captura local en un
 * Client Component específico (SDD-07+).
 */
export function ErrorBoundary({ children }: ErrorBoundaryProps): ReactNode {
  return children;
}

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { TemplateDetail } from '@/features/templates/components/template-detail';

// La ruta /admin/templates/detail?templateId=xxx reemplaza al dynamic
// segment /admin/templates/[id]. Necesario porque `output: 'export'` no
// soporta dynamic routes sin al menos un prerendered path (no es viable
// cuando los IDs se crean en runtime). El page usa searchParams para leer
// el templateId; la página se prerendera como shell estática y el contenido
// se hidrata client-side via TanStack Query.
function TemplateDetailContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');

  if (!templateId) {
    return (
      <div className="rounded-tv border border-border bg-surface-container-lowest p-12 text-center">
        <h3 className="text-headline-sm font-semibold text-navy">Template no especificado</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Volvé al listado y seleccioná un template para ver su detalle.
        </p>
      </div>
    );
  }

  return <TemplateDetail templateId={templateId} />;
}

export default function TemplateDetailPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="space-y-stack-md">
          <div className="h-8 w-1/3 animate-pulse rounded bg-surface-container-low" />
          <div className="h-32 w-full animate-pulse rounded bg-surface-container-low" />
        </div>
      }
    >
      <TemplateDetailContent />
    </Suspense>
  );
}

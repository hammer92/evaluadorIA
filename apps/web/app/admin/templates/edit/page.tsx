'use client';

import { Edit } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/features/auth/components/role-provider';
import { TemplateForm } from '@/features/templates/components/template-form';
import { useTemplate } from '@/features/templates/hooks/use-templates';

// =============================================================================
// /admin/templates/edit — pantalla completa para editar un template.
// =============================================================================
// Reemplaza al antiguo modal TemplateFormModal (edit mode). Lee el templateId
// desde searchParams (consistente con el patrón de output:'export' usado en
// /admin/templates/detail — no admite dynamic routes). Tras guardar navega
// al detalle; el botón Cancelar también vuelve al detalle.
// =============================================================================

function EditTemplateContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId') ?? undefined;
  const role = useRole();

  const { data: template, isLoading, isError, error } = useTemplate(templateId);

  if (!templateId) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-stack-md p-stack-lg">
          <h1 className="font-hanken text-headline-md text-on-surface">Template no especificado</h1>
          <p className="text-body-md text-on-surface-variant">
            Abrí la edición desde el detalle de un template.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/templates">Volver al listado</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-stack-lg">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !template) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-stack-md p-stack-lg">
          <h1 className="font-hanken text-headline-md text-status-error">
            No se pudo cargar el template
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {error?.message ?? 'Template no encontrado.'}
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/templates">Volver al listado</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canEdit =
    !template.deletedAt &&
    (role === 'admin' ||
      (role === 'recruiter' &&
        (template.status === 'draft' || template.status === 'changes_requested')));

  if (!canEdit) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-stack-md p-stack-lg">
          <h1 className="font-hanken text-headline-md text-on-surface">Edición no permitida</h1>
          <p className="text-body-md text-on-surface-variant">
            Este template no puede editarse en su estado actual ({template.status}) o tu rol no
            tiene permisos.
          </p>
          <Button asChild variant="outline">
            <Link href={`/admin/templates/detail?templateId=${template.templateId}`}>
              Volver al detalle
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">ADMINISTRACIÓN · TEMPLATES</p>
        <div className="flex items-center gap-stack-sm">
          <Edit className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-hanken text-display-lg text-on-surface">
            Editar template
          </h1>
        </div>
        <p className="text-body-lg text-on-surface-variant">
          Modificá los datos del template. Cambios permitidos solo en estado Borrador o Cambios
          solicitados.
        </p>
      </header>

      <TemplateForm
        mode="edit"
        template={template}
        submitLabel="Guardar cambios"
        onSuccess={() =>
          router.push(`/admin/templates/detail?templateId=${template.templateId}`)
        }
      />
    </div>
  );
}

export default function EditTemplatePage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="space-y-stack-lg">
          <div className="h-10 w-1/3 animate-pulse rounded bg-surface-container-low" />
          <div className="h-64 w-full animate-pulse rounded bg-surface-container-low" />
          <div className="h-64 w-full animate-pulse rounded bg-surface-container-low" />
        </div>
      }
    >
      <EditTemplateContent />
    </Suspense>
  );
}
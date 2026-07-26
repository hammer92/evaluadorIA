'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { TemplateForm } from '@/features/templates/components/template-form';

// =============================================================================
// /admin/templates/new — pantalla completa para crear un template.
// =============================================================================
// Reemplaza al antiguo modal TemplateFormModal (create mode). Tras crear el
// template navega al detalle del nuevo templateId; el create mutation expone
// el ID retornado por la CF v1TemplatesCreate vía cache update.
// =============================================================================

export default function NewTemplatePage(): React.JSX.Element {
  const router = useRouter();

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">ADMINISTRACIÓN · TEMPLATES</p>
        <div className="flex items-center gap-stack-sm">
          <Plus className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-hanken text-display-lg text-on-surface">Nuevo template</h1>
        </div>
        <p className="text-body-lg text-on-surface-variant">
          Definí el nombre, nicho y recetas de evaluación. El template arrancará en estado
          &quot;Borrador&quot;.
        </p>
      </header>

      <TemplateForm
        mode="create"
        submitLabel="Crear template"
        onSuccess={() => router.push('/admin/templates')}
      />
    </div>
  );
}
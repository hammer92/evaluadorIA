'use client';

import { Building2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// /admin/settings/organization — info de la organización actual.
// =============================================================================
// STUB: por ahora muestra placeholders. Cuando exista useOrganization() hook,
// este componente lo consumirá via TanStack Query para mostrar datos reales.
// =============================================================================

export default function OrganizationSettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">CONFIGURACIÓN · MI ORGANIZACIÓN</p>
        <h1 className="font-hanken text-display-lg text-on-surface">Mi organización</h1>
        <p className="text-body-lg text-on-surface-variant">
          Información sobre tu organización y plan actual.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-stack-md md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-stack-sm text-headline-sm">
              <Building2 className="h-5 w-5" />
              Datos de la organización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-stack-sm text-body-md">
            <div>
              <p className="text-label-sm text-outline-tv">Nombre</p>
              <p className="text-on-surface">—</p>
            </div>
            <div>
              <p className="text-label-sm text-outline-tv">Plan</p>
              <p className="text-on-surface">Free</p>
            </div>
            <div>
              <p className="text-label-sm text-outline-tv">Miembros</p>
              <p className="text-on-surface">—</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-headline-sm">Upgrade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-stack-sm text-body-md">
            <p className="text-on-surface-variant">
              El upgrade a Pro habilita nichos adicionales (programación), métricas avanzadas y
              soporte prioritario.
            </p>
            <p className="text-body-sm text-navy/60">(Próximamente — sprint v1.1)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

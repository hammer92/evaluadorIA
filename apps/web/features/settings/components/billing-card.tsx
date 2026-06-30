import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingCard(): React.JSX.Element {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-md bg-status-info/10 text-status-info"
          >
            <CreditCard className="h-5 w-5" />
          </span>
          Billing
        </CardTitle>
        <CardDescription>
          La facturación se gestiona fuera del producto en esta versión.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-stack-md">
        <div className="rounded-md border border-border-standard bg-surface-subtle p-stack-md">
          <p className="text-label-sm text-outline-tv">PLAN ACTUAL</p>
          <p className="mt-1 font-hanken text-headline-md text-navy">Pilot</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Acceso completo al entorno de evaluación durante la fase de pilot.
          </p>
        </div>
        <p className="text-body-md text-on-surface-variant">
          Para cambiar de plan contactá a tu account manager o escribinos a{' '}
          <span className="font-medium text-navy">billing@knowledgesync.local</span>.
        </p>
        <Button variant="outline" disabled>
          Actualizar plan (próximamente)
        </Button>
      </CardContent>
    </Card>
  );
}

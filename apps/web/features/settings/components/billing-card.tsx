import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingCard(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing
        </CardTitle>
        <CardDescription>
          La facturación se gestiona fuera del producto en esta versión.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Plan actual: <span className="font-medium text-foreground">Pilot</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Para cambiar plan, contactá a tu account manager o escribinos a
          <span className="text-foreground"> billing@knowledgesync.local</span>.
        </p>
        <Button variant="outline" disabled>
          Actualizar plan (próximamente)
        </Button>
      </CardContent>
    </Card>
  );
}

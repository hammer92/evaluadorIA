import { Compass } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-neutral px-container-padding">
      <div className="max-w-md rounded-tv border border-border-standard bg-white p-stack-lg text-center shadow-tv-card">
        <span className="mx-auto mb-stack-md flex h-12 w-12 items-center justify-center rounded-md bg-navy/10 text-navy">
          <Compass className="h-6 w-6" />
        </span>
        <p className="font-jetbrains text-5xl font-bold text-navy">404</p>
        <h1 className="mt-stack-md font-hanken text-headline-md text-on-surface">
          Página no encontrada
        </h1>
        <p className="mt-stack-sm text-body-md text-on-surface-variant">
          La ruta solicitada no existe o fue movida. Volvé al dashboard para continuar.
        </p>
        <Button asChild className="mt-stack-md">
          <Link href="/admin">Volver al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

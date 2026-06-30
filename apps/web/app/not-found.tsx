import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4">
      <p className="text-6xl font-bold tracking-tight">404</p>
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-muted-foreground max-w-md">
        La ruta solicitada no existe o fue movida. Volvé al dashboard para continuar.
      </p>
      <Button asChild>
        <Link href="/admin">Volver al dashboard</Link>
      </Button>
    </div>
  );
}

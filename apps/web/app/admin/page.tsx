import { verifyAuth } from '@/services/auth-service';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await verifyAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Bienvenido, <span className="font-medium text-foreground">{auth?.email}</span> ({auth?.role}
        )
      </p>
      <p className="mt-4 text-sm text-muted-foreground">Contenido real del dashboard en SDD-07.</p>
    </div>
  );
}

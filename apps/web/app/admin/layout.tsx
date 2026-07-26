'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { RoleProvider } from '@/features/auth/components/role-provider';
import { useAuth } from '@/features/auth/hooks/use-auth';

// =============================================================================
// Admin layout — client-side auth guard para /admin/**.
// =============================================================================
// Arquitectura estática (output: 'export'): no hay server runtime, no hay
// middleware de Next.js, no hay session cookie. La auth pasa por Firebase
// Auth client SDK y los custom claims (role, organizationId) del ID token.
//
// Flow:
//   1. useAuth() suscribe a onAuthStateChanged.
//   2. Si loading → muestra skeleton (evita flash de redirect).
//   3. Si no hay user o claims inválidos → redirect a /login?next=/admin.
//   4. Si hay user con role válido → renderiza con RoleProvider.
//
// `robots: noindex,nofollow` se setea en <Head> via <Metadata> en layout
// separado (no es posible en client component); ver <head> abajo.
// =============================================================================

export default function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Caso 1: loading terminó y no hay user → no autenticado.
    if (!auth.loading && !auth.user) {
      router.replace('/login?next=/admin');
      return;
    }
    // Caso 2: user autenticado PERO los claims fallaron (auth.error) y no
    // tenemos claims → permisos inválidos. Solo redirigimos si HAY un error
    // (no si los claims aún están cargando — eso es el estado normal después
    // de signIn).
    if (!auth.loading && auth.user && !auth.claims && auth.error) {
      router.replace('/login?next=/admin&error=no-claims');
    }
  }, [auth.loading, auth.user, auth.claims, auth.error, router]);

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!auth.user) {
    return null;
  }

  if (!auth.claims) {
    // User autenticado pero sin claims. Distinguimos dos casos:
    // 1. Claims aún cargando (sin error) → mostrar spinner.
    // 2. Claims fallaron (con error) → mostrar mensaje. El useEffect redirige.
    if (auth.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-neutral">
          <div className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error">
            <p className="font-medium">Tu cuenta no tiene permisos asignados.</p>
            <p className="mt-1 text-on-surface-variant">Contactá al administrador para que asigne un rol a tu cuenta.</p>
          </div>
        </div>
      );
    }
    // Claims cargando — mantener el spinner.
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <RoleProvider role={auth.claims.role}>
      <div className="flex min-h-screen bg-surface-neutral">
        <Sidebar role={auth.claims.role} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header email={auth.user.email ?? ''} role={auth.claims.role} />
          <main className="flex-1 px-container-padding py-stack-lg overflow-x-auto">
            <div className="mx-auto w-full max-w-7xl space-y-stack-lg">{children}</div>
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}

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
    if (!auth.loading && !auth.user) {
      router.replace('/login?next=/admin');
    }
  }, [auth.loading, auth.user, router]);

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!auth.user || !auth.claims) {
    return null;
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

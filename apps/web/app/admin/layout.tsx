import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { verifyAuth } from '@/services/auth-service';

// =============================================================================
// Admin layout — server-side verifyAuth() + render con Header/Sidebar.
// =============================================================================
// `verifyAuth()` valida la cookie `__session` (HS256). Si es inválida o no
// existe, redirect a /login. Esto se ejecuta en CADA navegación a /admin/**,
// por eso `dynamic = 'force-dynamic'` (evita que Next.js cachee la RSC).
//
// `robots: noindex,nofollow` indica a crawlers (Googlebot, Lighthouse SEO
// audit, etc.) que esta zona es solo para usuarios autenticados. Cumple
// GAP-07-A del SDD-07.
// =============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin · Plataforma',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAuth();
  if (!auth) {
    redirect('/login?next=/admin');
  }
  return (
    <div className="flex min-h-screen bg-surface-neutral">
      <Sidebar role={auth.role} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header email={auth.email} role={auth.role} />
        <main className="flex-1 px-container-padding py-stack-lg overflow-x-auto">
          <div className="mx-auto w-full max-w-7xl space-y-stack-lg">{children}</div>
        </main>
      </div>
    </div>
  );
}

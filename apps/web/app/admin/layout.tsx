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
// =============================================================================

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAuth();
  if (!auth) {
    redirect('/login?next=/admin');
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar role={auth.role} />
      <div className="flex flex-1 flex-col">
        <Header email={auth.email} role={auth.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

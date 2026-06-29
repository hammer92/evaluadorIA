// =============================================================================
// (auth) layout — layout mínimo para /login y /signup.
// =============================================================================
// Centra el contenido verticalmente. No tiene header/sidebar (son páginas
// públicas donde el user aún no está logueado).
// =============================================================================

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</div>
  );
}

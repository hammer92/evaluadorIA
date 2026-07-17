'use client';

import type { Role } from '@shared/schemas/common';
import { createContext, useContext, type ReactNode } from 'react';

// =============================================================================
// RoleProvider — expone el rol del usuario actual al client tree de /admin/**.
// =============================================================================
// Source of truth: cookie `__session` (validada server-side en el layout via
// `verifyAuth()`). Esto evita depender de los custom claims del Firebase
// Auth client, que pueden estar desincronizados con la cookie (e.g., si el
// usuario hizo logout en otra tab, o si el idToken cacheado no refleja los
// claims más recientes seteados por Admin SDK en una CF).
//
// Mismo `role` que se pasa a `<Header>` y `<Sidebar>`. Garantiza que la UI
// del admin (acciones de crear/editar/eliminar usuarios) coincida con lo
// que ve el usuario en el header.
// =============================================================================

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}): React.JSX.Element {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role | null {
  return useContext(RoleContext);
}

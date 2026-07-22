'use client';

import type { Role } from '@shared/schemas/common';
import type { ReactNode } from 'react';

import { useRole } from '@/features/auth/components/role-provider';

// =============================================================================
// RoleGuard — renderiza children solo si el role del usuario está en `roles`.
// =============================================================================
// Uso client-side para ocultar UI (botones, secciones) que el user no debe ver.
// IMPORTANTE: esto NO es un security boundary — el server-side enforcement es
// la fuente de verdad (ver CFs en apps/functions/src/v1/**). RoleGuard solo
// mejora la UX (no muestra acciones que darían 403 al ejecutar).
// =============================================================================

export interface RoleGuardProps {
  /** Roles permitidos para ver los children. */
  roles: readonly Role[];
  /** Contenido a renderizar si el role está permitido. */
  children: ReactNode;
  /** Fallback opcional si el role NO está permitido. Default: null. */
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps): React.JSX.Element {
  const currentRole = useRole();
  const allowed = currentRole !== null && roles.includes(currentRole);
  return <>{allowed ? children : fallback}</>;
}

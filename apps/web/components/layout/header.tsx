import type { Role } from '@shared/schemas/common';

import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

// =============================================================================
// Header — server component, recibe email + role del user logueado.
// =============================================================================
export function Header({ email, role }: { email: string; role: Role }) {
  return (
    <header className="flex h-14 items-center justify-between px-6 border-b bg-background">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {role}
        </span>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

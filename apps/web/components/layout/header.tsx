import type { Role } from '@shared/schemas/common';

import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Header({ email, role }: { email: string; role: Role }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border-standard bg-white px-container-padding">
      <div className="flex flex-1 items-center gap-3">
        <span className="text-label-sm text-outline-tv">{role.toUpperCase()}</span>
        <span className="h-4 w-px bg-border-standard" aria-hidden />
        <span className="text-body-md text-on-surface-variant">{email}</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

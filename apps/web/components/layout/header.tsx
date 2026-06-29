'use client';

import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between px-6 border-b bg-background">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

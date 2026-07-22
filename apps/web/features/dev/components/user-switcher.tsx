'use client';

import { ChevronsUpDown, UserCircle2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface DevUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

export interface UserSwitcherProps {
  currentUserEmail: string;
  users: DevUser[];
  onSwitch: (uid: string) => void;
}

// =============================================================================
// UserSwitcher (DEV ONLY) — floating panel que permite cambiar de usuario
// durante el desarrollo local. NO se incluye en el bundle de producción.
// =============================================================================
// Uso: <UserSwitcher currentUserEmail={...} users={...} onSwitch={fn} />
// El padre debe controlar el render condicional con `process.env.NODE_ENV ===
// 'development'` o equivalente (ej: en /admin/layout.tsx render condicional).
// =============================================================================

export function UserSwitcher({
  currentUserEmail,
  users,
  onSwitch,
}: UserSwitcherProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="region"
      aria-label="User switcher dev only"
      data-testid="user-switcher"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-stack-sm rounded-md border-2 border-status-warning bg-status-warning/10 px-3 py-2 shadow-tv-card"
    >
      <span className="rounded bg-status-warning px-1.5 py-0.5 text-label-sm font-bold text-white">
        DEV ONLY
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-stack-sm">
            <UserCircle2 className="h-4 w-4" />
            <span className="max-w-[180px] truncate text-body-sm">{currentUserEmail}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Cambiar de usuario (dev)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {users.length === 0 ? (
            <div className="p-stack-sm text-body-sm text-navy/60">
              No hay otros usuarios en la organización.
            </div>
          ) : (
            users.map((u) => (
              <DropdownMenuItem
                key={u.uid}
                onClick={() => {
                  setOpen(false);
                  onSwitch(u.uid);
                }}
                className="flex flex-col items-start gap-0.5"
                data-testid={`switch-to-${u.uid}`}
              >
                <span className="text-body-sm font-medium">{u.displayName || u.email}</span>
                <span className="text-label-sm text-navy/60">
                  {u.email} · {u.role}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
